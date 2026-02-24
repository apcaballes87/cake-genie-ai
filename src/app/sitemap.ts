import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getAllBlogPosts } from '@/data/blogPosts'

// Cache the sitemaps for 24 hours to prevent Googlebot timeouts on cold starts
export const revalidate = 86400;

/**
 * Sanitize URL for XML sitemap
 * - For Supabase storage URLs: strips query params (they're just auth tokens)
 * - For other URLs: keeps full URL (query params may be essential)
 * - Properly encodes ampersands for XML safety
 */
const sanitizeUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    try {
        const parsed = new URL(url)

        // Only strip query params for Supabase storage URLs
        // (their query params are just signed tokens, base URL still works)
        if (parsed.hostname.includes('supabase')) {
            return `${parsed.origin}${parsed.pathname}`
        }

        // For other URLs, keep the full URL but XML escape it
        // Next.js sitemap generator doesn't seem to always escape image URLs correctly
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

// Generate sitemap IDs.
export async function generateSitemaps() {
    return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }];
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://genie.ph'
    const supabase = await createClient()

    // Next.js 15 breaking change runtime parameter parsing
    const resolvedId = typeof id === 'object' && id !== null && 'then' in (id as any) ? await (id as any) : id;
    const sitemapId = Number(resolvedId);

    // Chunk 0: Static Routes
    if (sitemapId === 0) {
        return [
            '',
            '/shop',
            '/customizing',
            '/collections',
            '/blog',
            '/about',
            '/cake-price-calculator',
            '/faq',
            '/how-to-order',
            '/contact',
            '/return-policy',
            '/terms',
            '/privacy',
            '/sitemap-html',
            '/compare',
            '/compare/genie-ph-vs-traditional-bakeries',
            '/compare/genie-ph-vs-social-media-ordering',
            '/compare/custom-cake-pricing-cebu',
        ].map((route) => ({
            url: `${baseUrl}${route}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1,
        }))
    }

    // Chunk 1: Bakeries (Merchants)
    if (sitemapId === 1) {
        const { data: merchants } = await supabase
            .from('cakegenie_merchants')
            .select('slug, updated_at')
            .eq('is_active', true)

        return (merchants || []).map((merchant) => ({
            url: `${baseUrl}/shop/${merchant.slug}`,
            lastModified: merchant.updated_at ? new Date(merchant.updated_at) : new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.9,
        }))
    }

    // Chunk 2: Products
    if (sitemapId === 2) {
        const { data: products } = await supabase
            .from('cakegenie_merchant_products')
            .select(`
                slug,
                updated_at,
                image_url,
                cakegenie_merchants!inner(slug)
            `)
            .eq('is_active', true)

        return (products || []).map((product: any) => ({
            url: `${baseUrl}/shop/${product.cakegenie_merchants.slug}/${product.slug}`,
            lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            images: sanitizeUrl(product.image_url) ? [sanitizeUrl(product.image_url)] : [],
        }))
    }

    // Chunk 3: Blog Posts
    if (sitemapId === 3) {
        const blogPosts = getAllBlogPosts()
        return blogPosts.map((post) => ({
            url: `${baseUrl}/blog/${post.slug}`,
            lastModified: new Date(post.date),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        }))
    }

    // Chunk 4: Popular Search Categories
    if (sitemapId === 4) {
        const { data: recentSearchesFull } = await supabase
            .from('cakegenie_analysis_cache')
            .select('keywords')
            .not('slug', 'is', null)
            .limit(5000)

        const keywordMap = new Map<string, number>()
        for (const search of (recentSearchesFull || [])) {
            const kw = (search.keywords || '').trim()
            if (!kw) continue
            keywordMap.set(kw, (keywordMap.get(kw) || 0) + 1)
        }
        return Array.from(keywordMap.entries())
            .filter(([, count]) => count >= 3)
            .map(([keyword]) => ({
                url: `${baseUrl}/customizing/category/${keyword.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}`,
                lastModified: new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.8,
            }))
    }

    // Chunk 5: Shared Designs
    if (sitemapId === 5) {
        const { data: designs } = await supabase
            .from('cakegenie_shared_designs')
            .select('url_slug, created_at, customized_image_url')
            .order('created_at', { ascending: false })
            .limit(5000)

        return (designs || []).map((design) => ({
            url: `${baseUrl}/designs/${design.url_slug}`,
            lastModified: new Date(design.created_at),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
            images: sanitizeUrl(design.customized_image_url) ? [sanitizeUrl(design.customized_image_url)] : [],
        }))
    }

    // Chunk 6: Customized Cake Analysis (/customizing/[slug])
    if (sitemapId === 6) {
        const { data: recentSearches } = await supabase
            .from('cakegenie_analysis_cache')
            .select('slug, created_at, original_image_url')
            .not('slug', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5000)

        return (recentSearches || []).map((search: any) => ({
            url: `${baseUrl}/customizing/${search.slug}`,
            lastModified: new Date(search.created_at),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
            images: sanitizeUrl(search.original_image_url) ? [sanitizeUrl(search.original_image_url)] : [],
        }))
    }

    // Fallback
    return [];
}
