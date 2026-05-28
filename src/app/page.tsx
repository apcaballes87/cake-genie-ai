import { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import LandingClient from './LandingClient';
import { getRecommendedProducts, getHomepageBlogPreviews } from '@/services/supabaseService';
import { RecommendedProductsSection, IntroContent } from '@/components/landing';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingPageSkeleton } from '@/components/LoadingSkeletons';
import { createClient } from '@/lib/supabase/server';
import { normalizePublicReviews, REVIEW_SELECT } from '@/lib/reviews';
import HomepageAeoSections from '@/components/seo/HomepageAeoSections';
import type { SupabaseClient } from '@supabase/supabase-js';
import { genieBusinessProfile, buildGenieLocalBusinessSchema } from '@/lib/seo/genieBusinessProfile';
import { HOMEPAGE_ASSETS } from '@/constants';
import AnimatedBlobs from '@/components/UI/AnimatedBlobs';

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

async function getHomepageReviews() {
    const supabase: SupabaseClient = await createClient();

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
    const total = ratingRows?.length || 0;
    const averageRating = total > 0
        ? ratingRows!.reduce((sum, review) => sum + review.rating, 0) / total
        : 0;

    return {
        reviews: normalizedReviews,
        error,
        reviewSummary: {
            total,
            averageRating,
        },
    };
}

/**
 * Async server component that fetches data + renders the homepage's
 * data-dependent below-fold sections (recommended products, AEO/reviews
 * blocks, blog previews via the parent LandingClient). It also resolves the
 * review summary used by the hero's "★★★★★ N happy customers" line.
 *
 * Wrapped in <Suspense> at the call site so the hero in <LandingClient>
 * paints immediately while this streams in.
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
              LCP preload: the hero masonry grid renders 6 cake-card images
              that are roughly equal in size, so the LCP element is whichever
              one happens to win the layout race — it's not deterministic
              between minimalist/photo/floral/vintage/doodle/bento. Preloading
              just one was a coin flip, so we preload all six. They're small
              webp files (~20-40 KB each) and they're all above the fold, so
              shipping them in parallel is the right call.

              The first <link> uses fetchPriority="high" so the browser still
              treats the leftmost card (the most likely LCP candidate on
              wide viewports) as the highest priority. The other five queue
              right behind at default priority — without these hints they
              were starting after the LandingClient bundle hydrated, costing
              ~700 ms of LCP load delay.
            */}
            <link
                rel="preload"
                as="image"
                href={HOMEPAGE_ASSETS.heroProducts.minimalist}
                fetchPriority="high"
            />
            <link rel="preload" as="image" href={HOMEPAGE_ASSETS.heroProducts.vintage} />
            <link rel="preload" as="image" href={HOMEPAGE_ASSETS.heroProducts.doodle} />
            <link rel="preload" as="image" href={HOMEPAGE_ASSETS.heroProducts.photo} />
            <link rel="preload" as="image" href={HOMEPAGE_ASSETS.heroProducts.floral} />
            <link rel="preload" as="image" href={HOMEPAGE_ASSETS.heroProducts.bento} />
            <WebSiteSchema />
            <AnimatedBlobs />
            {/*
              The hero (LandingClient with empty data) renders immediately so
              the LCP element is in the static HTML. We don't wait on Supabase
              for reviews/products/blog before painting — those stream in via
              the Suspense boundary below. HeroReviewSummary already handles
              an undefined reviewSummary by showing a "Verified" fallback, so
              the hero looks complete even before the data lands.
            */}
            <Suspense fallback={<LandingPageSkeleton />}>
                <LandingDataSections />
            </Suspense>
            <NewsletterPopup />
        </>
    );
}
