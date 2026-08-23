import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { getAllPromptVersions } from '@/services/prompts/promptLoader';
import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders(req: NextRequest): HeadersInit {
    const configuredOrigin = process.env.ADMIN_DASHBOARD_ORIGIN?.trim();
    const requestOrigin = req.headers.get('origin');
    const allowedOrigin = configuredOrigin
        ? requestOrigin === configuredOrigin ? requestOrigin : configuredOrigin
        : '*';

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'x-admin-pin',
        Vary: 'Origin',
    };
}

function authorized(req: NextRequest) {
    return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
    if (!authorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });
    }

    try {
        const admin = createAdminServerSupabaseClient();
        const versions = await getAllPromptVersions(
            admin as unknown as Parameters<typeof getAllPromptVersions>[0],
        );
        return NextResponse.json({ data: versions, total: versions.length }, { headers: corsHeaders(req) });
    } catch (error) {
        console.error('Error fetching prompt versions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch prompt versions' },
            { status: 500, headers: corsHeaders(req) },
        );
    }
}
