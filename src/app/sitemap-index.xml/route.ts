import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllBlogPosts } from '@/data/blogPosts';

// Cache the sitemap index for 24 hours to prevent Googlebot timeouts
export const revalidate = 86400;

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const today = new Date().toISOString();

    // Fetch latest updated dates to give Googlebot accurate `<lastmod>` per sitemap
    const { data: latestMerchant } = await supabase
        .from('cakegenie_merchants')
        .select('updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
    const bakeriesLastMod = latestMerchant?.updated_at ? new Date(latestMerchant.updated_at).toISOString() : today;

    const { data: latestProduct } = await supabase
        .from('cakegenie_merchant_products')
        .select('updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
    const productsLastMod = latestProduct?.updated_at ? new Date(latestProduct.updated_at).toISOString() : today;

    const { data: latestDesign, count: designCount } = await supabase
        .from('cakegenie_shared_designs')
        .select('created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    const designsLastMod = latestDesign?.created_at ? new Date(latestDesign.created_at).toISOString() : today;
    const designChunks = Math.ceil((designCount || 0) / 1000) || 1;

    const { data: latestCustomized, count: customCount } = await supabase
        .from('cakegenie_analysis_cache')
        .select('created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .not('slug', 'is', null)
        .limit(1)
        .single();
    const customizedLastMod = latestCustomized?.created_at ? new Date(latestCustomized.created_at).toISOString() : today;
    const customChunks = Math.ceil((customCount || 0) / 1000) || 1;

    const blogPosts = getAllBlogPosts();
    const latestBlogDate = blogPosts.length > 0
        ? new Date(Math.max(...blogPosts.map(post => new Date(post.date).getTime()))).toISOString()
        : today;

    const sitemaps = [
        { name: 'sitemap-core.xml', lastmod: today }, // Static pages change frequently due to dynamic features on them 
        { name: 'sitemap-bakeries.xml', lastmod: bakeriesLastMod },
        { name: 'sitemap-products.xml', lastmod: productsLastMod },
        { name: 'sitemap-blog.xml', lastmod: latestBlogDate },
        { name: 'sitemap-categories.xml', lastmod: today } // Built from dynamic recent search data
    ];

    for (let i = 0; i < designChunks; i++) {
        sitemaps.push({ name: `sitemap-designs-${i}.xml`, lastmod: designsLastMod });
    }

    for (let i = 0; i < customChunks; i++) {
        sitemaps.push({ name: `sitemap-customized-cakes-${i}.xml`, lastmod: customizedLastMod });
    }

    const baseUrl = 'https://genie.ph';

    // Create a sitemap index that explicitly points to the generated sitemap chunks
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(sm => `  <sitemap>
    <loc>${baseUrl}/${sm.name}</loc>
    <lastmod>${sm.lastmod}</lastmod>
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
