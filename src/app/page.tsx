import { Metadata } from 'next';
import LandingClient from './LandingClient';
import { getRecommendedProducts, getPopularDesigns, getHomepageBlogPreviews } from '@/services/supabaseService';
import { RecommendedProductsSection, IntroContent } from '@/components/landing';
import { LandingFooter } from '@/components/landing/LandingFooter';
import NewsletterPopup from '@/components/NewsletterPopup';
import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// ISR: Revalidate every hour for fresh data while maintaining fast loads
export const revalidate = 3600;

export const metadata: Metadata = {
    title: { absolute: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!' },
    description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu. Order your perfect custom cake online today!',
    openGraph: {
        title: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
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
        title: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
        description: 'Upload any cake design, customize with AI, and get instant pricing from top cakeshops and homebakers in Cebu.',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg',
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
        .select(`
            review_id,
            rating,
            review_text,
            review_photos,
            reviewer_name,
            created_at,
            cakegenie_users(first_name, last_name),
            cakegenie_orders!order_id(cakegenie_order_items(cake_type, cake_size, customized_image_url))
        `)
        .eq('is_visible', true)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(20);
    return data || [];
}

export default async function Home() {
    const [recommendedProductsRes, popularDesignsRes, blogsRes, reviews] = await Promise.all([
        getRecommendedProducts(8, 0).catch(err => ({ data: [], error: err })),
        getPopularDesigns(8, { keyword: 'minimalist', availability: ['rush', 'same-day'] }).catch(err => ({ data: [], error: err })),
        getHomepageBlogPreviews(3).catch(err => ({ data: [], error: err })),
        getReviews().catch(() => []),
    ]);

    const recommendedProducts = recommendedProductsRes.data || [];
    const popularDesigns = popularDesignsRes.data || [];
    const blogPosts = blogsRes.data || [];

    // Shuffle hero products on the server to avoid hydration mismatch
    const shuffled = [...popularDesigns].sort(() => Math.random() - 0.5);
    const heroProducts = shuffled.slice(0, 4);

    return (
        <>
            <WebSiteSchema />
            <LandingClient popularDesigns={popularDesigns} heroProducts={heroProducts} blogPosts={blogPosts} reviews={reviews}>
                {/* Server-rendered sections for LCP optimization */}
                {/* <MerchantShowcase merchants={merchants} /> - Hidden for now */}
                <RecommendedProductsSection products={recommendedProducts} />
                <IntroContent />
            </LandingClient>
            <LandingFooter />
            <NewsletterPopup />
        </>
    );
}
