import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 60;
const MODEL_NAME = 'gemini-3.1-flash-image-preview';

const SYSTEM_INSTRUCTION = `You are an expert cake designer specializing in edible photo cakes.
Your task is to seamlessly place the provided overlay image onto the top surface of the cake as an edible photo print.
The result should look like a real edible photo cake — the image should appear printed on the frosting surface,
conforming to the cake's shape and perspective. Maintain photorealistic quality.
If the cake is circular, crop or reshape the overlay image into a circle so it fits seamlessly on the round surface.
If the cake is rectangular or square, reshape the overlay image to match that shape and place it on top.
Do NOT add any text, watermarks, or additional decorations. Only place the overlay image on the cake surface.`;

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

export async function POST(req: NextRequest) {
    const traceId = `cold-cake-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();

    try {
        const body = await req.json();
        const { baseImage, overlayImage } = body;

        if (!baseImage?.data || !baseImage?.mimeType || !overlayImage?.data || !overlayImage?.mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: baseImage and overlayImage (each with data and mimeType)' },
                { status: 400 }
            );
        }

        console.log(`[AI TRACE ${traceId}] /api/ai/cold-cake-edit:start`);

        const parts: any[] = [
            // Base cake image
            {
                inlineData: {
                    mimeType: baseImage.mimeType,
                    data: baseImage.data,
                },
            },
            // Overlay image (user's pitch/photo)
            {
                inlineData: {
                    mimeType: overlayImage.mimeType,
                    data: overlayImage.data,
                },
            },
            // Prompt
            {
                text: 'The first image is the base cake. The second image is what the customer wants printed on the cake. Add the second image on top of the cake as an edible photo cake design. Make it look like a real edible photo print on the frosting surface. If the cake is circular, make the printed image circular to match. If the cake is rectangular or square, make the printed image match that shape.',
            },
        ];

        const aiClient = getAI();
        const response = await aiClient.models.generateContent({
            model: MODEL_NAME,
            contents: [{ parts }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
            },
        });

        const generatedImage = extractGeneratedImage(response);

        if (generatedImage) {
            console.log(`[AI TRACE ${traceId}] /api/ai/cold-cake-edit:success`, {
                durationMs: Date.now() - startedAt,
            });
            return NextResponse.json({
                imageData: generatedImage.imageData,
                mimeType: generatedImage.mimeType,
            });
        }

        console.error(`[AI TRACE ${traceId}] /api/ai/cold-cake-edit:empty-response`, {
            durationMs: Date.now() - startedAt,
        });
        return NextResponse.json(
            { error: 'AI failed to generate the cold cake image. Please try again.' },
            { status: 500 }
        );
    } catch (error: any) {
        console.error('Error in cold-cake-edit:', error);
        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to create cold cake image. Please try again.',
            quotaMessage: 'AI image editing is temporarily unavailable due to quota limits. Please try again later.',
        });

        console.error(`[AI TRACE ${traceId}] /api/ai/cold-cake-edit:error`, {
            durationMs: Date.now() - startedAt,
            status: normalizedError.status,
            message: normalizedError.message,
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status }
        );
    }
}
