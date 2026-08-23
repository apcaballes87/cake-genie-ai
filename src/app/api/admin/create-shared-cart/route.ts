import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateSharedCartBody {
    slug: string;
    quantity?: number;
    orderDate?: string;
    timeSlot?: string;
    customerName?: string;
    customerContact?: string;
    deliveryAddress?: string;
    deliveryCity?: string;
}

function isAuthorized(req: NextRequest): boolean {
    return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
}

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: CreateSharedCartBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const slug = String(body.slug ?? '').trim();
    if (!slug) {
        return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const quantity = Number(body.quantity ?? 1) || 1;

    const admin = createAdminServerSupabaseClient();

    const { data, error } = await admin.rpc('admin_create_shared_cart', {
        p_slug: slug,
        p_quantity: quantity,
        p_order_date: body.orderDate ? new Date(body.orderDate).toISOString().slice(0, 10) : null,
        p_time_slot: body.timeSlot || null,
        p_customer_name: body.customerName || null,
        p_customer_contact: body.customerContact || null,
        p_delivery_address: body.deliveryAddress || null,
        p_delivery_city: body.deliveryCity || null,
    });

    if (error) {
        return NextResponse.json(
            { error: error.message, details: error },
            { status: 400 },
        );
    }

    const result = data as {
        token?: string;
        cart_url?: string;
        expires_at?: string;
        error?: string;
    } | null;

    if (!result || result.error) {
        return NextResponse.json(
            { error: result?.error || 'Failed to create shared cart' },
            { status: 400 },
        );
    }

    return NextResponse.json({
        token: result.token,
        cart_url: result.cart_url,
        expires_at: result.expires_at,
    });
}
