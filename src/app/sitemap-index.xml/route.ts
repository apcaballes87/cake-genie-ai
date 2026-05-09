import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllBlogs } from '@/services/supabaseService';
import {
    getIndexableCustomizedCakeRows,
    getIndexableSharedDesignRows,
    SITEMAP_CHUNK_SIZE,
    SITEMAP_REVALIDATE_SECONDS,
} from '@/lib/sitemap/indexability';

// Cache the sitemap index for 24 hours to prevent Googlebot timeouts
export const revalidate = SITEMAP_REVALIDATE_SECONDS;

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

    const customizedCakes = await getIndexableCustomizedCakeRows();
    const customizedCakeSlugs = new Set(customizedCakes.map((cake) => cake.slug));
    const sharedDesigns = (await getIndexableSharedDesignRows())
        .filter((design) => !customizedCakeSlugs.has(design.url_slug));

    const customizedLastMod = customizedCakes[0]?.created_at
        ? new Date(customizedCakes[0].created_at).toISOString()
        : today;
    const customChunks = customizedCakes.length > 0
        ? Math.ceil(customizedCakes.length / SITEMAP_CHUNK_SIZE)
        : 0;

    const designsLastMod = sharedDesigns[0]?.created_at
        ? new Date(sharedDesigns[0].created_at).toISOString()
        : today;
    const designChunks = Math.ceil(sharedDesigns.length / SITEMAP_CHUNK_SIZE) || 0;

    // Fetch blog posts from Supabase
    const { data: blogPosts } = await getAllBlogs();
    const posts = blogPosts || [];
    const latestBlogDate = posts.length > 0
        ? new Date(Math.max(...posts.map(post => new Date(post.date).getTime()))).toISOString()
        : today;

    const sitemaps = [
        { name: 'sitemap-core.xml', lastmod: today }, // Static pages change frequently due to dynamic features on them 
        { name: 'sitemap-bakeries.xml', lastmod: bakeriesLastMod },
        { name: 'sitemap-products.xml', lastmod: productsLastMod },
        { name: 'sitemap-blog.xml', lastmod: latestBlogDate },
        { name: 'sitemap-images.xml', lastmod: customizedLastMod },
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
