import { Metadata } from 'next'
import { Suspense } from 'react'
import ColdCakingClient from './ColdCakingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export const revalidate = 3600;

export const metadata: Metadata = {
    title: { absolute: 'Corporate Cake Gifts | The Best Way to Order Custom Cakes for Business' },
    description: 'Order custom corporate cakes and gifts for your team and clients. Print your logo, brand, or message on a delicious cake. Perfect for giveaways, celebrations, and business events.',
    openGraph: {
        title: 'Corporate Cake Gifts | The Best Way to Order Custom Cakes for Business',
        description: 'Order custom corporate cakes and gifts for your team and clients. Print your logo on a delicious cake. Perfect for giveaways, celebrations, and business events.',
        type: 'website',
        url: 'https://genie.ph/coldcaking',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cold-caking/corporate-giveaways-cakes-hero.webp',
            width: 1200,
            height: 630,
            alt: 'Corporate Cake Gifts - Custom Cakes for Business',
        }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Corporate Cake Gifts | The Best Way to Order Custom Cakes for Business',
        description: 'Order custom corporate cakes and gifts for your team and clients. Print your logo on a delicious cake. Perfect for giveaways, celebrations, and business events.',
        images: [{
            url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cold-caking/corporate-giveaways-cakes-hero.webp',
            width: 1200,
            height: 630,
            alt: 'Corporate Cake Gifts - Custom Cakes for Business',
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
        name: 'Corporate Cake Gifts | The Best Way to Order Custom Cakes for Business',
        description: 'Order custom corporate cakes and gifts for your team and clients. Print your logo, brand, or message on a delicious cake.',
        url: 'https://genie.ph/coldcaking',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cold-caking/corporate-giveaways-cakes-hero.webp',
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
