import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { getDesignsByKeyword, getCollectionBySlug } from '@/services/supabaseService'
import CategoryClient from './CategoryClient'

export const revalidate = 3600; // ISR: revalidate every hour

type Props = {
    params: Promise<{ category: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { category } = await params

    // Try to find the exact collection
    const { data: collection } = await getCollectionBySlug(category);

    let title = collection?.name;
    let desc = collection?.description;

    if (!title) {
        // Fallback for random slugs
        title = category
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    }

    if (!desc) {
        desc = `Browse our collection of ${title.toLowerCase()} designs. Get instant AI pricing for any of these custom cakes from trusted local bakers.`
    }

    return {
        title: `${title} Cake Ideas & Designs | Genie.ph`,
        description: desc,
        alternates: {
            canonical: `https://genie.ph/collections/${category}`,
        },
        openGraph: {
            title: `${title} Cake Designs`,
            description: desc,
            url: `https://genie.ph/collections/${category}`,
            type: 'website',
        },
    }
}

export default async function CategoryPage({ params }: Props) {
    const { category } = await params

    // 1. Get the official collection details if it exists
    const { data: collection } = await getCollectionBySlug(category);

    let readableTitle = collection?.name;
    let description = collection?.description || null;

    if (!readableTitle) {
        readableTitle = category.split('-').join(' ');
    }

    // 2. Fetch designs using the slug (the service will resolve tags if it's a collection)
    const { data: designs } = await getDesignsByKeyword(category, 30);

    if (!designs || designs.length === 0) {
        return notFound();
    }

    return (
        <CategoryClient
            designs={designs}
            keyword={category} // Service expects the slug or keyword
            readableTitle={readableTitle}
            category={category}
            description={description}
        />
    )
}
