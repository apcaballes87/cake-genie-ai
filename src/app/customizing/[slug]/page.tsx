import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CustomizingClient from '../CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getCakeBasePriceOptions, getRelatedProductsByKeywords } from '@/services/supabaseService'
import { CakeType, BasePriceInfo, HybridAnalysisResult, CakeInfoUI, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI } from '@/types'
import { CustomizationProvider, CustomizationState } from '@/contexts/CustomizationContext'
import { v4 as uuidv4 } from 'uuid'

// Helper to fetch design by slug OR keyword fallback
async function getDesign(supabase: any, slug: string) {
    // 1. Try exact slug match
    let { data } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*')
        .eq('slug', slug)
        .single()

    // 2. Fallback: Search by keyword (e.g. 'graduation' -> latest graduation cake)
    if (!data) {
        const keyword = slug.replace(/-/g, ' ');
        const { data: fallback } = await supabase
            .from('cakegenie_analysis_cache')
            .select('*')
            .ilike('keywords', `%${keyword}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (fallback) {
            data = fallback
        }
    }

    return data
}

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug } = await params
    const supabase = await createClient()

    const design = await getDesign(supabase, slug)

    if (!design) {
        return { title: 'Design Not Found' }
    }

    const priceDisplay = design.price ? ` | Php ${Math.round(design.price).toLocaleString()}` : ''
    // Strip existing "| Genie.ph" suffix to avoid duplication
    const baseSeoTitle = design.seo_title?.replace(/\s*\|\s*Genie\.ph\s*$/i, '') || ''
    const title = baseSeoTitle
        ? `${baseSeoTitle}${priceDisplay} | Genie.ph`
        : `${design.keywords || 'Custom'} Cake${priceDisplay} | Genie.ph`

    // Richer Fallback Description Logic
    let description = design.seo_description

    if (!description && design.analysis_json) {
        // Construct description from analysis features for legacy records
        const analysis = design.analysis_json
        const features = []

        // Colors
        if (analysis.icing_design?.colors) {
            const colors = Object.values(analysis.icing_design.colors)
                .filter(c => typeof c === 'string')
                .join(', ')
            if (colors) features.push(`${analysis.icing_design.base.replace('_', ' ')}: ${colors}`)
        }

        // Toppers
        if (analysis.main_toppers?.length > 0) {
            const topNames = analysis.main_toppers.slice(0, 3).map((t: any) => t.description || t.type).join(', ')
            features.push(`Toppers: ${topNames}`)
        }

        description = `Customize this ${design.keywords || 'custom'} cake design. ${features.join('. ')}. Starting at ₱${design.price?.toLocaleString() || '0'}.`
    } else if (!description) {
        description = `Get instant pricing for this ${design.keywords || 'custom'} cake design. Starting at ₱${design.price?.toLocaleString() || '0'}.`
    }

    // Use the actual design slug for canonical URL to prevent Soft 404s on fallback matches
    const canonicalSlug = design.slug || slug
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
                    width: 1200,
                    height: 630,
                    alt: design.alt_text || design.keywords || 'Custom cake design',
                },
            ] : [],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: design.original_image_url ? [design.original_image_url] : [],
        },
        other: {
            thumbnail: design.original_image_url || '',
            'image_src': design.original_image_url || '',
            // PageMap DataObject for Google thumbnail
            'pagemap': design.original_image_url ? `<DataObject type="thumbnail"><Attribute name="src">${design.original_image_url}</Attribute></DataObject>` : '',
        },
    }
}

// JSON-LD Schema for SEO - Enhanced for Google Image Thumbnails
function DesignSchema({ design, prices }: { design: any; prices?: BasePriceInfo[] }) {
    const sanitize = (str: string | null | undefined) => str ? str.replace(/<\/script/g, '<\\/script') : '';

    const keywords = design.keywords || 'Custom';
    const title = design.seo_title || `${keywords} Cake`;
    const imageUrl = design.original_image_url;
    const pageUrl = `https://genie.ph/customizing/${design.slug || ''}`;

    // ImageObject for better image indexing
    const imageObject = imageUrl ? {
        '@type': 'ImageObject',
        url: imageUrl,
        contentUrl: imageUrl,
        width: 1200,
        height: 1200,
        name: sanitize(design.alt_text || title || 'Custom Cake Design'),
        caption: sanitize(design.seo_description || `Custom ${keywords} cake design`),
        creditText: 'Genie.ph',
        creator: {
            '@type': 'Organization',
            name: 'Genie.ph'
        }
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
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility'
    };

    const priceValidUntil = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
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
            price: design.price ? Math.round(design.price).toString() : '0',
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

    // Product schema
    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': pageUrl, // Unique identifier for cross-referencing
        url: pageUrl, // Explicit URL
        name: sanitize(title),
        sku: productMpn,
        mpn: productMpn,
        description: sanitize(design.seo_description || `Custom ${keywords} cake design`),
        image: imageUrl || undefined,
        brand: {
            '@type': 'Brand',
            name: 'Genie.ph'
        },
        offers: offers,
        category: 'Custom Cakes',
        ...(design.alt_text && { 'alternateName': sanitize(design.alt_text) })
    };

    // WebPage schema with primaryImageOfPage - explicit signal for Google image thumbnails
    // Uses @id reference to link to the Product schema instead of creating a duplicate
    const webPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
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
                name: 'Designs',
                item: 'https://genie.ph/designs',
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
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
        </>
    );
}




