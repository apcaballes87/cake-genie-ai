import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getAllBlogSlugs } from '@/services/supabaseService'

// Cache the sitemaps for 24 hours to prevent Googlebot timeouts on cold starts
export const revalidate = 86400;

/**
 * Sanitize URL for XML sitemap
 * - For Supabase storage URLs: strips query params (they're just auth tokens)
 * - For other URLs: keeps full URL (query params may be essential)
 * - Properly encodes ampersands for XML safety
 */
const sanitizeUrl = (url: string | null | undefined): string => {
    if (!url || url.startsWith('data:')) return ''
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
export async function generateSitemaps(): Promise<Array<{ id: number | string }>> {
    const ids: Array<{ id: number | string }> = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];

    try {
        // Fetch total customized cakes count directly to avoid strict cookie requirements at build time
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/cakegenie_analysis_cache?slug=not.is.null&select=id`, {
            method: 'HEAD',
            headers: {
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
                'Prefer': 'count=exact'
            },
            next: { revalidate: 86400 }
        });

        const countHeader = res.headers.get('content-range'); // e.g., "0-0/1095"
        let totalCakes = 0;
        if (countHeader) {
            totalCakes = parseInt(countHeader.split('/')[1], 10) || 0;
        }

        const CHUNK_SIZE = 1000;
        const chunks = Math.ceil(totalCakes / CHUNK_SIZE) || 1;

        for (let i = 0; i < chunks; i++) {
            ids.push({ id: `customized-cakes-${i}` });
        }
    } catch (error) {
        console.error('Error fetching sitemap chunks for customized cakes:', error);
        ids.push({ id: 'customized-cakes-0' }); // Fallback
    }

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/cakegenie_shared_designs?select=id`, {
            method: 'HEAD',
            headers: {
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
                'Prefer': 'count=exact'
            },
            next: { revalidate: 86400 } // Avoid dynamic server usage bailout, matches ISR
        });

        const countHeader = res.headers.get('content-range'); // e.g., "0-0/4095"
        let totalDesigns = 0;
        if (countHeader) {
            totalDesigns = parseInt(countHeader.split('/')[1], 10) || 0;
        }

        const CHUNK_SIZE = 1000;
        const chunks = Math.ceil(totalDesigns / CHUNK_SIZE) || 1;

        for (let i = 0; i < chunks; i++) {
            ids.push({ id: `designs-${i}` });
        }
    } catch (error) {
        console.error('Error fetching sitemap chunks for shared designs:', error);
        ids.push({ id: 'designs-0' }); // Fallback
    }

    return ids;
}

export default async function sitemap({ id }: { id: any }): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://genie.ph'
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Next.js 15 breaking change runtime parameter parsing (either Promise or Primitive)
    const resolvedId = typeof id === 'object' && id !== null && 'then' in (id as any) ? await (id as any) : id;
    const sitemapId = Number(resolvedId);

    // ==========================================
    // Handle Paginated String IDs (e.g. customized-cakes-0)
    // ==========================================
    if (Number.isNaN(sitemapId)) {
        const idStr = String(resolvedId);
        if (idStr.startsWith('customized-cakes-')) {
            const page = parseInt(idStr.split('-').pop() || '0', 10);
            const CHUNK_SIZE = 1000;
            const offset = page * CHUNK_SIZE;

            const { data: customizedCakes } = await supabase
                .from('cakegenie_analysis_cache')
                .select('slug, created_at, original_image_url')
                .not('slug', 'is', null)
                .order('created_at', { ascending: false })
                .range(offset, offset + CHUNK_SIZE - 1);

            return (customizedCakes || []).map((cake: any) => ({
                url: `${baseUrl}/customizing/${cake.slug}`,
                lastModified: new Date(cake.created_at),
                changeFrequency: 'weekly' as const,
                priority: 0.6,
                images: sanitizeUrl(cake.original_image_url) ? [sanitizeUrl(cake.original_image_url)] : [],
            }));
        }

        if (idStr.startsWith('designs-')) {
            const page = parseInt(idStr.split('-').pop() || '0', 10);
            const CHUNK_SIZE = 1000;
            const offset = page * CHUNK_SIZE;

            const { data: designs } = await supabase
                .from('cakegenie_shared_designs')
                .select('url_slug, created_at, customized_image_url')
                .order('created_at', { ascending: false })
                .range(offset, offset + CHUNK_SIZE - 1);

            return (designs || []).map((design: any) => ({
                url: `${baseUrl}/designs/${design.url_slug}`,
                lastModified: new Date(design.created_at),
                changeFrequency: 'weekly' as const,
                priority: 0.7,
                images: sanitizeUrl(design.customized_image_url) ? [sanitizeUrl(design.customized_image_url)] : [],
            }));
        }

        return [];
    }

    // ==========================================
    // Handle Core Numeric IDs
    // ==========================================

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
            lastModified: new Date('2026-02-27'),
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
        const { data: blogPosts } = await getAllBlogSlugs();
        const posts = blogPosts || [];
        return posts.map((post) => ({
            url: `${baseUrl}/blog/${post.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        }))
    }

    // Fallback
    return [];
}
