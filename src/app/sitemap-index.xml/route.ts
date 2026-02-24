import { NextResponse } from 'next/server';

export async function GET() {
    const sitemaps = [
        'sitemap-core.xml',
        'sitemap-bakeries.xml',
        'sitemap-products.xml',
        'sitemap-blog.xml',
        'sitemap-categories.xml',
        'sitemap-designs.xml',
        'sitemap-searches.xml'
    ];
    const baseUrl = 'https://genie.ph';
    const today = new Date().toISOString();

    // Create a sitemap index that explicitly points to the generated sitemap chunks
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(filename => `  <sitemap>
    <loc>${baseUrl}/${filename}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;

    return new NextResponse(sitemapIndex, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
        },
    });
}
