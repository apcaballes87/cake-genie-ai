import { resolveAnalysisGenerationSeoSchema } from '@/lib/ai/generatedAnalysisContract';
import { getAI, getOrCreatePromptCache } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/client';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import {
    buildSearchAnalysisGenerationConfig,
    getAnalysisGenerationSizeSchema,
    postProcessSearchAnalysisResult,
    type WhiteWaferPaperSideWaveVerification,
} from '@/lib/admin/searchAnalysisContract';
import { getActivePromptDetails, getPromptDetailsByVersion } from '@/services/prompts/promptLoader';
import { logRejectedUpload } from '@/lib/ai/rejectedUploads';
import { getDynamicTypeEnums } from '@/lib/ai/utils';
import {
    GeneratedAnalysisContractError,
    type GeneratedCakeAnalysisResult,
} from '@/lib/ai/generatedAnalysisContract';
import {
    AI_THREE_BAND_SIZE_SCHEMA,
    ANALYSIS_SIZE_SCHEMA,
    INTEGRATED_BBOX_ANALYSIS_SIZE_SCHEMA,
    LINE_RATIO_ANALYSIS_SIZE_SCHEMA,
} from '@/lib/ai/analysisSize';
import { Type } from '@google/genai';
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
const ANALYSIS_CONTRACT_CORRECTION_TIMEOUT_MS = 25_000;
const WAFER_WAVE_VERIFICATION_TIMEOUT_MS = 25_000;

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

