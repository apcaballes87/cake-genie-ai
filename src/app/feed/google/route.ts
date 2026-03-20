import { createClient } from '@supabase/supabase-js';
import { CakeThickness } from '@/types';

// Cache for 6 hours
export const revalidate = 21600;

const FALLBACK_MIN_PRICE = 1099;

const CAKE_TYPE_THICKNESS_MAP: Record<string, CakeThickness> = {
    '1 Tier': '4 in',
    '2 Tier': '4 in',
    '3 Tier': '4 in',
    'Square': '3 in',
    'Rectangle': '3 in',
    '1 Tier Fondant': '5 in',
    '2 Tier Fondant': '5 in',
    '3 Tier Fondant': '5 in',
    'Square Fondant': '5 in',
    'Rectangle Fondant': '5 in',
    'Bento': '2 in',
};

/**
 * Google Merchant Center Product Feed
 *
 * Generates an XML product feed following Google Shopping spec.
 * Add this URL in GMC → Products → Feeds → Add primary feed:
 *   https://genie.ph/feed/google
 */
export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch all designs with images
    const { data: designs, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('slug, keywords, seo_title, seo_description, alt_text, original_image_url, price, analysis_json, tags, created_at')
        .not('original_image_url', 'is', null)
        .not('slug', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10000);

    if (error) {
        console.error('Google feed error:', error.message);
        return new Response('Feed generation failed', { status: 500 });
    }

    // Fetch base prices for all cake types to resolve missing prices
    const basePrices = await fetchBasePrices(supabase);

    const baseUrl = 'https://genie.ph';
    const items = (designs || []).map(design => buildItem(design, baseUrl, basePrices));

    const xml = generateGoogleFeedXml(baseUrl, items);

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=21600, s-maxage=21600',
        },
    });
}

// ─── Helpers ──────────────────────────────────────────

interface BasePriceMap {
    [cakeType: string]: number; // minimum price for each cake type
}

async function fetchBasePrices(supabase: any): Promise<BasePriceMap> {
    const priceMap: BasePriceMap = {};

    for (const [cakeType, thickness] of Object.entries(CAKE_TYPE_THICKNESS_MAP)) {
        const { data } = await supabase
            .from('productsizes_cakegenie')
            .select('price')
            .eq('type', cakeType)
            .eq('thickness', thickness)
            .order('price', { ascending: true })
            .limit(1);

        if (data && data.length > 0) {
            priceMap[cakeType] = data[0].price;
        }
    }

    return priceMap;
}

function resolvePrice(design: any, basePrices: BasePriceMap): number {
    // 1. Use cached price if valid
    if (design.price && design.price > 0) {
        return Math.round(design.price);
    }

    // 2. Look up minimum base price by cake type
    const cakeType = design.analysis_json?.cakeType;
    if (cakeType && basePrices[cakeType]) {
        return basePrices[cakeType];
    }

    // 3. Fallback
    return FALLBACK_MIN_PRICE;
}

function buildItem(design: any, baseUrl: string, basePrices: BasePriceMap) {
    const tags = design.tags || [];
    const keywords = design.keywords || 'Custom';
    const title = design.seo_title
        || `${tags.length > 0 ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1) + ' ' : ''}${keywords} Cake`;
    const description = design.seo_description
        || design.alt_text
        || `Custom ${keywords} cake design from Genie.ph`;
    const link = `${baseUrl}/customizing/${design.slug}`;
    const imageUrl = sanitizeImageUrl(design.original_image_url);
    const price = resolvePrice(design, basePrices);

    return {
        id: design.slug,
        title: sanitizeXml(title.substring(0, 150)),
        description: sanitizeXml(description.substring(0, 5000)),
        link,
        imageUrl,
        price,
        availability: 'in_stock',
    };
}

function sanitizeXml(text: string): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function sanitizeImageUrl(url: string | null): string {
    if (!url || url.startsWith('data:')) return '';
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('supabase')) {
            return `${parsed.origin}${parsed.pathname}`;
        }
        return url;
    } catch {
        return url || '';
    }
}

interface FeedItem {
    id: string;
    title: string;
    description: string;
    link: string;
    imageUrl: string;
    price: number;
    availability: string;
}

function generateGoogleFeedXml(baseUrl: string, items: FeedItem[]): string {
    const itemsXml = items
        .filter(item => item.imageUrl)
        .map(item => `    <item>
      <g:id>${sanitizeXml(item.id)}</g:id>
      <g:title>${item.title}</g:title>
      <g:description>${item.description}</g:description>
      <g:link>${sanitizeXml(item.link)}</g:link>
      <g:image_link>${sanitizeXml(item.imageUrl)}</g:image_link>
      <g:price>${item.price}.00 PHP</g:price>
      <g:availability>${item.availability}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>Genie.ph</g:brand>
      <g:product_type>Food, Beverages &amp; Tobacco &gt; Food Items &gt; Bakery &gt; Cakes</g:product_type>
      <g:shipping>
        <g:country>PH</g:country>
        <g:price>0 PHP</g:price>
      </g:shipping>
    </item>`)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Genie.ph - Custom Cake Designs</title>
    <link>${sanitizeXml(baseUrl)}</link>
    <description>Custom cake designs with instant AI pricing from Genie.ph</description>
${itemsXml}
  </channel>
</rss>`;
}
