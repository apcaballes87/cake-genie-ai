import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDesignCategories, getDesignsByKeyword, getCollectionBySlug } from '@/services/supabaseService'
import CategoryClient from './CategoryClient'

export const revalidate = 3600; // ISR: revalidate every hour

const FEATURED_COLLECTION_SLUGS = ['pickleball-cake'];

const COLLECTION_SEO_FALLBACKS: Record<string, { description: string; keywords: string[] }> = {
    'pickleball-cake': {
        description: 'Browse pickleball cake designs with paddles, courts, balls, and personalized toppers. Get instant pricing and order custom pickleball cakes on Genie.ph.',
        keywords: [
            'pickleball cake',
            'pickleball cake design',
            'pickleball birthday cake',
            'pickleball themed cake',
            'custom pickleball cake',
            'sports cake',
            'Genie.ph',
        ],
    },
};

type Props = {
    params: Promise<{ category: string }>
}

type CategoryDesign = Awaited<ReturnType<typeof getDesignsByKeyword>> extends Promise<{ data: infer T }>
    ? T extends Array<infer U>
        ? U
        : never
    : never;

function humanizeSlug(slug: string): string {
    return slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function stripCakeSuffix(label: string): string {
    return label.replace(/\s+cake$/i, '').trim();
}

function buildCollectionKeywords(title: string, category: string, tags?: string[] | null): string[] {
    const coreTitle = stripCakeSuffix(title).toLowerCase();
    const fallbackKeywords = COLLECTION_SEO_FALLBACKS[category]?.keywords || [];
    const tagKeywords = (tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);

    return Array.from(new Set([
        `${coreTitle} cake`,
        `${coreTitle} cake ideas`,
        `${coreTitle} cake design`,
        `custom ${coreTitle} cake`,
        ...tagKeywords,
        ...fallbackKeywords,
    ]));
}

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const { category } = await params

    // Try to find the exact collection
    const { data: collection } = await getCollectionBySlug(category);

    let title = collection?.name;
    let desc = collection?.description || COLLECTION_SEO_FALLBACKS[category]?.description;

    if (!title) {
        // Fallback for random slugs
        title = humanizeSlug(category)
    }

    if (!desc) {
        desc = `Browse our collection of ${title.toLowerCase()} designs. Get instant AI pricing for any of these custom cakes from trusted local bakers.`
    }

    // Fetch designs to get the first image for og:image
    const { data: designs } = await getDesignsByKeyword(category, 1);
    const ogImage = collection?.sample_image || designs?.[0]?.original_image_url;

    // Avoid "Kuromi Cake Cake Ideas" — strip trailing "Cake" before appending
    const titleForMeta = stripCakeSuffix(title);
    const imageAlt = `${titleForMeta} cake design collection — browse ${titleForMeta.toLowerCase()} cake ideas on Genie.ph`;

    return {
        title: { absolute: `${titleForMeta} Cake Ideas & Designs | Genie.ph` },
        description: desc,
        keywords: buildCollectionKeywords(title, category, collection?.tags),
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        },
        category: 'Cake Design Collections',
        alternates: {
            canonical: `https://genie.ph/collections/${category}`,
        },
        openGraph: {
            title: `${titleForMeta} Cake Designs`,
            description: desc,
            url: `https://genie.ph/collections/${category}`,
            type: 'website',
            siteName: 'Genie.ph',
            locale: 'en_PH',
            ...(ogImage ? {
                images: [{
                    url: ogImage,
                    width: 1200,
                    height: 1200,
                    alt: imageAlt,
                }],
            } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: `${titleForMeta} Cake Ideas & Designs | Genie.ph`,
            description: desc,
            ...(ogImage ? {
                images: [{
                    url: ogImage,
                    width: 1200,
                    height: 1200,
                    alt: imageAlt,
                }],
            } : {}),
        },
    }
}

export async function generateStaticParams() {
    const { data: categories } = await getDesignCategories();
    const slugs = new Set((categories || []).slice(0, 30).map((collection) => collection.slug));
    FEATURED_COLLECTION_SLUGS.forEach((slug) => slugs.add(slug));

    return Array.from(slugs).map((category) => ({ category }));
}

export default async function CategoryPage({ params }: Props) {
    const { category } = await params

    // 1. Get the official collection details if it exists
    const { data: collection } = await getCollectionBySlug(category);

    let readableTitle = collection?.name;
    const description = collection?.description || COLLECTION_SEO_FALLBACKS[category]?.description || null;

    if (!readableTitle) {
        readableTitle = humanizeSlug(category);
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
    const galleryImages = designs.slice(0, 12).map((d: CategoryDesign) => {
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