function getContractCorrectionInstruction(error: unknown): string | null {
    if (!(error instanceof GeneratedAnalysisContractError)) return null;

    const message = error.message;
    const missingElementLine = /(?:main_toppers|support_elements)\[\d+\]\.size_line is required/i.test(message);
    if (!missingElementLine) return null;

    return [
        'Your previous JSON response omitted a required representative `size_line` for a priced cake element.',
        'Regenerate the complete analysis JSON for the same image.',
        'Every non-fixed, non-piped-flower `main_toppers` or `support_elements` row must include one normalized `size_line` with integer start and end coordinates from 0 through 1000.',
        'Only fixed-local types and `piped_flowers_top` or `piped_flowers_side` may omit `size_line`.',
    ].join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasWaferPaperSideWaveCandidate(result: unknown): boolean {
    return isRecord(result)
        && Array.isArray(result.support_elements)
        && result.support_elements.some((element) => (
            isRecord(element) && element.type === 'edible_photo_side_wave'
        ));
}

function parseWhiteWaferPaperSideWaveVerification(
    value: unknown,
): WhiteWaferPaperSideWaveVerification | undefined {
    if (!isRecord(value)) return undefined;

    const fields = [
        'hasDistinctThinPaperStrips',
        'hasUprightSeparateAttachment',
        'hasLooseFreeWavyEdges',
        'hasPredominantlyFullHeightWrap',
        'hasWhiteUnprintedSheets',
    ] as const;
    if (fields.some((field) => typeof value[field] !== 'boolean')) return undefined;

    return {
        hasDistinctThinPaperStrips: value.hasDistinctThinPaperStrips as boolean,
        hasUprightSeparateAttachment: value.hasUprightSeparateAttachment as boolean,
        hasLooseFreeWavyEdges: value.hasLooseFreeWavyEdges as boolean,
        hasPredominantlyFullHeightWrap: value.hasPredominantlyFullHeightWrap as boolean,
        hasWhiteUnprintedSheets: value.hasWhiteUnprintedSheets as boolean,
    };
}

async function verifyWhiteWaferPaperSideWave(
    aiClient: ReturnType<typeof getAI>,
    imageData: string,
    mimeType: string,
): Promise<WhiteWaferPaperSideWaveVerification | undefined> {
    try {
        const response = await aiClient.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: imageData } },
                    {
                        text: `Inspect only the cake side in this image. This is a strict,
fail-closed verification for a paid conditioned wafer-paper wave wrap. Return
JSON booleans only. Set a field true only when the image itself directly proves
it; do not rely on another model's description, labels, or likely materials.

A passing wrap must show: (1) individually distinguishable, thin paper strips;
(2) those strips upright and separately attached to the iced side; (3) each
strip has a loose/free wavy, ruffled, or pleated outer edge; (4) the strips form
a repeated predominantly full-height wrap around a visible tier; and (5) the
strips are visibly white and unprinted. For this purpose, ivory, cream, beige,
tan, any colored treatment, any printed/patterned treatment, piped frosting,
continuous texture, shadows, scalloped folds, flower petals, or an unclear
image are false. Any uncertainty is false.`,
                    },
                ],
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        hasDistinctThinPaperStrips: { type: Type.BOOLEAN },
                        hasUprightSeparateAttachment: { type: Type.BOOLEAN },
                        hasLooseFreeWavyEdges: { type: Type.BOOLEAN },
                        hasPredominantlyFullHeightWrap: { type: Type.BOOLEAN },
                        hasWhiteUnprintedSheets: { type: Type.BOOLEAN },
                    },
                    required: [
                        'hasDistinctThinPaperStrips',
                        'hasUprightSeparateAttachment',
                        'hasLooseFreeWavyEdges',
                        'hasPredominantlyFullHeightWrap',
                        'hasWhiteUnprintedSheets',
                    ],
                },
                temperature: 0,
                topP: 1,
                topK: 1,
                abortSignal: AbortSignal.timeout(WAFER_WAVE_VERIFICATION_TIMEOUT_MS),
            },
        });
        return parseWhiteWaferPaperSideWaveVerification(JSON.parse((response.text || '').trim()));
    } catch (error) {
        console.warn('[AI Wafer Gate] Verification failed closed.', {
            error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
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

    const generateAnalysis = async (
        correctionInstruction?: string,
        timeoutMs = AI_REQUEST_TIMEOUT_MS,
    ) => {
        const generateWithoutCache = () => aiClient.models.generateContent({
            model,
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: imageData } },
                    { text: promptDetails.promptText },
                    ...(correctionInstruction ? [{ text: correctionInstruction }] : []),
                ],
            }],
            config: {
                ...baseConfig,
                abortSignal: AbortSignal.timeout(timeoutMs),
            },
        });

        if (!cacheName) return generateWithoutCache();

        const cachedConfig = { ...baseConfig };
        delete (cachedConfig as { systemInstruction?: unknown }).systemInstruction;
        try {
            return await aiClient.models.generateContent({
                model,
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageData } },
                        ...(correctionInstruction ? [{ text: correctionInstruction }] : []),
                    ],
                }],
                config: {
                    ...cachedConfig,
                    cachedContent: cacheName,
                    abortSignal: AbortSignal.timeout(timeoutMs),
                },
            });
        } catch (cachedGenerationError) {
            clearCachedPromptCacheName(promptDetails.version);
            cacheName = null;
            console.warn('[AI Cache] Cached analysis generation failed. Retrying without cached content:', cachedGenerationError);
            return generateWithoutCache();
        }
    };

    let rawResponse = '';
    const parseAndValidate = async (response: Awaited<ReturnType<typeof generateAnalysis>>) => {
        const jsonText = (response.text || '').trim();
        rawResponse = jsonText;
        try {
            const generated = JSON.parse(jsonText);
            const waferPaperSideWaveVerification = hasWaferPaperSideWaveCandidate(generated)
                ? await verifyWhiteWaferPaperSideWave(aiClient, imageData, mimeType)
                : undefined;
            return postProcessSearchAnalysisResult(
                generated,
                typeEnums,
                sizeSchema,
                seoSchema,
                waferPaperSideWaveVerification,
            );
        } catch (error) {
            console.error('Failed to parse AI response:', jsonText);
            if (error instanceof GeneratedAnalysisContractError) throw error;
            throw new CakeAnalysisResponseError('Invalid response format from AI', jsonText, error);
        }
    };
    let result: GeneratedCakeAnalysisResult;
    try {
        result = await parseAndValidate(await generateAnalysis());
    } catch (error) {
        const correctionInstruction = getContractCorrectionInstruction(error);
        if (!correctionInstruction) throw error;

        console.warn('[AI Contract] Retrying once after recoverable missing element geometry.', {
            promptVersion: promptDetails.version,
            issue: error instanceof Error ? error.message : String(error),
        });
        result = await parseAndValidate(await generateAnalysis(
            correctionInstruction,
            ANALYSIS_CONTRACT_CORRECTION_TIMEOUT_MS,
        ));
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
        rawResponse,
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
