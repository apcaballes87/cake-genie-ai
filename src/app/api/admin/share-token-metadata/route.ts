import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
    return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const token = url.searchParams.get('token')?.trim();

    if (!token) {
        return NextResponse.json({ error: 'token query parameter is required' }, { status: 400 });
    }

    const admin = createAdminServerSupabaseClient();

    const { data, error } = await admin.rpc('admin_get_shared_cart_metadata', {
        p_token: token,
    });

    if (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 400 },
        );
    }

    const result = data as Record<string, unknown> | null;

    if (!result || result.error) {
        return NextResponse.json(
            { error: result?.error || 'Token not found' },
            { status: 404 },
        );
    }

    return NextResponse.json(result);
}
