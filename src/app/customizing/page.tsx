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
            {/* Header removed as requested */}

            {/* Client-side customization tool */}
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizingClient />
            </Suspense>
        </>
    )
}
