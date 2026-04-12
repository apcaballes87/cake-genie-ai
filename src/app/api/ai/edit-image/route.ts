import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 60; // Allow sufficient time for image generation
const MODEL_NAME = 'gemini-3.1-flash-image-preview';

function extractGeneratedImage(response: any) {
    const candidate = response?.candidates?.[0];
    const partsResponse = candidate?.content?.parts;
    const imagePart = partsResponse?.find((part: any) => part.inlineData?.data);

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

function extractTextResponse(response: any) {
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

    const textParts = response?.candidates?.flatMap((candidate: any) =>
        candidate?.content?.parts?.filter((part: any) => typeof part?.text === 'string') ?? []
    ) ?? [];

    return textParts.map((part: any) => part.text).join('\n').trim();
}

export async function POST(req: NextRequest) {
    const traceId = req.headers.get('x-ai-trace-id') ?? `edit-image-route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const requestSource = req.headers.get('x-ai-request-source') ?? 'unknown';
    const startedAt = Date.now();

    try {
        const body = await req.json();
        const { prompt, originalImage, threeTierReferenceImage, systemInstruction } = body;

        console.log(`[AI TRACE ${traceId}] /api/ai/edit-image:start`, {
            requestSource,
            promptLength: typeof prompt === 'string' ? prompt.length : 0,
            hasOriginalImage: Boolean(originalImage?.data && originalImage?.mimeType),
            hasThreeTierReferenceImage: Boolean(threeTierReferenceImage?.data && threeTierReferenceImage?.mimeType),
            hasSystemInstruction: Boolean(systemInstruction),
        });

        if (!prompt || !originalImage) {
            return NextResponse.json(
                { error: 'Missing required fields: prompt and originalImage' },
                { status: 400 }
            );
        }

        const parts: any[] = [];

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
        if (threeTierReferenceImage && threeTierReferenceImage.data && prompt.includes('tier')) {
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

        const aiClient = getAI();
        // Use Gemini 3.1 Flash Image Preview for image editing experiments.
        console.log(`[AI TRACE ${traceId}] /api/ai/edit-image:calling-model`, {
            requestSource,
            model: MODEL_NAME,
        });
        const response = await aiClient.models.generateContent({
            model: MODEL_NAME,
            contents: [{ parts }],
            config: {
                systemInstruction: systemInstruction,
            },
        });

        const generatedImage = extractGeneratedImage(response);

        if (generatedImage) {
            console.log(`[AI TRACE ${traceId}] /api/ai/edit-image:success`, {
                requestSource,
                mimeType: generatedImage.mimeType,
                durationMs: Date.now() - startedAt,
            });
            return NextResponse.json({
                imageData: generatedImage.imageData,
                mimeType: generatedImage.mimeType,
            });
        }

        const textResponse = extractTextResponse(response);

        if (textResponse) {
            // Fallback/Warning: received text instead of image
            console.warn('Received text response instead of image:', textResponse);
            console.warn(`[AI TRACE ${traceId}] /api/ai/edit-image:text-response`, {
                requestSource,
                durationMs: Date.now() - startedAt,
            });
            return NextResponse.json(
                { error: `AI returned text instead of an image. ${textResponse}`.trim() },
                { status: 400 }
            );
        }

        console.error(`[AI TRACE ${traceId}] /api/ai/edit-image:empty-response`, {
            requestSource,
            durationMs: Date.now() - startedAt,
            fullResponse: JSON.stringify(response).slice(0, 2000),
        });

        return NextResponse.json(
            { error: 'AI failed to generate image (No image data returned by Gemini)' },
            { status: 500 }
        );

    } catch (error: any) {
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
            rawStatus: error?.status,
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status }
        );
    }
}
