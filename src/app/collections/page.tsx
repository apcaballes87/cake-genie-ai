import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { ProductCard } from '@/components/ProductCard'
import { getDesignCategories, getAllRecentDesigns } from '@/services/supabaseService'

export const revalidate = 3600; // ISR: revalidate every hour

export const metadata: Metadata = {
    title: 'Cake Design Collections | Genie.ph',
    description: 'Browse thousands of custom cake designs organized by category. From birthday cakes to weddings, find the perfect design and get instant AI pricing.',
    alternates: {
        canonical: 'https://genie.ph/collections',
    },
}

export default async function CollectionsPage() {
    const [categoriesRes, recentRes] = await Promise.all([
        getDesignCategories().catch(() => ({ data: [], error: null })),
        getAllRecentDesigns(24).catch(() => ({ data: [], error: null })),
    ]);

    const categories = categoriesRes.data || [];
    const recentDesigns = recentRes.data || [];

    return (
        <main className="min-h-screen py-10">
            <div className="w-full max-w-4xl mx-auto bg-white/80 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                        <ArrowLeft />
                    </Link>
                    <div className="grow">
                        <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
                            Browse Cake Collections
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">
                            Explore our organized library of custom cake designs. Filter by category or browse the newest arrivals from the Genie.ph community.
                        </p>
                    </div>
                </div>

                {/* Categories Grid */}
                {categories.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Popular Categories</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {categories.map((cat: any) => (
                                <Link
                                    key={cat.slug}
                                    href={`/collections/${cat.slug}`}
                                    className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
                                >
                                    <div className="relative aspect-4/3 bg-gray-100">
                                        <Image
                                            src={cat.sample_image}
                                            alt={`${cat.keyword} cake designs`}
                                            fill
                                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                            unoptimized
                                        />
                                        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                                            <p className="text-white text-sm font-bold leading-tight capitalize">{cat.keyword}</p>
                                            <p className="text-white/80 text-xs">{cat.count} designs</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Recent Price Quotes */}
                {recentDesigns.length > 0 && (
                    <section className="pt-6 border-t border-slate-200">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Recent Price Quotes</h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Browse designs that other users have recently requested pricing for.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                            {recentDesigns.map((design: any) => (
                                <ProductCard
                                    key={design.slug}
                                    p_hash={design.p_hash}
                                    original_image_url={design.original_image_url}
                                    price={design.price}
                                    keywords={design.keywords}
                                    slug={design.slug}
                                    availability={design.availability}
                                    analysis_json={design.analysis_json}
                                />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}
