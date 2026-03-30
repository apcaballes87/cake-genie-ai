import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 60;
const MODEL_NAME = 'gemini-2.5-flash-image';

const SYSTEM_INSTRUCTION = `You are a professional food photographer and cake artist specializing in photorealistic edible photo cakes.

Your task: composite the provided overlay image onto the top surface of the base cake so it looks exactly like a real edible photo print made in a professional bakery.

EDIBLE PRINT REALISM RULES — follow all of these:
1. Shape & fit: Match the print shape precisely to the cake top — circular for round cakes, rectangular/square for those shapes. The print must fill the entire flat top surface without overflow or gap.
2. Perspective & foreshortening: Apply the same camera angle and perspective as the base cake photo. If the cake is shot at a slight angle, the print should appear foreshortened accordingly — not flat/frontal.
3. Frosting texture bleed-through: Edible prints are thin rice paper or wafer paper — the frosting texture subtly shows through. Let the underlying frosting micro-texture faintly show through the print, especially near edges.
4. Matte ink finish: Real edible ink is matte and slightly desaturated compared to a glossy digital image. Reduce the print's saturation by ~10–15% and give it a matte finish, not a glossy or laminated look.
5. Lighting & shadows: The print must be lit by the exact same light source as the cake. Apply the same highlights and soft shadows from the cake's existing light direction onto the print surface. Do NOT leave the print looking evenly lit or "pasted on".
6. Edge softness: Where the print meets the cake's border piping or icing edge, feather the print edge slightly so it blends — no hard rectangular cutout border.
7. Preserve everything else: Keep all existing cake decorations (border piping, ribbons, flowers, side design, base board) completely unchanged. Only modify the top flat surface.
8. No additions: Do NOT add text, watermarks, extra decorations, or change the cake color/shape.

The final result must be indistinguishable from a real bakery photo of an edible photo cake.`;

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
                text: `Image 1 is the base cake. Image 2 is the customer's photo to be printed as an edible photo on top of the cake.

Composite Image 2 onto the top surface of the cake following all professional edible print standards:
- Fit the print to the exact shape of the cake top (circle, square, or rectangle)
- Apply correct perspective/foreshortening to match the camera angle of the cake photo
- Let the frosting texture subtly bleed through the print (rice paper/wafer paper effect)
- Desaturate the print slightly (~10–15%) and render it matte — no glossy finish
- Match the lighting direction and shadows from the existing cake photo onto the print
- Feather the print edges softly where they meet the border piping — no hard cutout edge
- Leave all other cake elements (borders, piping, ribbon, side design) completely untouched

The result must look like a real professionally-made edible photo cake from a bakery, not a digital composite.`,
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
