import Link from 'next/link'
import { getDesignCategories } from '@/services/supabaseService'
import CollectionsClient from './CollectionsClient'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'
import { FEATURED_COLLECTION_LINKS } from '@/lib/seo/priorityCollections'

export const revalidate = 3600; // ISR: revalidate every hour

export const metadata = buildMarketingPageMetadata({
    title: 'Browse Custom Cake Designs by Category',
    description: 'Browse thousands of custom cake designs organized by category. From birthday cakes to weddings, find the perfect design and get instant AI pricing.',
    canonicalPath: 'https://genie.ph/collections',
})

type CollectionsPageProps = {
    searchParams?: Promise<{ page?: string | string[] }>
}

type CollectionCategory = NonNullable<Awaited<ReturnType<typeof getDesignCategories>>['data']>[number]

export function parseCollectionsPage(value: string | string[] | undefined): number {
    const rawValue = Array.isArray(value) ? value[0] : value
    const parsed = Number.parseInt(rawValue || '1', 10)
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
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

function CollectionPageSchema({ categories }: { categories: CollectionCategory[] }) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Browse Custom Cake Designs by Category',
        description: 'Browse thousands of custom cake designs organized by category. From birthday cakes to weddings, find the perfect design and get instant AI pricing.',
        url: 'https://genie.ph/collections',
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph' },
                { '@type': 'ListItem', position: 2, name: 'Collections', item: 'https://genie.ph/collections' }
            ]
        },
        mainEntity: {
            '@type': 'ItemList',
            name: 'Cake Design Categories',
            numberOfItems: categories.length,
            itemListElement: categories.map((cat, i) => ({
                '@type': 'ListItem',
                position: i + 1,
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
    const categoriesRes = await getDesignCategories().catch(() => ({ data: [], error: null }));

    const categories = categoriesRes.data || [];
    const initialPage = parseCollectionsPage((await searchParams)?.page)

    return (
        <>
            <CollectionPageSchema categories={categories} />
            <CollectionsClient
                key={initialPage}
                categories={categories}
                initialPage={initialPage}
                featuredCollections={<FeaturedCollectionLinks />}
            />
        </>
    );
}
