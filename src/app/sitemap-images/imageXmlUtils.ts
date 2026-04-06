/**
 * Shared utilities for generating Google image sitemap XML.
 * Spec: https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 */

/** Escape special XML characters in attribute values and text content. */
export function escapeXml(str: string | null | undefined): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Sanitize a Supabase storage URL — strips signed auth query params so the
 * base URL (which always resolves publicly) is used in the sitemap.
 * Non-Supabase URLs are returned as-is after XML escaping.
 */
export function sanitizeImageUrl(url: string | null | undefined): string {
    if (!url || url.startsWith('data:')) return '';
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('supabase')) {
            return `${parsed.origin}${parsed.pathname}`;
        }
        return escapeXml(url);
    } catch {
        return escapeXml(url ?? '');
    }
}

export interface ImageEntry {
    /** Canonical page URL */
    pageUrl: string;
    /** Image source URL (will be sanitized) */
    imageUrl: string | null | undefined;
    /** Short title for the image — used as <image:title> */
    title: string;
    /** Longer descriptive caption — used as <image:caption> */
    caption?: string;
}

/**
 * Builds the full XML string for a Google image sitemap.
 * Omits entries where imageUrl is empty after sanitization.
 */
export function buildImageSitemapXml(entries: ImageEntry[]): string {
    const urlElements = entries
        .map(({ pageUrl, imageUrl, title, caption }) => {
            const loc = sanitizeImageUrl(imageUrl);
            if (!loc) return '';

            const titleEsc = escapeXml(title);
            const captionEsc = escapeXml(caption || title);

            return `  <url>
    <loc>${escapeXml(pageUrl)}</loc>
    <image:image>
      <image:loc>${loc}</image:loc>
      <image:title>${titleEsc}</image:title>
      <image:caption>${captionEsc}</image:caption>
      <image:geo_location>Cebu, Philippines</image:geo_location>
    </image:image>
  </url>`;
        })
        .filter(Boolean)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlElements}
</urlset>`;
}
