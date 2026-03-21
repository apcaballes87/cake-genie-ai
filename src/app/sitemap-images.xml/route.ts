import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cache for 24 hours
export const revalidate = 86400;

/** Regex matching old 16-char hex-hash slugs that should be excluded */
const LEGACY_SLUG_RE = /[a-f0-9]{16}$/;

/**
 * Sanitize a URL for XML sitemap output.
 * Strips query params from Supabase storage URLs and XML-escapes all others.
 */
const sanitizeUrl = (url: string | null | undefined): string => {
    if (!url || url.startsWith('data:')) return '';
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('supabase')) {
            return `${parsed.origin}${parsed.pathname}`;
        }
        return escapeXml(url);
    } catch {
        return url ? escapeXml(url) : '';
    }
};

/** Escape all XML special characters */
const escapeXml = (str: string): string =>
    str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const baseUrl = 'https://genie.ph';

    // Fetch all entries in paginated batches (Supabase default limit is 1000)
    const BATCH_SIZE = 1000;
    const allItems: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data } = await supabase
            .from('cakegenie_analysis_cache')
            .select('slug, seo_title, alt_text, original_image_url, keywords')
            .not('slug', 'is', null)
            .not('original_image_url', 'is', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);

        const batch = data || [];
        allItems.push(...batch);
        hasMore = batch.length === BATCH_SIZE;
        offset += BATCH_SIZE;
    }

    const entries = allItems
        // Exclude old 16-char hex-hash slugs (same filter as main sitemap)
        .filter((item: any) => !LEGACY_SLUG_RE.test(item.slug))
        .map((item: any) => {
            const imageLoc = sanitizeUrl(item.original_image_url);
            if (!imageLoc) return '';

            // Title logic: strip suffix or fallback to keywords
            const title = item.seo_title
                ? item.seo_title.replace(' | Genie.ph', '').trim()
                : `${item.keywords ? item.keywords.split(',')[0].trim() : 'Custom'} Cake Design`;

            // Caption logic: alt_text or fallback with mandatory suffix
            const caption = item.alt_text || `${title} — customize this cake design and get instant pricing on Genie.ph`;

            return `  <url>
    <loc>${baseUrl}/customizing/${item.slug}</loc>
    <image:image>
      <image:loc>${imageLoc}</image:loc>
      <image:title>${escapeXml(title)}</image:title>
      <image:caption>${escapeXml(caption)}</image:caption>
    </image:image>
  </url>`;
        })
        .filter(Boolean)
        .join('\n');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries}
</urlset>`;

    return new NextResponse(sitemap, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=43200',
        },
    });
}
