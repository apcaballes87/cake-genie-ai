import { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getDesignCategories, getDesignsByKeyword, getCollectionBySlug } from '@/services/supabaseService'
import CategoryClient from '@/app/collections/[category]/CategoryClient'

export const revalidate = 3600; // ISR: revalidate every hour

const COLLECTION_SEO_FALLBACKS: Record<string, { description: string; keywords: string[] }> = {
    'pickleball-cake': {
        description: 'Browse pickleball cake designs with paddles, courts, balls, and sporty birthday details. Perfect for pickleball lovers, club parties, and tournament celebrations. Get instant pricing and order custom pickleball cakes on Genie.ph.',
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

type CategoryDesign = NonNullable<Awaited<ReturnType<typeof getDesignsByKeyword>>['data']>[number];

type CollectionRecord = {
    slug?: string;
    name?: string | null;
    description?: string | null;
    tags?: string[] | null;
    sample_image?: string | null;
    item_count?: number | null;
};

function humanizeSlug(slug: string): string {
    return slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizeCollectionBaseName(label: string): string {
    const normalized = normalizeWhitespace(label);

    if (!normalized) {
        return normalized;
    }

    if (/\scakes$/i.test(normalized)) {
        return normalized.replace(/\scakes$/i, ' Cake');
    }

    if (/\scake$/i.test(normalized)) {
        return normalized.replace(/\scake$/i, ' Cake');
    }

    return normalized;
}

function stripCakeWord(label: string): string {
    return normalizeCollectionBaseName(label).replace(/\scake$/i, '').trim();
}

function buildCollectionHeading(label: string): string {
    const baseName = normalizeCollectionBaseName(label);
    return /\scake$/i.test(baseName)
        ? `${baseName} Designs`
        : `${baseName} Cake Designs`;
}

function buildCollectionMetaTitle(label: string): string {
    return `${buildCollectionHeading(label)} in Cebu | Genie.ph`;
}

function extractTagHighlights(tags?: string[] | null): string[] {
    return (tags || [])
        .map((tag) => normalizeWhitespace(tag))
        .filter(Boolean)
        .filter((tag, index, allTags) => allTags.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index)
        .filter((tag) => {
            const lowered = tag.toLowerCase();
            return lowered !== 'genie.ph' && lowered !== 'cake' && lowered !== 'cakes';
        })
        .slice(0, 3);
}

function truncateMetaDescription(description: string): string {
    const trimmed = description.replace(/\s+/g, ' ').trim();
    if (trimmed.length <= 160) {
        return trimmed;
    }

    const shortened = trimmed.slice(0, 157).replace(/[,\s]+$/g, '');
    return `${shortened}...`;
}

function buildCollectionMetaDescription(collection: CollectionRecord | null, readableTitle: string, fallbackCategory: string): string {
    const defaultName = normalizeCollectionBaseName(readableTitle || humanizeSlug(fallbackCategory));
    const collectionName = defaultName.toLowerCase();
    const countText = collection?.item_count && collection.item_count > 0
        ? `Browse ${collection.item_count.toLocaleString()} ${collectionName} designs on Genie.ph.`
        : `Browse ${collectionName} designs on Genie.ph.`;
    const tagHighlights = extractTagHighlights(collection?.tags);
    const tagText = tagHighlights.length > 0
        ? ` Explore ${tagHighlights.join(', ')}.`
        : '';
    const customDescription = normalizeWhitespace(collection?.description || COLLECTION_SEO_FALLBACKS[fallbackCategory]?.description || '');
    const closingText = ' Customize your cake and get instant pricing from Cebu bakers.';

    return truncateMetaDescription(
        [countText, customDescription, tagText, closingText]
            .filter(Boolean)
            .join(' ')
    );
}

function buildCollectionKeywords(title: string, category: string, tags?: string[] | null): string[] {
    const normalizedTitle = normalizeCollectionBaseName(title).toLowerCase();
    const coreTitle = stripCakeWord(title).toLowerCase();
    const keywordRoot = coreTitle || normalizedTitle;
    const fallbackKeywords = COLLECTION_SEO_FALLBACKS[category]?.keywords || [];
    const tagKeywords = (tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);

    return Array.from(new Set([
        normalizedTitle,
        `${normalizedTitle} designs`,
        `${normalizedTitle} cebu`,
        `${normalizedTitle} delivery cebu`,
        `${keywordRoot} cake ideas`,
        `${keywordRoot} cake design`,
        `custom ${keywordRoot} cake`,
        ...tagKeywords,
        ...fallbackKeywords,
    ]));
}

function buildItemListName(design: CategoryDesign, readableTitle: string): string {
    const firstKeyword = typeof design.keywords === 'string'
        ? design.keywords.split(',')[0].trim()
        : readableTitle;
    const normalizedKeyword = normalizeCollectionBaseName(firstKeyword);
    const titleCore = stripCakeWord(readableTitle).toLowerCase();

    if (!titleCore || normalizedKeyword.toLowerCase().includes(titleCore)) {
        return buildCollectionHeading(normalizedKeyword);
    }

    return `${normalizedKeyword} in ${normalizeCollectionBaseName(readableTitle)}`;
}

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const { category } = await params
    const { data: collection } = await getCollectionBySlug(category);
    const canonicalCategory = collection?.slug || category;
    const title = collection?.name || humanizeSlug(category);
    const description = buildCollectionMetaDescription(collection, title, category);

    const { data: designs } = await getDesignsByKeyword(canonicalCategory, 1);
    const ogImage = collection?.sample_image || designs?.[0]?.original_image_url;
    const collectionHeading = buildCollectionHeading(title);

    return {
        title: { absolute: buildCollectionMetaTitle(title) },
        description,
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
            canonical: `https://genie.ph/collections/${canonicalCategory}`,
        },
        openGraph: {
            title: collectionHeading,
            description,
            url: `https://genie.ph/collections/${canonicalCategory}`,
            type: 'website',
            siteName: 'Genie.ph',
            locale: 'en_PH',
            ...(ogImage ? {
                images: [{
                    url: ogImage,
                    width: 1200,
                    height: 1200,
                    alt: `${collectionHeading} on Genie.ph`,
                }],
            } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: buildCollectionMetaTitle(title),
            description,
            ...(ogImage ? {
                images: [{
                    url: ogImage,
                    width: 1200,
                    height: 1200,
                    alt: `${collectionHeading} on Genie.ph`,
                }],
            } : {}),
        },
    }
}

export async function generateStaticParams() {
    const { data: categories } = await getDesignCategories();

    return (categories || [])
        .filter((collection) => (collection.count || 0) > 0)
        .map((collection) => ({ category: collection.slug }));
}

export default async function CategoryPage({ params }: Props) {
    const { category } = await params
    const { data: collection } = await getCollectionBySlug(category);

    if (collection?.slug && collection.slug !== category) {
        permanentRedirect(`/collections/${collection.slug}`);
    }

    const canonicalCategory = collection?.slug || category;
    const readableTitle = collection?.name || humanizeSlug(category);
    const description = collection?.description || COLLECTION_SEO_FALLBACKS[category]?.description || null;
    const pageDescription = buildCollectionMetaDescription(collection, readableTitle, category);
    const collectionHeading = buildCollectionHeading(readableTitle);
    const tagHighlights = extractTagHighlights(collection?.tags);
    const { data: designs } = await getDesignsByKeyword(canonicalCategory, 30);

    if (!designs || designs.length === 0) {
        return notFound();
    }

    const pageUrl = `https://genie.ph/collections/${canonicalCategory}`;
    const topDesigns = designs.slice(0, 12);

    const jsonLd = [
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            '@id': pageUrl,
            name: collectionHeading,
            description: pageDescription,
            url: pageUrl,
            inLanguage: 'en-PH',
            isPartOf: { '@type': 'WebSite', name: 'Genie.ph', url: 'https://genie.ph' },
            about: tagHighlights.length > 0
                ? `${normalizeCollectionBaseName(readableTitle)} cake designs for Cebu celebrations featuring ${tagHighlights.join(', ')}.`
                : `${normalizeCollectionBaseName(readableTitle)} cake designs available for customization and ordering in Cebu, Philippines.`,
            mainEntity: { '@id': `${pageUrl}#itemlist` },
            ...(collection?.sample_image || designs[0]?.original_image_url
                ? {
                    primaryImageOfPage: {
                        '@type': 'ImageObject',
                        url: collection?.sample_image || designs[0]?.original_image_url,
                        representativeOfPage: true,
                    },
                }
                : {}),
        },
        {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            '@id': `${pageUrl}#itemlist`,
            name: collectionHeading,
            itemListOrder: 'https://schema.org/ItemListOrderAscending',
            numberOfItems: designs.length,
            itemListElement: topDesigns.map((design: CategoryDesign, index: number) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: `https://genie.ph/customizing/${design.slug}`,
                name: buildItemListName(design, readableTitle),
                ...(design.original_image_url ? { image: design.original_image_url } : {}),
            })),
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph' },
                { '@type': 'ListItem', position: 2, name: 'Collections', item: 'https://genie.ph/collections' },
                { '@type': 'ListItem', position: 3, name: collectionHeading, item: pageUrl },
            ],
        },
    ];

    return (
        <>
            {jsonLd.map((schema, index) => (
                <script
                    key={`collection-ld-${index}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />
            ))}
            <CategoryClient
                designs={designs}
                keyword={canonicalCategory}
                readableTitle={readableTitle}
                category={canonicalCategory}
                description={description}
                designCount={collection?.item_count || designs.length}
                heading={collectionHeading}
                intro={pageDescription}
                tagHighlights={tagHighlights}
            />
        </>
    )
}
