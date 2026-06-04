import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { buildSearchAnalysisGenerationConfig, postProcessSearchAnalysisResult } from '@/lib/admin/searchAnalysisContract';
import { getAnalysisPromptWithFallback } from '@/services/prompts/promptLoader';

export const maxDuration = 300; // Allow up to 300 seconds (Vercel Pro) for AI processing

// Fail fast on slow AI calls so we can return a clean 504 well before Vercel kills the function.
// The analyze prompt is heavy; most successful calls complete in <90s.
const AI_REQUEST_TIMEOUT_MS = 120_000;

import { getDynamicTypeEnums } from '@/lib/ai/utils';

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

        const supabase = createClient();

        // Fetch inputs required for prompt construction
        const [activePrompt, typeEnums] = await Promise.all([
            getAnalysisPromptWithFallback(supabase).catch(() => null),
            getDynamicTypeEnums(supabase)
        ]);

        if (!activePrompt) {
            return NextResponse.json(
                { error: 'Failed to load analysis prompt configuration' },
                { status: 500 }
            );
        }

        const aiClient = getAI(req);
        const response = await aiClient.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: imageData } },
                    { text: activePrompt }
                ],
            }],
            config: {
                ...buildSearchAnalysisGenerationConfig(typeEnums),
                abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
            },
        });

        const jsonText = (response.text || '').trim();
        let result;
        try {
            result = JSON.parse(jsonText);

            result = postProcessSearchAnalysisResult(result);

        } catch {
            console.error("Failed to parse AI response:", jsonText);
            return NextResponse.json(
                { error: 'Invalid response format from AI' },
                { status: 500 }
            );
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error analyzing cake image:", error);

        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to analyze image',
            quotaMessage: 'AI cake analysis is temporarily unavailable due to quota limits. Please try again later.',
            authorizationMessage: 'AI cake analysis is not authorized. Please check the Vertex AI and Workload Identity configuration, then confirm project access.',
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status }
        );
    }
}
