import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel } from "@google/genai";
import { getAI } from '@/lib/ai/client';
import { VALIDATION_PROMPT, validationResponseSchema } from '@/lib/ai/prompts';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 60; // Allow up to 60 seconds for AI processing

async function classifyImageWithModel(
    imageData: string,
    mimeType: string,
    model: string
) {
    const aiClient = getAI();
    const response = await aiClient.models.generateContent({
        model,
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
            thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
            },
        },
    });

    const jsonText = (response.text || '').trim();
    try {
        return JSON.parse(jsonText);
    } catch {
        console.error(`Failed to parse AI response from model ${model}:`, jsonText);
        throw new Error('Invalid response format from AI');
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageData, mimeType, useCase } = body;

        if (!imageData || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: imageData and mimeType' },
                { status: 400 }
            );
        }

        const primaryModel = useCase === 'chat' ? 'gemini-2.5-flash' : 'gemini-3-flash-preview';
        const fallbackModel = 'gemini-3-flash-preview';

        let result;
        try {
            result = await classifyImageWithModel(imageData, mimeType, primaryModel);
        } catch (primaryError) {
            const normalizedPrimaryError = normalizeAiRouteError(primaryError, {
                defaultMessage: 'Failed to validate image',
                quotaMessage: 'AI image validation is temporarily unavailable due to quota limits. Please try again later.',
                authorizationMessage: 'AI image validation is not authorized. Please check the Google AI API key and project access.',
            });

            if (useCase === 'chat' && primaryModel !== fallbackModel && ![401, 403].includes(normalizedPrimaryError.status)) {
                console.warn(
                    `Chat validation failed with ${primaryModel}. Retrying with ${fallbackModel}.`,
                    primaryError
                );
                result = await classifyImageWithModel(imageData, mimeType, fallbackModel);
            } else {
                throw primaryError;
            }
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error validating cake image:", error);

        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to validate image',
            quotaMessage: 'AI image validation is temporarily unavailable due to quota limits. Please try again later.',
            authorizationMessage: 'AI image validation is not authorized. Please check the Google AI API key and project access.',
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status }
        );
    }
}
