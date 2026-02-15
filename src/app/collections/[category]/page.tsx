import { Metadata, ResolvingMetadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getDesignsByKeyword } from '@/services/supabaseService'

export const revalidate = 3600; // ISR: revalidate every hour

type Props = {
    params: Promise<{ category: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { category } = await params

    // Convert slug back to readable title (e.g., "birthday-cakes" -> "Birthday Cakes")
    const title = category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

    return {
        title: `${title} Cake Ideas & Designs | Genie.ph`,
        description: `Browse our collection of ${title.toLowerCase()} designs. Get instant AI pricing for any of these custom cakes from trusted local bakers.`,
        alternates: {
            canonical: `https://genie.ph/collections/${category}`,
        },
        openGraph: {
            title: `${title} Cake Designs`,
            description: `Browse ${title.toLowerCase()} and get instant pricing.`,
            url: `https://genie.ph/collections/${category}`,
            type: 'website',
        },
    }
}

export default async function CategoryPage({ params }: Props) {
    const { category } = await params

    // Convert slug to keyword for search (e.g., "birthday-cakes" -> "birthday")
    // Simple heuristic: take the first word or the whole thing defined by how slugs were generated
    const keyword = category.split('-')[0];
    const readableTitle = category.split('-').join(' ');

    const { data: designs } = await getDesignsByKeyword(keyword, 50);

    if (!designs || designs.length === 0) {
        // Fallback or 404 if truly empty
        // In this architecture, it's better to show empty state than 404 IF the category is valid but empty
        // But for SEO, if it's empty, it shouldn't exist.
        return notFound();
    }

    return (
        <main className="bg-gray-50 min-h-screen py-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Breadcrumb */}
                <nav className="flex text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
                    <Link href="/" className="hover:text-purple-600">Home</Link>
                    <span className="mx-2">/</span>
                    <Link href="/collections" className="hover:text-purple-600">Collections</Link>
                    <span className="mx-2">/</span>
                    <span className="font-semibold text-gray-900 capitalize">{readableTitle}</span>
                </nav>

                <div className="mb-10 text-center md:text-left">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2 capitalize">
                        {readableTitle} Designs
                    </h1>
                    <p className="text-gray-600">
                        Found {designs.length} {readableTitle} ideas. Click any design to customize it and get a price.
                    </p>
                </div>

                {/* Designs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {designs.map((design: any) => (
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
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    unoptimized
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            </div>
                            <div className="p-3">
                                <p className="text-sm font-semibold text-gray-900 line-clamp-2 md:line-clamp-1 group-hover:text-purple-600 capitalize">
                                    {design.keywords || 'Custom Cake'}
                                </p>
                                <div className="flex justify-between items-center mt-2">
                                    <p className="text-purple-600 font-bold text-xs">
                                        ₱{design.price?.toLocaleString()}
                                    </p>
                                    <span className="text-[10px] text-gray-400">
                                        {design.usage_count > 0 ? `${design.usage_count} views` : 'New'}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </main>
    )
}
