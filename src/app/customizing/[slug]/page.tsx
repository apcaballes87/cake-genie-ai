import { Metadata, ResolvingMetadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CustomizingClient from '../CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getCakeBasePriceOptions, getRelatedProductsByKeywords } from '@/services/supabaseService'
import { CakeType, CakeThickness, BasePriceInfo, HybridAnalysisResult, CakeInfoUI, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI } from '@/types'
import { CustomizationProvider, CustomizationState } from '@/contexts/CustomizationContext'
// FAQPageSchema deprecated (restricted to gov/healthcare Aug 2023) — using HTML accordions instead
import { DesignAboutSection } from '@/components/DesignAboutSection'
import LazyImage from '@/components/LazyImage'
import NewsletterPopup from '@/components/NewsletterPopup'
import { v4 as uuidv4 } from 'uuid'
import { mapProductToDefaultState } from '@/utils/customizationMapper'
import { upgradeLegacySlug, downgradeCakeSlug } from '@/lib/utils/urlHelpers'
import { generateDesignDetails, generateDynamicFAQ, generateRichAltText } from '@/utils/designContentUtils'
import { getSupabaseRenderUrl } from '@/utils/supabase-image-loader'

// Minimum base price (1 Tier / 4in / 6" Round = ₱1,099) used as fallback
// when a design has no valid cakeType or cached price.
const FALLBACK_MIN_PRICE = 1099;
const VALID_CAKE_TYPES: CakeType[] = ['1 Tier', '2 Tier', '3 Tier', '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant', 'Square', 'Rectangle', 'Bento', 'Square Fondant', 'Rectangle Fondant'];
const CAKE_TYPE_THICKNESS_MAP: Record<string, CakeThickness> = {
    '1 Tier': '4 in', '2 Tier': '4 in', '3 Tier': '4 in',
    'Square': '3 in', 'Rectangle': '3 in',
    '1 Tier Fondant': '5 in', '2 Tier Fondant': '5 in', '3 Tier Fondant': '5 in',
    'Square Fondant': '5 in', 'Rectangle Fondant': '5 in',
    'Bento': '2 in',
};

// ISR: Cache pages for 1 hour, then revalidate in the background.
// Reduces TTFB for 8k+ pages and gives Google a faster crawl experience.
export const revalidate = 3600;

// Helper to fetch design by exact slug
const getDesign = cache(async (slug: string) => {
    const supabase = await createClient()

    // Before exact match: check if a legacy (downgraded) version of this slug exists.
    // If both "modern" (color-name + cake) and "legacy" (hex, no cake) slugs exist in the DB,
    // consolidate to the legacy version to resolve Google's "duplicate without user-selected canonical."
    const downgradedCandidates = downgradeCakeSlug(slug);
    for (const candidate of downgradedCandidates) {
        const { data: downgradedData } = await supabase
            .from('cakegenie_analysis_cache')
            .select('slug')
            .eq('slug', candidate)
            .single();

        if (downgradedData) {
            permanentRedirect(`/customizing/${candidate}`);
        }
    }

    const { data: cacheData } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*')
        .eq('slug', slug)
        .single()

    if (cacheData) return cacheData;

    // Check if it's a legacy slug that needs a 301 redirect to the modern format
    const upgradedSlug = upgradeLegacySlug(slug);
    if (upgradedSlug !== slug) {
        const { data: upgradedData } = await supabase
            .from('cakegenie_analysis_cache')
            .select('*')
            .eq('slug', upgradedSlug)
            .single();

        if (upgradedData) {
            permanentRedirect(`/customizing/${upgradedSlug}`);
        }
    }

    // Check shared designs by slug
    const { data: sharedData } = await supabase
        .from('cakegenie_shared_designs')
        .select('*')
        .eq('url_slug', slug)
        .single()

    if (sharedData) {
        // Parse customization_details if it's a string
        let details = sharedData.customization_details;
        if (typeof details === 'string') {
            try {
                details = JSON.parse(details);
            } catch (e) {
                console.error('Failed to parse customization details', e);
            }
        }

        return {
            isSharedDesign: true,
            slug: sharedData.url_slug,
            keywords: sharedData.title || sharedData.cake_type || 'Custom',
            seo_title: sharedData.title,
            seo_description: sharedData.description,
            alt_text: sharedData.alt_text,
            original_image_url: sharedData.original_image_url || sharedData.customized_image_url,
            customized_image_url: sharedData.customized_image_url,
            price: sharedData.base_price,
            availability: sharedData.availability_type,
            analysis_json: details?.analysisResult || null,
            customization_details: details
        }
    }

    return null
})

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug } = await params

    const design = await getDesign(slug)

    if (!design) {
        return {
            title: 'Design Not Found',
            description: 'The requested custom cake design could not be found in our catalogue.',
            robots: { index: false, follow: false },
        }
    }

    const tags = design.tags || [];
    const tagsPrefix = tags.length > 0 ? tags.slice(0, 2).map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ') + ' ' : '';
    const priceDisplay = design.price ? ` | Php ${Math.round(design.price).toLocaleString()}` : ''
    // Strip existing "| Genie.ph" suffix — the root layout template already appends it
    const baseSeoTitle = design.seo_title?.replace(/\s*\|\s*Genie\.ph\s*$/i, '') || ''
    const title = baseSeoTitle
        ? `${baseSeoTitle}${priceDisplay}`
        : `${tagsPrefix}${design.keywords || 'Custom'} Cake Designs & Photos${priceDisplay}`

    // Description with rich fallback chain:
    // 1. Use seo_description if available
    // 2. Build from analysis features (colors, toppers, tags) for richer snippets
    // 3. Generic fallback with pricing
    let description = design.seo_description || '';

    if (!description && design.analysis_json) {
        // Construct description from analysis features for legacy records without seo_description
        const analysis = design.analysis_json
        const features = []
        if (tags.length > 0) features.push(`Perfect for: ${tags.join(', ')}`)

        // Colors
        if (analysis.icing_design?.colors) {
            const colors = Object.values(analysis.icing_design.colors)
                .filter(c => typeof c === 'string')
                .join(', ')
            if (colors) features.push(`${(typeof analysis.icing_design.base === 'string' ? analysis.icing_design.base : 'icing').replace(/_/g, ' ')} in ${colors}`)
        }

        // Toppers
        if (analysis.main_toppers?.length > 0) {
            const topNames = analysis.main_toppers.slice(0, 3).map((t: any) => t.description || t.type).join(', ')
            features.push(`Decorated with ${topNames}`)
        }

        description = `Customize this ${tagsPrefix}${design.keywords || 'custom'} cake design. ${features.join('. ')}. Starting at ₱${(design.price && design.price > 0) ? Math.round(design.price).toLocaleString() : FALLBACK_MIN_PRICE.toLocaleString()}.`
    }

    if (!description) {
        description = `Customize this ${tagsPrefix}${design.keywords || 'custom'} cake design on Genie.ph. Get instant pricing from local bakers in Cebu and Cavite. ${design.alt_text || ''}`
    }

    // Use the shortest slug form for the canonical URL: strip "-cake-" before
    // the trailing hash so Google consolidates duplicates that differ only by
    // the presence of "cake" in the slug (e.g., "...-cake-ffdf" → "...-ffdf").
    const canonicalSlug = slug.replace(/-cake-([a-f0-9]{4,16})$/, '-$1')
    const canonicalUrl = `https://genie.ph/customizing/${canonicalSlug}`

    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        },
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: 'Genie.ph',
            images: design.original_image_url ? [
                {
                    url: design.original_image_url,
                    width: design.image_width || 1200,
                    height: design.image_height || 1200,
                    alt: generateRichAltText(design),
                },
            ] : [],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: design.original_image_url ? [
                {
                    url: design.original_image_url,
                    width: design.image_width || 1200,
                    height: design.image_height || 1200,
                    alt: generateRichAltText(design),
                }
            ] : [],
        },
        other: {
            thumbnail: design.original_image_url || '',
            // Explicit og:image:alt for Pinterest and crawlers that read it separately
            'og:image:alt': design.alt_text || design.keywords || 'Custom cake design',
            // product:* meta tags for e-commerce enrichment (og:type set via openGraph.type above)
            'product:price:amount': (design.price && design.price > 0) ? Math.round(design.price).toString() : FALLBACK_MIN_PRICE.toString(),
            'product:price:currency': 'PHP',
        },
    }
}

