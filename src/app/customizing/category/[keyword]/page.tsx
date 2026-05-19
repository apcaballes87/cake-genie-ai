import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDesignsByKeyword, getDesignCategories } from '@/services/supabaseService';
import { DesignGridWithLoadMore } from '@/components/collections/DesignGridWithLoadMore';

// ---------------------------------------------------------------------------
// Related category cross-links (curated for internal link graph health)
// ---------------------------------------------------------------------------
const RELATED_CATEGORIES: Record<string, { slug: string; label: string }[]> = {
  'birthday cakes': [
    { slug: 'kids-birthday', label: "Kids' Birthday Cakes" },
    { slug: 'debut', label: 'Debut Cakes' },
    { slug: 'anniversary', label: 'Anniversary Cakes' },
    { slug: 'bento-cakes', label: 'Bento Cakes' },
    { slug: 'character-cakes', label: 'Character Cakes' },
  ],
  'debut': [
    { slug: 'birthday-cakes', label: 'Birthday Cakes' },
    { slug: 'floral-cakes', label: 'Floral Cakes' },
    { slug: 'elegant-cakes', label: 'Elegant Cakes' },
    { slug: 'princess-cakes', label: 'Princess Cakes' },
  ],
  'wedding': [
    { slug: 'anniversary', label: 'Anniversary Cakes' },
    { slug: 'elegant-cakes', label: 'Elegant Cakes' },
    { slug: 'floral-cakes', label: 'Floral Cakes' },
    { slug: 'multi-tier', label: 'Multi-Tier Cakes' },
  ],
  'bento cakes': [
    { slug: 'birthday-cakes', label: 'Birthday Cakes' },
    { slug: 'minimalist', label: 'Minimalist Cakes' },
    { slug: 'korean-cakes', label: 'Korean Cakes' },
  ],
  'minimalist': [
    { slug: 'bento-cakes', label: 'Bento Cakes' },
    { slug: 'elegant-cakes', label: 'Elegant Cakes' },
    { slug: 'floral-cakes', label: 'Floral Cakes' },
  ],
  'character cakes': [
    { slug: 'birthday-cakes', label: 'Birthday Cakes' },
    { slug: 'kids-birthday', label: "Kids' Birthday Cakes" },
    { slug: 'anime-cakes', label: 'Anime Cakes' },
  ],
  'floral cakes': [
    { slug: 'wedding', label: 'Wedding Cakes' },
    { slug: 'debut', label: 'Debut Cakes' },
    { slug: 'minimalist', label: 'Minimalist Cakes' },
    { slug: 'anniversary', label: 'Anniversary Cakes' },
  ],
};

// ---------------------------------------------------------------------------
// FAQ data — category-specific Q&A for rich results & thin-content fix
// ---------------------------------------------------------------------------
type FaqItem = { q: string; a: string };

const CATEGORY_FAQS: Record<string, FaqItem[]> = {
  'birthday cakes': [
    { q: 'How much does a custom birthday cake cost in Cebu?', a: 'Custom birthday cakes in Cebu typically range from ₱1,200 for a basic 6-inch single-tier cake up to ₱8,000+ for multi-tier or sculpted designs. On Genie.ph you get instant pricing before you commit — just upload your design or choose from our gallery.' },
    { q: 'How far in advance should I order a birthday cake?', a: 'Most bakers on Genie.ph need 3–7 days lead time. For same-day or next-day delivery in Cebu City, filter by "rush orders" when browsing.' },
    { q: 'Can I customize the cake message and colors?', a: 'Yes. After choosing a design on Genie.ph you can specify your message, preferred color palette, number of tiers, and serving size before sending your order to the baker.' },
    { q: 'Do you deliver birthday cakes in Cebu?', a: 'Genie.ph works with bakers across Cebu City, Mandaue, Lapu-Lapu, Talisay, and Consolacion. Delivery availability and fees depend on the baker you choose.' },
  ],
  'wedding': [
    { q: 'How much does a wedding cake cost in Cebu?', a: 'Wedding cakes in Cebu generally start at ₱4,000 for a simple two-tier design and can reach ₱25,000+ for multi-tier fondant showpieces. Genie.ph provides instant quotes from multiple bakers so you can compare prices easily.' },
    { q: 'How far in advance do I need to book a wedding cake?', a: 'We recommend booking at least 4–8 weeks before your wedding, especially for peak season (December and summer months). Some bakers on Genie.ph accept bookings up to 6 months in advance.' },
    { q: 'Can bakers on Genie.ph do multi-tier wedding cakes?', a: 'Yes. Many of our partner bakers specialize in multi-tier, fondant, and fresh-flower wedding cakes. Upload a reference photo and the AI will match you with the right baker.' },
  ],
  'debut': [
    { q: 'How much does a debut cake cost in Cebu?', a: 'Debut cakes in Cebu start at around ₱2,500 for a 1-tier design and range up to ₱12,000 for elaborate multi-tier creations with gold accents and fresh flowers.' },
    { q: 'What cake sizes are popular for debut parties?', a: 'A 2- or 3-tier cake (serving 60–100 guests) is most popular for debut celebrations. Genie.ph lets you select your exact serving size so pricing is accurate.' },
    { q: 'Can I upload an inspiration photo for my debut cake?', a: 'Absolutely. Upload any reference image on Genie.ph and our AI will analyze the design, suggest the nearest matches in our gallery, and give you instant pricing.' },
  ],
};

