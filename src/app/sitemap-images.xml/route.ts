import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cache for 24 hours
export const revalidate = 86400;

/**
 * Sanitize URL for XML sitemap
 */
const sanitizeUrl = (url: string | null | undefined): string => {
    if (!url || url.startsWith('data:')) return ''
    try {
        const parsed = new URL(url)
        if (parsed.hostname.includes('supabase')) {
            return `${parsed.origin}${parsed.pathname}`
        }
        return url
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
    } catch {
        return url ? url
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;') : ''
    }
}

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const baseUrl = 'https://genie.ph';

    // Fetch all customizing pages with images
    const { data: items } = await supabase
        .from('cakegenie_analysis_cache')
        .select('slug, seo_title, alt_text, original_image_url, keywords')
        .not('slug', 'is', null)
        .not('original_image_url', 'is', null)
        .order('created_at', { ascending: false });

    const entries = (items || []).map((item: any) => {
        const loc = `${baseUrl}/customizing/${item.slug}`;
        const imageLoc = sanitizeUrl(item.original_image_url);
        
        // Title logic: strip suffix or fallback to keywords
        const title = item.seo_title
            ? item.seo_title.replace(' | Genie.ph', '').trim()
            : `${item.keywords ? item.keywords.split(',')[0].trim() : 'Custom'} Cake Design`;
            
        // Caption logic: alt_text or fallback with mandatory suffix
        const caption = item.alt_text || `${title} — customize this cake design and get instant pricing on Genie.ph`;
        
        return `  <url>
    <loc>${loc}</loc>
    <image:image>
      <image:loc>${imageLoc}</image:loc>
      <image:title>${title.replace(/&/g, '&amp;')}</image:title>
      <image:caption>${caption.replace(/&/g, '&amp;')}</image:caption>
      <image:geo_location>Cebu, Philippines</image:geo_location>
    </image:image>
  </url>`;
    }).join('\n');

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
