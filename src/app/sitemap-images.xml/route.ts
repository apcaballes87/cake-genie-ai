import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cache for 24 hours
export const revalidate = 86400;

/** Regex matching old 16-char hex-hash slugs that should be excluded */
const LEGACY_SLUG_RE = /[a-f0-9]{16}$/;

/** Site-wide license URL, matching the JSON-LD ImageObject on the slug page */
const LICENSE_URL = 'https://genie.ph/terms';

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

    // --- Customizing entries ---
    const customizingEntries = allItems
        // Exclude old 16-char hex-hash slugs (same filter as main sitemap)
        .filter((item: any) => !LEGACY_SLUG_RE.test(item.slug))
        .map((item: any) => {
            const imageLoc = sanitizeUrl(item.original_image_url);
            if (!imageLoc) return '';

            // Title logic: strip suffix and ensure "Cake Design" is always present
            // "Cake Design" matches what Filipino users search in Google Images
            const rawTitle = item.seo_title
                ? item.seo_title.replace(' | Genie.ph', '').trim()
                : `${item.keywords ? item.keywords.split(',')[0].trim() : 'Custom'} Cake Design`;
            const title = /cake\s*design/i.test(rawTitle) ? rawTitle : /cake\s*$/i.test(rawTitle) ? `${rawTitle} Design` : `${rawTitle} Cake Design`;

            // Caption logic: alt_text or fallback with mandatory suffix
            const caption = item.alt_text || `${title} — customize this cake design and get instant pricing on Genie.ph`;

            return `  <url>
    <loc>${baseUrl}/customizing/${item.slug}</loc>
    <image:image>
      <image:loc>${imageLoc}</image:loc>
      <image:title>${escapeXml(title)}</image:title>
      <image:caption>${escapeXml(caption)}</image:caption>
      <image:geo_location>Cebu, Philippines</image:geo_location>
      <image:license>${LICENSE_URL}</image:license>
    </image:image>
  </url>`;
        })
        .filter(Boolean);

    // --- Product entries ---
    // Products need merchant slug from the merchants table (joined via merchant_id)
    const productItems: any[] = [];
    offset = 0;
    hasMore = true;
    while (hasMore) {
        const { data } = await supabase
            .from('cakegenie_merchant_products')
            .select('slug, title, image_url, alt_text, short_description, merchant:cakegenie_merchants!merchant_id(slug)')
            .eq('is_active', true)
            .not('image_url', 'is', null)
            .range(offset, offset + BATCH_SIZE - 1);

        const batch = data || [];
        productItems.push(...batch);
        hasMore = batch.length === BATCH_SIZE;
        offset += BATCH_SIZE;
    }

    const productEntries = productItems
        .map((item: any) => {
            const imageLoc = sanitizeUrl(item.image_url);
            const merchantSlug = item.merchant?.slug;
            if (!imageLoc || !merchantSlug) return '';

            const title = escapeXml(item.title || 'Custom Cake');
            const caption = escapeXml(item.alt_text || item.short_description || `${item.title} — order custom cakes on Genie.ph`);

            return `  <url>
    <loc>${baseUrl}/shop/${merchantSlug}/${item.slug}</loc>
    <image:image>
      <image:loc>${imageLoc}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${caption}</image:caption>
      <image:geo_location>Cebu, Philippines</image:geo_location>
      <image:license>${LICENSE_URL}</image:license>
    </image:image>
  </url>`;
        })
        .filter(Boolean);

    // --- Blog entries ---
    const { data: blogPosts } = await supabase
        .from('blogs')
        .select('slug, title, image, excerpt')
        .not('image', 'is', null)
        .eq('is_published', true);

    const blogEntries = (blogPosts || [])
        .map((post: any) => {
            const imageLoc = sanitizeUrl(post.image);
            if (!imageLoc) return '';

            const title = escapeXml(post.title || 'Blog Post');
            const caption = escapeXml(post.excerpt || `${post.title} — read more on Genie.ph`);

            return `  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <image:image>
      <image:loc>${imageLoc}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${caption}</image:caption>
      <image:geo_location>Cebu, Philippines</image:geo_location>
      <image:license>${LICENSE_URL}</image:license>
    </image:image>
  </url>`;
        })
        .filter(Boolean);

    // --- Collection entries ---
    // Each collection page gets its top design images in the image sitemap
    const { data: collections } = await supabase
        .from('cakegenie_collections')
        .select('slug, name, description');

    const collectionEntries: string[] = [];
    if (collections && collections.length > 0) {
        // Build a map of collection images from the already-fetched analysis cache
        // Group designs by their tags to find images for each collection
        for (const col of collections) {
            // Find up to 5 designs that match this collection's slug/name in keywords
            const matchingDesigns = allItems
                .filter((item: any) => {
                    const kw = (item.keywords || '').toLowerCase();
                    const colName = (col.name || col.slug || '').toLowerCase().replace(/-/g, ' ');
                    return kw.includes(colName) || kw.includes(col.slug.replace(/-/g, ' '));
                })
                .slice(0, 5);

            if (matchingDesigns.length === 0) continue;

            const imageEntries = matchingDesigns
                .map((item: any) => {
                    const imageLoc = sanitizeUrl(item.original_image_url);
                    if (!imageLoc) return '';
                    const kw = item.keywords ? item.keywords.split(',')[0].trim() : col.name;
                    const title = escapeXml(`${kw} ${col.name} cake design`);
                    const caption = escapeXml(`${kw} cake design — browse the ${col.name} collection on Genie.ph`);
                    return `    <image:image>
      <image:loc>${imageLoc}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${caption}</image:caption>
      <image:geo_location>Cebu, Philippines</image:geo_location>
      <image:license>${LICENSE_URL}</image:license>
    </image:image>`;
                })
                .filter(Boolean);

            if (imageEntries.length > 0) {
                collectionEntries.push(`  <url>
    <loc>${baseUrl}/collections/${col.slug}</loc>
${imageEntries.join('\n')}
  </url>`);
            }
        }
    }

    const entries = [...customizingEntries, ...productEntries, ...blogEntries, ...collectionEntries].join('\n');

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
