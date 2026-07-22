import { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import LandingClient from './LandingClient';
import { getRecommendedProducts, getHomepageBlogPreviews } from '@/services/supabaseService';
import { RecommendedProductsSection, IntroContent } from '@/components/landing';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingPageSkeleton } from '@/components/LoadingSkeletons';
import { createPublicServerSupabaseClient } from '@/lib/supabase/publicServer';
import { buildReviewSummary, normalizePublicReviews, REVIEW_SELECT } from '@/lib/reviews';
import HomepageAeoSections from '@/components/seo/HomepageAeoSections';
import type { SupabaseClient } from '@supabase/supabase-js';
import { genieBusinessProfile, buildGenieLocalBusinessSchema } from '@/lib/seo/genieBusinessProfile';
import { HOMEPAGE_ASSETS } from '@/constants';
import { buildFAQPageSchema } from '@/lib/seo/schema';
import { PUBLIC_ORDER_FACTS } from '@/lib/seo/publicOrderFacts';

// The newsletter popup is gated on a 25s timer or 40% scroll, so it never
// affects the initial render. Lazy-loading it keeps its bundle (and the auth
// hooks it pulls in) out of the homepage's critical-path JS.
const NewsletterPopup = dynamic(() => import('@/components/NewsletterPopup'));

// ISR: Revalidate every hour for fresh data while maintaining fast loads
export const revalidate = 3600;

export const metadata: Metadata = {
    title: { absolute: 'Best Online Cake Delivery for Rush Orders in Cebu' },
    description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu. Order your perfect custom cake online today!',
    openGraph: {
        title: 'Best Online Cake Delivery for Rush Orders in Cebu',
        description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu. Order your perfect custom cake online today!',
        images: [{
            url: genieBusinessProfile.ogImageUrl,
            width: 1200,
            height: 630,
            alt: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu',
        }],
        url: 'https://genie.ph/',
        type: 'website',
    },
    alternates: {
        canonical: 'https://genie.ph/',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Best Online Cake Delivery for Rush Orders in Cebu',
        description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu.',
        images: [{
            url: genieBusinessProfile.ogImageUrl,
            width: 1200,
            height: 630,
            alt: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu',
        }],
    },
};

function WebSiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
            {
                '@type': 'CollectionPage',
                '@id': 'https://genie.ph/#homepage',
                name: 'Online Marketplace for Custom Cakes in Cebu',
                description: 'Browse customizable cakes from top local bakers in Cebu. Get instant pricing and order online.',
                url: 'https://genie.ph',
                isPartOf: {
                    '@id': genieBusinessProfile.websiteId,
                },
                about: {
                    '@id': genieBusinessProfile.organizationId,
                },
                hasPart: [
                    {
                        '@type': 'CreativeWork',
                        name: 'Minimalist Cakes',
                        url: 'https://genie.ph/collections/minimalist-cake'
                    },
                    {
                        '@type': 'CreativeWork',
                        name: 'Bento Cakes',
                        url: 'https://genie.ph/collections/bento-cake'
                    },
                    {
                        '@type': 'CreativeWork',
                        name: 'Wedding Cakes',
                        url: 'https://genie.ph/collections/wedding-cake'
                    },
                    {
                        '@type': 'CreativeWork',
                        name: 'Cake Pricing and Ordering Guide',
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

function LocalBusinessSchema({
    averageRating,
    reviewCount,
}: {
    averageRating: number;
    reviewCount: number;
}) {
    const baseSchema = buildGenieLocalBusinessSchema();
    const schema = reviewCount > 0
        ? {
            ...baseSchema,
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Number(averageRating.toFixed(2)),
                ratingCount: reviewCount,
                bestRating: 5,
                worstRating: 1,
            },
        }
        : baseSchema;

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

function HomepageFAQSchema() {
    const homepageFaqs = [
        {
            question: 'What is Genie.ph?',
            answer: 'Genie.ph is an AI-powered custom cake marketplace in Cebu. Customers can upload a cake design, review an AI-generated starting price, customize the cake details, and place an order with Metro Cebu delivery or pickup support.',
        },
        {
            question: 'How much do custom cakes cost on Genie.ph?',
            answer: PUBLIC_ORDER_FACTS.pricingSummary,
        },
        {
            question: 'Where does Genie.ph deliver?',
            answer: PUBLIC_ORDER_FACTS.deliverySummary,
        },
        {
            question: 'How do I order a custom cake on Genie.ph?',
            answer: `Order a custom cake in 3 steps: 1) upload a design on Genie.ph, 2) customize the cake after the AI-generated starting price appears, 3) place the order with secure online checkout. ${PUBLIC_ORDER_FACTS.paymentSummary} ${PUBLIC_ORDER_FACTS.leadTimeSummary}`,
        },
    ];

    const faqSchema = buildFAQPageSchema(homepageFaqs, 'https://genie.ph');
    if (!faqSchema) return null;

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
    );
}

async function getHomepageReviews() {
    // Homepage reviews are public data. A cookie-aware client calls cookies(),
    // making the entire route dynamic and defeating the hourly ISR contract.
    const supabase: SupabaseClient = createPublicServerSupabaseClient();

    const [{ data: reviewRows, error }, { data: ratingRows }] = await Promise.all([
        supabase
            .from('cakegenie_reviews')
            .select(REVIEW_SELECT)
            .eq('is_visible', true)
            .eq('is_approved', true)
            .order('created_at', { ascending: false })
            .limit(3),
        supabase
            .from('cakegenie_reviews')
            .select('rating')
            .eq('is_visible', true)
            .eq('is_approved', true),
    ]);

    const normalizedReviews = normalizePublicReviews(reviewRows);
    return {
        reviews: normalizedReviews,
        error,
        reviewSummary: buildReviewSummary(ratingRows),
    };
}

/**
 * Async server component that fetches data + renders the homepage's
 * data-dependent below-fold sections (recommended products, AEO/reviews
 * blocks, blog previews via the parent LandingClient). It also resolves the
 * review summary used by the hero's "★★★★★ N happy customers" line.
 *
 * All queries use cookie-free public clients, so Next can resolve this into
 * the hourly ISR snapshot instead of making the homepage request-dynamic.
 * Suspense still provides a safe fallback during an uncached regeneration.
 */
async function LandingDataSections() {
    const [recommendedProductsRes, blogsRes, homepageReviews] = await Promise.all([
        getRecommendedProducts(8, 0).catch(err => ({ data: [], error: err })),
        getHomepageBlogPreviews(3).catch(err => ({ data: [], error: err })),
        getHomepageReviews().catch(() => ({
            reviews: [],
            error: null,
            reviewSummary: {
                total: 0,
                averageRating: 0,
            },
        })),
    ]);

    const recommendedProducts = recommendedProductsRes.data || [];
    const blogPosts = blogsRes.data || [];

    return (
        <>
            <LocalBusinessSchema
                averageRating={homepageReviews.reviewSummary.averageRating}
                reviewCount={homepageReviews.reviewSummary.total}
            />
            <LandingClient
                blogPosts={blogPosts}
                reviewSummary={homepageReviews.reviewSummary}
            >
                <RecommendedProductsSection products={recommendedProducts} />
                <IntroContent />
                <HomepageAeoSections reviews={homepageReviews.reviews} />
            </LandingClient>
            <LandingFooter reviewSummary={homepageReviews.reviewSummary} />
        </>
    );
}

export default function Home() {
    return (
        <>
            {/*
              Mobile Lighthouse consistently identifies the first minimalist
              card as LCP. Preloading all six hero images made the other five
              compete with that critical request on throttled mobile networks,
              so only the actual LCP candidate receives a global preload.
            */}
            <link
                rel="preload"
                as="image"
                href={HOMEPAGE_ASSETS.heroProducts.minimalist}
                fetchPriority="high"
            />
            {/* Desktop's measured LCP is the transition image below the hero. */}
            <link
                rel="preload"
                as="image"
                href={HOMEPAGE_ASSETS.transition}
                media="(min-width: 768px)"
                fetchPriority="high"
            />
            <WebSiteSchema />
            <HomepageFAQSchema />
            {/*
              Public homepage data is resolved into the static ISR snapshot,
              so the complete hero and its LCP image are present in cached HTML.
              The Suspense fallback covers an uncached regeneration without
              turning the route back into request-time dynamic rendering.
            */}
            <Suspense fallback={<LandingPageSkeleton />}>
                <LandingDataSections />
            </Suspense>
            <NewsletterPopup />
        </>
    );
}
