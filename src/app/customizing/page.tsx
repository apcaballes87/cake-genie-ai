import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import CustomizingClient from './CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getDesignCategories, getPopularDesigns } from '@/services/supabaseService'

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
    const [categoriesRes, popularRes] = await Promise.all([
        getDesignCategories().catch(() => ({ data: [], error: null })),
        getPopularDesigns(10).catch(() => ({ data: [], error: null })),
    ]);

    const categories = categoriesRes.data || [];
    const popular = popularRes.data || [];

    return (
        <>
            {/* SSR content for Google — categories and popular designs with real links */}
            <section className="bg-gray-50 py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Popular Designs */}
                    {popular.length > 0 && (
                        <div className="mb-12">
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                                Cake Designs & Customization
                            </h1>
                            <p className="text-gray-600 mb-6">
                                Browse popular cake designs or upload your own image to get instant AI pricing from bakers in Cebu.
                            </p>
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Trending Designs</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {popular.map((design: any) => (
                                    <Link
                                        key={design.slug}
                                        href={`/customizing/${design.slug}`}
                                        className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden transition-all"
                                    >
                                        <div className="relative aspect-square bg-gray-100">
                                            <Image
                                                src={design.original_image_url}
                                                alt={design.alt_text || `${design.keywords} cake`}
                                                fill
                                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                        <div className="p-2.5">
                                            <p className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-purple-600">
                                                {design.keywords ? `${design.keywords.split(',')[0].trim()} Cake` : 'Custom Cake'}
                                            </p>
                                            <p className="text-purple-600 font-bold text-xs mt-0.5">₱{design.price?.toLocaleString()}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Category Grid */}
                    {categories.length > 0 && (
                        <div className="mb-10">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Browse by Category</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {categories.map((cat: any) => (
                                    <Link
                                        key={cat.slug}
                                        href={`/customizing/category/${cat.slug}`}
                                        className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden transition-all"
                                    >
                                        <div className="relative aspect-[4/3] bg-gray-100">
                                            <Image
                                                src={cat.sample_image}
                                                alt={`${cat.keyword} cake designs`}
                                                fill
                                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                                                className="object-cover"
                                                unoptimized
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            <div className="absolute bottom-0 left-0 right-0 p-2.5">
                                                <p className="text-white text-sm font-bold leading-tight">{cat.keyword}</p>
                                                <p className="text-white/80 text-xs">{cat.count} designs</p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Client-side customization tool */}
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizingClient />
            </Suspense>
        </>
    )
}