/**
 * Server-rendered cake design details displayed VISIBLY for both SEO and users.
 * This content is shown on initial page load before client hydration.
 * Once CustomizingClient hydrates, it takes over the interactive display.
 */
function SSRCakeDetails({ design, prices, relatedDesigns }: { design: any; prices?: BasePriceInfo[]; relatedDesigns?: any[] }) {
    const keywords = design.keywords || 'Custom';
    const analysis = design.analysis_json || {};

    // Clean title: remove "| Genie.ph" suffix
    const title = (design.seo_title || `${keywords} Cake Design`).replace(/\s*\|\s*Genie\.ph\s*$/i, '');
    const altText = design.alt_text || design.seo_title || `${keywords} cake design`;
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
            {/* Main card container - matches CustomizingClient styling */}
            <article
                className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 overflow-hidden"
            >
                {/* Hero Image Section */}
                {design.original_image_url && (
                    <figure className="relative w-full aspect-square bg-slate-100">
                        <img
                            src={design.original_image_url}
                            alt={altText}
                            className="w-full h-full object-contain"
                            loading="eager"
                            fetchPriority="high"
                        />
                    </figure>
                )}

                {/* Product Details */}
                <div className="p-4 md:p-6 space-y-4">
                    {/* Title */}
                    <h1
                        className="text-xl md:text-2xl font-bold text-slate-800"
                    >
                        {title}
                    </h1>

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
                                            <div className="aspect-square bg-slate-100 overflow-hidden">
                                                <img
                                                    src={related.original_image_url}
                                                    alt={related.alt_text || `${related.keywords || 'Custom'} cake design`}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                    loading="lazy"
                                                />
                                            </div>
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


export default async function RecentSearchPage({ params }: Props) {
    const { slug } = await params
    const supabase = await createClient()

    console.log(`[RecentSearchPage] Request for slug: ${slug}`);

    const design = await getDesign(supabase, slug)

    if (!design) {
        console.warn(`[RecentSearchPage] No design found for slug: ${slug} - triggering 404`);
        notFound()
    }

    console.log(`[RecentSearchPage] Design found for slug: ${slug}, passing to client.`);

    if (!design) {
        notFound()
    }

    // Fetch base price options for SEO table
    let prices: BasePriceInfo[] = [];
    try {
        const analysis = design.analysis_json || {};
        // Use cakeType from analysis or default to 'custom'
        // Using '4 in' as default thickness for SEO pricing table
        const cakeType = (analysis.cakeType as CakeType) || 'custom';
        prices = await getCakeBasePriceOptions(cakeType, '4 in');
    } catch (e) {
        console.error('Error fetching SEO prices:', e);
    }

    // Fetch related designs for internal linking (SEO) - keyword-based matching
    let relatedDesigns: any[] = [];
    try {
        const { data } = await getRelatedProductsByKeywords(design.keywords, slug, 6, 0);
        relatedDesigns = data || [];
    } catch (e) {
        console.error('Error fetching related designs:', e);
    }

    // Prepare State for Hydration (SSR)
    const analysis: HybridAnalysisResult | null = design.analysis_json ? { ...design.analysis_json } : null;

    let initialState: CustomizationState | undefined;
    if (analysis) {
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
            isEnabled: true,
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
            analysisId: design.slug // Using slug or p_hash as ID
        };
    }

    return (
        <>
            <DesignSchema design={design} prices={prices} />

            {/* SSR Content - Visible initial content for SEO and fast first paint */}
            {/* This is hidden by CustomizingClient once JavaScript hydrates */}
            <SSRCakeDetails design={design} prices={prices} relatedDesigns={relatedDesigns} />

            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizationProvider initialData={initialState}>
                    <CustomizingClient
                        recentSearchDesign={design}
                        initialPrices={prices}
                        relatedDesigns={relatedDesigns}
                        currentKeywords={design.keywords}
                        currentSlug={slug}
                    />
                </CustomizationProvider>
            </Suspense>
        </>
    )
}

