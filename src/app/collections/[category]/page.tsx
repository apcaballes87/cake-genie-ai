import { ArrowLeft } from 'lucide-react'
import { Metadata, ResolvingMetadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDesignsByKeyword } from '@/services/supabaseService'
import { ProductCard } from '@/components/ProductCard'
import { DesignGridWithLoadMore } from '@/components/collections/DesignGridWithLoadMore'

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

    const { data: designs } = await getDesignsByKeyword(keyword, 30);

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
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/collections" className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                        <ArrowLeft />
                    </Link>
                    <div className="grow">
                        <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text capitalize">
                            {readableTitle} Designs
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">
                            Found {designs.length} {readableTitle} ideas. Click any design to customize it and get a price.
                        </p>
                    </div>
                </div>

                {/* Designs Grid with Load More & Google Search */}
                <DesignGridWithLoadMore initialDesigns={designs} keyword={keyword} />
            </div>
        </main>
    )
}
