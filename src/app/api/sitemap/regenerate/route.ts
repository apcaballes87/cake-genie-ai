import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const SITE_URL = 'https://genie.ph';
const SITEMAP_PATH = path.join(process.cwd(), 'public', 'sitemap.xml');

export async function POST(request: NextRequest) {
    try {
        // 1. AUTHENTICATION - Verify the request is from n8n
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token || token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // 2. FETCH ACTIVE PRODUCTS from Supabase
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: products, error } = await supabase
            .from('cakegenie_merchant_products')
            .select('slug, updated_at, image_url, title')
            .eq('is_active', true)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // 3. GENERATE SITEMAP XML
        const sitemap = generateSitemapXML(products || []);

        // 4. WRITE TO FILE SYSTEM
        await fs.writeFile(SITEMAP_PATH, sitemap, 'utf-8');

        // 5. SUCCESS RESPONSE
        return NextResponse.json({
            success: true,
            message: 'Sitemap regenerated successfully',
            products_count: products?.length || 0,
            timestamp: new Date().toISOString()
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Sitemap regeneration error:', error);
        return NextResponse.json(
            {
                error: 'Failed to regenerate sitemap',
                details: errorMessage
            },
            { status: 500 }
        );
    }
}

function generateSitemapXML(products: Array<{
    slug: string;
    updated_at: string;
    image_url: string | null;
    title: string;
}>): string {
    const now = new Date().toISOString();

    // Static pages (customize based on your actual pages)
    const staticPages = [
        { url: '', changefreq: 'daily', priority: '1.0' },
        { url: '/about', changefreq: 'monthly', priority: '0.8' },
        { url: '/contact', changefreq: 'monthly', priority: '0.8' },
        { url: '/search', changefreq: 'weekly', priority: '0.9' },
    ];

    const staticUrls = staticPages.map(page => `
  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('');

    // Product pages
    const productUrls = products.map(product => `
  <url>
    <loc>${SITE_URL}/product/${product.slug}</loc>
    <lastmod>${product.updated_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>${product.image_url ? `
    <image:image>
      <image:loc>${product.image_url}</image:loc>
    </image:image>` : ''}
  </url>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticUrls}${productUrls}
</urlset>`;
}