// JSON-LD Schema for SEO - Enhanced for Google Image Thumbnails
function DesignSchema({ design, prices }: { design: any; prices?: BasePriceInfo[] }) {
    // Sanitize string to prevent script injection in JSON-LD (matches SEOSchemas.tsx pattern)
    const sanitize = (str: string | null | undefined) => str ? str.replace(/<\/script/gi, '<\\/script') : '';

    const tags = design.tags || [];
    const keywords = design.keywords || 'Custom';
    const title = design.seo_title || `${tags.length > 0 ? tags[0] + ' ' : ''}${keywords} Cake`;
    const imageUrl = design.original_image_url;
    const pageUrl = `https://genie.ph/customizing/${design.slug || ''}`;

    // ImageObject for better image indexing
    const imageObject = imageUrl ? {
        '@type': 'ImageObject',
        url: imageUrl,
        contentUrl: imageUrl,
        ...(design.image_width && { width: design.image_width }),
        ...(design.image_height && { height: design.image_height }),
        name: sanitize(generateRichAltText(design)),
        caption: sanitize(design.seo_description || `Custom ${keywords} cake design`),
        creditText: 'Genie.ph',
        creator: {
            '@type': 'Organization',
            name: 'Genie.ph'
        },
        license: 'https://genie.ph/terms',
        acquireLicensePage: 'https://genie.ph/customizing',
        copyrightNotice: '© ' + new Date().getFullYear() + ' Genie.ph'
    } : null;

    // Standard Shipping Details (Free Delivery)
    const shippingDetails = {
        '@type': 'OfferShippingDetails',
        shippingRate: {
            '@type': 'MonetaryAmount',
            value: 0,
            currency: 'PHP'
        },
        deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 3, // Custom cakes take longer
                maxValue: 7,
                unitCode: 'DAY'
            },
            transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 1,
                maxValue: 2,
                unitCode: 'DAY'
            }
        },
        shippingDestination: {
            '@type': 'DefinedRegion',
            addressCountry: 'PH'
        }
    };

    // Merchant Return Policy (No Returns)
    const returnPolicy = {
        '@type': 'MerchantReturnPolicy',
        returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
        merchantReturnDays: 0,
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
        returnPolicyCountry: 'PH' // Required since March 2025
    };

    // Use end of current year for stable schema (avoids changing on every render)
    const priceValidUntil = `${new Date().getFullYear()}-12-31`;
    const productMpn = design.p_hash || design.slug;

    let baseOffersWrapper;

    if (prices && prices.length > 0) {
        // Find min and max prices
        const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
        const lowPrice = sortedPrices[0].price;
        const highPrice = sortedPrices[sortedPrices.length - 1].price;

        baseOffersWrapper = {
            '@type': 'AggregateOffer',
            lowPrice: lowPrice,
            highPrice: highPrice,
            priceCurrency: 'PHP',
            offerCount: prices.length,
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            url: pageUrl,
            offers: prices.map(p => ({
                '@type': 'Offer',
                name: p.size,
                sku: `${productMpn}-${p.size.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
                mpn: productMpn,
                price: Math.round(p.price).toString(),
                priceCurrency: 'PHP',
                availability: 'https://schema.org/InStock',
                itemCondition: 'https://schema.org/NewCondition',
                priceValidUntil: priceValidUntil,
                url: pageUrl,
                seller: {
                    '@type': 'Organization',
                    name: 'Genie.ph'
                },
                shippingDetails: shippingDetails,
                hasMerchantReturnPolicy: returnPolicy
            }))
        };
    } else {
        baseOffersWrapper = {
            '@type': 'Offer',
            price: (design.price && design.price > 0) ? Math.round(design.price).toString() : FALLBACK_MIN_PRICE.toString(),
            priceCurrency: 'PHP',
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            priceValidUntil: priceValidUntil,
            sku: productMpn,
            mpn: productMpn,
            seller: {
                '@type': 'Organization',
                name: 'Genie.ph'
            },
            url: pageUrl,
            shippingDetails: shippingDetails,
            hasMerchantReturnPolicy: returnPolicy
        };
    }


    const offers = {
        ...baseOffersWrapper
    };

    // Build a second ImageObject when a customized variant exists
    const customizedImageUrl = design.customized_image_url;
    const customizedImageObject = (customizedImageUrl && customizedImageUrl !== imageUrl) ? {
        '@type': 'ImageObject',
        url: customizedImageUrl,
        contentUrl: customizedImageUrl,
        name: sanitize(`Customized ${title}`),
        creditText: 'Genie.ph',
    } : null;

    // Use array when both original + customized images are available
    const schemaImage = imageObject && customizedImageObject
        ? [imageObject, customizedImageObject]
        : imageObject || (imageUrl || undefined);

    // Product schema with SoftwareApplication link
    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': pageUrl,
        url: pageUrl,
        name: sanitize(title),
        sku: productMpn,
        mpn: productMpn,
        description: sanitize(design.seo_description || `Custom ${keywords} cake design`),
        image: schemaImage,
        brand: {
            '@type': 'Brand',
            name: 'Genie.ph'
        },
        offers: offers,
        category: 'Custom Cakes',
        // Link to the AI engine that analyzed this design
        subjectOf: {
            '@type': 'SoftwareApplication',
            name: 'Genie.ph AI Cake Price Calculator',
            url: 'https://genie.ph/cake-price-calculator',
            applicationCategory: 'BusinessApplication'
        },
        ...(design.alt_text && { 'alternateName': sanitize(design.alt_text) })
    };

    // WebPage schema with primaryImageOfPage - explicit signal for Google image thumbnails
    // Uses @id reference to link to the Product schema instead of creating a duplicate
    const webPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'ItemPage',
        name: sanitize(title),
        description: sanitize(design.seo_description || `Custom ${keywords} cake design`),
        url: pageUrl,
        mainEntity: {
            '@id': pageUrl // Reference the Product by URL instead of duplicating
        },
        ...(imageObject && { primaryImageOfPage: imageObject }),
        ...(imageUrl && { thumbnailUrl: imageUrl })
    };

    // BreadcrumbList schema for better SERP breadcrumb display
    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: 'https://genie.ph',
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Cake Designs',
                item: 'https://genie.ph/customizing',
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: sanitize(title),
                item: pageUrl,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, '\\u003c') }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema).replace(/</g, '\\u003c') }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') }}
            />
        </>
    );
}




/**
 * Maps hex color codes to human-readable color names for prose generation.
 * (Removed and replaced by hexToColorNameProse from @/utils/colorUtils)
 */




/**
 * Server-rendered cake design details visible on initial paint for SEO/image crawlability.
 * Google does not index content hidden with display:none, so this block is rendered visible.
 * CustomizingClient hides it on mount via document.getElementById('ssr-content') to avoid
 * duplication with the interactive UI. No-JS users see this as the primary content.
 */
function SSRCakeDetails({ design, prices, relatedDesigns, captionText }: { design: any; prices?: BasePriceInfo[]; relatedDesigns?: any[]; captionText?: string }) {
    const keywords = design.keywords || 'Custom';
    const analysis = design.analysis_json || {};

    // Clean title: use keywords + "Cake Designs" if seo_title is missing
    const baseTitle = design.seo_title || `${keywords} Cake Designs`;
    const title = baseTitle.replace(/\s*\|\s*Genie\.ph\s*$/i, '');
    const altText = generateRichAltText(design);
    const displayPrice = prices?.[0]?.price || design.price;

    // Extract product details from analysis
    const cakeType = analysis.cakeType || 'Custom';
    const icingDesign = analysis.icing_design || {};
    const mainToppers = analysis.main_toppers || [];
    const cakeMessages = analysis.cake_messages || [];

    // Extract icing colors
    const icingColors: string[] = [];
    if (icingDesign.colors) {
        if (icingDesign.colors.top) icingColors.push(icingDesign.colors.top);
        if (icingDesign.colors.side && icingDesign.colors.side !== icingDesign.colors.top) {
            icingColors.push(icingDesign.colors.side);
        }
        if (icingDesign.colors.drip) icingColors.push(`Drip: ${icingDesign.colors.drip}`);
    }

    return (
        <div id="ssr-content" className="w-full max-w-4xl mx-auto px-4 py-6">
            {/* Breadcrumb navigation */}
            <nav className="mb-4" aria-label="Breadcrumb">
                <ol className="flex items-center text-sm text-gray-500 space-x-2">
                    <li><Link href="/" className="hover:text-purple-600">Home</Link></li>
                    <li>/</li>
                    <li><Link href="/customizing" className="hover:text-purple-600">Cake Designs</Link></li>
                    <li>/</li>
                    <li className="text-gray-900 font-medium line-clamp-1">{title}</li>
                </ol>
            </nav>

            {/* Main card container - matches CustomizingClient styling */}
            <article
                className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 overflow-hidden"
            >
                {/* Hero Image Section */}
                {design.original_image_url && (
                    <figure className="relative w-full aspect-square bg-slate-100">
                        <LazyImage
                            src={design.original_image_url}
                            alt={altText}
                            title={altText}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-contain"
                            itemProp="image"
                        />
                        <figcaption className="absolute bottom-0 left-0 right-0 text-xs text-slate-500 p-3 text-center bg-white/50 backdrop-blur-sm">
                            {captionText}
                        </figcaption>
                        {/* Noscript fallback for non-JS crawlers */}
                        <noscript>
                            <img
                                src={design.original_image_url}
                                alt={altText}
                                width={design.image_width || 1200}
                                height={design.image_height || 1200}
                                style={{ width: '100%', height: 'auto' }}
                                loading="eager"
                            />
                        </noscript>
                    </figure>
                )}

                {/* Product Details */}
                <div className="p-4 md:p-6 space-y-4">
                    {/* User-requested customization guide text for SEO */}
                    <p className="text-xs font-semibold text-slate-500 mb-1">How would you like your cake customized?</p>

                    {/* Title — h2 since this block is hidden; the visible h1 is in CustomizingClient */}
                    <h2
                        className="text-xl md:text-2xl font-bold text-slate-800"
                    >
                        {title}
                    </h2>

                    {/* Description */}
                    {design.alt_text && (
                        <p className="text-slate-600 text-sm">
                            {design.alt_text}
                        </p>
                    )}

                    {/* Cake Type Badge */}
                    <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                            {cakeType} Cake
                        </span>
                    </div>

                    {/* Icing Colors */}
                    {icingColors.length > 0 && (
                        <div className="space-y-2">
                            <h2 className="text-sm font-semibold text-slate-700">Icing Colors</h2>
                            <div className="flex flex-wrap gap-2">
                                {icingColors.map((color, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full"
                                    >
                                        {color}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Cake Toppers */}
                    {mainToppers.length > 0 && (
                        <div className="space-y-2">
                            <h2 className="text-sm font-semibold text-slate-700">Cake Toppers</h2>
                            <ul className="flex flex-wrap gap-2">
                                {mainToppers.map((topper: any, i: number) => (
                                    <li
                                        key={i}
                                        className="inline-flex items-center px-2.5 py-1 bg-pink-50 text-pink-700 text-xs font-medium rounded-full"
                                    >
                                        {topper.description || topper.type}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Cake Messages */}
                    {cakeMessages.length > 0 && (
                        <div className="space-y-2">
                            <h2 className="text-sm font-semibold text-slate-700">Cake Messages</h2>
                            <ul className="space-y-1">
                                {cakeMessages.map((msg: any, i: number) => (
                                    <li
                                        key={i}
                                        className="text-sm text-slate-600 italic"
                                    >
                                        "{msg.text || 'Custom message'}"
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Price Display */}
                    {displayPrice && (
                        <div className="pt-2 border-t border-slate-200">
                            <p className="text-lg font-bold text-pink-600">
                                Starting at <span>₱{Math.round(displayPrice).toLocaleString()}</span>
                            </p>
                        </div>
                    )}

                    {/* Size & Pricing Table */}
                    {prices && prices.length > 0 && (
                        <div className="space-y-2">
                            <h2 className="text-sm font-semibold text-slate-700">Available Sizes & Prices</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {prices.map((option, i) => (
                                    <div
                                        key={i}
                                        className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center"
                                    >
                                        <p className="text-sm font-medium text-slate-800">{option.size}</p>
                                        <p className="text-sm text-pink-600 font-semibold">
                                            ₱{Math.round(option.price).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Related Designs Section - SEO Internal Linking */}
                    {relatedDesigns && relatedDesigns.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-slate-200">
                            <h2 className="text-sm font-semibold text-slate-700">You May Also Like</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {relatedDesigns.map((related, i) => (
                                    <Link
                                        key={related.slug || i}
                                        href={`/customizing/${related.slug}`}
                                        className="group block overflow-hidden rounded-lg border border-slate-200 hover:border-pink-300 transition-colors"
                                        aria-label={`View ${related.keywords || 'custom'} cake design`}
                                        tabIndex={0}
                                    >
                                        {related.original_image_url && (
                                            // CSS background prevents Google Images from indexing
                                            // related-cake thumbnails as belonging to this page.
                                            // Only the hero <img> above (itemProp="image") is indexable.
                                            <div
                                                className="aspect-square bg-slate-100 overflow-hidden bg-cover bg-center group-hover:scale-105 transition-transform duration-200"
                                                style={{ backgroundImage: `url(${related.original_image_url})` }}
                                                role="img"
                                                aria-label={related.alt_text || `${related.keywords || 'Custom'} cake design`}
                                            />
                                        )}
                                        <div className="p-2">
                                            <p className="text-xs font-medium text-slate-700 line-clamp-1">
                                                {related.keywords || 'Custom Cake'}
                                            </p>
                                            {related.price && (
                                                <p className="text-xs text-pink-600 font-semibold">
                                                    ₱{Math.round(related.price).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading indicator for interactive features */}
                    <div className="flex items-center justify-center py-4 text-slate-500">
                        <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm">Loading customization tools...</span>
                    </div>
                </div>
            </article>
        </div>
    );
}


/**
 * Persistent server-rendered content that is ALWAYS visible — never hidden by hydration.
 * Lives outside #ssr-content and outside Suspense so both Googlebot and users see it.
 * This avoids any cloaking concerns where crawlers see different content than users.
 */
function SSRDesignContent({ design, prices }: { design: any; prices?: BasePriceInfo[] }) {
    const designDetails = design.seo_description || design.alt_text || '';
    const dynamicFAQs = generateDynamicFAQ(design, prices);
    const keywords = design.keywords || 'Custom';
    const tags = design.tags || [];
    const analysis = design.analysis_json || {};

    return (
        <div className="w-full pb-4 pt-1 space-y-1">
            {/* Design Details - now rendered in SSR for SEO */}
            {designDetails && (
                <section className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 p-4 md:p-6">
                    <DesignAboutSection
                        title={`About This ${keywords || 'Custom'} Cake`}
                        description={designDetails}
                        showDisclaimer={true}
                    />
                </section>
            )}

            {/* Structured Specifications Table for SEO */}
            <section className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 p-4 md:p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Design Specifications</h2>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm text-left">
                        <tbody className="divide-y divide-slate-200">
                            <tr className="bg-white">
                                <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">Cake Style</th>
                                <td className="px-4 py-2 text-slate-600">{analysis.cakeType || 'Custom'} {keywords}</td>
                            </tr>
                            <tr className="bg-slate-50">
                                <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">Icing Finish</th>
                                <td className="px-4 py-2 text-slate-600">{analysis.icing_design?.base?.replace(/_/g, ' ') || 'Standard Icing'}</td>
                            </tr>
                            {analysis.main_toppers?.length > 0 && (
                                <tr className="bg-white">
                                    <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">Primary Features</th>
                                    <td className="px-4 py-2 text-slate-600">
                                        {analysis.main_toppers.map((t: any) => t.description || t.type).join(', ')}
                                    </td>
                                </tr>
                            )}
                            {analysis.support_elements?.length > 0 && (
                                <tr className="bg-slate-50">
                                    <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">Decorations</th>
                                    <td className="px-4 py-2 text-slate-600">
                                        {analysis.support_elements.map((s: any) => s.description || s.type).join(', ')}
                                    </td>
                                </tr>
                            )}
                            {tags.length > 0 && (
                                <tr className="bg-white">
                                    <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">TAGS</th>
                                    <td className="px-4 py-2 text-slate-600">
                                        <div className="flex flex-wrap gap-1.5">
                                            {tags.map((tag: string, index: number) => (
                                                <a
                                                    key={`${tag}-${index}`}
                                                    href={`/search?q=${encodeURIComponent(tag)}`}
                                                    className="text-purple-600 hover:text-purple-800 hover:underline transition-colors"
                                                >
                                                    {tag}{index < tags.length - 1 ? ',' : ''}
                                                </a>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Combined FAQ — dynamic per-cake questions + general store info */}
            {dynamicFAQs.length > 0 && (
                <section className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 p-4 md:p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Frequently Asked Questions</h2>
                    <div className="space-y-3">
                        {dynamicFAQs.map((faq, i) => (
                            <details
                                key={i}
                                className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                                {...(i === 0 ? { open: true } : {})}
                            >
                                <summary className="flex items-center justify-between p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                    <span className="font-semibold text-slate-700 group-open:text-purple-900 text-sm">
                                        {faq.question}
                                    </span>
                                    <svg
                                        className="w-5 h-5 text-slate-400 transition-transform duration-300 group-open:rotate-180 shrink-0 ml-2"
                                        width="20"
                                        height="20"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </summary>
                                <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
                                    {faq.answer}
                                </div>
                            </details>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}


export default async function RecentSearchPage({ params }: Props) {
    const { slug } = await params

    const design = await getDesign(slug)

    const pageUrl = `https://genie.ph/customizing/${slug}`;

    if (!design) {
        notFound()
    }

    const seoAnalysis = design.analysis_json || {};
    const seoCakeType: CakeType = VALID_CAKE_TYPES.includes(seoAnalysis.cakeType as CakeType)
        ? (seoAnalysis.cakeType as CakeType)
        : '1 Tier';

    // Fetch SEO data in parallel to reduce server wait time without changing rendered content.
    let prices: BasePriceInfo[] = [];
    let relatedDesigns: any[] = [];
    const [pricesResult, relatedDesignsResult] = await Promise.allSettled([
        getCakeBasePriceOptions(seoCakeType, CAKE_TYPE_THICKNESS_MAP[seoCakeType] || '4 in'),
        getRelatedProductsByKeywords(design.keywords, slug, 6, 0),
    ]);

    if (pricesResult.status === 'fulfilled') {
        prices = pricesResult.value;
    } else {
        console.error('Error fetching SEO prices:', pricesResult.reason);
    }

    if (relatedDesignsResult.status === 'fulfilled') {
        relatedDesigns = relatedDesignsResult.value.data || [];
    } else {
        console.error('Error fetching related designs:', relatedDesignsResult.reason);
    }

    // Generate unique caption for image SEO from the first 1-2 sentences of design details
    const detailsText = generateDesignDetails(design, prices);
    const captionSentences = detailsText.split('. ').slice(0, 2);
    let captionText = captionSentences.join('. ');
    if (captionText && !captionText.endsWith('.')) captionText += '.';

    // Prepare State for Hydration (SSR)
    const analysis: HybridAnalysisResult | null = design.analysis_json ? { ...design.analysis_json } : null;

    // Always provide initialData to prevent localStorage fallback and state leakage
    let initialState: CustomizationState;
    if (design.isSharedDesign && design.customization_details) {
        initialState = typeof design.customization_details === 'string'
            ? JSON.parse(design.customization_details as string)
            : design.customization_details;
    } else if (analysis) {
        // Construct the initial state matching CustomizationContext structure
        const cakeType: CakeType = analysis.cakeType || '1 Tier';
        // Note: Default thickness/size maps might be needed if not in analysis
        // Using basic defaults if missing from analysis
        const defaultCakeInfo: CakeInfoUI = {
            type: cakeType,
            thickness: analysis.cakeThickness || '3 in',
            flavors: ['Chocolate Cake'], // Default flavor
            size: '6" Round' // Default size, ideally mapped from type
        };

        // Transform arrays to add IDs if needed (though IDs should ideally be valid strings)
        // We'll trust the analysis structure mostly matches, but ensure IDs exist
        const mainToppers = (analysis.main_toppers || []).map((t: any) => ({
            ...t,
            id: t.id || uuidv4(),
            isEnabled: true,
            original_type: t.type,
            original_color: t.color,
            original_colors: t.colors
        }));

        const supportElements = (analysis.support_elements || []).map((s: any) => ({
            ...s,
            id: s.id || uuidv4(),
            isEnabled: true,
            original_type: s.type,
            original_color: s.color,
            original_colors: s.colors
        }));

        const cakeMessages = (analysis.cake_messages || []).map((m: any) => ({
            ...m,
            id: m.id || uuidv4(),
            text: m.text || '', // Preserve analyzed text if present
            isEnabled: true,
            isPlaceholder: !m.text, // Only a placeholder if no text was detected
            originalMessage: { ...m }
        }));

        const icingDesign: IcingDesignUI | null = analysis.icing_design ? {
            ...analysis.icing_design,
            dripPrice: 100, // Default pricing assumption
            gumpasteBaseBoardPrice: 100
        } : null;

        initialState = {
            cakeInfo: defaultCakeInfo,
            mainToppers,
            supportElements,
            cakeMessages,
            icingDesign,
            additionalInstructions: '',
            analysisResult: analysis, // The full analysis result
            analysisId: design.slug, // Using slug or p_hash as ID
            availability: design.availability
        };
    } else {
        // No analysis available - use clean default state to prevent localStorage fallback
        initialState = mapProductToDefaultState(undefined, prices);
    }

    return (
        <>
            <DesignSchema design={design} prices={prices} />

            {/* Preload hero image for faster LCP with responsive srcset */}
            {design.original_image_url && (() => {
                const renderUrl = getSupabaseRenderUrl(design.original_image_url);
                return (
                    <link
                        rel="preload"
                        as="image"
                        href={design.original_image_url}
                        imageSrcSet={renderUrl ? `${renderUrl}?width=640&resize=contain&quality=75 640w, ${renderUrl}?width=828&resize=contain&quality=75 828w, ${renderUrl}?width=1200&resize=contain&quality=75 1200w` : undefined}
                        imageSizes={renderUrl ? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" : undefined}
                    />
                );
            })()}

            <SSRCakeDetails
                design={design}
                prices={prices}
                relatedDesigns={relatedDesigns}
                captionText={captionText}
            />

            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizationProvider initialData={initialState}>
                    <CustomizingClient
                        recentSearchDesign={design}
                        initialPrices={prices}
                        relatedDesigns={relatedDesigns}
                        currentKeywords={design.keywords}
                        currentSlug={slug}
                        initialCaption={captionText}
                        postEditorSlot={<SSRDesignContent design={design} prices={prices} />}
                    />
                    <NewsletterPopup />
            </CustomizationProvider>
            </Suspense>

        </>
    )
}