const getCategoryFaqs = (decodedKeyword: string, coreName: string, productLabel: string): FaqItem[] => {
  const key = decodedKeyword.toLowerCase();
  const exact = CATEGORY_FAQS[key];
  if (exact) return exact;

  const partial = Object.keys(CATEGORY_FAQS).find((k) => key.includes(k) || k.includes(key));
  if (partial) return CATEGORY_FAQS[partial];

  // Generic fallback for unconfigured categories
  return [
    { q: `How much do custom ${productLabel.toLowerCase()} cost in Cebu?`, a: `Prices vary depending on size, tiers, and complexity. On Genie.ph you get instant, accurate quotes from real Cebu bakers — just upload your design or choose from our gallery to see pricing.` },
    { q: `How do I order a ${coreName.toLowerCase()} cake on Genie.ph?`, a: `Browse the designs above, click on one you love, customize the details (message, colors, serving size), and submit your order. A verified Cebu baker will confirm your request within hours.` },
    { q: `Can I get same-day delivery for ${productLabel.toLowerCase()} in Cebu?`, a: `Some bakers on Genie.ph offer rush or same-day orders. Filter by "Rush Orders" when browsing to see available options near you.` },
    { q: `Do I need to upload a photo to order?`, a: `No. You can choose any design from our gallery and customize it directly. Uploading your own photo is optional but helps bakers match your exact vision.` },
  ];
};

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
        // FAQPage — qualifies for FAQ rich results & improves thin-content signal
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: getCategoryFaqs(category.decodedKeyword, category.coreName, category.productLabel).map(({ q, a }) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: { '@type': 'Answer', text: a },
            })),
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

                    {/* Related Categories — strengthens internal link graph */}
                    {(() => {
                        const related = RELATED_CATEGORIES[category.decodedKeyword.toLowerCase()] ?? [];
                        if (related.length === 0) return null;
                        return (
                            <div className="mt-8">
                                <h2 className="text-lg font-semibold text-slate-800 mb-3">Browse Similar Cake Categories</h2>
                                <div className="flex flex-wrap gap-2">
                                    {related.map(({ slug, label }) => (
                                        <Link
                                            key={slug}
                                            href={`/customizing/category/${slug}`}
                                            className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors"
                                        >
                                            {label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* FAQ Section — resolves thin-content & qualifies for FAQ rich results */}
                    {(() => {
                        const faqs = getCategoryFaqs(category.decodedKeyword, category.coreName, category.productLabel);
                        return (
                            <div className="mt-10 border-t border-slate-200 pt-8">
                                <h2 className="text-xl font-bold text-slate-800 mb-6">
                                    Frequently Asked Questions about {category.productLabel} in Cebu
                                </h2>
                                <dl className="space-y-5">
                                    {faqs.map(({ q, a }, i) => (
                                        <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
                                            <dt className="font-semibold text-slate-900 mb-1.5">{q}</dt>
                                            <dd className="text-slate-600 leading-relaxed text-sm">{a}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        );
                    })()}
                </div>
            </main>
        </>
    );
}
