import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDesignsByKeyword, getCollectionBySlug } from '@/services/supabaseService'
import CategoryClient from './CategoryClient'

export const revalidate = 3600; // ISR: revalidate every hour

type Props = {
    params: Promise<{ category: string }>
}

export async function generateMetadata(
    { params }: Props
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

    // Fetch designs to get the first image for og:image
    const { data: designs } = await getDesignsByKeyword(category, 1);
    const firstImage = designs?.[0]?.original_image_url;

    return {
        title: { absolute: `${title} Cake Ideas & Designs | Genie.ph` },
        description: desc,
        alternates: {
            canonical: `https://genie.ph/collections/${category}`,
        },
        openGraph: {
            title: `${title} Cake Designs`,
            description: desc,
            url: `https://genie.ph/collections/${category}`,
            type: 'website',
            ...(firstImage ? {
                images: [{
                    url: firstImage,
                    width: 1200,
                    height: 1200,
                    alt: `${title} cake design collection — browse ${title.toLowerCase()} cake ideas on Genie.ph`,
                }],
            } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: `${title} Cake Ideas & Designs | Genie.ph`,
            description: desc,
            ...(firstImage ? {
                images: [firstImage],
            } : {}),
        },
    }
}

export default async function CategoryPage({ params }: Props) {
    const { category } = await params

    // 1. Get the official collection details if it exists
    const { data: collection } = await getCollectionBySlug(category);

    let readableTitle = collection?.name;
    const description = collection?.description || null;

    if (!readableTitle) {
        readableTitle = category.split('-').join(' ');
    }

    // 2. Fetch designs using the slug (the service will resolve tags if it's a collection)
    const { data: designs } = await getDesignsByKeyword(category, 30);

    if (!designs || designs.length === 0) {
        return notFound();
    }

    // Build JSON-LD: CollectionPage + ImageGallery + BreadcrumbList
    const pageUrl = `https://genie.ph/collections/${category}`;
    const titleCap = readableTitle.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Top 12 designs for ImageGallery schema (enough for rich results, not too heavy)
    const titleLower = titleCap.toLowerCase();
    // Core name without "cake" suffix for overlap detection (e.g. "debut" from "Debut Cake")
    const titleCore = titleLower.replace(/\s*cake\s*$/i, '').trim();
    const galleryImages = designs.slice(0, 12).map((d: any, i: number) => {
        const kw = typeof d.keywords === 'string' ? d.keywords.split(',')[0].trim() : 'Custom';
        // Avoid doubling: if keyword already contains the core collection name, don't append it
        const kwLower = kw.toLowerCase();
        const imageName = kwLower.includes(titleCore) || titleCore.includes(kwLower)
            ? `${kw} cake design`
            : `${kw} ${titleCap} cake design`;
        return {
            '@type': 'ImageObject',
            url: d.original_image_url,
            contentUrl: d.original_image_url,
            name: imageName,
            caption: `${kw} cake design — customize and order on Genie.ph`,
            ...(d.image_width ? { width: d.image_width } : {}),
            ...(d.image_height ? { height: d.image_height } : {}),
            creditText: 'Genie.ph',
            copyrightHolder: { '@type': 'Organization', name: 'Genie.ph' },
            license: 'https://genie.ph/terms',
            acquireLicensePage: 'https://genie.ph/terms',
        };
    });

    const jsonLd = [
        // CollectionPage + ImageGallery
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            '@id': pageUrl,
            name: `${titleCap} Cake Ideas & Designs`,
            description: description || `Browse ${titleCap.toLowerCase()} cake designs. Get instant AI pricing for any of these custom cakes.`,
            url: pageUrl,
            isPartOf: { '@type': 'WebSite', name: 'Genie.ph', url: 'https://genie.ph' },
            mainEntity: {
                '@type': 'ImageGallery',
                name: titleLower.includes('cake') ? `${titleCap} Design Collection` : `${titleCap} Cake Design Collection`,
                about: `${titleCap} cake designs available for customization and ordering in Cebu, Philippines`,
                numberOfItems: designs.length,
                image: galleryImages,
            },
            ...(designs[0]?.original_image_url ? {
                primaryImageOfPage: {
                    '@type': 'ImageObject',
                    url: designs[0].original_image_url,
                    representativeOfPage: true,
                },
            } : {}),
        },
        // BreadcrumbList
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph' },
                { '@type': 'ListItem', position: 2, name: 'Collections', item: 'https://genie.ph/collections' },
                { '@type': 'ListItem', position: 3, name: `${titleCap} Designs`, item: pageUrl },
            ],
        },
    ];

    return (
        <>
            {jsonLd.map((schema, i) => (
                <script
                    key={`collection-ld-${i}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />
            ))}
            <CategoryClient
                designs={designs}
                keyword={category}
                readableTitle={readableTitle}
                category={category}
                description={description}
            />
        </>
    )
}
