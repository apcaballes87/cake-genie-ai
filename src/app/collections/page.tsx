import { Suspense } from 'react';
import { getDesignCategories } from '@/services/supabaseService'
import CollectionsClient from './CollectionsClient'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'

export const revalidate = 3600; // ISR: revalidate every hour

export const metadata = buildMarketingPageMetadata({
    title: 'Browse Custom Cake Designs by Category',
    description: 'Browse thousands of custom cake designs organized by category. From birthday cakes to weddings, find the perfect design and get instant AI pricing.',
    canonicalPath: 'https://genie.ph/collections',
})

function CollectionPageSchema({ categories }: { categories: any[] }) {
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
            itemListElement: categories.map((cat: any, i: number) => ({
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

export default async function CollectionsPage() {
    const categoriesRes = await getDesignCategories().catch(() => ({ data: [], error: null }));

    const categories = categoriesRes.data || [];

    return (
        <>
            <CollectionPageSchema categories={categories} />
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            }>
                <CollectionsClient categories={categories} />
            </Suspense>
        </>
    );
}
