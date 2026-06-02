import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { buildSearchAnalysisGenerationConfig, postProcessSearchAnalysisResult } from '@/lib/admin/searchAnalysisContract';

export const maxDuration = 300; // Allow up to 300 seconds (Vercel Pro) for AI processing

// Abort ~5s before Vercel kills the function so we can return a clean 504.
const AI_REQUEST_TIMEOUT_MS = Math.max(1000, (maxDuration - 5) * 1000);

// Helper to get active prompt from Supabase (server-side)
// Note: We're not using the complex caching logic from the client service here 
// to keep the API route stateless and simple. If performance is an issue, we can add simple memory cache.
async function getActivePrompt(supabase: ReturnType<typeof createClient>): Promise<string> {
    const { data, error } = await supabase
        .from('ai_prompts')
        .select('prompt_text')
        .eq('is_active', true)
        .limit(1)
        .single();

    // In a real serverless environment, we might fallback if DB fails
    if (error || !data) {
        console.warn('Failed to fetch prompt from database in API route');
        // We'll rely on the default fallback prompt logic or throw
        throw new Error('Could not retrieve active prompt configuration');
    }

    return data.prompt_text;
}

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
            getActivePrompt(supabase).catch(() => null), // Fallback handled later if null
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
            model: "gemini-3-flash-preview",
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
