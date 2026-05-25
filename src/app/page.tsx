import { Metadata } from 'next';
import { Suspense } from 'react';
import LandingClient from './LandingClient';
import { getRecommendedProducts, getHomepageBlogPreviews } from '@/services/supabaseService';
import { RecommendedProductsSection, IntroContent } from '@/components/landing';
import { LandingFooter } from '@/components/landing/LandingFooter';
import NewsletterPopup from '@/components/NewsletterPopup';
import { LandingPageSkeleton } from '@/components/LoadingSkeletons';
import { createClient } from '@/lib/supabase/server';
import { normalizePublicReviews, REVIEW_SELECT } from '@/lib/reviews';
import HomepageAeoSections from '@/components/seo/HomepageAeoSections';
import type { SupabaseClient } from '@supabase/supabase-js';
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile';

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

async function LandingServerSections() {
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
            <LandingClient
                blogPosts={blogPosts}
                reviewSummary={homepageReviews.reviewSummary}
            >
                {/* Server-rendered sections for LCP optimization */}
                {/* <MerchantShowcase merchants={merchants} /> - Hidden for now */}
                <RecommendedProductsSection products={recommendedProducts} />
                <IntroContent />
                <HomepageAeoSections
                  reviews={homepageReviews.reviews}
                />
            </LandingClient>
            <LandingFooter reviewSummary={homepageReviews.reviewSummary} />
        </>
    );
}

export default function Home() {
    return (
        <>
            <WebSiteSchema />
            <Suspense fallback={<LandingPageSkeleton />}>
                <LandingServerSections />
            </Suspense>
            <NewsletterPopup />
        </>
    );
}
