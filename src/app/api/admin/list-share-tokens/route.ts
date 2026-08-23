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
    const onlyActive = url.searchParams.get('active') !== 'false';
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);

    const admin = createAdminServerSupabaseClient();

    let query = admin
        .from('cart_share_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (onlyActive) {
        query = query
            .eq('is_revoked', false)
            .gt('expires_at', new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 400 },
        );
    }

    const tokens = (data || []).map((row) => ({
        token: row.token,
        is_revoked: row.is_revoked,
        created_at: row.created_at,
        expires_at: row.expires_at,
        renewed_at: row.renewed_at,
        admin_order_date: row.admin_order_date,
        admin_order_time_slot: row.admin_order_time_slot,
        admin_customer_name: row.admin_customer_name,
        admin_customer_contact: row.admin_customer_contact,
        admin_delivery_address: row.admin_delivery_address,
        admin_delivery_city: row.admin_delivery_city,
        design_slug: row.design_slug,
        design_p_hash: row.design_p_hash,
        cart_url: `https://genie.ph/cart?share_token=${row.token}`,
    }));

    return NextResponse.json({ tokens });
}
