import { NextRequest, NextResponse } from 'next/server';
import { PromptComparisonError, runCakeAnalysisWithVersion } from '@/lib/admin/promptComparison';
import { normalizeAiRouteError } from '@/lib/ai/routeError';
import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function corsHeaders(req: NextRequest): HeadersInit {
    const configuredOrigin = process.env.ADMIN_DASHBOARD_ORIGIN?.trim();
    const requestOrigin = req.headers.get('origin');
    const allowedOrigin = configuredOrigin
        ? requestOrigin === configuredOrigin ? requestOrigin : configuredOrigin
        : '*';

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin',
        Vary: 'Origin',
    };
}

function json(req: NextRequest, body: unknown, status = 200) {
    return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

function authorized(req: NextRequest) {
    return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
    if (!authorized(req)) {
        return json(req, { error: 'Unauthorized' }, 401);
    }

    try {
        const body = await req.json().catch(() => ({}));
        const pHash = typeof body?.pHash === 'string' ? body.pHash.trim() : '';
        const promptVersion = typeof body?.promptVersion === 'string' ? body.promptVersion.trim() : '';

        if (!pHash) {
            return json(req, { error: 'Missing required field: pHash' }, 400);
        }
        if (!promptVersion) {
            return json(req, { error: 'Missing required field: promptVersion' }, 400);
        }

        const result = await runCakeAnalysisWithVersion(pHash, promptVersion, req);
        return json(req, result);
    } catch (error) {
        if (error instanceof PromptComparisonError) {
            return json(req, { error: error.message }, error.status);
        }

        const normalized = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to run cake analysis with the selected prompt version.',
            quotaMessage: 'AI cake analysis is temporarily unavailable due to quota limits. Please try again later.',
            authorizationMessage: 'AI cake analysis is not authorized. Please check the AI provider configuration and try again.',
        });

        return json(req, { error: normalized.message }, normalized.status);
    }
}
