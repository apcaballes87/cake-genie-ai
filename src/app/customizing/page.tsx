import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import CustomizingClient from './CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LandingFooter } from '@/components/landing/LandingFooter'

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
            alt: 'Custom Cake Designs for Birthday, Wedding, Debut & Graduation | Genie.ph',
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
            alt: 'Custom Cake Designs for Birthday, Wedding, Debut & Graduation | Genie.ph',
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

    // Preload for external sources (Shopify CSE, Chrome Extension) - external images go through proxy
    const isExternalSource = (source === 'shopify_cse' || source === 'chrome_extension') && imageUrl;
    const proxyImageUrl = isExternalSource ? `/api/proxy-image?url=${encodeURIComponent(imageUrl)}` : null;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Cake Designs & Customization',
        description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu. Birthday cakes, wedding cakes, character cakes and more.',
        url: 'https://genie.ph/customizing',
        keywords: 'cake design, birthday cake design, wedding cake design, custom cake, debut cake, graduation cake, character cake, Cebu cake',
        image: {
            '@type': 'ImageObject',
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta-GENIE.jpg',
            width: 1200,
            height: 630,
            name: 'Custom Cake Designs',
            description: 'Browse 1,000+ custom cake designs for birthday, wedding, debut, and graduation in Cebu, Philippines',
        },
        publisher: {
            '@type': 'Organization',
            name: 'Genie.ph',
            url: 'https://genie.ph',
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
                />
            )}
            {/* Client-side customization tool — uses root-level CustomizationProvider from Providers.tsx */}
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizingClient
                    preloadSource={source || undefined}
                    preloadImageUrl={proxyImageUrl || undefined}
                    hideAiChat={true}
                />
            </Suspense>

            {/* Browse by Theme — static internal links for crawlability */}
            <nav aria-label="Browse cake designs by theme" className="max-w-7xl mx-auto px-4 pb-10">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Browse by Theme</h2>
                <div className="flex flex-wrap gap-2">
                    {[
                        { href: '/customizing/category/birthday-cakes', label: 'Birthday Cake Designs' },
                        { href: '/customizing/category/kuromi-cake', label: 'Kuromi Cake Designs' },
                        { href: '/customizing/category/wedding-cake', label: 'Wedding Cake Designs' },
                        { href: '/customizing/category/graduation-cake', label: 'Graduation Cake Designs' },
                        { href: '/customizing/category/minimalist-cake', label: 'Minimalist Cake Designs' },
                        { href: '/customizing/category/bento-cake', label: 'Bento Cake Designs' },
                        { href: '/customizing/category/character-cake', label: 'Character Cake Designs' },
                        { href: '/customizing/category/debut-cake', label: 'Debut Cake Designs' },
                        { href: '/customizing/category/baptism-cake', label: 'Baptism Cake Designs' },
                        { href: '/customizing/category/anniversary-cake', label: 'Anniversary Cake Designs' },
                    ].map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/70 border border-slate-200 text-slate-600 hover:border-purple-400 hover:text-purple-700 transition-colors"
                        >
                            {label}
                        </Link>
                    ))}
                </div>
            </nav>
            <LandingFooter />
        </>
    )
}
