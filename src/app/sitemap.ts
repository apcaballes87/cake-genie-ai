import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getAllBlogSlugs } from '@/services/supabaseService'
import { LOCAL_SEO_ROUTES } from '@/components/local-seo/cebuLandingData'
import {
    getSitemapChunkHints,
    getSitemapInventory,
    SITEMAP_CHUNK_SIZE,
} from '@/lib/sitemap/indexability'
import { isPublicHttpImageUrl } from '@/lib/seo/crawlerImage'

export const dynamic = 'force-dynamic'

/**
 * Sanitize URL for XML sitemap
 * - For Supabase storage URLs: strips query params (they're just auth tokens)
 * - For other URLs: keeps full URL (query params may be essential)
 * - Properly encodes ampersands for XML safety
 */
const sanitizeUrl = (url: string | null | undefined): string => {
    if (!isPublicHttpImageUrl(url)) return ''
    try {
        const parsed = new URL(url.trim())

        // Only strip query params for Supabase storage URLs
        // (their query params are just signed tokens, base URL still works)
        if (parsed.hostname.includes('supabase')) {
            return `${parsed.origin}${parsed.pathname}`
        }

        // For other URLs, keep the full URL but XML escape it
        // Next.js sitemap generator doesn't seem to always escape image URLs correctly
        return url.trim()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
    } catch {
        return ''
    }
}

// Generate sitemap IDs.
export async function generateSitemaps(): Promise<Array<{ id: number | string }>> {
    const ids: Array<{ id: number | string }> = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];

    try {
        const {
            customizedChunkCount: chunks,
            sharedDesignChunkCount: designChunks,
        } = await getSitemapChunkHints();

        for (let i = 0; i < chunks; i++) {
            ids.push({ id: `customized-cakes-${i}` });
        }

        for (let i = 0; i < designChunks; i++) {
            ids.push({ id: `designs-${i}` });
        }
    } catch (error) {
        console.error('Error fetching sitemap chunk hints:', error);
        ids.push({ id: 'customized-cakes-0' }); // Fallback
        ids.push({ id: 'designs-0' }); // Fallback
    }

    return ids;
}

type SitemapParam = number | string | Promise<number | string>;

type MerchantProductSitemapRow = {
    slug: string;
    updated_at: string | null;
    image_url: string | null;
    cakegenie_merchants: { slug: string } | { slug: string }[] | null;
};

type CollectionSitemapRow = {
    slug: string;
    created_at: string | null;
    sample_image: string | null;
    item_count: number | null;
    publication_status: string | null;
    is_indexable: boolean | null;
};

function getMerchantSlug(value: MerchantProductSitemapRow['cakegenie_merchants']): string | null {
    if (Array.isArray(value)) {
        return value[0]?.slug ?? null;
    }

    return value?.slug ?? null;
}

export default async function sitemap({ id }: { id: SitemapParam }): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://genie.ph'
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const resolvedId = await Promise.resolve(id);
    const sitemapId = Number(resolvedId);

    // ==========================================
    // Handle Paginated String IDs (e.g. customized-cakes-0)
    // ==========================================
    if (Number.isNaN(sitemapId)) {
        const idStr = String(resolvedId);
        if (idStr.startsWith('customized-cakes-')) {
            const page = parseInt(idStr.split('-').pop() || '0', 10);
            const offset = page * SITEMAP_CHUNK_SIZE;
            const { customizedCakes } = await getSitemapInventory();
            const chunk = customizedCakes.slice(offset, offset + SITEMAP_CHUNK_SIZE);

            return chunk.map((cake) => ({
                url: `${baseUrl}/customizing/${cake.slug}`,
                lastModified: new Date(cake.created_at),
                changeFrequency: 'weekly' as const,
                priority: 0.6,
                images: sanitizeUrl(cake.image_url) ? [sanitizeUrl(cake.image_url)] : [],
            }));
        }

        if (idStr.startsWith('designs-')) {
            const page = parseInt(idStr.split('-').pop() || '0', 10);
            const offset = page * SITEMAP_CHUNK_SIZE;
            const { sharedDesigns } = await getSitemapInventory();
            const designs = sharedDesigns.slice(offset, offset + SITEMAP_CHUNK_SIZE);

            return designs.map((design) => ({
                url: `${baseUrl}/customizing/${design.url_slug}`,
                lastModified: new Date(design.created_at),
                changeFrequency: 'weekly' as const,
                priority: 0.7,
                images: sanitizeUrl(design.image_url) ? [sanitizeUrl(design.image_url)] : [],
            }));
        }

        return [];
    }

    // ==========================================
    // Handle Core Numeric IDs
    // ==========================================

    // Chunk 0: Static Routes
    if (sitemapId === 0) {
        const coreRoutes = [
            '',
            '/shop',
            '/customizing',
            '/collections',
            '/blog',
            '/about',
            '/services',
            '/is-genie-ph-a-scam',
            '/cake-price-calculator',
            '/chatgpt-cake-design-quote',
            '/best-cake-shops-cebu',
            '/mothersdaycakes',
            '/faq',
            '/how-to-order',
            '/contact',
            '/reviews',
            '/suppliers',
            '/suppliers/signup',
            '/return-policy',
            '/terms',
            '/privacy',
            '/sitemap-html',
            '/compare',
            '/compare/genie-ph-vs-traditional-bakeries',
            '/compare/genie-ph-vs-social-media-ordering',
            '/compare/custom-cake-pricing-cebu',
            ...LOCAL_SEO_ROUTES,
        ].map((route) => ({
            url: `${baseUrl}${route}`,
            lastModified: new Date('2026-02-27'),
            changeFrequency: 'daily' as const,
            priority: 1,
        }));

        const blogCategoryRoutes = [
            '/blog/category/birthday-cakes',
            '/blog/category/cebu-cakes',
            '/blog/category/wedding-cakes',
            '/blog/category/party-packages',
            '/blog/category/cake-comparison',
            '/blog/category/character-cakes',
            '/blog/category/graduation-cakes',
            '/blog/category/kids-cakes',
        ].map((route) => ({
            url: `${baseUrl}${route}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        }));

        const { data: collections, error: collectionsError } = await supabase
            .from('cakegenie_collections')
            .select('slug, created_at, sample_image, item_count, publication_status, is_indexable')
            .eq('publication_status', 'published')
            .eq('is_indexable', true)
            .gte('item_count', 8)
            .returns<CollectionSitemapRow[]>()

        if (collectionsError) {
            console.error('Error fetching collection sitemap routes:', collectionsError)
        }

        const collectionRoutes = (collections || [])
            .filter((collection) => collection.slug)
            .map((collection) => ({
                url: `${baseUrl}/collections/${collection.slug}`,
                lastModified: collection.created_at ? new Date(collection.created_at) : new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.85,
                images: sanitizeUrl(collection.sample_image) ? [sanitizeUrl(collection.sample_image)] : [],
            }))

        return [...coreRoutes, ...blogCategoryRoutes, ...collectionRoutes];
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
            .returns<MerchantProductSitemapRow[]>()

        return (products || [])
            .filter((product) => product.slug && getMerchantSlug(product.cakegenie_merchants))
            .map((product) => ({
            url: `${baseUrl}/shop/${getMerchantSlug(product.cakegenie_merchants)}/${product.slug}`,
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
            lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            images: sanitizeUrl(post.image) ? [sanitizeUrl(post.image)] : [],
        }))
    }

    // Fallback
    return [];
}
