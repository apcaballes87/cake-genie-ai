import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cache for 24 hours — matches other sitemaps
export const revalidate = 86400;

const BASE_URL = 'https://genie.ph';
const GEO_LOCATION = 'Cebu, Philippines';

/** Strip Supabase auth query params and XML-escape the result */
function sanitizeImageUrl(url: string | null | undefined): string {
    if (!url || url.startsWith('data:')) return '';
    try {
        const parsed = new URL(url);
        const clean = parsed.hostname.includes('supabase')
            ? `${parsed.origin}${parsed.pathname}`
            : url;
        return clean
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    } catch {
        return url
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

function escapeXml(str: string | null | undefined): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function imageEntry(pageUrl: string, imageUrl: string, title: string, caption: string, geoLocation?: string): string {
    const cleanImage = sanitizeImageUrl(imageUrl);
    if (!cleanImage) return '';
    return `  <url>
    <loc>${escapeXml(pageUrl)}</loc>
    <image:image>
      <image:loc>${cleanImage}</image:loc>
      <image:title>${escapeXml(title)}</image:title>
      <image:caption>${escapeXml(caption)}</image:caption>${geoLocation ? `
      <image:geo_location>${escapeXml(geoLocation)}</image:geo_location>` : ''}
    </image:image>
  </url>`;
}

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const entries: string[] = [];

    // ── Products ──────────────────────────────────────────────────────────────
    const { data: products } = await supabase
        .from('cakegenie_merchant_products')
        .select(`
            slug,
            title,
            alt_text,
            image_url,
            image_caption,
            cakegenie_merchants!inner(slug, business_name, city)
        `)
        .eq('is_active', true)
        .not('image_url', 'is', null);

    for (const product of products || []) {
        const merchant = (product as any).cakegenie_merchants;
        if (!merchant || !product.image_url) continue;

        const pageUrl = `${BASE_URL}/shop/${merchant.slug}/${product.slug}`;
        const title = product.title || 'Custom Cake';
        const caption =
            product.image_caption ||
            product.alt_text ||
            `${title} by ${merchant.business_name} — order custom cakes on Genie.ph`;
        const geo = merchant.city ? `${merchant.city}, Philippines` : GEO_LOCATION;

        const entry = imageEntry(pageUrl, product.image_url, title, caption, geo);
        if (entry) entries.push(entry);
    }

    // ── Shared Designs ────────────────────────────────────────────────────────
    const { data: designs } = await supabase
        .from('cakegenie_shared_designs')
        .select('url_slug, title, description, alt_text, customized_image_url, cake_type')
        .not('customized_image_url', 'is', null);

    for (const design of designs || []) {
        if (!design.customized_image_url) continue;

        const pageUrl = `${BASE_URL}/designs/${design.url_slug}`;
        const title = design.title || `Custom ${design.cake_type || 'Cake'} Design`;
        const caption =
            design.alt_text ||
            design.description ||
            `${title} — a custom cake design created on Genie.ph`;

        const entry = imageEntry(pageUrl, design.customized_image_url, title, caption, GEO_LOCATION);
        if (entry) entries.push(entry);
    }

    // ── Blog Posts ────────────────────────────────────────────────────────────
    const { data: blogPosts } = await supabase
        .from('blogs')
        .select('slug, title, image, excerpt, alt_text')
        .eq('is_published', true)
        .not('image', 'is', null);

    for (const post of blogPosts || []) {
        if (!post.image) continue;

        const pageUrl = `${BASE_URL}/blog/${post.slug}`;
        const title = post.title || 'Genie.ph Blog';
        const caption =
            (post as any).alt_text ||
            post.excerpt ||
            `${title} — read the full article on Genie.ph`;

        const entry = imageEntry(pageUrl, post.image, title, caption);
        if (entry) entries.push(entry);
    }

    // ── Merchant Cover Images ─────────────────────────────────────────────────
    const { data: merchants } = await supabase
        .from('cakegenie_merchants')
        .select('slug, business_name, city, cover_image_url, profile_image_url')
        .eq('is_active', true);

    for (const merchant of merchants || []) {
        if (merchant.cover_image_url) {
            const pageUrl = `${BASE_URL}/shop/${merchant.slug}`;
            const title = `${merchant.business_name} — Custom Cake Bakery`;
            const caption = `Cover photo of ${merchant.business_name}, a custom cake bakery on Genie.ph${merchant.city ? ` in ${merchant.city}` : ''}.`;
            const geo = merchant.city ? `${merchant.city}, Philippines` : GEO_LOCATION;

            const entry = imageEntry(pageUrl, merchant.cover_image_url, title, caption, geo);
            if (entry) entries.push(entry);
        }
        if (merchant.profile_image_url && merchant.profile_image_url !== merchant.cover_image_url) {
            const pageUrl = `${BASE_URL}/shop/${merchant.slug}`;
            const title = `${merchant.business_name} Logo`;
            const caption = `Profile image of ${merchant.business_name}, a custom cake bakery on Genie.ph.`;
            const geo = merchant.city ? `${merchant.city}, Philippines` : GEO_LOCATION;

            const entry = imageEntry(pageUrl, merchant.profile_image_url, title, caption, geo);
            if (entry) entries.push(entry);
        }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
        },
    });
}
