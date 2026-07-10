import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel } from "@google/genai";
import { getAI } from '@/lib/ai/client';
import { VALIDATION_PROMPT, validationResponseSchema } from '@/lib/ai/prompts';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 300; // Allow up to 300 seconds (Vercel Pro) for AI processing

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: CORS_HEADERS,
    });
}

// Fail fast on slow AI calls so we can return a clean 504 well before Vercel kills the function.
// The validation prompt is light; most successful calls complete in <60s.
const AI_REQUEST_TIMEOUT_MS = 90_000;

async function classifyImageWithModel(
    req: NextRequest,
    imageData: string,
    mimeType: string,
    model: string
) {
    const aiClient = getAI(req);
    const response = await aiClient.models.generateContent({
        model,
        contents: [{
            role: 'user',
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
            abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
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
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const primaryModel = useCase === 'chat' ? 'gemini-2.5-flash' : 'gemini-3.1-flash-lite';
        const fallbackModel = 'gemini-3.1-flash-lite';

        let result;
        try {
            result = await classifyImageWithModel(req, imageData, mimeType, primaryModel);
        } catch (primaryError) {
            const normalizedPrimaryError = normalizeAiRouteError(primaryError, {
                defaultMessage: 'Failed to validate image',
                quotaMessage: 'AI image validation is temporarily unavailable due to quota limits. Please try again later.',
                authorizationMessage: 'AI image validation is not authorized. Please check the Vertex AI and Workload Identity configuration, then confirm project access.',
            });

            if (useCase === 'chat' && primaryModel !== fallbackModel && ![401, 403].includes(normalizedPrimaryError.status)) {
                console.warn(
                    `Chat validation failed with ${primaryModel}. Retrying with ${fallbackModel}.`,
                    primaryError
                );
                result = await classifyImageWithModel(req, imageData, mimeType, fallbackModel);
            } else {
                throw primaryError;
            }
        }

        return NextResponse.json(result, { headers: CORS_HEADERS });

    } catch (error) {
        console.error("Error validating cake image:", error);

        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to validate image',
            quotaMessage: 'AI image validation is temporarily unavailable due to quota limits. Please try again later.',
            authorizationMessage: 'AI image validation is not authorized. Please check the Vertex AI and Workload Identity configuration, then confirm project access.',
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status, headers: CORS_HEADERS }
        );
    }
}
