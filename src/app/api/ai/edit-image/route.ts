import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel } from "@google/genai";
import { getAI } from '@/lib/ai/client';

export const maxDuration = 60; // Allow sufficient time for image generation

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt, originalImage, threeTierReferenceImage, systemInstruction } = body;

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
        const response = await aiClient.models.generateContent({
            model: "gemini-3-pro-image-preview", // UPDATED: Using Nano Banana 2 (Gemini 3 Pro Image)
            contents: [{ parts }],
            config: {
                systemInstruction: systemInstruction,
                // responseMimeType: 'image/png', // Gemini 3 might require this differently or infer from prompt
            },
        });

        // According to Google GenAI docs for image generation/editing, check for image parts
        const candidate = response.candidates?.[0];
        const partsResponse = candidate?.content?.parts;
        // Find the part that has inlineData (image)
        const imagePart = partsResponse?.find(p => p.inlineData && p.inlineData.data);

        if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
            return NextResponse.json({
                imageData: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType || 'image/png'
            });
        } else if (response.text) {
            // Fallback/Warning: received text instead of image
            console.warn("Received text response instead of image:", response.text);
            return NextResponse.json(
                { error: 'AI returned text instead of an image. Try refining the prompt.' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'AI failed to generate image (Empty response)' },
            { status: 500 }
        );

    } catch (error) {
        console.error("Error editing cake image:", error);
        return NextResponse.json(
            { error: `Failed to edit image: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}
