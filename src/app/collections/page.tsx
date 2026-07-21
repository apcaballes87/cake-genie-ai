import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDesignCategories } from '@/services/supabaseService'
import CollectionsClient from './CollectionsClient'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'
import { FEATURED_COLLECTION_LINKS } from '@/lib/seo/priorityCollections'
import { COLLECTIONS_PER_PAGE, buildCollectionDirectoryPath } from './pagination'

export const revalidate = 3600; // ISR: revalidate every hour

type CollectionsPageProps = {
    searchParams?: Promise<{ page?: string | string[] }>
}

type CollectionCategory = NonNullable<Awaited<ReturnType<typeof getDesignCategories>>['data']>[number]

export function parseCollectionsPage(value: string | string[] | undefined): number {
    const rawValue = Array.isArray(value) ? value[0] : value
    const parsed = Number.parseInt(rawValue || '1', 10)
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
}

export async function generateMetadata({ searchParams }: CollectionsPageProps) {
    const page = parseCollectionsPage((await searchParams)?.page)
    const pageSuffix = page > 1 ? ` - Page ${page}` : ''

    return buildMarketingPageMetadata({
        title: `Browse Custom Cake Designs by Category${pageSuffix}`,
        description: page > 1
            ? `Browse page ${page} of Genie.ph custom cake collections in Cebu. Open a category to compare designs and customize a cake.`
            : 'Browse thousands of custom cake designs organized by category. From birthday cakes to weddings, find the perfect design and get instant AI pricing.',
        canonicalPath: `https://genie.ph${buildCollectionDirectoryPath(page)}`,
    })
}

export function FeaturedCollectionLinks() {
    return (
        <section className="mb-10 rounded-2xl border border-purple-100 bg-purple-50/60 p-5" aria-labelledby="featured-collections-heading">
            <h2 id="featured-collections-heading" className="text-lg font-bold text-slate-800">
                Featured Cake Collections
            </h2>
            <p className="mt-1 text-sm text-slate-600">
                Start with a popular Cebu cake theme, then open any design to customize it and check pricing.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
                {FEATURED_COLLECTION_LINKS.map((collection) => (
                    <Link
                        key={collection.slug}
                        href={`/collections/${collection.slug}`}
                        prefetch={false}
                        className="rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                    >
                        {collection.label}
                    </Link>
                ))}
            </div>
        </section>
    )
}

function CollectionPageSchema({
    categories,
    currentPage,
    totalCount,
    startIndex,
}: {
    categories: CollectionCategory[]
    currentPage: number
    totalCount: number
    startIndex: number
}) {
    const pageUrl = `https://genie.ph${buildCollectionDirectoryPath(currentPage)}`
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Browse Custom Cake Designs by Category',
        description: 'Browse thousands of custom cake designs organized by category. From birthday cakes to weddings, find the perfect design and get instant AI pricing.',
        url: pageUrl,
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph' },
                { '@type': 'ListItem', position: 2, name: 'Collections', item: pageUrl }
            ]
        },
        mainEntity: {
            '@type': 'ItemList',
            name: 'Cake Design Categories',
            numberOfItems: totalCount,
            itemListElement: categories.map((cat, i) => ({
                '@type': 'ListItem',
                position: startIndex + i + 1,
                name: cat.keyword,
                url: `https://genie.ph/collections/${cat.slug}`,
                ...(cat.sample_image && { image: cat.sample_image }),
            }))
        }
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
    const categoriesRes = await getDesignCategories().catch(() => ({ data: [], error: new Error('Unable to load collections') }));

    const categories = categoriesRes.data || [];
    const currentPage = parseCollectionsPage((await searchParams)?.page)
    const totalCount = categories.length
    const totalPages = Math.max(1, Math.ceil(totalCount / COLLECTIONS_PER_PAGE))

    if (!categoriesRes.error && currentPage > totalPages) {
        notFound()
    }

    const startIndex = (currentPage - 1) * COLLECTIONS_PER_PAGE
    const pageCategories = categories.slice(startIndex, startIndex + COLLECTIONS_PER_PAGE)
    const trendingCategories = currentPage === 1
        ? pageCategories
            .filter((category) => category.collection_type === 'entertainment' && (category.trend_score || 0) > 0)
            .sort((a, b) => (b.trend_score || 0) - (a.trend_score || 0))
            .slice(0, 6)
        : []

    return (
        <>
            <CollectionPageSchema
                categories={pageCategories}
                currentPage={currentPage}
                totalCount={totalCount}
                startIndex={startIndex}
            />
            <CollectionsClient
                key={currentPage}
                categories={pageCategories}
                trendingCategories={trendingCategories}
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                startIndex={startIndex}
                featuredCollections={currentPage === 1 ? <FeaturedCollectionLinks /> : undefined}
            />
        </>
    );
}
