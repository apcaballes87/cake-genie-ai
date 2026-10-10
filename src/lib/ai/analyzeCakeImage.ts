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
    INTEGRATED_BBOX_V2_ANALYSIS_SIZE_SCHEMA,
    LINE_RATIO_ANALYSIS_SIZE_SCHEMA,
} from '@/lib/ai/analysisSize';
import type { AnalysisGenerationSizeSchema } from '@/lib/admin/searchAnalysisContract';
import { ThinkingLevel, Type } from '@google/genai';
import { logCakeAnalysisDebug } from '@/lib/ai/analysisDebug';
import { generateClaudeJson } from '@/lib/ai/claudeClient';
import { getCakeAnalysisProviderSettings, type CakeAnalysisProvider } from '@/lib/ai/providerSettings';
import {
    getIntegratedBboxRepairCandidates,
    mergeIntegratedBboxRepairResponse,
} from '@/lib/ai/integratedBboxAnalysis';

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
    status = 502;

    constructor(message: string, rawResponse: string, cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'CakeAnalysisResponseError';
        this.rawResponse = rawResponse;
    }
}

function contractFailureMessage(error: unknown): string {
    if (error instanceof Error) {
        const cause = (error as Error & { cause?: unknown }).cause;
        if (cause instanceof Error && cause.message) return cause.message;
    }
    return 'The previous response did not satisfy the required JSON contract.';
}

function isCakeHeightLineContractError(error: unknown): boolean {
    let current: unknown = error;
    while (current && typeof current === 'object') {
        if (current instanceof Error && current.message.includes('geometry.cake_height_line')) return true;
        current = (current as { cause?: unknown }).cause;
    }
    return false;
}

/**
 * Gemini's response schema can require the line fields but cannot express the
 * geometric relationship between their coordinates. Give its single bounded
 * replacement attempt the exact violated invariant instead of a generic JSON
 * reminder. We deliberately do not repair a bad measurement locally: it is
 * used to calculate prices, so only a newly observed, validated line is safe.
 */
export function buildCakeAnalysisContractRepairInstruction(
    error: unknown,
    sizeSchema: AnalysisGenerationSizeSchema,
): string {
    const failure = contractFailureMessage(error);
    const integratedGeometryReminder = sizeSchema === 'integrated_bbox_v1'
        || sizeSchema === 'integrated_bbox_v2'
        || sizeSchema === 'integrated_bbox_v2_tolerant'
        ? [
            `For ${sizeSchema}, every point is [y, x], never [x, y].`,
            'cake_diameter_line must run from the cake’s left rim to right rim: end.x > start.x and its vertical drift must be smaller than its horizontal span.',
            'cake_height_line must run from the cake’s top/front edge to bottom/front edge on the diameter midpoint: end.y > start.y and its horizontal drift must be smaller than its vertical span.',
            'Return fresh, image-grounded measurement lines; do not reuse the invalid lines.',
        ].join(' ')
        : '';

    return [
        'Return one complete replacement JSON object that satisfies the response schema exactly.',
        `The previous response failed this application validation: ${failure}.`,
        integratedGeometryReminder,
        'Do not omit required fields or add unsupported fields.',
    ].filter(Boolean).join(' ');
}

function buildIntegratedBboxRepairSchema(candidateCount: number) {
    const repairKeys = Array.from({ length: candidateCount }, (_, index) => `row_${index}`);
    return {
        type: Type.OBJECT,
        properties: {
            repairs: {
                type: Type.ARRAY,
                maxItems: candidateCount,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        repair_key: { type: Type.STRING, enum: repairKeys },
                        box_2d: {
                            type: Type.ARRAY,
                            minItems: 0,
                            maxItems: 5,
                            items: {
                                type: Type.ARRAY,
                                minItems: 4,
                                maxItems: 4,
                                items: { type: Type.NUMBER, minimum: 0, maximum: 1000 },
                            },
                        },
                        bbox_confidence: {
                            type: Type.ARRAY,
                            minItems: 0,
                            maxItems: 5,
                            items: { type: Type.NUMBER, minimum: 0, maximum: 1 },
                        },
                        geometry_scope: {
                            type: Type.STRING,
                            enum: ['unit', 'piped_cluster', 'treatment'],
                        },
                    },
                    required: ['repair_key', 'box_2d', 'bbox_confidence'],
                },
            },
        },
        required: ['repairs'],
    };
}

