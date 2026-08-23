import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RenewShareTokenBody {
    token: string;
}

function isAuthorized(req: NextRequest): boolean {
    return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
}

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: RenewShareTokenBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const token = String(body.token ?? '').trim();
    if (!token) {
        return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const admin = createAdminServerSupabaseClient();

    const { data, error } = await admin.rpc('admin_renew_share_token', {
        p_token: token,
    });

    if (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 400 },
        );
    }

    const result = data as {
        token?: string;
        expires_at?: string | Date;
        error?: string;
    } | null;

    if (!result || result.error) {
        return NextResponse.json(
            { error: result?.error || 'Failed to renew token' },
            { status: 400 },
        );
    }

    const expiresAt = result.expires_at;
    if (expiresAt instanceof Date) {
        return NextResponse.json({
            token: result.token,
            expires_at: expiresAt.toISOString(),
        });
    }

    return NextResponse.json({
        token: result.token,
        expires_at: expiresAt,
    });
}
