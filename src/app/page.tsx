import { Metadata } from 'next';
import LandingClient from './LandingClient';
import { getRecommendedProducts, getPopularDesigns, getDesignCategories } from '@/services/supabaseService';
import { RecommendedProductsSection, IntroContent, PopularDesigns } from '@/components/landing';
import { createClient } from '@/lib/supabase/server';

// ISR: Revalidate every hour for fresh data while maintaining fast loads
export const revalidate = 3600;

export const metadata: Metadata = {
    title: 'Genie.ph | Online Marketplace for Custom Cakes in Cebu!',
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
};

function HomepageFAQSchema() {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: 'How does Genie.ph work?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Upload any cake design photo, customize it with our AI-powered editor, and get instant pricing from the best local cakeshops and homebakers in Cebu. Order online in minutes with secure payment via GCash, Maya, or card.',
                },
            },
            {
                '@type': 'Question',
                name: 'How much do custom cakes cost on Genie.ph?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Prices start as low as ₱350 for bento cakes. Standard round cakes start from ₱800 and up depending on size, design complexity, and the baker you choose. Use our free Cake Price Calculator for an instant AI estimate.',
                },
            },
            {
                '@type': 'Question',
                name: 'Does Genie.ph deliver in Cebu?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes! Genie.ph delivers throughout Metro Cebu including Cebu City, Mandaue, Lapu-Lapu (Mactan), Talisay, and select surrounding areas. Delivery coverage depends on your chosen baker.',
                },
            },
            {
                '@type': 'Question',
                name: 'Can I upload my own cake design photo?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Absolutely! Upload any cake photo or inspiration image and our AI analyzes it, breaks it into customizable components — icing style, toppers, colors, and messages — then generates accurate pricing from vetted local bakers.',
                },
            },
        ],
    };
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
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

export default async function Home() {
    const [recommendedProductsRes, popularDesignsRes, categoriesRes] = await Promise.all([
        getRecommendedProducts(8, 0).catch(err => ({ data: [], error: err })),
        getPopularDesigns(6, { keyword: 'minimalist', availability: ['rush', 'same-day'] }).catch(err => ({ data: [], error: err })),
        getDesignCategories().catch(err => ({ data: [], error: err })),
    ]);

    const recommendedProducts = recommendedProductsRes.data || [];
    const popularDesigns = popularDesignsRes.data || [];
    const categories = categoriesRes.data || [];

    return (
        <>
            <HomepageFAQSchema />
            <WebSiteSchema />
            <LandingClient popularDesigns={popularDesigns} categories={categories}>
                {/* Server-rendered sections for LCP optimization */}
                {/* <MerchantShowcase merchants={merchants} /> - Hidden for now */}
                <RecommendedProductsSection products={recommendedProducts} />
                <IntroContent />
            </LandingClient>
        </>
    );
}
