import { Metadata } from 'next'
import { Suspense } from 'react'
import CustomizingClient from './CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export const metadata: Metadata = {
    title: 'Customize Your Cake Design',
    description: 'Customize your cake design with AI-powered suggestions. Upload any cake image, get instant pricing, and order from local bakeries in Cebu. Rush orders available.',
    openGraph: {
        title: 'Customize Your Cake Design | Genie.ph',
        description: 'Upload any cake design, customize with AI-powered suggestions, and get instant pricing from local bakeries in Cebu.',
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
        title: 'Customize Your Cake Design | Genie.ph',
        description: 'Upload any cake design, customize with AI-powered suggestions, and get instant pricing from local bakeries in Cebu.',
        images: ['https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg'],
    },
}

export default function CustomizingPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
            <CustomizingClient />
        </Suspense>
    )
}
