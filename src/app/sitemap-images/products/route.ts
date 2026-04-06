import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildImageSitemapXml } from '../imageXmlUtils';

/**
 * Image sitemap for merchant product pages.
 * Served at: /sitemap-images/products
 *
 * Includes <image:title> and <image:caption> for each product image,
 * derived from the product alt_text, title, and merchant name.
 */

export const revalidate = 86400;

const BASE_URL = 'https://genie.ph';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: products } = await supabase
        .from('cakegenie_merchant_products')
        .select(`
            slug,
            title,
            image_url,
            alt_text,
            short_description,
            cakegenie_merchants!inner(slug, business_name, city)
        `)
        .eq('is_active', true)
        .not('image_url', 'is', null);

    const entries = (products || []).map((product: any) => {
        const merchantSlug = product.cakegenie_merchants?.slug || '';
        const merchantName = product.cakegenie_merchants?.business_name || 'Genie.ph';
        const city = product.cakegenie_merchants?.city || 'Cebu';

        const title = product.alt_text || `${product.title} — Custom Cake by ${merchantName}`;
        const caption =
            product.alt_text ||
            product.short_description ||
            `${product.title} from ${merchantName} in ${city}. Order custom cakes on Genie.ph.`;

        return {
            pageUrl: `${BASE_URL}/shop/${merchantSlug}/${product.slug}`,
            imageUrl: product.image_url,
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
