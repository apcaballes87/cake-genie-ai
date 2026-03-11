import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai/client';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageData, mimeType, textData } = body;

        if (!imageData || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: imageData and mimeType' },
                { status: 400 }
            );
        }

        const aiClient = getAI();
        
        // Construct the parts array for multimodal input
        const parts: any[] = [];
        
        if (textData && typeof textData === 'string' && textData.trim().length > 0) {
            parts.push({ text: textData.trim() });
        }
        
        parts.push({ inlineData: { mimeType, data: imageData } });

        const response = await aiClient.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: [{
                role: 'user',
                parts: parts
            }],
            config: {
                outputDimensionality: 768
            }
        });

        const embeddingValues = response.embeddings?.[0]?.values;

        if (!embeddingValues || embeddingValues.length === 0) {
            return NextResponse.json(
                { error: 'Failed to generate embedding array from AI response' },
                { status: 500 }
            );
        }

        return NextResponse.json({ embedding: embeddingValues });

    } catch (error) {
        console.error("Error generating image embedding:", error);
        return NextResponse.json(
            { error: 'Failed to generate embedding' },
            { status: 500 }
        );
    }
}
