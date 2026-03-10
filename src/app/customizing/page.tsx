import { Metadata } from 'next'
import { Suspense } from 'react'
import CustomizingClient from './CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'

// Shopify CSE handoff: image comes from external URL via query param
// Read searchParams to enable SSR-side preload of the hero image
interface CustomizingPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export const revalidate = 3600; // ISR: revalidate every hour

export const metadata: Metadata = {
    title: { absolute: 'Cake Designs & Customization | Genie.ph' },
    description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu. Birthday cakes, wedding cakes, character cakes and more.',
    openGraph: {
        title: 'Cake Designs & Customization | Genie.ph',
        description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu.',
        type: 'website',
        url: 'https://genie.ph/customizing',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta-GENIE.jpg',
            width: 1200,
            height: 630,
            alt: 'Genie.ph Cake Customizer',
        }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Cake Designs & Customization | Genie.ph',
        description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu.',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta-GENIE.jpg',
            width: 1200,
            height: 630,
            alt: 'Genie.ph Cake Customizer',
        }],
    },
    alternates: {
        canonical: 'https://genie.ph/customizing',
    },
}

export default async function CustomizingPage(props: CustomizingPageProps) {
    // Await searchParams for Next.js 15+ compatibility
    const searchParams = await props.searchParams;
    const imageUrl = typeof searchParams.image_url === 'string' ? searchParams.image_url : null;
    const source = typeof searchParams.source === 'string' ? searchParams.source : null;

    // Only preload for Shopify CSE handoff - external images go through proxy
    const isShopifyCse = source === 'shopify_cse' && imageUrl;
    const proxyImageUrl = isShopifyCse ? `/api/proxy-image?url=${encodeURIComponent(imageUrl)}` : null;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Cake Designs & Customization',
        description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu.',
        url: 'https://genie.ph/customizing',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta-GENIE.jpg',
        publisher: {
            '@type': 'Organization',
            name: 'Genie.ph'
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
            />
            {/* SSR preload for Shopify CSE hero image - starts fetching before React hydrates */}
            {proxyImageUrl && (
                <link
                    rel="preload"
                    as="image"
                    href={proxyImageUrl}
                    crossOrigin="anonymous"
                />
            )}
            {/* Client-side customization tool — uses root-level CustomizationProvider from Providers.tsx */}
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizingClient
                    // Pass the preloading image URL to client for immediate use
                    preloadImageUrl={proxyImageUrl}
                />
            </Suspense>
        </>
    )
}
