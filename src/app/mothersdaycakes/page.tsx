import { Metadata } from 'next';
import LandingClient from '@/app/LandingClient';
import NewsletterPopup from '@/components/NewsletterPopup';
import {
    RecommendedProductsSection,
    MothersDayIntroContent,
} from '@/components/landing';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { MOTHERS_DAY_HERO_CONTENT } from '@/components/landing/landingHeroContent';
import {
    getHomepageBlogPreviews,
    getRecommendedProducts,
    type RecommendedProductsQueryOptions,
} from '@/services/supabaseService';
import type { LandingHeroContent } from '@/components/landing/landingHeroContent';
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile';

export const revalidate = 3600;

const MOTHERS_DAY_PRODUCT_QUERY: RecommendedProductsQueryOptions = {
    keywords: ["mother's day", 'mothers day', 'mother', 'mom'],
};

const MOTHERS_DAY_MESSAGE_RE = /happy\s+mother'?s\s+day/i;

type MothersDayProduct = {
    p_hash: string;
    original_image_url: string;
    price: number;
    keywords?: string;
    slug?: string;
    availability?: string;
    image_width?: number | null;
    image_height?: number | null;
    analysis_json?: {
        cake_messages?: Array<
            | string
            | {
                text?: string;
                message?: string;
                [key: string]: unknown;
            }
        >;
        [key: string]: unknown;
    };
};

function getCakeMessageTexts(product: MothersDayProduct): string[] {
    if (!Array.isArray(product.analysis_json?.cake_messages)) {
        return [];
    }

    return product.analysis_json.cake_messages
        .map(message => {
            if (typeof message === 'string') {
                return message.trim();
            }

            if (message && typeof message === 'object') {
                return String(message.text ?? message.message ?? '').trim();
            }

            return '';
        })
        .filter(Boolean);
}

function buildMothersDayHeroContent(products: MothersDayProduct[]): LandingHeroContent {
    const heroProducts = products.slice(0, 6).map((product) => ({
        title: product.keywords?.trim() || "Mother's Day Cake",
        image: product.original_image_url,
        headlineVariant: 0,
    }));

    return heroProducts.length > 0
        ? { ...MOTHERS_DAY_HERO_CONTENT, products: heroProducts }
        : MOTHERS_DAY_HERO_CONTENT;
}

async function getMothersDayProducts(limit: number = 8): Promise<MothersDayProduct[]> {
    const response = await getRecommendedProducts(80, 0, MOTHERS_DAY_PRODUCT_QUERY);
    const candidates = (response.data || []) as MothersDayProduct[];

    const exactMessageMatches = candidates.filter((product) =>
        getCakeMessageTexts(product).some((text) => MOTHERS_DAY_MESSAGE_RE.test(text))
    );

    if (exactMessageMatches.length >= limit) {
        return exactMessageMatches.slice(0, limit);
    }

    const fallbackMatches = candidates.filter((product) => {
        if (exactMessageMatches.some(match => match.p_hash === product.p_hash)) {
            return false;
        }

        const searchableText = [
            product.keywords || '',
            ...getCakeMessageTexts(product),
        ].join(' ').toLowerCase();

        return searchableText.includes('mother') || searchableText.includes('mom');
    });

    return [...exactMessageMatches, ...fallbackMatches].slice(0, limit);
}

const META_IMAGE =
    genieBusinessProfile.ogImageUrl;

export const metadata: Metadata = {
    title: { absolute: "Mother's Day Cakes 2026 in Cebu | Personalized Cakes for Mom | Genie.ph" },
    description:
        "Mother's Day 2026 falls on Sunday, May 10, 2026. Find floral, photo, and personalized Mother's Day cakes in Cebu with instant pricing and online ordering at Genie.ph.",
    openGraph: {
        title: "Mother's Day Cakes 2026 in Cebu | Personalized Cakes for Mom",
        description:
            "Order Mother's Day cakes in Cebu for Sunday, May 10, 2026. Browse floral, photo, and custom cakes for mom with instant pricing at Genie.ph.",
        images: [
            {
                url: META_IMAGE,
                width: 1200,
                height: 630,
                alt: "Genie.ph Mother's Day Cakes 2026",
            },
        ],
        url: 'https://genie.ph/mothersdaycakes',
        type: 'website',
    },
    alternates: {
        canonical: 'https://genie.ph/mothersdaycakes',
    },
    twitter: {
        card: 'summary_large_image',
        title: "Mother's Day Cakes 2026 in Cebu | Personalized Cakes for Mom",
        description:
            "Mother's Day 2026 is on Sunday, May 10. Shop floral, photo, and custom cakes for mom at Genie.ph.",
        images: [
            {
                url: META_IMAGE,
                width: 1200,
                height: 630,
                alt: "Genie.ph Mother's Day Cakes 2026",
            },
        ],
    },
};

function MothersDaySchema() {
    const schema = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebPage',
                name: "Mother's Day Cakes 2026 in Cebu",
                description:
                    "Browse Mother's Day cakes in Cebu for Sunday, May 10, 2026, including floral, photo, and personalized cakes for mom.",
                url: 'https://genie.ph/mothersdaycakes',
                isPartOf: {
                    '@type': 'WebSite',
                    name: 'Genie.ph',
                    url: 'https://genie.ph',
                },
            },
            {
                '@type': 'CollectionPage',
                name: "Mother's Day Cakes",
                description:
                    "Shop Mother's Day cakes, floral cakes, and photo cakes for mom in Cebu for Mother's Day on Sunday, May 10, 2026.",
                url: 'https://genie.ph/mothersdaycakes',
                hasPart: [
                    {
                        '@type': 'CreativeWork',
                        name: "Mother's Day Cakes",
                        url: 'https://genie.ph/search?q=mother%27s+day+cake',
                    },
                    {
                        '@type': 'CreativeWork',
                        name: 'Floral Cakes for Mom',
                        url: 'https://genie.ph/search?q=floral+cake',
                    },
                    {
                        '@type': 'CreativeWork',
                        name: 'Photo Cakes for Mom',
                        url: 'https://genie.ph/search?q=photo+cake',
                    },
                ],
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: 'https://genie.ph',
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: "Mother's Day Cakes",
                        item: 'https://genie.ph/mothersdaycakes',
                    },
                ],
            },
        ],
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
    );
}

export default async function MothersDayPage() {
    const [recommendedProductsRes, blogsRes] = await Promise.all([
        getMothersDayProducts(8).then(data => ({ data, error: null })).catch(err => ({ data: [], error: err })),
        getHomepageBlogPreviews(3).catch(err => ({ data: [], error: err })),
    ]);

    const recommendedProducts = (recommendedProductsRes.data || []) as MothersDayProduct[];
    const blogPosts = blogsRes.data || [];
    const heroContent = buildMothersDayHeroContent(recommendedProducts);

    return (
        <>
            <MothersDaySchema />
            <LandingClient heroContent={heroContent} blogPosts={blogPosts}>
                <RecommendedProductsSection
                    products={recommendedProducts}
                    headingHighlight="Mother's Day Picks:"
                    headingText="Real Happy Mother's Day cake designs"
                    description="These picks are filtered from designs that actually include a Happy Mother's Day message."
                    listName="mothers_day_recommended"
                    emptyStateText="No Mother's Day cakes found at the moment."
                    loadMoreEnabled={false}
                />
                <MothersDayIntroContent />
            </LandingClient>
            <NewsletterPopup />
            <LandingFooter />
        </>
    );
}
