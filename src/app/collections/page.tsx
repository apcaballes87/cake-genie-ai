import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
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
        <main className="bg-gray-50 min-h-screen py-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
                        Browse Cake Collections
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Explore our organized library of custom cake designs. Filter by category or browse the newest arrivals from the Genie.ph community.
                    </p>
                </div>

                {/* Categories Grid (The Silos) */}
                {categories.length > 0 && (
                    <section className="mb-16">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                            <span className="bg-purple-600 w-2 h-8 rounded-full mr-3"></span>
                            Popular Categories
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {categories.map((cat: any) => (
                                <Link
                                    key={cat.slug}
                                    href={`/collections/${cat.slug}`}
                                    className="group relative rounded-xl overflow-hidden aspect-4/5 shadow-sm hover:shadow-xl transition-all duration-300"
                                >
                                    <Image
                                        src={cat.sample_image}
                                        alt={`${cat.keyword} cake designs`}
                                        fill
                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        unoptimized // Assuming external Supabase URLs
                                    />
                                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                                    <div className="absolute bottom-0 left-0 right-0 p-4">
                                        <h3 className="text-white font-bold text-lg leading-tight mb-1 capitalize">
                                            {cat.keyword}
                                        </h3>
                                        <p className="text-white/80 text-xs font-medium">
                                            {cat.count} Designs
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* "Newest Designs" Catch-All (The Orphan Safety Net) */}
                {recentDesigns.length > 0 && (
                    <section>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-2">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center mb-1">
                                    <span className="bg-pink-500 w-2 h-8 rounded-full mr-3"></span>
                                    Recent Price Quotes
                                </h2>
                                <p className="text-sm text-gray-500 ml-5">
                                    Browse designs that other users have recently requested pricing for.
                                </p>
                            </div>
                            {/* In a real app, this would link to a paginated "All" page */}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {recentDesigns.map((design: any) => (
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
                                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                                            className="object-cover"
                                            unoptimized
                                        />
                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    </div>
                                    <div className="p-3">
                                        <p className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-purple-600 capitalize">
                                            {design.keywords ? design.keywords.split(',')[0].trim() : 'Custom Cake'}
                                        </p>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-purple-600 font-bold text-xs">
                                                ₱{design.price?.toLocaleString()}
                                            </p>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(design.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}
