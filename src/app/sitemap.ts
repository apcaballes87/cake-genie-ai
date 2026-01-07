import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

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
        .select('url_slug, created_at')
        .order('created_at', { ascending: false })
        .limit(5000)

    const designRoutes = (designs || []).map((design) => ({
        url: `${baseUrl}/designs/${design.url_slug}`,
        lastModified: new Date(design.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
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
            cakegenie_merchants!inner(slug)
        `)
        .eq('is_active', true)

    const productRoutes = (products || []).map((product: any) => ({
        url: `${baseUrl}/shop/${product.cakegenie_merchants.slug}/${product.slug}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
    }))

    // 5. Dynamic routes: Product Customize Pages (SEO-friendly customization URLs)
    const customizeRoutes = (products || []).map((product: any) => ({
        url: `${baseUrl}/shop/${product.cakegenie_merchants.slug}/${product.slug}/customize`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7, // Higher priority than product detail pages
    }))

    return [...routes, ...designRoutes, ...merchantRoutes, ...productRoutes, ...customizeRoutes]

}
