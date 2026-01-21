import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

/**
 * Sanitize URL for XML sitemap
 * - Strips query parameters (Supabase signed URLs contain & that break XML)
 * - Falls back to empty string if URL is invalid
 */
const sanitizeUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    try {
        const parsed = new URL(url)
        // Return just the base URL without query params
        return `${parsed.origin}${parsed.pathname}`
    } catch {
        return url
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://genie.ph'

    // 1. Static routes
    const routes = [
        '',
        '/search',
        '/customizing',
        '/cart',
        '/login',
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

    // 5. Dynamic routes: Product Customize Pages (SEO-friendly customization URLs)
    const customizeRoutes = (products || []).map((product: any) => ({
        url: `${baseUrl}/shop/${product.cakegenie_merchants.slug}/${product.slug}/customize`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7, // Higher priority than product detail pages
        images: sanitizeUrl(product.image_url) ? [sanitizeUrl(product.image_url)] : [],
    }))

    // 6. Dynamic routes: Recent Searches (SEO-friendly /customizing/[slug] URLs)
    const { data: recentSearches } = await supabase
        .from('cakegenie_analysis_cache')
        .select('slug, created_at, original_image_url, alt_text, keywords')
        .not('slug', 'is', null)
        .not('original_image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500)

    const recentSearchRoutes = (recentSearches || []).map((search: any) => ({
        url: `${baseUrl}/customizing/${search.slug}`,
        lastModified: new Date(search.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        images: sanitizeUrl(search.original_image_url) ? [sanitizeUrl(search.original_image_url)] : [],
    }))

    return [...routes, ...designRoutes, ...merchantRoutes, ...productRoutes, ...customizeRoutes, ...recentSearchRoutes]

}
