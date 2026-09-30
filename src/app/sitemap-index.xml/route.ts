import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllBlogs } from '@/services/supabaseService';
import {
    getSitemapChunkHints,
} from '@/lib/sitemap/indexability';

export const dynamic = 'force-dynamic';

function validIsoDate(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function latestIsoDate(...values: Array<string | null | undefined>): string | undefined {
    const dates = values.map(validIsoDate).filter((value): value is string => Boolean(value));
    return dates.length ? dates.sort().at(-1) : undefined;
}

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: latestMerchant, error: merchantError } = await supabase
        .from('cakegenie_merchants')
        .select('updated_at')
        .eq('is_active', true)
        .not('updated_at', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (merchantError) throw merchantError;

    const { data: latestProduct, error: productError } = await supabase
        .from('cakegenie_merchant_products')
        .select('updated_at, cakegenie_merchants!inner(is_active)')
        .eq('is_active', true)
        .eq('cakegenie_merchants.is_active', true)
        .not('updated_at', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (productError) throw productError;

    const {
        customizedChunkCount: customChunks,
        customizedLastMod,
        sharedDesignChunkCount: designChunks,
        sharedDesignLastMod,
    } = await getSitemapChunkHints();

    const { data: blogPosts, error: blogError } = await getAllBlogs();
    if (blogError) throw blogError;
    const posts = blogPosts || [];
    const latestBlogDate = latestIsoDate(...posts.map((post) => post.updated_at || post.date));

    const sitemaps: Array<{ name: string; lastmod?: string }> = [
        { name: 'sitemap-core.xml' },
        { name: 'sitemap-bakeries.xml', lastmod: validIsoDate(latestMerchant?.updated_at) },
        { name: 'sitemap-products.xml', lastmod: validIsoDate(latestProduct?.updated_at) },
        { name: 'sitemap-blog.xml', lastmod: latestBlogDate },
        { name: 'sitemap-images.xml', lastmod: latestIsoDate(
            customChunks > 0 ? customizedLastMod : null,
            designChunks > 0 ? sharedDesignLastMod : null,
        ) },
    ];

    for (let i = 0; i < designChunks; i++) {
        sitemaps.push({ name: `sitemap-designs-${i}.xml`, lastmod: validIsoDate(sharedDesignLastMod) });
    }

    for (let i = 0; i < customChunks; i++) {
        sitemaps.push({ name: `sitemap-customized-cakes-${i}.xml`, lastmod: validIsoDate(customizedLastMod) });
    }

    const baseUrl = 'https://genie.ph';

    // Create a sitemap index that explicitly points to the generated sitemap chunks
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(sm => `  <sitemap>
    <loc>${baseUrl}/${sm.name}</loc>${sm.lastmod ? `
    <lastmod>${sm.lastmod}</lastmod>` : ''}
  </sitemap>`).join('\n')}
</sitemapindex>`;

    return new NextResponse(sitemapIndex, {
        headers: {
            'Content-Type': 'application/xml',
            // Lower cache time slightly to ensure lastmods stay fresh
            'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=43200',
        },
    });
}
