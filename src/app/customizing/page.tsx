import { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import CustomizingClient from './CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { createClient } from '@/lib/supabase/server'
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile'
import { buildReviewSummary } from '@/lib/reviews'
import { getPopularDesigns } from '@/services/supabaseService'
import { ProductCard } from '@/components/ProductCard'

// Shopify CSE handoff: image comes from external URL via query param
// Read searchParams to enable SSR-side preload of the hero image
interface CustomizingPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export const revalidate = 3600; // ISR: revalidate every hour

const PAGE_URL = 'https://genie.ph/customizing';
const FEATURED_DESIGN_LIMIT = 12;

// Curated theme chips — also used as the ItemList JSON-LD source.
const THEMES: { href: string; label: string; name: string }[] = [
    { href: '/customizing/category/birthday-cakes', label: 'Birthday Cake Designs', name: 'Birthday Cakes' },
    { href: '/customizing/category/kuromi-cake', label: 'Kuromi Cake Designs', name: 'Kuromi Cakes' },
    { href: '/customizing/category/wedding-cake', label: 'Wedding Cake Designs', name: 'Wedding Cakes' },
    { href: '/customizing/category/graduation-cake', label: 'Graduation Cake Designs', name: 'Graduation Cakes' },
    { href: '/customizing/category/minimalist-cake', label: 'Minimalist Cake Designs', name: 'Minimalist Cakes' },
    { href: '/customizing/category/bento-cake', label: 'Bento Cake Designs', name: 'Bento Cakes' },
    { href: '/customizing/category/character-cake', label: 'Character Cake Designs', name: 'Character Cakes' },
    { href: '/customizing/category/debut-cake', label: 'Debut Cake Designs', name: 'Debut Cakes' },
    { href: '/customizing/category/baptism-cake', label: 'Baptism Cake Designs', name: 'Baptism Cakes' },
    { href: '/customizing/category/anniversary-cake', label: 'Anniversary Cake Designs', name: 'Anniversary Cakes' },
];

// Stringify with the same XSS-safe escape used elsewhere in this codebase.
const stringifyLd = (obj: unknown) =>
    JSON.stringify(obj).replace(/</g, '\\u003c');

export const metadata: Metadata = {
    title: { absolute: 'Cake Designs & Customization | Genie.ph' },
    description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu. Birthday cakes, wedding cakes, character cakes and more.',
    openGraph: {
        title: 'Cake Designs & Customization | Genie.ph',
        description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu.',
        type: 'website',
        url: PAGE_URL,
        images: [{
            url: genieBusinessProfile.ogImageUrl,
            width: 1200,
            height: 630,
            alt: 'Custom Cake Designs for Birthday, Wedding, Debut & Graduation | Genie.ph',
        }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Cake Designs & Customization | Genie.ph',
        description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu.',
        images: [{
            url: genieBusinessProfile.ogImageUrl,
            width: 1200,
            height: 630,
            alt: 'Custom Cake Designs for Birthday, Wedding, Debut & Graduation | Genie.ph',
        }],
    },
    alternates: {
        canonical: PAGE_URL,
    },
}

export default async function CustomizingPage(props: CustomizingPageProps) {
    // Await searchParams for Next.js 15+ compatibility
    const searchParams = await props.searchParams;
    const imageUrl = typeof searchParams.image_url === 'string' ? searchParams.image_url : null;
    const source = typeof searchParams.source === 'string' ? searchParams.source : null;

    const supabase = await createClient();
    const [{ data: ratingRows }, popularDesignsResult] = await Promise.all([
        supabase
            .from('cakegenie_reviews')
            .select('rating')
            .eq('is_visible', true)
            .eq('is_approved', true),
        getPopularDesigns(FEATURED_DESIGN_LIMIT),
    ]);

    const reviewSummary = buildReviewSummary(ratingRows);

    // Featured designs power the SSR'd grid AND the CollectionPage image array.
    type FeaturedDesign = {
        p_hash: string;
        slug: string;
        original_image_url: string;
        alt_text: string | null;
        keywords: string | null;
        price: number | null;
        availability?: string | null;
        image_width?: number | null;
        image_height?: number | null;
        studio_edited_image_url?: string | null;
    };
    const featuredDesigns: FeaturedDesign[] = (popularDesignsResult.data || [])
        .filter((d): d is FeaturedDesign => Boolean(d?.slug && d?.original_image_url && d?.p_hash))
        .slice(0, FEATURED_DESIGN_LIMIT);

    // Preload for external sources (Shopify CSE, Chrome Extension) - external images go through proxy
    const isExternalSource = (source === 'shopify_cse' || source === 'chrome_extension') && imageUrl;
    const proxyImageUrl = isExternalSource ? `/api/proxy-image?url=${encodeURIComponent(imageUrl)}` : null;

    // ----- JSON-LD blocks -----
    const nowIso = new Date().toISOString();

    const collectionImages = featuredDesigns.length > 0
        ? featuredDesigns.slice(0, 6).map((d) => ({
            '@type': 'ImageObject',
            url: d.original_image_url as string,
            ...(d.alt_text ? { name: d.alt_text } : {}),
        }))
        : [{
            '@type': 'ImageObject',
            url: genieBusinessProfile.ogImageUrl,
            width: 1200,
            height: 630,
            name: 'Custom Cake Designs',
            description: 'Browse 1,000+ custom cake designs for birthday, wedding, debut, and graduation in Cebu, Philippines',
        }];

    const featuredItemList = featuredDesigns.length > 0 ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': `${PAGE_URL}#featured-designs`,
        name: 'Featured Custom Cake Designs',
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        numberOfItems: featuredDesigns.length,
        itemListElement: featuredDesigns.map((d, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `https://genie.ph/customizing/${d.slug}`,
            name: d.alt_text || d.keywords || 'Custom Cake Design',
            ...(d.original_image_url ? { image: d.original_image_url } : {}),
        })),
    } : null;

    const themeItemList = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': `${PAGE_URL}#browse-by-theme`,
        name: 'Browse Cake Designs by Theme',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: THEMES.length,
        itemListElement: THEMES.map((t, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `https://genie.ph${t.href}`,
            name: t.name,
        })),
    };

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph' },
            { '@type': 'ListItem', position: 2, name: 'Cake Designs & Customization', item: PAGE_URL },
        ],
    };

    const collectionPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${PAGE_URL}#collectionpage`,
        name: 'Cake Designs & Customization',
        description: 'Browse 1,000+ cake designs by category or upload your own. Get instant AI pricing from trusted bakers in Cebu. Birthday cakes, wedding cakes, character cakes and more.',
        url: PAGE_URL,
        keywords: 'cake design, birthday cake design, wedding cake design, custom cake, debut cake, graduation cake, character cake, Cebu cake',
        inLanguage: 'en-PH',
        dateModified: nowIso,
        image: collectionImages,
        publisher: {
            '@type': 'Organization',
            name: 'Genie.ph',
            url: 'https://genie.ph',
        },
        ...(featuredItemList ? { mainEntity: { '@id': `${PAGE_URL}#featured-designs` } } : {}),
        breadcrumb: { '@id': `${PAGE_URL}#breadcrumb` },
    };

    // Attach @id to breadcrumb for the collectionPage reference above.
    const breadcrumbSchemaWithId = {
        ...breadcrumbSchema,
        '@id': `${PAGE_URL}#breadcrumb`,
    };

    const jsonLdBlocks: unknown[] = [
        collectionPageSchema,
        breadcrumbSchemaWithId,
        themeItemList,
    ];
    if (featuredItemList) jsonLdBlocks.push(featuredItemList);

    return (
        <>
            {jsonLdBlocks.map((block, i) => (
                <script
                    key={`customizing-ld-${i}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: stringifyLd(block) }}
                />
            ))}

            {/* SSR preload for Shopify CSE hero image - starts fetching before React hydrates */}
            {proxyImageUrl && (
                <link
                    rel="preload"
                    as="image"
                    href={proxyImageUrl}
                />
            )}

            {/* SSR fallback for the hero/uploader so Googlebot and no-JS visitors
                see a real CTA + link in the source HTML. The client app
                hydrates over this once JS loads. */}
            <Suspense
                fallback={
                    <div className="max-w-7xl mx-auto px-4 py-10">
                        <noscript>
                            <p className="mb-4 text-sm text-slate-700">
                                Enable JavaScript to upload your own cake design and get instant AI pricing.
                                You can still browse designs by theme below.
                            </p>
                        </noscript>
                        <div
                            id="upload"
                            className="rounded-2xl border border-purple-100 bg-white/95 p-6 shadow-sm"
                        >
                            <h2 className="text-xl font-semibold text-slate-800">
                                Upload a Custom Cake Design
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Drag &amp; drop, paste, or choose a file to get an instant price quote
                                from a trusted Cebu baker.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                    href="/customizing#upload"
                                    className="genie-btn-primary inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold"
                                >
                                    Upload your design
                                </Link>
                                <Link
                                    href="/collections"
                                    className="genie-btn-secondary inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold"
                                >
                                    Browse curated collections
                                </Link>
                            </div>
                            <div className="mt-6 flex items-center justify-center">
                                <LoadingSpinner />
                            </div>
                        </div>
                    </div>
                }
            >
                <CustomizingClient
                    preloadSource={source || undefined}
                    preloadImageUrl={proxyImageUrl || undefined}
                    hideAiChat={false}
                    reviewSummary={reviewSummary}
                />
            </Suspense>

            {/* Featured designs — SSR'd grid backing the CollectionPage / ItemList schema. */}
            {featuredDesigns.length > 0 && (
                <section
                    aria-labelledby="customizing-featured-heading"
                    className="max-w-7xl mx-auto px-4 py-10"
                >
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <h2
                            id="customizing-featured-heading"
                            className="text-lg md:text-xl font-semibold text-slate-800"
                        >
                            Featured Cake Designs
                        </h2>
                        <Link
                            href="/collections"
                            className="text-sm font-semibold text-purple-700 hover:text-purple-900"
                        >
                            See all collections →
                        </Link>
                    </div>
                    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {featuredDesigns.map((d) => (
                            <li key={d.slug} className="mb-3">
                                <ProductCard {...d} listName="featured_designs" />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Browse by Theme — static internal links for crawlability */}
            <nav aria-label="Browse cake designs by theme" className="max-w-7xl mx-auto px-4 pb-10">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Browse by Theme</h2>
                <div className="flex flex-wrap gap-2">
                    {THEMES.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className="genie-btn-secondary px-3 py-1.5 rounded-full text-xs font-medium"
                        >
                            {label}
                        </Link>
                    ))}
                </div>
            </nav>

            {/* SSR-only editorial intro — lives at the bottom so users land on the tool
                directly. Google crawls the full page so position here is fine for SEO. */}
            <section
                aria-labelledby="customizing-intro-heading"
                className="max-w-7xl mx-auto px-4 pt-2 pb-8"
            >
                <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/70 via-white to-pink-50/40 px-6 py-5 shadow-sm">
                    {/* Kicker + heading row */}
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 mb-3">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-purple-400 shrink-0">
                            Custom cake designs · Cebu, Philippines
                        </p>
                        <span className="hidden sm:block h-px flex-1 bg-purple-100 self-center" aria-hidden="true" />
                    </div>
                    <h1
                        id="customizing-intro-heading"
                        className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-neutral-900 mb-4"
                    >
                        Custom Cake Designs with Instant AI Pricing in Cebu
                    </h1>

                    {/* 3-column editorial grid */}
                    <div className="grid sm:grid-cols-3 gap-x-6 gap-y-3 text-xs text-slate-500 leading-relaxed border-t border-purple-100 pt-4">
                        <p>
                            Genie.ph is the easiest way to design a custom cake in Cebu. Upload any
                            reference photo, choose a design from our gallery of more than 1,000 cake
                            ideas, or browse by occasion below. Our AI matches the design to a
                            verified Cebu baker, returns an instant price quote, and lets you
                            personalise the message, colour palette, flavour, and serving size before
                            you check out.
                        </p>
                        <p>
                            Shoppers come to this page to plan{' '}
                            <Link href="/customizing/category/birthday-cakes" className="text-purple-600 underline underline-offset-2 hover:text-purple-800">
                                birthday cakes
                            </Link>
                            ,{' '}
                            <Link href="/customizing/category/wedding-cake" className="text-purple-600 underline underline-offset-2 hover:text-purple-800">
                                wedding cakes
                            </Link>
                            ,{' '}
                            <Link href="/customizing/category/debut-cake" className="text-purple-600 underline underline-offset-2 hover:text-purple-800">
                                debut cakes
                            </Link>
                            ,{' '}
                            <Link href="/customizing/category/graduation-cake" className="text-purple-600 underline underline-offset-2 hover:text-purple-800">
                                graduation cakes
                            </Link>
                            , and{' '}
                            <Link href="/customizing/category/character-cake" className="text-purple-600 underline underline-offset-2 hover:text-purple-800">
                                character cakes
                            </Link>{' '}
                            for last-minute celebrations. Genie partners with bakeries across Cebu City,
                            Mandaue, Lapu-Lapu, Talisay, and Consolacion.
                        </p>
                        <p>
                            New here? Start with the{' '}
                            <Link href="/customizing#upload" className="text-purple-600 underline underline-offset-2 hover:text-purple-800">
                                upload tool
                            </Link>{' '}
                            to get a price in seconds, or jump to a{' '}
                            <Link href="/collections" className="text-purple-600 underline underline-offset-2 hover:text-purple-800">
                                curated collection
                            </Link>{' '}
                            if you already know the vibe you&rsquo;re going for. Every order is fulfilled by a vetted local baker, with delivery
                            windows, return policies, and same-day cut-offs shown up front.
                        </p>
                    </div>
                </div>
            </section>

            <LandingFooter reviewSummary={reviewSummary} />
        </>
    )
}