function buildIntegratedBboxRepairInstruction(
    candidates: ReturnType<typeof getIntegratedBboxRepairCandidates>,
): string {
    const requested = candidates.map((candidate, index) => ({
        repair_key: `row_${index}`,
        category: candidate.category,
        group_id: candidate.groupId,
        type: candidate.type,
        quantity: candidate.quantity,
        geometry_scope: candidate.geometryScope,
        target_box_count: candidate.targetBoxCount,
        known_issues: candidate.reasons,
    }));
    return [
        'This is a targeted bbox-only repair for the listed analysis rows. Inspect the image and return only the requested repair objects; do not rewrite cake classification, descriptions, materials, row identities, or quantities.',
        'For unit rows, target exactly quantity boxes for quantities 1–5, and five boxes for quantity 6 or greater. For treatment or piped_cluster rows, return one tight region box. Never pair printout with treatment.',
        'Return one confidence per returned box in matching order. If a tight box cannot be localized, return empty box_2d and bbox_confidence arrays. Do not invent coordinates or merge separate countable items into an arrangement box.',
        `Rows to repair: ${JSON.stringify(requested)}`,
    ].join('\n');
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
    /** Existing cached analysis, used only if a row has no valid boxes. */
    previousAnalysis?: unknown;
};

type ProviderTarget = { provider: CakeAnalysisProvider; model: string };

export type RunCakeAnalysisResult = {
    result: GeneratedCakeAnalysisResult & {
        analysis_size_schema:
            typeof ANALYSIS_SIZE_SCHEMA
            | typeof LINE_RATIO_ANALYSIS_SIZE_SCHEMA
            | typeof AI_THREE_BAND_SIZE_SCHEMA
            | typeof INTEGRATED_BBOX_ANALYSIS_SIZE_SCHEMA
            | typeof INTEGRATED_BBOX_V2_ANALYSIS_SIZE_SCHEMA;
    };
    promptVersion: string;
    rawResponse: string;
    sizeSchema: AnalysisGenerationSizeSchema;
    effectiveSettings: {
        model: CakeAnalysisModel | string;
        provider: CakeAnalysisProvider;
        thinkingLevel: CakeAnalysisThinkingLevel;
        temperature: number;
        topP: number;
        topK: number;
        usedPromptCache: boolean;
    };
};

let cachedPromptDetails: { value: PromptDetails; expiresAt: number } | null = null;
let cachedTypeEnums: { value: TypeEnums; expiresAt: number } | null = null;
let cachedPromptCacheByVersion: {
    version: string;
    promptText: string;
    systemInstruction: string;
    cacheName: string | null;
    expiresAt: number;
} | null = null;

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
        cachedPromptCacheByVersion.promptText === promptDetails.promptText &&
        cachedPromptCacheByVersion.systemInstruction === systemInstruction &&
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
        promptText: promptDetails.promptText,
        systemInstruction,
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

/**
 * Production callers omit `model`, so the provider comes from the
 * admin-controlled `ai_provider_settings` row (with optional cross-provider
 * fallback). Explicit lab/comparison models always run on Gemini as requested.
 */
export async function runActiveCakeAnalysis(input: RunCakeAnalysisInput): Promise<RunCakeAnalysisResult> {
    if (input.model) {
        return runCakeAnalysisWithProvider(input, { provider: 'gemini', model: input.model });
    }

    const settings = await getCakeAnalysisProviderSettings();
    const targets: ProviderTarget[] = [
        { provider: 'gemini', model: settings.geminiModel },
        { provider: 'claude', model: settings.claudeModel },
    ];
    if (settings.provider === 'claude') targets.reverse();

    try {
        return await runCakeAnalysisWithProvider(input, targets[0]);
    } catch (primaryError) {
        // Skip a Claude fallback that cannot authenticate rather than masking
        // the real Gemini error with a missing-key error.
        const fallbackUnavailable = targets[1].provider === 'claude' && !process.env.ANTHROPIC_API_KEY;
        if (!settings.fallbackEnabled || fallbackUnavailable) throw primaryError;
        console.warn(`[AI Provider] ${targets[0].provider} analysis failed; falling back to ${targets[1].provider}.`, primaryError);
        return runCakeAnalysisWithProvider(input, targets[1]);
    }
}

