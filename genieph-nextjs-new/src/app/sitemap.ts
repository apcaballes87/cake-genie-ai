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

    return [...routes, ...designRoutes]
}
