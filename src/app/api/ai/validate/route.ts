import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel } from "@google/genai";
import { getAI } from '@/lib/ai/client';
import { VALIDATION_PROMPT, validationResponseSchema } from '@/lib/ai/prompts';

export const maxDuration = 60; // Allow up to 60 seconds for AI processing

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageData, mimeType } = body;

        if (!imageData || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: imageData and mimeType' },
                { status: 400 }
            );
        }

        const aiClient = getAI();
        const response = await aiClient.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: imageData } },
                    { text: VALIDATION_PROMPT }
                ],
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: validationResponseSchema,
                temperature: 0,
                // Using 'low' for quick validation - minimal thinking for simple classification
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                },
            },
        });

        const jsonText = (response.text || '').trim();
        let result;
        try {
            result = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse AI response:", jsonText);
            return NextResponse.json(
                { error: 'Invalid response format from AI' },
                { status: 500 }
            );
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error validating cake image:", error);
        return NextResponse.json(
            { error: 'Failed to validate image' },
            { status: 500 }
        );
    }
}