async function runCakeAnalysisWithProvider({
    imageData,
    mimeType,
    requestContext,
    sourceContext,
    sourceRoute = 'api/ai/analyze',
    persistRejectedUpload = true,
    promptVersion,
    promptText,
    thinkingLevel = 'LOW',
    temperature,
    topP,
    topK,
    sizeSchema: requestedSizeSchema,
    usePromptCache = false,
    previousAnalysis,
}: RunCakeAnalysisInput, { provider, model }: ProviderTarget): Promise<RunCakeAnalysisResult> {
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

    const aiClient = provider === 'gemini' ? await getAI(requestContext) : null;
    const sizeSchema = requestedSizeSchema ?? getAnalysisGenerationSizeSchema(promptDetails.version);
    const seoSchema = resolveAnalysisGenerationSeoSchema(promptDetails.promptText);
    logCakeAnalysisDebug('AI request starting', {
        provider,
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
        // Keep the production cake-analysis request at LOW unless a trusted
        // comparison/lab caller explicitly overrides it.
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[thinkingLevel] },
    };
    let responseText: string;
    let cacheName: string | null = null;

    if (aiClient && usePromptCache && promptText === undefined) {
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

    const generateGeminiResponse = async (
        aiClient: Awaited<ReturnType<typeof getAI>>,
        repairInstruction?: string,
        responseSchemaOverride?: typeof baseConfig.responseSchema | ReturnType<typeof buildIntegratedBboxRepairSchema>,
    ) => {
        const repairPart = repairInstruction ? [{ text: repairInstruction }] : [];
        if (cacheName) {
            const cachedConfig = { ...baseConfig };
            delete (cachedConfig as { systemInstruction?: unknown }).systemInstruction;

            try {
                return await aiClient.models.generateContent({
                    model,
                    contents: [{
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType, data: imageData } },
                            ...repairPart,
                        ],
                    }],
                    config: {
                        ...cachedConfig,
                        ...(responseSchemaOverride ? { responseSchema: responseSchemaOverride } : {}),
                        cachedContent: cacheName,
                        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                    },
                });
            } catch (cachedGenerationError) {
                clearCachedPromptCacheName(promptDetails.version);
                console.warn('[AI Cache] Cached analysis generation failed. Retrying without cached content:', cachedGenerationError);
                return aiClient.models.generateContent({
                    model,
                    contents: [{
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType, data: imageData } },
                            { text: promptDetails.promptText },
                            ...repairPart,
                        ],
                    }],
                    config: {
                        ...baseConfig,
                        ...(responseSchemaOverride ? { responseSchema: responseSchemaOverride } : {}),
                        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                    },
                });
            }
        }

        return aiClient.models.generateContent({
            model,
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: imageData } },
                    { text: promptDetails.promptText },
                    ...repairPart,
                ],
            }],
            config: {
                ...baseConfig,
                ...(responseSchemaOverride ? { responseSchema: responseSchemaOverride } : {}),
                abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
            },
        });
    };

    const generateResponse = async (
        repairInstruction?: string,
        responseSchemaOverride?: typeof baseConfig.responseSchema | ReturnType<typeof buildIntegratedBboxRepairSchema>,
    ): Promise<string> => {
        if (!aiClient) {
            return generateClaudeJson({
                model,
                systemInstruction: baseConfig.systemInstruction,
                promptText: promptDetails.promptText,
                imageData,
                mimeType,
                repairInstruction,
                responseSchema: responseSchemaOverride ?? baseConfig.responseSchema,
                timeoutMs: AI_REQUEST_TIMEOUT_MS,
            });
        }
        const response = await generateGeminiResponse(aiClient, repairInstruction, responseSchemaOverride);
        return (response.text || '').trim();
    };

    const parseAndValidateResponse = (
        candidateJsonText: string,
        options: { allowMissingCakeHeightLine?: boolean } = {},
    ) => {
        logCakeAnalysisDebug('Gemini raw response received', {
            promptVersion: promptDetails.version,
            sizeSchema,
            usedPromptCache: Boolean(cacheName),
            rawResponse: candidateJsonText,
        });
        try {
            return {
                jsonText: candidateJsonText,
                result: postProcessSearchAnalysisResult(
                    JSON.parse(candidateJsonText),
                    typeEnums,
                    sizeSchema,
                    seoSchema,
                    { ...options, previousAnalysis },
                ),
            };
        } catch (error) {
            console.error('Failed to parse AI response:', candidateJsonText);
            throw new CakeAnalysisResponseError('Invalid response format from AI', candidateJsonText, error);
        }
    };

    let bboxRepairAttempted = false;
    const prepareResponseText = async (originalText: string): Promise<string> => {
        if (sizeSchema !== 'integrated_bbox_v2_tolerant' || bboxRepairAttempted) return originalText;

        let envelope: unknown;
        try {
            envelope = JSON.parse(originalText);
        } catch {
            return originalText;
        }
        const candidates = getIntegratedBboxRepairCandidates(envelope);
        if (candidates.length === 0) return originalText;
        // At most one bbox-only generation is allowed for this analysis, even
        // if a separate full-contract replacement is later needed.
        bboxRepairAttempted = true;

        logCakeAnalysisDebug('Gemini targeted bbox repair starting', {
            promptVersion: promptDetails.version,
            candidateCount: candidates.length,
            candidates,
        });
        try {
            const repairText = await generateResponse(
                buildIntegratedBboxRepairInstruction(candidates),
                buildIntegratedBboxRepairSchema(candidates.length),
            );
            const merged = mergeIntegratedBboxRepairResponse(
                envelope,
                candidates,
                JSON.parse(repairText),
            );
            logCakeAnalysisDebug('Gemini targeted bbox repair completed', {
                promptVersion: promptDetails.version,
                candidateCount: candidates.length,
                rawRepairResponse: repairText,
            });
            return JSON.stringify(merged);
        } catch (error) {
            // A failed or malformed bbox-only retry must not turn otherwise
            // usable analysis into a provider failure. Main validation keeps
            // the original row, salvageable boxes, and a review marker.
            console.warn('[AI Contract] Targeted bbox repair failed; keeping the original analysis rows.', error);
            logCakeAnalysisDebug('Gemini targeted bbox repair could not be parsed', {
                promptVersion: promptDetails.version,
                candidateCount: candidates.length,
                error: error instanceof Error ? error.message : String(error),
            });
            return originalText;
        }
    };

    responseText = await generateResponse();
    let parsedResponse: ReturnType<typeof parseAndValidateResponse>;
    try {
        parsedResponse = parseAndValidateResponse(await prepareResponseText(responseText));
    } catch (error) {
        if (!(error instanceof CakeAnalysisResponseError)) throw error;
        // Structured output normally prevents this. A single bounded repair
        // gives the model one chance to satisfy the exact application contract
        // without inventing missing pricing fields or looping indefinitely.
        console.warn('[AI Contract] Generated response failed validation; requesting one complete replacement.', error);
        responseText = await generateResponse(buildCakeAnalysisContractRepairInstruction(error, sizeSchema));
        try {
            parsedResponse = parseAndValidateResponse(await prepareResponseText(responseText));
        } catch (replacementError) {
            if (!(replacementError instanceof CakeAnalysisResponseError)) throw replacementError;
            if (
                sizeSchema !== 'integrated_bbox_v2'
                && sizeSchema !== 'integrated_bbox_v2_tolerant'
                || !isCakeHeightLineContractError(replacementError)
            ) {
                throw replacementError;
            }
            console.warn('[AI Contract] Cake height geometry remains unusable after repair; applying the type-safe thickness fallback.');
            parsedResponse = parseAndValidateResponse(
                await prepareResponseText(responseText),
                { allowMissingCakeHeightLine: true },
            );
        }
    }

    const { jsonText, result } = parsedResponse;

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
                    : sizeSchema === 'integrated_bbox_v2' || sizeSchema === 'integrated_bbox_v2_tolerant'
                        ? INTEGRATED_BBOX_V2_ANALYSIS_SIZE_SCHEMA
                    : sizeSchema === 'integrated_bbox_v1'
                        ? INTEGRATED_BBOX_ANALYSIS_SIZE_SCHEMA
                    : AI_THREE_BAND_SIZE_SCHEMA,
        },
        promptVersion: promptDetails.version,
        rawResponse: jsonText,
        sizeSchema,
        effectiveSettings: {
            model,
            provider,
            thinkingLevel,
            temperature: baseConfig.temperature,
            topP: baseConfig.topP,
            topK: baseConfig.topK,
            usedPromptCache: Boolean(cacheName),
        },
    };
}
