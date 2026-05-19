import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDesignsByKeyword, getDesignCategories } from '@/services/supabaseService';
import { DesignGridWithLoadMore } from '@/components/collections/DesignGridWithLoadMore';

export const revalidate = 3600; // ISR: revalidate every hour

const CATEGORY_PAGE_SIZE = 30;
const DEFAULT_OG_IMAGE = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta-GENIE.jpg';

interface Props {
    params: Promise<{ keyword: string }>;
}

function decodeKeyword(slug: string): string {
    return decodeURIComponent(slug).replace(/-/g, ' ');
}

function toTitleCase(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripCakeSuffix(label: string): string {
    return label.replace(/\s+cakes?$/i, '').trim();
}

function buildCategoryCopy(slug: string) {
    const decodedKeyword = decodeKeyword(slug);
    const displayName = toTitleCase(decodedKeyword);
    const coreName = stripCakeSuffix(displayName) || displayName;
    const coreNameLower = coreName.toLowerCase();
    const designLabel = `${coreName} Cake Designs`;
    const productLabel = `${coreName} Cakes`;
    const productLabelLower = productLabel.toLowerCase();

    return {
        decodedKeyword,
        displayName,
        coreName,
        coreNameLower,
        designLabel,
        productLabel,
        productLabelLower,
    };
}

const getCategoryDesigns = cache(async (keyword: string) => {
    const { data } = await getDesignsByKeyword(keyword, CATEGORY_PAGE_SIZE);
    return data || [];
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { keyword } = await params;
    const { decodedKeyword, coreName, coreNameLower, designLabel, productLabelLower } = buildCategoryCopy(keyword);
    const title = `${designLabel} in Cebu`;
    const description = `Browse ${coreNameLower} cake designs with instant AI pricing. Order custom ${productLabelLower} from trusted bakers in Cebu. Upload your own design or choose from our collection.`;

    const designs = await getCategoryDesigns(decodedKeyword);
    const ogImage = designs[0]?.original_image_url || DEFAULT_OG_IMAGE;

    return {
        title,
        description,
        openGraph: {
            title: `${title} | Genie.ph`,
            description,
            type: 'website',
            url: `https://genie.ph/customizing/category/${keyword}`,
            images: [{
                url: ogImage,
                width: 1200,
                height: 1200,
                alt: `${coreName} cake design collection - browse ${coreNameLower} cake ideas on Genie.ph`,
            }],
        },
        twitter: {
            card: 'summary_large_image',
            title: `${title} | Genie.ph`,
            description,
            images: [ogImage],
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

function CategorySchema({ category, designs, url }: { category: ReturnType<typeof buildCategoryCopy>; designs: any[]; url: string }) {
    const titleCore = category.coreNameLower;

    // Top 12 designs as full ImageObjects — triggers Google image rich results
    const galleryImages = designs.slice(0, 12).map((d: any) => {
        const kw = typeof d.keywords === 'string' ? d.keywords.split(',')[0].trim() : 'Custom';
        const kwLower = kw.toLowerCase();
        // Avoid doubling: "Kuromi Kuromi Cake Design" → "Kuromi Cake Design"
        const imageName = kwLower.includes(titleCore) || titleCore.includes(kwLower)
            ? `${kw} cake design`
            : `${kw} ${category.coreName} cake design`;
        return {
            '@type': 'ImageObject',
            url: d.original_image_url,
            contentUrl: d.original_image_url,
            name: imageName,
            caption: `${kw} cake design — customize and order on Genie.ph`,
            ...(d.image_width ? { width: d.image_width } : {}),
            ...(d.image_height ? { height: d.image_height } : {}),
            creditText: 'Genie.ph',
            copyrightHolder: { '@type': 'Organization', name: 'Genie.ph' },
            license: 'https://genie.ph/terms',
            acquireLicensePage: 'https://genie.ph/terms',
        };
    });

    const schema = [
        // CollectionPage + ImageGallery (same pattern as /collections/[category])
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            '@id': url,
            name: category.designLabel,
            description: `Browse ${designs.length} ${category.coreNameLower} cake designs available for customization and ordering in Cebu, Philippines`,
            url,
            isPartOf: { '@type': 'WebSite', name: 'Genie.ph', url: 'https://genie.ph' },
            mainEntity: {
                '@type': 'ImageGallery',
                name: `${category.coreName} Cake Design Collection`,
                about: `${category.coreName} cake designs available for customization and ordering in Cebu, Philippines`,
                numberOfItems: designs.length,
                image: galleryImages,
            },
            ...(designs[0]?.original_image_url ? {
                primaryImageOfPage: {
                    '@type': 'ImageObject',
                    url: designs[0].original_image_url,
                    representativeOfPage: true,
                },
            } : {}),
        },
        // BreadcrumbList
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph' },
                { '@type': 'ListItem', position: 2, name: 'Cake Designs', item: 'https://genie.ph/customizing' },
                { '@type': 'ListItem', position: 3, name: category.designLabel, item: url },
            ],
        },
    ];

    return (
        <>
            {schema.map((s, i) => (
                <script
                    key={`category-ld-${i}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
                />
            ))}
        </>
    );
}

export default async function CategoryPage({ params }: Props) {
    const { keyword } = await params;
    const category = buildCategoryCopy(keyword);

    const designs = await getCategoryDesigns(category.decodedKeyword);

    if (!designs || designs.length === 0) {
        notFound();
    }

    const url = `https://genie.ph/customizing/category/${keyword}`;

    return (
        <>
            <CategorySchema category={category} designs={designs} url={url} />
            <main className="min-h-screen py-10">
                <div className="w-full max-w-7xl mx-auto px-4">
                    {/* Breadcrumb */}
                    <nav className="mb-6" aria-label="Breadcrumb">
                        <ol className="flex items-center text-sm text-slate-500 space-x-2">
                            <li><Link href="/" className="hover:text-purple-600 transition-colors">Home</Link></li>
                            <li>/</li>
                            <li><Link href="/customizing" className="hover:text-purple-600 transition-colors">Cake Designs</Link></li>
                            <li>/</li>
                            <li className="text-slate-800 font-medium">{category.designLabel}</li>
                        </ol>
                    </nav>

                    {/* Header */}
                    <header className="mb-8">
                        <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text truncate">
                            {category.designLabel}
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">
                            Browse {designs.length} {category.coreNameLower} cake designs. Get instant AI pricing and order from trusted bakers in Cebu.
                        </p>
                    </header>

                    {/* Design Grid — collectionTitle passed for enriched alt text */}
                    <div className="mb-10">
                        <DesignGridWithLoadMore
                            initialDesigns={designs}
                            keyword={category.decodedKeyword}
                            collectionTitle={category.coreName}
                        />
                    </div>

                    {/* SEO Content */}
                    <div className="pt-6 border-t border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">
                            Order {category.productLabel} in Cebu
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            Looking for the perfect {category.coreNameLower} cake? Genie.ph makes it easy to find and order custom {category.productLabelLower} from the best bakers in Cebu City, Mandaue, Lapu-Lapu, and Talisay. Simply choose a design you love, customize it with our AI-powered tools, and get an instant price. You can also <Link href="/" className="text-purple-600 hover:underline">upload your own {category.coreNameLower} cake image</Link> to get started.
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
