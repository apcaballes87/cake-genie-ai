import { NextResponse } from 'next/server';

/**
 * Image Sitemap Index
 * Served at /sitemap-images (rewritten from /sitemap-images.xml via next.config.ts)
 *
 * References four sub-sitemaps with full image metadata:
 *   - /sitemap-images/products  — merchant product images
 *   - /sitemap-images/blog      — blog featured images
 *   - /sitemap-images/designs   — shared design images
 *   - /sitemap-images/cakes     — customized cake images
 *
 * Unlike the standard Next.js sitemap route (which only supports image URLs),
 * these custom XML routes include <image:title> and <image:caption> for richer
 * Google Images indexing.
 */

export const revalidate = 86400; // 24-hour ISR cache

const BASE_URL = 'https://genie.ph';

export async function GET() {
    const today = new Date().toISOString().split('T')[0];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemap-images/products</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-images/blog</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-images/designs</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-images/cakes</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
