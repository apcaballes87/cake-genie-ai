import { Metadata } from 'next'
import { Suspense } from 'react'
import ColdCakingClient from './ColdCakingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export const revalidate = 3600;

export const metadata: Metadata = {
    title: { absolute: 'Cold Caking - Print Your Pitch on a Cake | Genie.ph' },
    description: 'Upload your pitch deck, seed memo, or any image and get it printed on a custom cake. Inspired by the viral VC pitch cake trend — cold caking is the boldest outreach tactic of 2026.',
    openGraph: {
        title: 'Cold Caking - Print Your Pitch on a Cake | Genie.ph',
        description: 'Upload your pitch deck, seed memo, or any image and get it printed on a custom cake. The boldest outreach tactic of 2026.',
        type: 'website',
        url: 'https://genie.ph/coldcaking',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta-GENIE.jpg',
            width: 1200,
            height: 630,
            alt: 'Cold Caking - Print Your Pitch on a Cake',
        }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Cold Caking - Print Your Pitch on a Cake | Genie.ph',
        description: 'Upload your pitch deck, seed memo, or any image and get it printed on a custom cake. The boldest outreach tactic of 2026.',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta-GENIE.jpg',
            width: 1200,
            height: 630,
            alt: 'Cold Caking - Print Your Pitch on a Cake',
        }],
    },
    alternates: {
        canonical: 'https://genie.ph/coldcaking',
    },
}

export default function ColdCakingPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Cold Caking - Print Your Pitch on a Cake',
        description: 'Upload your pitch deck, seed memo, or any image and get it printed on a custom cake. Inspired by the viral VC pitch cake trend.',
        url: 'https://genie.ph/coldcaking',
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
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <ColdCakingClient />
            </Suspense>
        </>
    )
}
