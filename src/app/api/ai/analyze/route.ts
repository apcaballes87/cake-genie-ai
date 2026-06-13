import { NextRequest, NextResponse } from 'next/server';
import { getAI, getOrCreatePromptCache } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { buildSearchAnalysisGenerationConfig, postProcessSearchAnalysisResult } from '@/lib/admin/searchAnalysisContract';
import { getActivePromptDetails } from '@/services/prompts/promptLoader';
import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { logRejectedUpload } from '@/lib/ai/rejectedUploads';
import { getDynamicTypeEnums } from '@/lib/ai/utils';

export const maxDuration = 150; // Internal timeout aborts well before this; keep some headroom for cleanup.

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: CORS_HEADERS,
    });
}

// Fail fast on slow AI calls so we can return a clean 504 well before Vercel kills the function.
// The analyze prompt is heavy; most successful calls complete in <90s.
const AI_REQUEST_TIMEOUT_MS = 120_000;
const ANALYSIS_MODEL = "gemini-3.1-flash-lite-preview";
const ANALYSIS_CONFIG_CACHE_TTL_MS = 5 * 60_000;
const PROMPT_CACHE_NAME_TTL_MS = 30 * 60_000;

type PromptDetails = Awaited<ReturnType<typeof getActivePromptDetails>>;
type TypeEnums = Awaited<ReturnType<typeof getDynamicTypeEnums>>;

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
    aiClient: InstanceType<typeof import('@/lib/ai/client').GoogleGenAI>,
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
        SYSTEM_INSTRUCTION
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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageData, mimeType, sourceContext } = body;

        if (!imageData || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: imageData and mimeType' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const supabase = createClient();

        // Fetch inputs required for prompt construction
        const [promptDetails, typeEnums] = await Promise.all([
            getCachedPromptDetails(supabase).catch(() => null),
            getCachedTypeEnums(supabase)
        ]);

        if (!promptDetails) {
            return NextResponse.json(
                { error: 'Failed to load analysis prompt configuration' },
                { status: 500, headers: CORS_HEADERS }
            );
        }

        const aiClient = getAI(req);
        const baseConfig = buildSearchAnalysisGenerationConfig(typeEnums);

        let response;
        let cacheName: string | null = null;

        // Try to get or create an active context cache for Vertex AI
        try {
            cacheName = await getCachedPromptCacheName(aiClient, promptDetails);
        } catch (cacheErr) {
            console.warn('[AI Cache] Failed to create or retrieve context cache:', cacheErr);
        }

        if (cacheName) {
            // Remove systemInstruction from generation config because it is already stored inside the cached content
            const cachedConfig = { ...baseConfig };
            delete (cachedConfig as { systemInstruction?: unknown }).systemInstruction;

            try {
                response = await aiClient.models.generateContent({
                    model: ANALYSIS_MODEL,
                    contents: [{
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType, data: imageData } }
                        ],
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
                            { text: promptDetails.promptText }
                        ],
                    }],
                    config: {
                        ...baseConfig,
                        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                    },
                });
            }
        } else {
            // Fallback to uncached generation if cache lookup fails
            response = await aiClient.models.generateContent({
                model: ANALYSIS_MODEL,
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageData } },
                        { text: promptDetails.promptText }
                    ],
                }],
                config: {
                    ...baseConfig,
                    abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                },
            });
        }

        const jsonText = (response.text || '').trim();
        let result;
        try {
            result = JSON.parse(jsonText);

            result = postProcessSearchAnalysisResult(result);

        } catch {
            console.error("Failed to parse AI response:", jsonText);
            return NextResponse.json(
                { error: 'Invalid response format from AI' },
                { status: 500, headers: CORS_HEADERS }
            );
        }

        const rejection = result?.rejection as { isRejected?: boolean; reason?: string; message?: string } | undefined;
        if (rejection?.isRejected) {
            await logRejectedUpload({
                imageData,
                mimeType,
                rejection,
                modelName: ANALYSIS_MODEL,
                promptVersion: promptDetails.version,
                sourceRoute: 'api/ai/analyze',
                sourceContext: typeof sourceContext === 'string' ? sourceContext : null,
                request: req,
            });
        }

        return NextResponse.json(result, { headers: CORS_HEADERS });

    } catch (error) {
        console.error("Error analyzing cake image:", error);

        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to analyze image',
            quotaMessage: 'AI cake analysis is temporarily unavailable due to quota limits. Please try again later.',
            authorizationMessage: 'AI cake analysis is not authorized. Please check the Vertex AI and Workload Identity configuration, then confirm project access.',
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status, headers: CORS_HEADERS }
        );
    }
}
