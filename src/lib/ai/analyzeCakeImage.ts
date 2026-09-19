import { resolveAnalysisGenerationSeoSchema } from '@/lib/ai/generatedAnalysisContract';
import { getAI, getOrCreatePromptCache } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/client';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import {
    buildSearchAnalysisGenerationConfig,
    getAnalysisGenerationSizeSchema,
    postProcessSearchAnalysisResult,
} from '@/lib/admin/searchAnalysisContract';
import { getActivePromptDetails, getPromptDetailsByVersion } from '@/services/prompts/promptLoader';
import { logRejectedUpload } from '@/lib/ai/rejectedUploads';
import { getDynamicTypeEnums } from '@/lib/ai/utils';
import {
    type GeneratedCakeAnalysisResult,
} from '@/lib/ai/generatedAnalysisContract';
import {
    AI_THREE_BAND_SIZE_SCHEMA,
    ANALYSIS_SIZE_SCHEMA,
    INTEGRATED_BBOX_ANALYSIS_SIZE_SCHEMA,
    LINE_RATIO_ANALYSIS_SIZE_SCHEMA,
} from '@/lib/ai/analysisSize';
import type { AnalysisGenerationSizeSchema } from '@/lib/admin/searchAnalysisContract';
import { ThinkingLevel } from '@google/genai';
import { logCakeAnalysisDebug } from '@/lib/ai/analysisDebug';

export const ANALYSIS_MODEL = 'gemini-3.5-flash-lite';
export const CAKE_ANALYSIS_LAB_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
] as const;
export type CakeAnalysisModel = (typeof CAKE_ANALYSIS_LAB_MODELS)[number];
export type CakeAnalysisThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
export const AI_REQUEST_TIMEOUT_MS = 120_000;

const THINKING_LEVELS: Record<CakeAnalysisThinkingLevel, ThinkingLevel> = {
    MINIMAL: ThinkingLevel.MINIMAL,
    LOW: ThinkingLevel.LOW,
    MEDIUM: ThinkingLevel.MEDIUM,
    HIGH: ThinkingLevel.HIGH,
};

/** Includes provider text for internal diagnostic consumers without changing public route errors. */
export class CakeAnalysisResponseError extends Error {
    rawResponse: string;

    constructor(message: string, rawResponse: string, cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'CakeAnalysisResponseError';
        this.rawResponse = rawResponse;
    }
}

const ANALYSIS_CONFIG_CACHE_TTL_MS = 5 * 60_000;
const PROMPT_CACHE_NAME_TTL_MS = 30 * 60_000;

type PromptDetails = Awaited<ReturnType<typeof getActivePromptDetails>>;
type TypeEnums = Awaited<ReturnType<typeof getDynamicTypeEnums>>;

type AIRequestContext = {
    headers?: {
        get(name: string): string | null | undefined;
    };
} | null | undefined;

export type RunCakeAnalysisInput = {
    imageData: string;
    mimeType: string;
    requestContext?: AIRequestContext;
    sourceContext?: string | null;
    sourceRoute?: string;
    persistRejectedUpload?: boolean;
    promptVersion?: string;
    /** Lab-only in-memory override. Never eligible for a Gemini prompt cache. */
    promptText?: string;
    model?: CakeAnalysisModel;
    thinkingLevel?: CakeAnalysisThinkingLevel;
    temperature?: number;
    topP?: number;
    topK?: number;
    sizeSchema?: AnalysisGenerationSizeSchema;
    usePromptCache?: boolean;
};

