import { NextRequest, NextResponse } from 'next/server';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { runActiveCakeAnalysis } from '@/lib/ai/analyzeCakeImage';

export const maxDuration = 150; // Internal timeout aborts well before this; keep some headroom for cleanup.

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
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageData, mimeType, sourceContext } = body;

        if (!imageData || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: imageData and mimeType' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const { result } = await runActiveCakeAnalysis({
            imageData,
            mimeType,
            requestContext: req,
            sourceContext: typeof sourceContext === 'string' ? sourceContext : null,
        });

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
