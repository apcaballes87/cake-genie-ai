import { Metadata } from 'next';
import LandingClient from './LandingClient';
import { getRecommendedProducts, getHomepageBlogPreviews, getDesignCategories } from '@/services/supabaseService';
import { RecommendedProductsSection, IntroContent } from '@/components/landing';
import { LandingFooter } from '@/components/landing/LandingFooter';
import NewsletterPopup from '@/components/NewsletterPopup';
import { createClient } from '@/lib/supabase/server';
import { normalizePublicReviews, REVIEW_SELECT } from '@/lib/reviews';
import { SupabaseClient } from '@supabase/supabase-js';

// ISR: Revalidate every hour for fresh data while maintaining fast loads
export const revalidate = 3600;

export const metadata: Metadata = {
    title: { absolute: 'Best Online Cake Delivery for Rush Orders in Cebu' },
    description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu. Order your perfect custom cake online today!',
    openGraph: {
        title: 'Best Online Cake Delivery for Rush Orders in Cebu',
        description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu. Order your perfect custom cake online today!',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg',
            width: 1200,
            height: 630,
            alt: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu',
        }],
        url: 'https://genie.ph/',
        type: 'website',
    },
    alternates: {
        canonical: 'https://genie.ph',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Best Online Cake Delivery for Rush Orders in Cebu',
        description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu.',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg',
            width: 1200,
            height: 630,
            alt: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu',
        }],
    },
};

type HeroCollectionCard = {
    title: string;
    slug: string;
    count: number;
    sampleImage: string;
    caption: string;
};

type DesignCategory = {
    keyword: string;
    slug: string;
    count: number;
    sample_image: string;
};

const HERO_COLLECTION_BLUEPRINTS = [
    {
        title: 'Minimalist Cakes',
        slug: 'minimalist-cake',
        matchers: ['minimalist'],
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-minimalist-cake.webp',
        caption: 'Clean lines, pastel finishes, and understated message cakes.',
    },
    {
        title: 'Vintage Cakes',
        slug: 'vintage-cake',
        matchers: ['vintage', 'lambeth'],
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-vintage-cake.webp',
        caption: 'Frilly piping, retro charm, and statement celebration cakes.',
    },
    {
        title: 'Doodle Cakes',
        slug: 'doodle-cake',
        matchers: ['doodle'],
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-doodle-cake.webp',
        caption: 'Playful hand-drawn details for expressive, modern birthdays.',
    },
    {
        title: 'Edible Photo Cakes',
        slug: 'edible-photo-cake',
        matchers: ['edible photo', 'photo cake'],
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-edible-photo-cake.webp',
        caption: 'Printed memories and personalized graphics wrapped into cake form.',
    },
    {
        title: 'Floral Cakes',
        slug: 'floral-cake',
        matchers: ['floral', 'flower'],
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-floral-cake.webp',
        caption: 'Soft blooms, romantic piping, and elegant garden-party finishes.',
    },
    {
        title: 'Bento Cakes',
        slug: 'bento-cake',
        matchers: ['bento'],
        sampleImage: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/landing-page-bento-cake.webp',
        caption: 'Compact celebration cakes with playful piping and giftable charm.',
    },
] as const;

function buildHeroCollections(categories: DesignCategory[]): HeroCollectionCard[] {
    return HERO_COLLECTION_BLUEPRINTS.map((blueprint) => {
        const match = categories.find((category) => {
            const keyword = category.keyword.toLowerCase();
            const slug = category.slug.toLowerCase();

            return slug === blueprint.slug || blueprint.matchers.some((matcher) => keyword.includes(matcher) || slug.includes(matcher.replace(/\s+/g, '-')));
        });

        return {
            title: blueprint.title,
            slug: match?.slug || blueprint.slug,
            count: match?.count || 0,
            sampleImage: blueprint.sampleImage,
            caption: blueprint.caption,
        };
    });
}

function WebSiteSchema() {
    const schema = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                name: 'Genie.ph',
                url: 'https://genie.ph',
                potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                        '@type': 'EntryPoint',
                        urlTemplate: 'https://genie.ph/search?q={search_term_string}'
                    },
                    'query-input': 'required name=search_term_string'
                }
            },
            {
                '@type': 'CollectionPage',
                name: 'Online Marketplace for Custom Cakes in Cebu',
                description: 'Browse customizable cakes from top local bakers in Cebu. Get instant pricing and order online.',
                url: 'https://genie.ph',
                hasPart: [
                    {
                        '@type': 'CreativeWork',
                        name: 'Minimalist Cakes',
                        url: 'https://genie.ph/search?q=minimalist+cakes'
                    },
                    {
                        '@type': 'CreativeWork',
                        name: 'Bento Cakes',
                        url: 'https://genie.ph/search?q=bento+cakes'
                    },
                    {
                        '@type': 'CreativeWork',
                        name: 'Wedding Cakes',
                        url: 'https://genie.ph/search?q=wedding'
                    },
                    {
                        '@type': 'CreativeWork',
                        name: 'Cake Price Calculator',
                        url: 'https://genie.ph/cake-price-calculator'
                    },
                    {
                        '@type': 'CreativeWork',
                        name: 'How to Order Custom Cakes',
                        url: 'https://genie.ph/how-to-order'
                    }
                ]
            }
        ]
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

async function getReviews() {
    const supabase: SupabaseClient = await createClient();
    const { data } = await supabase
        .from('cakegenie_reviews')
        .select(REVIEW_SELECT)
        .eq('is_visible', true)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(20);
    return normalizePublicReviews(data);
}

export default async function Home() {
    const [recommendedProductsRes, blogsRes, categoriesRes, reviews] = await Promise.all([
        getRecommendedProducts(8, 0).catch(err => ({ data: [], error: err })),
        getHomepageBlogPreviews(3).catch(err => ({ data: [], error: err })),
        getDesignCategories().catch(err => ({ data: [], error: err })),
        getReviews().catch(() => []),
    ]);

    const recommendedProducts = recommendedProductsRes.data || [];
    const blogPosts = blogsRes.data || [];
    const heroCollections = buildHeroCollections(categoriesRes.data || []);

    return (
        <>
            <WebSiteSchema />
            <LandingClient heroCollections={heroCollections} blogPosts={blogPosts} reviews={reviews}>
                {/* Server-rendered sections for LCP optimization */}
                {/* <MerchantShowcase merchants={merchants} /> - Hidden for now */}
                <RecommendedProductsSection products={recommendedProducts} />
                <IntroContent />
            </LandingClient>
            <NewsletterPopup />
            <LandingFooter />
        </>
    );
}