export type RunCakeAnalysisResult = {
    result: GeneratedCakeAnalysisResult & {
        analysis_size_schema:
            typeof ANALYSIS_SIZE_SCHEMA
            | typeof LINE_RATIO_ANALYSIS_SIZE_SCHEMA
            | typeof AI_THREE_BAND_SIZE_SCHEMA
            | typeof INTEGRATED_BBOX_ANALYSIS_SIZE_SCHEMA;
    };
    promptVersion: string;
    rawResponse: string;
    sizeSchema: AnalysisGenerationSizeSchema;
    effectiveSettings: {
        model: CakeAnalysisModel;
        thinkingLevel: CakeAnalysisThinkingLevel;
        temperature: number;
        topP: number;
        topK: number;
        usedPromptCache: boolean;
    };
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
    aiClient: Awaited<ReturnType<typeof getAI>>,
    promptDetails: PromptDetails,
    systemInstruction: string,
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
        systemInstruction,
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
    promptVersion,
    promptText,
    model = ANALYSIS_MODEL as CakeAnalysisModel,
    thinkingLevel = 'LOW',
    temperature,
    topP,
    topK,
    sizeSchema: requestedSizeSchema,
    usePromptCache = true,
}: RunCakeAnalysisInput): Promise<RunCakeAnalysisResult> {
    const supabase = createClient();
    // Explicit versions are supplied only by trusted server-side flows (admin
    // comparisons, selected reruns, or the local development selector). They
    // may be staged/inactive and therefore unavailable through the public RLS
    // reader used for ordinary active-prompt inference.
    const promptReader = promptText === undefined && promptVersion
        ? createAdminServerSupabaseClient()
        : supabase;
    const [promptDetails, typeEnums] = await Promise.all([
        promptText === undefined && promptVersion
            ? getPromptDetailsByVersion(promptReader as unknown as Parameters<typeof getPromptDetailsByVersion>[0], promptVersion)
            : promptText === undefined
                ? getCachedPromptDetails(supabase)
                : Promise.resolve({ promptText, version: promptVersion ?? 'lab-custom' }),
        getCachedTypeEnums(supabase),
    ]);

    if (!promptDetails) {
        throw new Error(`AI prompt version ${promptVersion} was not found.`);
    }

    const aiClient = await getAI(requestContext);
    const sizeSchema = requestedSizeSchema ?? getAnalysisGenerationSizeSchema(promptDetails.version);
    const seoSchema = resolveAnalysisGenerationSeoSchema(promptDetails.promptText);
    logCakeAnalysisDebug('Gemini request starting', {
        promptVersion: promptDetails.version,
        sizeSchema,
        seoSchema,
        model,
        thinkingLevel,
        mimeType,
        imageByteLength: imageData.length,
        sourceRoute,
        sourceContext: sourceContext ?? null,
    });
    const baseConfig = {
        ...buildSearchAnalysisGenerationConfig(typeEnums, sizeSchema, seoSchema),
        ...(temperature === undefined ? {} : { temperature }),
        ...(topP === undefined ? {} : { topP }),
        ...(topK === undefined ? {} : { topK }),
        // LOW is the only currently supported lab level. Keep the production default.
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[thinkingLevel] },
    };
    let response;
    let cacheName: string | null = null;

    if (usePromptCache && promptText === undefined) {
        try {
            cacheName = await getCachedPromptCacheName(
                aiClient,
                promptDetails,
                baseConfig.systemInstruction,
            );
        } catch (cacheError) {
            console.warn('[AI Cache] Failed to create or retrieve context cache:', cacheError);
        }
    }

    if (cacheName) {
        const cachedConfig = { ...baseConfig };
        delete (cachedConfig as { systemInstruction?: unknown }).systemInstruction;

        try {
            response = await aiClient.models.generateContent({
                model,
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
                model,
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
            model,
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
    logCakeAnalysisDebug('Gemini raw response received', {
        promptVersion: promptDetails.version,
        sizeSchema,
        usedPromptCache: Boolean(cacheName),
        rawResponse: jsonText,
    });
    let result: GeneratedCakeAnalysisResult;
    try {
        result = postProcessSearchAnalysisResult(JSON.parse(jsonText), typeEnums, sizeSchema, seoSchema);
    } catch (error) {
        console.error('Failed to parse AI response:', jsonText);
        throw new CakeAnalysisResponseError('Invalid response format from AI', jsonText, error);
    }

    const rejection = result.rejection as {
        isRejected?: boolean;
        reason?: string;
        message?: string;
    } | undefined;

    logCakeAnalysisDebug('Validated analysis and application-owned sizing complete', {
        promptVersion: promptDetails.version,
        sizeSchema,
        rejected: rejection?.isRejected === true,
        analysis: result,
        geometry: result.geometry ?? null,
    });

    if (rejection?.isRejected && persistRejectedUpload) {
        await logRejectedUpload({
            imageData,
            mimeType,
            rejection,
            modelName: model,
            promptVersion: promptDetails.version,
            sourceRoute,
            sourceContext: sourceContext ?? null,
            request: requestContext as Request | undefined,
        });
    }

    return {
        result: {
            ...result,
            analysis_size_schema: sizeSchema === 'local_line_ratio'
                ? LINE_RATIO_ANALYSIS_SIZE_SCHEMA
                : sizeSchema === 'local_bbox_area'
                    ? ANALYSIS_SIZE_SCHEMA
                    : sizeSchema === 'integrated_bbox_v1'
                        ? INTEGRATED_BBOX_ANALYSIS_SIZE_SCHEMA
                    : AI_THREE_BAND_SIZE_SCHEMA,
        },
        promptVersion: promptDetails.version,
        rawResponse: jsonText,
        sizeSchema,
        effectiveSettings: {
            model,
            thinkingLevel,
            temperature: baseConfig.temperature,
            topP: baseConfig.topP,
            topK: baseConfig.topK,
            usedPromptCache: Boolean(cacheName),
        },
    };
}
