import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import CustomizingClient from '../CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getCakeBasePriceOptions } from '@/services/supabaseService'
import { CakeType, BasePriceInfo, HybridAnalysisResult, CakeInfoUI, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI } from '@/types'
import { CustomizationProvider, CustomizationState } from '@/contexts/CustomizationContext'
import { v4 as uuidv4 } from 'uuid'

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug } = await params
    const supabase = await createClient()

    const { data: design } = await supabase
        .from('cakegenie_analysis_cache')
        .select('seo_title, seo_description, alt_text, original_image_url, price, keywords, analysis_json')
        .eq('slug', slug)
        .single()

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

    return {
        title,
        description,
        alternates: {
            canonical: `https://genie.ph/customizing/${slug}`,
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
            url: `https://genie.ph/customizing/${slug}`,
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

    // Standard Shipping Details (Placeholder)
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
            seller: {
                '@type': 'Organization',
                name: 'Genie.ph'
            },
            url: pageUrl
        };
    } else {
        baseOffersWrapper = {
            '@type': 'Offer',
            price: design.price || 0,
            priceCurrency: 'PHP',
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            seller: {
                '@type': 'Organization',
                name: 'Genie.ph'
            },
            url: pageUrl
        };
    }

    const offers = {
        ...baseOffersWrapper,
        hasMerchantReturnPolicy: returnPolicy,
        shippingDetails: shippingDetails
    };

    // Product schema
    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': pageUrl, // Unique identifier for cross-referencing
        url: pageUrl, // Explicit URL
        name: sanitize(title),
        description: sanitize(design.seo_description || `Custom ${keywords} cake design`),
        image: imageUrl ? [imageUrl] : [],
        brand: {
            '@type': 'Brand',
            name: 'Genie.ph'
        },
        offers: offers,
        category: 'Custom Cakes',
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '156',
            bestRating: '5',
            worstRating: '1'
        },
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
        </>
    );
}





/**
 * Server-rendered cake design details for SEO crawlers.
 * Extracts and displays key features from analysis_json.
 * Hidden from visual users but fully visible to search bots.
 */
/**
 * Server-rendered cake design details for SEO crawlers and user information.
 * Matches the UI style of the Customizing Client (glassmorphism).
 */
function SEODesignDetails({ design }: { design: any }) {
    const keywords = design.keywords || 'Custom';

    // Clean title: remove "| Genie.ph" suffix
    const title = (design.seo_title || `${keywords} Cake Design`).replace(/\s*\|\s*Genie\.ph\s*$/i, '');

    return (
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 p-6 space-y-4">
            <header className="border-b border-slate-200 pb-4">
                <h2 className="text-xl font-bold text-slate-800">{title}</h2>
            </header>

            {design.alt_text && (
                <section>
                    <h3 className="text-sm font-semibold text-slate-700 mb-1">Description</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{design.alt_text}</p>
                </section>
            )}
        </div>
    );
}

export default async function RecentSearchPage({ params }: Props) {
    const { slug } = await params
    const supabase = await createClient()

    console.log(`[RecentSearchPage] Request for slug: ${slug}`);

    const { data: design } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*')
        .eq('slug', slug)
        .single()

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

            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizationProvider initialData={initialState}>
                    <CustomizingClient
                        recentSearchDesign={design}
                    />
                </CustomizationProvider>
            </Suspense>
            {/* SEO Content: Pricing Table removed as per user request (redundant with UI options) */}
        </>
    )
}
