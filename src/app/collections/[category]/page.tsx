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

    // Convert slug to keyword for search
    const readableTitle = category.split('-').join(' ');
    const keyword = readableTitle;

    const { data: designs } = await getDesignsByKeyword(keyword, 50);

    if (!designs || designs.length === 0) {
        return notFound();
    }

    return (
        <main className="min-h-screen py-10">
            <div className="w-full max-w-4xl mx-auto bg-white/80 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200">
                {/* Breadcrumb */}
                <nav className="mb-6" aria-label="Breadcrumb">
                    <ol className="flex items-center text-sm text-slate-500 space-x-2">
                        <li><Link href="/" className="hover:text-purple-600 transition-colors">Home</Link></li>
                        <li>/</li>
                        <li><Link href="/collections" className="hover:text-purple-600 transition-colors">Collections</Link></li>
                        <li>/</li>
                        <li className="text-slate-800 font-medium capitalize">{readableTitle}</li>
                    </ol>
                </nav>

                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text capitalize">
                        {readableTitle} Designs
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Found {designs.length} {readableTitle} ideas. Click any design to customize it and get a price.
                    </p>
                </header>

                {/* Designs Grid */}
                <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                    {designs.map((design: any) => (
                        <Link
                            key={design.slug}
                            href={`/customizing/${design.slug}`}
                            className="group bg-white p-3 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-gray-100 transition-all duration-300"
                        >
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                                <Image
                                    src={design.original_image_url}
                                    alt={design.alt_text || `${design.keywords} cake`}
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                    unoptimized
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                            </div>
                            <div className="px-1 mt-3">
                                <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 group-hover:text-purple-600 transition-colors capitalize">
                                    {design.keywords || 'Custom Cake'}
                                </h3>
                                <div className="flex justify-between items-end border-t border-gray-50 pt-2 mt-2">
                                    <span className="font-black text-gray-900 text-base">₱{design.price?.toLocaleString()}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </main>
    )
}
