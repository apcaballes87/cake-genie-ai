import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getAllBlogSlugs, getAllBlogs } from '@/services/supabaseService'
import { LOCAL_SEO_ROUTES } from '@/components/local-seo/cebuLandingData'
import {
    getSitemapChunkHints,
    getSitemapInventory,
    SITEMAP_CHUNK_SIZE,
} from '@/lib/sitemap/indexability'
import { isPublicHttpImageUrl } from '@/lib/seo/crawlerImage'
import { getBlogTagsForPost, getPopulatedBlogCategorySlugs } from '@/lib/seo/blogCategories'
import { isPublishedIndexableCollection } from '@/lib/seo/collectionEligibility'

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
    cakegenie_merchants: { slug: string; is_active: boolean } | { slug: string; is_active: boolean }[] | null;
};

type CollectionSitemapRow = {
    slug: string;
    published_at: string | null;
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
            '/coldcaking',
            '/delivery-rates',
            '/payment-options',
            '/price-list',
            '/investors',
            '/is-genie-ph-a-scam',
            '/cake-price-calculator',
            '/chatgpt-cake-design-quote',
            '/best-cake-shops-cebu',
            '/mothersdaycakes',
            '/party-budget-calculator',
            '/faq',
            '/how-to-order',
            '/contact',
            '/reviews',
            '/suppliers',
            '/suppliers/signup',
            '/creators',
            '/return-policy',
            '/terms',
            '/privacy',
            '/sitemap-html',
            '/compare',
            '/compare/genie-ph-vs-traditional-bakeries',
            '/compare/genie-ph-vs-social-media-ordering',
            '/compare/custom-cake-pricing-cebu',
            '/compare/genie-ph-vs-goldilocks',
            '/compare/genie-ph-vs-red-ribbon',
            '/compare/genie-ph-vs-contis',
            '/compare/genie-ph-vs-caramia',
            ...LOCAL_SEO_ROUTES,
        ].map((route) => ({
            url: `${baseUrl}${route}`,
            changeFrequency: 'daily' as const,
            priority: 1,
        }));

        const { data: blogPosts, error: blogError } = await getAllBlogs();
        if (blogError) throw blogError;

        const blogCategoryRoutes = getPopulatedBlogCategorySlugs(blogPosts || []).map((tag) => {
            const dates = (blogPosts || [])
                .filter((post) => getBlogTagsForPost(post.keywords || '').includes(tag))
                .map((post) => post.updated_at || post.date)
                .filter(Boolean)
                .map((value) => new Date(value).getTime())
                .filter(Number.isFinite);

            return {
                url: `${baseUrl}/blog/category/${tag}`,
                ...(dates.length > 0 ? { lastModified: new Date(Math.max(...dates)) } : {}),
                changeFrequency: 'weekly' as const,
                priority: 0.8,
            };
        });

        const { data: collections, error: collectionsError } = await supabase
            .from('cakegenie_collections')
            .select('slug, published_at, sample_image, item_count, publication_status, is_indexable')
            .eq('publication_status', 'published')
            .eq('is_indexable', true)
            .gte('item_count', 8)
            .returns<CollectionSitemapRow[]>()

        if (collectionsError) throw collectionsError

        const collectionRoutes = (collections || [])
            .filter((collection) => collection.slug && isPublishedIndexableCollection(collection))
            .map((collection) => ({
                url: `${baseUrl}/collections/${collection.slug}`,
                ...(collection.published_at ? { lastModified: new Date(collection.published_at) } : {}),
                changeFrequency: 'weekly' as const,
                priority: 0.85,
                images: sanitizeUrl(collection.sample_image) ? [sanitizeUrl(collection.sample_image)] : [],
            }))

        return [...coreRoutes, ...blogCategoryRoutes, ...collectionRoutes];
    }

    // Chunk 1: Bakeries (Merchants)
    if (sitemapId === 1) {
        const { data: merchants, error } = await supabase
            .from('cakegenie_merchants')
            .select('slug, updated_at')
            .eq('is_active', true)

        if (error) throw error

        return (merchants || []).filter((merchant) => merchant.slug).map((merchant) => ({
            url: `${baseUrl}/shop/${merchant.slug}`,
            ...(merchant.updated_at ? { lastModified: new Date(merchant.updated_at) } : {}),
            changeFrequency: 'weekly' as const,
            priority: 0.9,
        }))
    }

    // Chunk 2: Products
    if (sitemapId === 2) {
        const { data: products, error } = await supabase
            .from('cakegenie_merchant_products')
            .select(`
                slug,
                updated_at,
                image_url,
                cakegenie_merchants!inner(slug, is_active)
            `)
            .eq('is_active', true)
            .eq('cakegenie_merchants.is_active', true)
            .returns<MerchantProductSitemapRow[]>()

        if (error) throw error

        return (products || [])
            .filter((product) => product.slug && getMerchantSlug(product.cakegenie_merchants))
            .map((product) => ({
            url: `${baseUrl}/shop/${getMerchantSlug(product.cakegenie_merchants)}/${product.slug}`,
            ...(product.updated_at ? { lastModified: new Date(product.updated_at) } : {}),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            images: sanitizeUrl(product.image_url) ? [sanitizeUrl(product.image_url)] : [],
        }))
    }

    // Chunk 3: Blog Posts
    if (sitemapId === 3) {
        const { data: blogPosts, error } = await getAllBlogSlugs();
        if (error) throw error;
        const posts = blogPosts || [];
        return posts.map((post) => ({
            url: `${baseUrl}/blog/${post.slug}`,
            ...(post.updated_at ? { lastModified: new Date(post.updated_at) } : {}),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            images: sanitizeUrl(post.image) ? [sanitizeUrl(post.image)] : [],
        }))
    }

    // Fallback
    return [];
}
