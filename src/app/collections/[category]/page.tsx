import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { getDesignsByKeyword } from '@/services/supabaseService'
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

    // Convert slug back to readable title (e.g., "birthday-cakes" -> "Birthday Cakes")
    const title = category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

    return {
        title: `${title} Cake Ideas & Designs | Genie.ph`,
        description: `Browse our collection of ${title.toLowerCase()} designs. Get instant AI pricing for any of these custom cakes from trusted local bakers.`,
        alternates: {
            canonical: `https://genie.ph/collections/${category}`,
        },
        openGraph: {
            title: `${title} Cake Designs`,
            description: `Browse ${title.toLowerCase()} and get instant pricing.`,
            url: `https://genie.ph/collections/${category}`,
            type: 'website',
        },
    }
}

export default async function CategoryPage({ params }: Props) {
    const { category } = await params

    // Convert slug to keyword for search
    const readableTitle = category.split('-').join(' ');
    const keyword = readableTitle;

    const { data: designs } = await getDesignsByKeyword(keyword, 30);

    if (!designs || designs.length === 0) {
        return notFound();
    }

    return (
        <CategoryClient
            designs={designs}
            keyword={keyword}
            readableTitle={readableTitle}
            category={category}
        />
    )
}
