import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 180;
const DEFAULT_MODEL_NAME = 'gemini-3.1-flash-image-preview';
const COLOR_ONLY_MODEL_NAME = 'gemini-2.5-flash-image';

type EditImageModelName = typeof DEFAULT_MODEL_NAME | typeof COLOR_ONLY_MODEL_NAME;
type ResponseModality = 'TEXT' | 'IMAGE';
type EditImageAttempt = {
    modelName: EditImageModelName;
    responseModalities: ResponseModality[];
    fallbackFrom?: EditImageModelName;
};

type AiInlineDataPart = {
    inlineData?: {
        data?: string;
        mimeType?: string;
    };
    text?: string;
};

type AiGenerateContentResponse = {
    candidates?: Array<{
        content?: {
            parts?: AiInlineDataPart[];
        };
    }>;
    data?: string;
    mimeType?: string;
    text?: string | (() => string);
};

type EditImageRequestBody = {
    prompt?: string;
    originalImage?: {
        data?: string;
        mimeType?: string;
    };
    threeTierReferenceImage?: {
        data?: string;
        mimeType?: string;
    } | null;
    systemInstruction?: string;
    preferredModel?: EditImageModelName;
};

function resolveModelName(preferredModel?: string): EditImageModelName {
    if (preferredModel === COLOR_ONLY_MODEL_NAME) {
        return COLOR_ONLY_MODEL_NAME;
    }

    return DEFAULT_MODEL_NAME;
}

function getResponseModalities(modelName: EditImageModelName): ResponseModality[] {
    if (modelName === COLOR_ONLY_MODEL_NAME) {
        return ['TEXT', 'IMAGE'];
    }

    return ['IMAGE'];
}

function extractGeneratedImage(response: AiGenerateContentResponse) {
    const candidate = response?.candidates?.[0];
    const partsResponse = candidate?.content?.parts;
    const imagePart = partsResponse?.find((part) => part.inlineData?.data);

    if (imagePart?.inlineData?.data) {
        return {
            imageData: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType || 'image/png',
        };
    }

    if (typeof response?.data === 'string' && response.data.trim()) {
        return {
            imageData: response.data,
            mimeType: response?.mimeType || 'image/png',
        };
    }

    return null;
}

function extractTextResponse(response: AiGenerateContentResponse) {
    if (typeof response?.text === 'string') {
        return response.text;
    }

    if (typeof response?.text === 'function') {
        try {
            return response.text();
        } catch {
            return '';
        }
    }

    const textParts = response?.candidates?.flatMap((candidate) =>
        candidate?.content?.parts?.filter((part) => typeof part?.text === 'string') ?? []
    ) ?? [];

    return textParts.map((part) => part.text).join('\n').trim();
}

