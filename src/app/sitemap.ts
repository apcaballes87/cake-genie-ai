import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getAllBlogPosts } from '@/data/blogPosts'

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://genie.ph'

    // 1. Static routes
    '',
        '/shop',
        '/customizing',
        '/blog',
        '/about',
        '/cake-price-calculator',
    ].map((route) => ({
            url: `${baseUrl}${route}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1,
        }))

    // 2. Dynamic routes: Shared Designs
    const supabase = await createClient()
    const { data: designs } = await supabase
        .from('cakegenie_shared_designs')
        .select('url_slug, created_at, customized_image_url, title, alt_text')
        .order('created_at', { ascending: false })
        .limit(5000)

    const designRoutes = (designs || []).map((design) => ({
        url: `${baseUrl}/designs/${design.url_slug}`,
        lastModified: new Date(design.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        images: sanitizeUrl(design.customized_image_url) ? [sanitizeUrl(design.customized_image_url)] : [],
    }))

    // 3. Dynamic routes: Merchants
    const { data: merchants } = await supabase
        .from('cakegenie_merchants')
        .select('slug, updated_at')
        .eq('is_active', true)

    const merchantRoutes = (merchants || []).map((merchant) => ({
        url: `${baseUrl}/shop/${merchant.slug}`,
        lastModified: merchant.updated_at ? new Date(merchant.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
    }))

    // 4. Dynamic routes: Merchant Products
    const { data: products } = await supabase
        .from('cakegenie_merchant_products')
        .select(`
            slug,
            updated_at,
            image_url,
            title,
            alt_text,
            cakegenie_merchants!inner(slug)
        `)
        .eq('is_active', true)

    const productRoutes = (products || []).map((product: any) => ({
        url: `${baseUrl}/shop/${product.cakegenie_merchants.slug}/${product.slug}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
        images: sanitizeUrl(product.image_url) ? [sanitizeUrl(product.image_url)] : [],
    }))



    // 6. Dynamic routes: Recent Searches (SEO-friendly /customizing/[slug] URLs)
    const { data: recentSearches } = await supabase
        .from('cakegenie_analysis_cache')
        .select('slug, created_at, original_image_url, alt_text, keywords')
        .not('slug', 'is', null)
        .not('original_image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5000)

    const recentSearchRoutes = (recentSearches || []).map((search: any) => ({
        url: `${baseUrl}/customizing/${search.slug}`,
        lastModified: new Date(search.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        images: sanitizeUrl(search.original_image_url) ? [sanitizeUrl(search.original_image_url)] : [],
    }))

    // 5. Dynamic routes: Blog Posts
    const blogPosts = getAllBlogPosts()
    const blogRoutes = blogPosts.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: new Date(post.date),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
    }))

    return [...routes, ...designRoutes, ...merchantRoutes, ...productRoutes, ...blogRoutes, ...recentSearchRoutes]

}
