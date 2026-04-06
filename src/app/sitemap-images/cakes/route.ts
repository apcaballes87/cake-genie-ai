import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildImageSitemapXml } from '../imageXmlUtils';

/**
 * Image sitemap for customized cake design pages (/customizing/:slug).
 * Served at: /sitemap-images/cakes
 *
 * Draws from cakegenie_analysis_cache — the largest dataset (8,000+ entries).
 * Limited to the 10,000 most-recent slugged designs (within Google's 50,000 limit).
 * Slugs matching a raw hex suffix (legacy/unindexed) are excluded.
 */

export const revalidate = 86400;

const BASE_URL = 'https://genie.ph';
const LIMIT = 10_000;

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: cakes } = await supabase
        .from('cakegenie_analysis_cache')
        .select('slug, keywords, original_image_url, alt_text, seo_title, seo_description')
        .not('slug', 'is', null)
        .not('original_image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(LIMIT);

    const entries = (cakes || [])
        // Exclude legacy slugs that are just a raw hex hash (no SEO value)
        .filter((cake: any) => !/[a-f0-9]{16}$/.test(cake.slug))
        .map((cake: any) => {
            const keywords = cake.keywords || 'Custom';
            const title =
                cake.seo_title ||
                cake.alt_text ||
                `${keywords} Cake Design`;

            // Ensure title includes "cake design" phrase for Google Images matching
            const normalizedTitle = /cake\s*design/i.test(title)
                ? title
                : /cake\s*$/i.test(title)
                ? `${title} Design`
                : `${title} Cake Design`;

            const caption =
                cake.alt_text ||
                cake.seo_description ||
                `${keywords} cake design — custom cake available on Genie.ph`;

            return {
                pageUrl: `${BASE_URL}/customizing/${cake.slug}`,
                imageUrl: cake.original_image_url,
                title: normalizedTitle,
                caption,
            };
        });

    const xml = buildImageSitemapXml(entries);

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
