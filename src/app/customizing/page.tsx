import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import CustomizingClient from './CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export const revalidate = 3600; // ISR: revalidate every hour

export const metadata: Metadata = {
    title: 'Cake Designs & Customization',
    description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu. Birthday cakes, wedding cakes, character cakes and more.',
    openGraph: {
        title: 'Cake Designs & Customization | Genie.ph',
        description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu.',
        type: 'website',
        url: 'https://genie.ph/customizing',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg',
            width: 1200,
            height: 630,
            alt: 'Genie.ph Cake Customizer',
        }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Cake Designs & Customization | Genie.ph',
        description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu.',
        images: ['https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg'],
    },
    alternates: {
        canonical: 'https://genie.ph/customizing',
    },
}

export default async function CustomizingPage() {
    return (
        <>
            {/* SSR content for Google — helpful context about the tool */}
            <section className="bg-gray-50 py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-12">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                            Cake Designs & Customization
                        </h1>
                        <p className="text-gray-600 mb-6">
                            Upload your own image to get instant AI pricing from bakers in Cebu. Or <Link href="/collections" className="text-purple-600 hover:underline">browse our design collections</Link>.
                        </p>
                    </div>
                </div>
            </section>

            {/* Client-side customization tool */}
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizingClient />
            </Suspense>
        </>
    )
}
