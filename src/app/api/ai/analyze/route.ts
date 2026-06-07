import { NextRequest, NextResponse } from 'next/server';
import { getAI, getOrCreatePromptCache } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { buildSearchAnalysisGenerationConfig, postProcessSearchAnalysisResult } from '@/lib/admin/searchAnalysisContract';
import { getActivePromptDetails } from '@/services/prompts/promptLoader';
import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { logRejectedUpload } from '@/lib/ai/rejectedUploads';

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
// The analyze prompt is heavy; most successful calls complete in <90s.
const AI_REQUEST_TIMEOUT_MS = 120_000;
const ANALYSIS_MODEL = "gemini-3.1-flash-lite-preview";

import { getDynamicTypeEnums } from '@/lib/ai/utils';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageData, mimeType, sourceContext, turnstileToken } = body;

        if (!imageData || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: imageData and mimeType' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // Bypass Turnstile check if it's an admin request using the pin
        const adminPin = req.headers.get('x-admin-pin');
        const isAdmin = adminPin === '231323';

        if (!isAdmin) {
            const ip = req.headers.get('x-forwarded-for') || (req as any).ip || undefined;
            const { verifyTurnstileToken } = await import('@/lib/security/turnstile');
            const turnstileResult = await verifyTurnstileToken(turnstileToken, ip);

            if (!turnstileResult.success) {
                return NextResponse.json(
                    { error: turnstileResult.error || 'Security check failed. Please try again.' },
                    { status: 400, headers: CORS_HEADERS }
                );
            }
        }

        const supabase = createClient();

        // Fetch inputs required for prompt construction
        const [promptDetails, typeEnums] = await Promise.all([
            getActivePromptDetails(supabase as unknown as Parameters<typeof getActivePromptDetails>[0]).catch(() => null),
            getDynamicTypeEnums(supabase)
        ]);

        if (!promptDetails) {
            return NextResponse.json(
                { error: 'Failed to load analysis prompt configuration' },
                { status: 500, headers: CORS_HEADERS }
            );
        }

        const aiClient = getAI(req);
        const baseConfig = buildSearchAnalysisGenerationConfig(typeEnums);

        let response;
        let cacheName: string | null = null;

        // Try to get or create an active context cache for Vertex AI
        try {
            cacheName = await getOrCreatePromptCache(
                aiClient,
                promptDetails.promptText,
                promptDetails.version,
                SYSTEM_INSTRUCTION
            );
        } catch (cacheErr) {
            console.warn('[AI Cache] Failed to create or retrieve context cache:', cacheErr);
        }

        if (cacheName) {
            // Remove systemInstruction from generation config because it is already stored inside the cached content
            const cachedConfig = { ...baseConfig };
            delete (cachedConfig as { systemInstruction?: unknown }).systemInstruction;

            response = await aiClient.models.generateContent({
                model: ANALYSIS_MODEL,
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageData } }
                    ],
                }],
                config: {
                    ...cachedConfig,
                    cachedContent: cacheName,
                    abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                },
            });
        } else {
            // Fallback to uncached generation if cache lookup fails
            response = await aiClient.models.generateContent({
                model: ANALYSIS_MODEL,
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageData } },
                        { text: promptDetails.promptText }
                    ],
                }],
                config: {
                    ...baseConfig,
                    abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                },
            });
        }

        const jsonText = (response.text || '').trim();
        let result;
        try {
            result = JSON.parse(jsonText);

            result = postProcessSearchAnalysisResult(result);

        } catch {
            console.error("Failed to parse AI response:", jsonText);
            return NextResponse.json(
                { error: 'Invalid response format from AI' },
                { status: 500, headers: CORS_HEADERS }
            );
        }

        const rejection = result?.rejection as { isRejected?: boolean; reason?: string; message?: string } | undefined;
        if (rejection?.isRejected) {
            await logRejectedUpload({
                imageData,
                mimeType,
                rejection,
                modelName: ANALYSIS_MODEL,
                promptVersion: promptDetails.version,
                sourceRoute: 'api/ai/analyze',
                sourceContext: typeof sourceContext === 'string' ? sourceContext : null,
                request: req,
            });
        }

        return NextResponse.json(result, { headers: CORS_HEADERS });

    } catch (error) {
        console.error("Error analyzing cake image:", error);

        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to analyze image',
            quotaMessage: 'AI cake analysis is temporarily unavailable due to quota limits. Please try again later.',
            authorizationMessage: 'AI cake analysis is not authorized. Please check the Vertex AI and Workload Identity configuration, then confirm project access.',
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status, headers: CORS_HEADERS }
        );
    }
}
