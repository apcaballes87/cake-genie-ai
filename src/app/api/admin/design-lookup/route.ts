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
    const slug = url.searchParams.get('slug')?.trim();

    if (!slug) {
        return NextResponse.json({ error: 'slug query parameter is required' }, { status: 400 });
    }

    const admin = createAdminServerSupabaseClient();

    const { data, error } = await admin
        .from('cakegenie_analysis_cache')
        .select('slug, p_hash, price, keywords, original_image_url, studio_edited_image_url, analysis_json')
        .eq('slug', slug)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Design not found', found: false }, { status: 404 });
    }

    const analysis = data.analysis_json || {};

    const result = {
        slug: data.slug,
        p_hash: data.p_hash,
        price: data.price,
        keywords: data.keywords,
        original_image_url: data.original_image_url,
        studio_edited_image_url: data.studio_edited_image_url,
        cake_type: analysis.cakeType || '1 Tier',
        cake_thickness: analysis.cakeThickness || '4 in',
        cake_size: analysis.cakeSize || null,
        availability: analysis.availability || null,
        found: true,
    };

    return NextResponse.json(result);
}
