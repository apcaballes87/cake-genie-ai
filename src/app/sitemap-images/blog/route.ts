import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildImageSitemapXml } from '../imageXmlUtils';

/**
 * Image sitemap for blog post featured images.
 * Served at: /sitemap-images/blog
 *
 * Uses post title as <image:title> and excerpt as <image:caption>.
 */

export const revalidate = 86400;

const BASE_URL = 'https://genie.ph';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: posts } = await supabase
        .from('cakegenie_blog_posts')
        .select('slug, title, image, excerpt')
        .not('image', 'is', null)
        .order('date', { ascending: false });

    const entries = (posts || []).map((post: any) => ({
        pageUrl: `${BASE_URL}/blog/${post.slug}`,
        imageUrl: post.image,
        title: post.title,
        caption: post.excerpt || post.title,
    }));

    const xml = buildImageSitemapXml(entries);

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
