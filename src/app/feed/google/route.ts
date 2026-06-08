import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CakeThickness } from '@/types';
import { toGoogleMerchantId } from '@/lib/commerce/feedIds';
import { resolveGoogleFeedImage } from '@/lib/commerce/googleFeedImage';

// Cache for 6 hours
export const revalidate = 21600;

const FEED_PAGE_SIZE = 1000;
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
    'Bento Cupcake Set': '2 in',
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

    const designs = await fetchAllFeedDesigns(supabase);

    if (!designs) {
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

interface FeedDesign {
    slug: string;
    keywords: string | null;
    seo_title: string | null;
    seo_description: string | null;
    alt_text: string | null;
    original_image_url: string | null;
    studio_edited_image_url: string | null;
    price: number | null;
    analysis_json: { cakeType?: string } | null;
    tags: string[] | null;
    created_at: string;
}

async function fetchAllFeedDesigns(supabase: SupabaseClient): Promise<FeedDesign[] | null> {
    const designs: FeedDesign[] = [];
    let pageStart = 0;

    while (true) {
        const pageEnd = pageStart + FEED_PAGE_SIZE - 1;
        const { data, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('slug, keywords, seo_title, seo_description, alt_text, original_image_url, studio_edited_image_url, price, analysis_json, tags, created_at')
            .or('studio_edited_image_url.not.is.null,original_image_url.not.is.null')
            .not('slug', 'is', null)
            .order('created_at', { ascending: false })
            .range(pageStart, pageEnd);

        if (error) {
            console.error('Google feed error:', error.message);
            return null;
        }

        if (!data || data.length === 0) {
            break;
        }

        designs.push(...(data as FeedDesign[]));

        if (data.length < FEED_PAGE_SIZE) {
            break;
        }

        pageStart += FEED_PAGE_SIZE;
    }

    return designs;
}

async function fetchBasePrices(supabase: SupabaseClient): Promise<BasePriceMap> {
    const priceMap: BasePriceMap = {};
    const cakeTypes = Object.keys(CAKE_TYPE_THICKNESS_MAP);

    const { data, error } = await supabase
        .from('productsizes_cakegenie')
        .select('type, thickness, price')
        .in('type', cakeTypes)
        .order('price', { ascending: true });

    if (error) {
        console.error('Error fetching base prices:', error);
        return priceMap;
    }

    if (data) {
        for (const row of data) {
            const requiredThickness = CAKE_TYPE_THICKNESS_MAP[row.type];
            if (row.thickness === requiredThickness && priceMap[row.type] === undefined) {
                priceMap[row.type] = row.price;
            }
        }
    }

    return priceMap;
}

function resolvePrice(design: FeedDesign, basePrices: BasePriceMap): number {
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

function buildItem(design: FeedDesign, baseUrl: string, basePrices: BasePriceMap) {
    const tags = design.tags || [];
    const keywords = design.keywords || 'Custom';
    const title = design.seo_title
        || `${tags.length > 0 ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1) + ' ' : ''}${keywords} Cake`;
    const description = design.seo_description
        || design.alt_text
        || `Custom ${keywords} cake design from Genie.ph`;
    const link = `${baseUrl}/customizing/${design.slug}`;
    const imageUrl = resolveGoogleFeedImage(design);
    const price = resolvePrice(design, basePrices);

    return {
        id: toGoogleMerchantId(design.slug),
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
