import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 60;
const MODEL_NAME = 'gemini-3.1-flash-lite-image';

const SYSTEM_INSTRUCTION = `You are a professional food photographer and cake artist specializing in photorealistic edible photo cakes and printed cake designs.

Your task: composite the provided customer photo, poster, artwork, or other reference image onto the top surface of the base cake so it looks exactly like a real edible print made in a professional bakery.

EDIBLE PRINT REALISM RULES — follow all of these:
0. DIMENSIONS PRESERVATION: Return the image in the EXACT SAME pixel dimensions and aspect ratio as the base cake image (Image 1). NEVER change the dimensions or aspect ratio — the output must match the input base image exactly.
1. COMPLETE UPLOADED IMAGE: Show all of Image 2, including every edge, corner, face, word, and design detail. NEVER crop, trim, zoom into, stretch, warp, or cut off any part of Image 2. Preserve Image 2's original aspect ratio and content exactly.
2. CONTAIN FIT: Place the complete Image 2 inside the usable cake-top area using a contain fit. If the aspect ratios differ, use clean edible-print padding or a simple margin/border; it is acceptable for the print not to reach every edge. Never force the image to fill the top by cropping it. For a round cake with a rectangular source, do not clip the source to a circular mask if that would hide any content.
3. Attached edible print: Treat Image 2 as one physical edible print attached flat to the cake top, with its complete original composition still visible. Do not redraw it, replace it with a similar image, or invent missing content.
4. Perspective & foreshortening: Apply the same camera angle and perspective as the base cake photo. If the cake is shot at a slight angle, the print should appear foreshortened accordingly — not flat/frontal.
5. Frosting texture bleed-through: Edible prints are thin rice paper or wafer paper — the frosting texture subtly shows through. Let the underlying frosting micro-texture faintly show through the print, especially near edges.
6. Matte ink finish: Real edible ink is matte and slightly desaturated compared to a glossy digital image. Reduce the print's saturation by ~10–15% and give it a matte finish, not a glossy or laminated look.
7. Lighting & shadows: The print must be lit by the exact same light source as the cake. Apply the same highlights and soft shadows from the cake's existing light direction onto the print surface. Do NOT leave the print looking evenly lit or "pasted on".
8. Edge softness: Where the print meets the cake's border piping or icing edge, feather the print edge slightly so it blends — without removing or hiding any part of Image 2.
9. Preserve everything else: Keep all existing cake decorations (border piping, ribbons, flowers, side design, base board) completely unchanged. Only modify the top flat surface.
10. No additions: Do NOT add text, watermarks, extra decorations, or change the cake color/shape.

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
            // Overlay image (user's photo, poster, artwork, or other edible-print reference)
            {
                inlineData: {
                    mimeType: overlayImage.mimeType,
                    data: overlayImage.data,
                },
            },
            // Prompt
            {
                text: `Image 1 is the base cake. Image 2 is the customer's photo, poster, artwork, or other reference design to be printed as an edible image on top of the cake.

Composite Image 2 onto the top surface of the cake following all professional edible print standards:
- Show the COMPLETE Image 2. Preserve every edge, corner, face, word, and design detail. NEVER crop, trim, zoom, stretch, warp, or cut off any part of Image 2, and preserve its original aspect ratio.
- Fit Image 2 inside the usable cake-top area with a contain fit. If the aspect ratios differ, use clean edible-print padding or a simple margin/border; leaving a margin is required over cropping. For a round cake with a rectangular source, do not clip the source to a circular mask if that would hide content.
- Treat Image 2 as one physical edible print attached flat to the top of the cake. Do not redraw the uploaded image, replace it with a similar image, or invent missing content.
- Apply correct perspective/foreshortening to match the camera angle of the cake photo
- Let the frosting texture subtly bleed through the print (rice paper/wafer paper effect)
- Desaturate the print slightly (~10–15%) and render it matte — no glossy finish
- Match the lighting direction and shadows from the existing cake photo onto the print
- Feather the print edges softly where they meet the border piping, without hiding any part of Image 2
- Leave all other cake elements (borders, piping, ribbon, side design) completely untouched
- IMPORTANT: Output the exact same dimensions and aspect ratio as Image 1 (the base cake). Do not resize or change the dimensions regardless of Image 2's size.

The result must look like a real professionally-made edible photo cake from a bakery, not a digital composite.`,
            },
        ];

        const aiClient = getAI(req);
        const response = await aiClient.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseModalities: ['IMAGE'],
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
