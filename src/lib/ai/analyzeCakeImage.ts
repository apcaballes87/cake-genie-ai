import { getAI, getOrCreatePromptCache } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/client';
import { buildSearchAnalysisGenerationConfig, postProcessSearchAnalysisResult } from '@/lib/admin/searchAnalysisContract';
import { getActivePromptDetails } from '@/services/prompts/promptLoader';
import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { logRejectedUpload } from '@/lib/ai/rejectedUploads';
import { getDynamicTypeEnums } from '@/lib/ai/utils';
import {
    GeneratedAnalysisContractError,
    type GeneratedCakeAnalysisResult,
} from '@/lib/ai/generatedAnalysisContract';

export const ANALYSIS_MODEL = 'gemini-3.5-flash-lite';
export const AI_REQUEST_TIMEOUT_MS = 120_000;

const ANALYSIS_CONFIG_CACHE_TTL_MS = 5 * 60_000;
const PROMPT_CACHE_NAME_TTL_MS = 30 * 60_000;

type PromptDetails = Awaited<ReturnType<typeof getActivePromptDetails>>;
type TypeEnums = Awaited<ReturnType<typeof getDynamicTypeEnums>>;

type AIRequestContext = {
    headers?: {
        get(name: string): string | null | undefined;
    };
} | null | undefined;

type RunCakeAnalysisInput = {
    imageData: string;
    mimeType: string;
    requestContext?: AIRequestContext;
    sourceContext?: string | null;
    sourceRoute?: string;
    persistRejectedUpload?: boolean;
};

type RunCakeAnalysisResult = {
    result: GeneratedCakeAnalysisResult;
    promptVersion: string;
};

let cachedPromptDetails: { value: PromptDetails; expiresAt: number } | null = null;
let cachedTypeEnums: { value: TypeEnums; expiresAt: number } | null = null;
let cachedPromptCacheByVersion: { version: string; cacheName: string | null; expiresAt: number } | null = null;

async function getCachedPromptDetails(supabase: ReturnType<typeof createClient>): Promise<PromptDetails> {
    const now = Date.now();
    if (cachedPromptDetails && cachedPromptDetails.expiresAt > now) {
        return cachedPromptDetails.value;
    }

    const value = await getActivePromptDetails(supabase as unknown as Parameters<typeof getActivePromptDetails>[0]);
    cachedPromptDetails = { value, expiresAt: now + ANALYSIS_CONFIG_CACHE_TTL_MS };
    return value;
}

async function getCachedTypeEnums(supabase: ReturnType<typeof createClient>): Promise<TypeEnums> {
    const now = Date.now();
    if (cachedTypeEnums && cachedTypeEnums.expiresAt > now) {
        return cachedTypeEnums.value;
    }

    const value = await getDynamicTypeEnums(supabase);
    cachedTypeEnums = { value, expiresAt: now + ANALYSIS_CONFIG_CACHE_TTL_MS };
    return value;
}

async function getCachedPromptCacheName(
    aiClient: ReturnType<typeof getAI>,
    promptDetails: PromptDetails,
) {
    const now = Date.now();
    if (
        cachedPromptCacheByVersion &&
        cachedPromptCacheByVersion.version === promptDetails.version &&
        cachedPromptCacheByVersion.expiresAt > now
    ) {
        return cachedPromptCacheByVersion.cacheName;
    }

    const cacheName = await getOrCreatePromptCache(
        aiClient,
        promptDetails.promptText,
        promptDetails.version,
        SYSTEM_INSTRUCTION,
    );

    cachedPromptCacheByVersion = {
        version: promptDetails.version,
        cacheName,
        expiresAt: now + PROMPT_CACHE_NAME_TTL_MS,
    };

    return cacheName;
}

function clearCachedPromptCacheName(version: string) {
    if (cachedPromptCacheByVersion?.version === version) {
        cachedPromptCacheByVersion = null;
    }
}

export async function runActiveCakeAnalysis({
    imageData,
    mimeType,
    requestContext,
    sourceContext,
    sourceRoute = 'api/ai/analyze',
    persistRejectedUpload = true,
}: RunCakeAnalysisInput): Promise<RunCakeAnalysisResult> {
    const supabase = createClient();
    const [promptDetails, typeEnums] = await Promise.all([
        getCachedPromptDetails(supabase),
        getCachedTypeEnums(supabase),
    ]);

    const aiClient = getAI(requestContext);
    const baseConfig = buildSearchAnalysisGenerationConfig(typeEnums);
    let response;
    let cacheName: string | null = null;

    try {
        cacheName = await getCachedPromptCacheName(aiClient, promptDetails);
    } catch (cacheError) {
        console.warn('[AI Cache] Failed to create or retrieve context cache:', cacheError);
    }

    if (cacheName) {
        const cachedConfig = { ...baseConfig };
        delete (cachedConfig as { systemInstruction?: unknown }).systemInstruction;

        try {
            response = await aiClient.models.generateContent({
                model: ANALYSIS_MODEL,
                contents: [{
                    role: 'user',
                    parts: [{ inlineData: { mimeType, data: imageData } }],
                }],
                config: {
                    ...cachedConfig,
                    cachedContent: cacheName,
                    abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                },
            });
        } catch (cachedGenerationError) {
            clearCachedPromptCacheName(promptDetails.version);
            console.warn('[AI Cache] Cached analysis generation failed. Retrying without cached content:', cachedGenerationError);
            response = await aiClient.models.generateContent({
                model: ANALYSIS_MODEL,
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageData } },
                        { text: promptDetails.promptText },
                    ],
                }],
                config: {
                    ...baseConfig,
                    abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                },
            });
        }
    } else {
        response = await aiClient.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: imageData } },
                    { text: promptDetails.promptText },
                ],
            }],
            config: {
                ...baseConfig,
                abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
            },
        });
    }

    const jsonText = (response.text || '').trim();
    let result: GeneratedCakeAnalysisResult;
    try {
        result = postProcessSearchAnalysisResult(JSON.parse(jsonText), typeEnums);
    } catch (error) {
        console.error('Failed to parse AI response:', jsonText);
        if (error instanceof GeneratedAnalysisContractError) throw error;
        throw new Error('Invalid response format from AI');
    }

    const rejection = result.rejection as {
        isRejected?: boolean;
        reason?: string;
        message?: string;
    } | undefined;

    if (rejection?.isRejected && persistRejectedUpload) {
        await logRejectedUpload({
            imageData,
            mimeType,
            rejection,
            modelName: ANALYSIS_MODEL,
            promptVersion: promptDetails.version,
            sourceRoute,
            sourceContext: sourceContext ?? null,
            request: requestContext as Request | undefined,
        });
    }

    return { result, promptVersion: promptDetails.version };
}
