import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildImageSitemapXml } from '../imageXmlUtils';

/**
 * Image sitemap for shared design pages (/designs/:slug).
 * Served at: /sitemap-images/designs
 *
 * Uses the design title as <image:title> and description/alt_text as <image:caption>.
 * Limited to 10,000 most-recent entries (well within Google's 50,000 limit).
 */

export const revalidate = 86400;

const BASE_URL = 'https://genie.ph';
const LIMIT = 10_000;

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: designs } = await supabase
        .from('cakegenie_shared_designs')
        .select('url_slug, title, customized_image_url, alt_text, description')
        .not('customized_image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(LIMIT);

    const entries = (designs || []).map((design: any) => {
        const title = design.title || 'Custom Cake Design';
        const caption =
            design.alt_text ||
            design.description ||
            `${title} — custom cake design available on Genie.ph`;

        return {
            pageUrl: `${BASE_URL}/designs/${design.url_slug}`,
            imageUrl: design.customized_image_url,
            title,
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
