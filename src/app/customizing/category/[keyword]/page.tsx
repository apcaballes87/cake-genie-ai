import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getDesignsByKeyword, getDesignCategories } from '@/services/supabaseService';
import { DesignGridWithLoadMore } from '@/components/collections/DesignGridWithLoadMore';

export const revalidate = 3600; // ISR: revalidate every hour

interface Props {
    params: Promise<{ keyword: string }>;
}

function decodeKeyword(slug: string): string {
    return decodeURIComponent(slug).replace(/-/g, ' ');
}

function toTitleCase(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { keyword } = await params;
    const displayName = toTitleCase(decodeKeyword(keyword));
    const title = `${displayName} Cake Designs in Cebu`;
    const description = `Browse ${displayName.toLowerCase()} cake designs with instant AI pricing. Order custom ${displayName.toLowerCase()} cakes from trusted bakers in Cebu. Upload your own design or choose from our collection.`;

    return {
        title,
        description,
        openGraph: {
            title: `${title} | Genie.ph`,
            description,
            type: 'website',
            url: `https://genie.ph/customizing/category/${keyword}`,
        },
        alternates: {
            canonical: `https://genie.ph/customizing/category/${keyword}`,
        },
    };
}

export async function generateStaticParams() {
    const { data: categories } = await getDesignCategories();
    if (!categories) return [];

    // Pre-render top 30 categories at build time
    return categories.slice(0, 30).map((cat) => ({
        keyword: cat.slug,
    }));
}

function CategorySchema({ keyword, designs, url }: { keyword: string; designs: any[]; url: string }) {
    const displayName = toTitleCase(keyword);
    const schema = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'CollectionPage',
                name: `${displayName} Cake Designs`,
                description: `Collection of ${designs.length} ${displayName.toLowerCase()} cake designs available for order in Cebu`,
                url,
                numberOfItems: designs.length,
                mainEntity: {
                    '@type': 'ItemList',
                    itemListElement: designs.slice(0, 20).map((design, index) => ({
                        '@type': 'ListItem',
                        position: index + 1,
                        url: `https://genie.ph/customizing/${design.slug}`,
                        name: design.alt_text || `${displayName} Cake Design`,
                        image: design.original_image_url,
                    })),
                },
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph' },
                    { '@type': 'ListItem', position: 2, name: 'Cake Designs', item: 'https://genie.ph/customizing' },
                    { '@type': 'ListItem', position: 3, name: `${displayName} Cakes` },
                ],
            },
        ],
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

export default async function CategoryPage({ params }: Props) {
    const { keyword } = await params;
    const decodedKeyword = decodeKeyword(keyword);
    const displayName = toTitleCase(decodedKeyword);

    const { data: designs } = await getDesignsByKeyword(decodedKeyword, 30);

    if (!designs || designs.length === 0) {
        notFound();
    }

    const url = `https://genie.ph/customizing/category/${keyword}`;

    return (
        <>
            <CategorySchema keyword={decodedKeyword} designs={designs} url={url} />
            <main className="min-h-screen py-10">
                <div className="w-full max-w-4xl mx-auto bg-white/80 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200">
                    {/* Breadcrumb */}
                    <nav className="mb-6" aria-label="Breadcrumb">
                        <ol className="flex items-center text-sm text-slate-500 space-x-2">
                            <li><Link href="/" className="hover:text-purple-600 transition-colors">Home</Link></li>
                            <li>/</li>
                            <li><Link href="/customizing" className="hover:text-purple-600 transition-colors">Cake Designs</Link></li>
                            <li>/</li>
                            <li className="text-slate-800 font-medium">{displayName}</li>
                        </ol>
                    </nav>

                    {/* Header */}
                    <header className="mb-8">
                        <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
                            {displayName} Cake Designs
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">
                            Browse {designs.length} {displayName.toLowerCase()} cake designs. Get instant AI pricing and order from trusted bakers in Cebu.
                        </p>
                    </header>

                    {/* Design Grid with Load More & Google Search */}
                    <div className="mb-10">
                        <DesignGridWithLoadMore initialDesigns={designs} keyword={decodedKeyword} />
                    </div>

                    {/* SEO Content */}
                    <div className="pt-6 border-t border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">
                            Order {displayName} Cakes in Cebu
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            Looking for the perfect {displayName.toLowerCase()} cake? Genie.ph makes it easy to find and order custom {displayName.toLowerCase()} cake designs from the best bakers in Cebu City, Mandaue, Lapu-Lapu, and Talisay. Simply choose a design you love, customize it with our AI-powered tools, and get an instant price. You can also <Link href="/" className="text-purple-600 hover:underline">upload your own {displayName.toLowerCase()} cake image</Link> to get started.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Link href="/cake-price-calculator" className="text-sm text-purple-600 hover:underline">Cake Price Calculator</Link>
                            <span className="text-slate-300">|</span>
                            <Link href="/how-to-order" className="text-sm text-purple-600 hover:underline">How to Order</Link>
                            <span className="text-slate-300">|</span>
                            <Link href="/customizing" className="text-sm text-purple-600 hover:underline">All Cake Designs</Link>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