export async function POST(req: NextRequest) {
    const traceId = req.headers.get('x-ai-trace-id') ?? `edit-image-route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const requestSource = req.headers.get('x-ai-request-source') ?? 'unknown';
    const startedAt = Date.now();

    try {
        const body = (await req.json()) as EditImageRequestBody;
        const { prompt, originalImage, threeTierReferenceImage, systemInstruction, preferredModel } = body;
        const modelName = resolveModelName(preferredModel);

        console.log(`[AI TRACE ${traceId}] /api/ai/edit-image:start`, {
            requestSource,
            promptLength: typeof prompt === 'string' ? prompt.length : 0,
            hasOriginalImage: Boolean(originalImage?.data && originalImage?.mimeType),
            hasThreeTierReferenceImage: Boolean(threeTierReferenceImage?.data && threeTierReferenceImage?.mimeType),
            hasSystemInstruction: Boolean(systemInstruction),
            preferredModel,
            resolvedModel: modelName,
        });

        if (!prompt || !originalImage) {
            return NextResponse.json(
                { error: 'Missing required fields: prompt and originalImage' },
                { status: 400 }
            );
        }

        const parts: Array<
            | { inlineData: { mimeType: string; data: string } }
            | { text: string }
        > = [];

        // Add original image (MANDATORY) - user's uploaded cake
        if (originalImage.data && originalImage.mimeType) {
            parts.push({
                inlineData: {
                    mimeType: originalImage.mimeType,
                    data: originalImage.data
                }
            });
        }

        // Add 3-tier structure reference (OPTIONAL) - for consistent tier resizing
        // Only if the prompt actually involves tier stack manipulation
        if (
            threeTierReferenceImage &&
            threeTierReferenceImage.data &&
            threeTierReferenceImage.mimeType &&
            prompt.includes('tier')
        ) {
            parts.push({
                inlineData: {
                    mimeType: threeTierReferenceImage.mimeType,
                    data: threeTierReferenceImage.data
                }
            });
            // Add instruction explaining the second image
            parts.push({
                text: "The second image provided is a REFERENCE GUIDE for standard 3-tier structure. Use it only to understand proper tier proportions."
            });
        }

        // Add the main edit prompt
        parts.push({ text: prompt });

        const aiClient = getAI(req);
        const attempts: EditImageAttempt[] = [
            {
                modelName,
                responseModalities: getResponseModalities(modelName),
            },
        ];

        if (modelName === COLOR_ONLY_MODEL_NAME) {
            attempts.push({
                modelName: DEFAULT_MODEL_NAME,
                responseModalities: getResponseModalities(DEFAULT_MODEL_NAME),
                fallbackFrom: COLOR_ONLY_MODEL_NAME,
            });
        }

        let lastTextResponse = '';
        let lastSerializedResponse = '';

        for (const [attemptIndex, attempt] of attempts.entries()) {
            console.log(`[AI TRACE ${traceId}] /api/ai/edit-image:calling-model`, {
                requestSource,
                model: attempt.modelName,
                responseModalities: attempt.responseModalities,
                fallbackFrom: attempt.fallbackFrom,
            });

            const response = await aiClient.models.generateContent({
                model: attempt.modelName,
                contents: [{ role: 'user', parts }],
                config: {
                    systemInstruction: systemInstruction,
                    responseModalities: attempt.responseModalities,
                },
            });

            const generatedImage = extractGeneratedImage(response);

            if (generatedImage) {
                console.log(`[AI TRACE ${traceId}] /api/ai/edit-image:success`, {
                    requestSource,
                    mimeType: generatedImage.mimeType,
                    durationMs: Date.now() - startedAt,
                    model: attempt.modelName,
                    fallbackFrom: attempt.fallbackFrom,
                });
                return NextResponse.json({
                    imageData: generatedImage.imageData,
                    mimeType: generatedImage.mimeType,
                });
            }

            const textResponse = extractTextResponse(response);
            lastTextResponse = textResponse;
            lastSerializedResponse = JSON.stringify(response).slice(0, 2000);

            const hasRetryAttempt = attemptIndex < attempts.length - 1;

            if (hasRetryAttempt) {
                console.warn(`[AI TRACE ${traceId}] /api/ai/edit-image:fallback`, {
                    requestSource,
                    fromModel: attempt.modelName,
                    toModel: attempts[attemptIndex + 1]?.modelName,
                    reason: textResponse ? 'text-response' : 'empty-response',
                    durationMs: Date.now() - startedAt,
                    textResponse,
                });
                continue;
            }

            if (textResponse) {
                console.warn('Received text response instead of image:', textResponse);
                console.warn(`[AI TRACE ${traceId}] /api/ai/edit-image:text-response`, {
                    requestSource,
                    durationMs: Date.now() - startedAt,
                    model: attempt.modelName,
                });
                return NextResponse.json(
                    { error: `AI returned text instead of an image. ${textResponse}`.trim() },
                    { status: 400 }
                );
            }
        }

        if (lastTextResponse) {
            console.warn('Received text response instead of image:', lastTextResponse);
            console.warn(`[AI TRACE ${traceId}] /api/ai/edit-image:text-response`, {
                requestSource,
                durationMs: Date.now() - startedAt,
                model: attempts[attempts.length - 1]?.modelName,
            });
            return NextResponse.json(
                { error: `AI returned text instead of an image. ${lastTextResponse}`.trim() },
                { status: 400 }
            );
        }

        console.error(`[AI TRACE ${traceId}] /api/ai/edit-image:empty-response`, {
            requestSource,
            durationMs: Date.now() - startedAt,
            model: attempts[attempts.length - 1]?.modelName,
            fullResponse: lastSerializedResponse,
        });

        return NextResponse.json(
            { error: 'AI did not return an edited image. Please try again.' },
            { status: 502 }
        );

    } catch (error: unknown) {
        console.error("Error editing cake image:", error);

        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to edit image. Please try again.',
            quotaMessage: 'AI image editing is temporarily unavailable due to quota limits. Please try again later.',
        });

        console.error(`[AI TRACE ${traceId}] /api/ai/edit-image:error`, {
            requestSource,
            durationMs: Date.now() - startedAt,
            status: normalizedError.status,
            message: normalizedError.message,
            rawStatus:
                typeof error === 'object' && error && 'status' in error
                    ? (error as { status?: unknown }).status
                    : undefined,
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status }
        );
    }
}
