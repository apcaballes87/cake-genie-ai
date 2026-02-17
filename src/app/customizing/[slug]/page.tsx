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
// FAQPageSchema deprecated (restricted to gov/healthcare Aug 2023) — using HTML accordions instead
import { v4 as uuidv4 } from 'uuid'

// Helper to fetch design by exact slug only
async function getDesign(supabase: any, slug: string) {
    const { data } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*')
        .eq('slug', slug)
        .single()

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
    // Strip existing "| Genie.ph" suffix — the root layout template already appends it
    const baseSeoTitle = design.seo_title?.replace(/\s*\|\s*Genie\.ph\s*$/i, '') || ''
    const title = baseSeoTitle
        ? `${baseSeoTitle}${priceDisplay}`
        : `${design.keywords || 'Custom'} Cake Designs & Photos${priceDisplay}`

    // Richer Fallback Description Logic
    let description = design.seo_description || `Customize this ${design.keywords || 'custom'} cake design on Genie.ph. Get instant pricing from local bakers in Cebu and Cavite. ${design.alt_text || ''}`

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

    const canonicalUrl = `https://genie.ph/customizing/${slug}`

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
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
        returnPolicyCountry: 'PH' // Required since March 2025
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
        image: imageUrl || undefined,
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
 * Maps hex color codes to human-readable color names for prose generation.
 * Uses the same palette defined in the AI system instruction.
 */
const HEX_TO_NAME: Record<string, string> = {
    '#EF4444': 'red', '#FCA5A5': 'light red', '#F97316': 'orange',
    '#EAB308': 'yellow', '#16A34A': 'green', '#4ADE80': 'light green',
    '#14B8A6': 'teal', '#3B82F6': 'blue', '#93C5FD': 'light blue',
    '#8B5CF6': 'purple', '#C4B5FD': 'light purple', '#EC4899': 'pink',
    '#FBCFE8': 'light pink', '#78350F': 'brown', '#B45309': 'light brown',
    '#64748B': 'gray', '#FFFFFF': 'white', '#000000': 'black',
};

function hexToName(hex: string): string {
    if (!hex) return '';
    const upper = hex.toUpperCase();
    return HEX_TO_NAME[upper] || hex;
}

/**
 * Generates a unique prose paragraph describing the cake design from its analysis data.
 * This creates substantive, unique content per page to avoid thin-content penalties.
 */
function generateDesignDetails(design: any, prices?: BasePriceInfo[]): string {
    const analysis = design.analysis_json || {};
    const keywords = design.keywords || 'custom';
    const cakeType = analysis.cakeType || 'Custom';
    const icingDesign = analysis.icing_design || {};
    const mainToppers = analysis.main_toppers || [];
    const supportElements = analysis.support_elements || [];
    const cakeMessages = analysis.cake_messages || [];
    const availability = design.availability || 'normal';

    const sentences: string[] = [];

    // Sentence 1: Introduce the cake with its type and icing base
    const icingBase = icingDesign.base?.replace(/[-_]/g, ' ') || 'soft icing';
    const topColor = hexToName(icingDesign.colors?.top || '');
    const sideColor = hexToName(icingDesign.colors?.side || '');
    const colorDesc = topColor && sideColor && topColor !== sideColor
        ? `a ${topColor} top and ${sideColor} sides`
        : topColor ? `a ${topColor} base` : 'a custom color palette';
    sentences.push(`This ${keywords} cake is a ${cakeType.toLowerCase()} design with ${icingBase} featuring ${colorDesc}.`);

    // Sentence 2: Describe the main toppers (the hero elements)
    if (mainToppers.length > 0) {
        const topperDescs = mainToppers
            .slice(0, 4)
            .map((t: any) => t.description || t.type?.replace(/_/g, ' '))
            .filter(Boolean);
        if (topperDescs.length === 1) {
            sentences.push(`The design is highlighted by ${topperDescs[0]}.`);
        } else if (topperDescs.length > 1) {
            const last = topperDescs.pop();
            sentences.push(`The design features ${topperDescs.join(', ')}, and ${last}.`);
        }
    }

    // Sentence 3: Describe support elements if present
    if (supportElements.length > 0) {
        const supportDescs = supportElements
            .slice(0, 3)
            .map((s: any) => {
                const desc = s.description || s.type?.replace(/_/g, ' ');
                return s.quantity > 1 ? `${s.quantity} ${desc}` : desc;
            })
            .filter(Boolean);
        if (supportDescs.length > 0) {
            const last = supportDescs.length > 1 ? supportDescs.pop() : null;
            const joined = last ? `${supportDescs.join(', ')}, and ${last}` : supportDescs[0];
            sentences.push(`Decorative accents include ${joined}.`);
        }
    }

    // Sentence 4: Drip or special icing features
    const specialFeatures: string[] = [];
    if (icingDesign.drip) specialFeatures.push('a drip effect');
    if (icingDesign.border_top) specialFeatures.push('a decorative top border');
    if (icingDesign.border_base) specialFeatures.push('a base border');
    if (icingDesign.gumpasteBaseBoard) specialFeatures.push('a gumpaste baseboard');
    if (specialFeatures.length > 0) {
        const last = specialFeatures.length > 1 ? specialFeatures.pop() : null;
        const joined = last ? `${specialFeatures.join(', ')}, and ${last}` : specialFeatures[0];
        sentences.push(`The icing work includes ${joined} for added detail.`);
    }

    // Sentence 5: Cake messages
    if (cakeMessages.length > 0) {
        const messages = cakeMessages.map((m: any) => `"${m.text}"`).join(' and ');
        sentences.push(`The cake carries the message ${messages}.`);
    }

    // Sentence 6: Pricing and sizes
    if (prices && prices.length > 0) {
        const sorted = [...prices].sort((a, b) => a.price - b.price);
        const lowest = sorted[0];
        const highest = sorted[sorted.length - 1];
        const sizeList = prices.map(p => p.size).join(', ');
        sentences.push(`Available in ${sizeList}, this design starts at ₱${Math.round(lowest.price).toLocaleString()} and goes up to ₱${Math.round(highest.price).toLocaleString()} for the largest size.`);
    }

    // Sentence 7: Availability
    const availabilityMap: Record<string, string> = {
        'rush': 'This is a simple design eligible for rush orders — you can have it ready in as little as 30 minutes to 1 hour.',
        'same-day': 'This design qualifies for same-day orders with approximately 3 to 4 hours of lead time.',
        'normal': 'Due to the complexity of this design, we recommend ordering at least 1 day in advance for the best results.',
    };
    if (availabilityMap[availability]) {
        sentences.push(availabilityMap[availability]);
    }

    return sentences.join(' ');
}

/**
 * Generates dynamic FAQ items specific to this cake design.
 * Each page gets unique Q&A content instead of identical boilerplate.
 */
function generateDynamicFAQ(design: any, prices?: BasePriceInfo[]): { question: string; answer: string }[] {
    const keywords = design.keywords || 'custom';
    const analysis = design.analysis_json || {};
    const cakeType = analysis.cakeType || 'Custom';
    const availability = design.availability || 'normal';
    const mainToppers = analysis.main_toppers || [];
    const supportElements = analysis.support_elements || [];

    const faqs: { question: string; answer: string }[] = [];

    // FAQ 1: Price — always unique per design
    if (prices && prices.length > 0) {
        const sorted = [...prices].sort((a, b) => a.price - b.price);
        const priceLines = sorted.map(p => `${p.size} at ₱${Math.round(p.price).toLocaleString()}`).join(', ');
        faqs.push({
            question: `How much does this ${keywords} cake cost?`,
            answer: `This ${keywords} ${cakeType.toLowerCase()} cake is available in multiple sizes: ${priceLines}. The price includes the base icing, all decorations shown in the design, and free delivery within Metro Cebu. You can also customize individual elements which may adjust the final price.`,
        });
    }

    // FAQ 2: Availability — varies by design complexity
    const availabilityAnswers: Record<string, string> = {
        'rush': `This ${keywords} cake design is simple enough for a rush order. You can have it ready in as little as 30 minutes to 1 hour, making it perfect for last-minute celebrations. Rush orders are available for pickup or delivery within Metro Cebu.`,
        'same-day': `This ${keywords} cake can be prepared as a same-day order with approximately 3 to 4 hours of lead time. The design includes elements that require some preparation time, but you can still order and receive it on the same day. Place your order before noon for the best availability.`,
        'normal': `This ${keywords} cake design requires at least 1 day of lead time due to its complexity. We recommend ordering at least 1 to 2 days in advance to ensure our bakers can craft every detail perfectly. Order by 3 PM for next-day delivery slots.`,
    };
    faqs.push({
        question: `How soon can I get this ${keywords} cake?`,
        answer: availabilityAnswers[availability] || availabilityAnswers['normal'],
    });

    // FAQ 3: Customization — varies based on what's actually on the cake
    const customizableElements: string[] = [];
    if (mainToppers.length > 0) {
        const topperTypes = [...new Set(mainToppers.map((t: any) => t.type?.replace(/_/g, ' ')))];
        customizableElements.push(`toppers (currently ${topperTypes.join(', ')})`);
    }
    if (analysis.icing_design) {
        customizableElements.push('icing colors and style');
    }
    if (analysis.cake_messages?.length > 0) {
        customizableElements.push('cake messages and text');
    }
    if (supportElements.length > 0) {
        customizableElements.push('decorative accents');
    }

    if (customizableElements.length > 0) {
        const lastEl = customizableElements.length > 1 ? customizableElements.pop() : null;
        const joined = lastEl ? `${customizableElements.join(', ')}, and ${lastEl}` : customizableElements[0];
        faqs.push({
            question: `Can I customize this ${keywords} cake design?`,
            answer: `Yes, you can fully customize this design. Editable elements include ${joined}. Use our AI-powered customizer to swap, add, or remove individual elements and see how each change affects the price in real time. For example, switching a toy topper to a printed one can adjust the cost.`,
        });
    }

    // FAQ 4: Delivery — semi-dynamic with cake type context
    faqs.push({
        question: `Do you deliver this ${cakeType.toLowerCase()} cake in Cebu?`,
        answer: `Yes, we offer free delivery for this ${keywords} ${cakeType.toLowerCase()} cake throughout Metro Cebu, including Cebu City, Mandaue, Mactan, Lapu-Lapu, and Talisay. We also serve select areas in Cavite. All cakes are delivered fresh by our partner bakers to ensure quality.`,
    });

    // FAQ 5: Payment methods — static but important for conversions and trust
    faqs.push({
        question: 'What payment options are available?',
        answer: 'We accept e-wallets (GCash and Maya), bank transfers (BDO, BPI, and Metrobank), and all major credit and debit cards processed securely via Xendit. You can choose your preferred payment method at checkout.',
    });

    return faqs;
}


/**
 * Server-rendered cake design details displayed VISIBLY for both SEO and users.
 * This content is shown on initial page load before client hydration.
 * Once CustomizingClient hydrates, it takes over the interactive display.
 */
function SSRCakeDetails({ design, prices, relatedDesigns }: { design: any; prices?: BasePriceInfo[]; relatedDesigns?: any[] }) {
    const keywords = design.keywords || 'Custom';
    const analysis = design.analysis_json || {};

    // Clean title: use keywords + "Cake Designs" if seo_title is missing
    const baseTitle = design.seo_title || `${keywords} Cake Designs`;
    const title = baseTitle.replace(/\s*\|\s*Genie\.ph\s*$/i, '');
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
                    {/* User-requested customization guide text for SEO */}
                    <p className="text-xs font-semibold text-slate-500 mb-1">How would you like your cake customized?</p>

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


/**
 * Persistent server-rendered content that is ALWAYS visible — never hidden by hydration.
 * Lives outside #ssr-content and outside Suspense so both Googlebot and users see it.
 * This avoids any cloaking concerns where crawlers see different content than users.
 */
function SSRDesignContent({ design, prices }: { design: any; prices?: BasePriceInfo[] }) {
    const designDetails = generateDesignDetails(design, prices);
    const dynamicFAQs = generateDynamicFAQ(design, prices);
    const keywords = design.keywords || 'Custom';

    return (
        <div className="w-full max-w-4xl mx-auto px-4 pb-6 space-y-6">
            {/* Design Details — moved to seoContentSlot passed to CustomizingClient */}


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
    const supabase = await createClient()

    const design = await getDesign(supabase, slug)

    const pageUrl = `https://genie.ph/customizing/${slug}`;

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
            analysisId: design.slug, // Using slug or p_hash as ID
            availability: design.availability
        };
    }

    return (
        <>
            <DesignSchema design={design} prices={prices} />
            {/* FAQ as visible HTML accordion (FAQPage schema restricted to gov/healthcare Aug 2023) */}

            {/* Ordering steps as visible HTML (HowTo schema deprecated Sept 2023) */}

            <SSRCakeDetails
                design={design}
                prices={prices}
                relatedDesigns={relatedDesigns}
            />

            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizationProvider initialData={initialState}>
                    <CustomizingClient
                        recentSearchDesign={design}
                        initialPrices={prices}
                        relatedDesigns={relatedDesigns}
                        currentKeywords={design.keywords}
                        currentSlug={slug}
                        seoContentSlot={
                            generateDesignDetails(design, prices) ? (
                                <div className="mb-3">
                                    <h2 className="text-sm font-semibold text-slate-700 mb-2">About This {design.keywords || 'Custom'} Cake</h2>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        {generateDesignDetails(design, prices)}
                                    </p>
                                    <p className="text-xs text-red-400 mt-4 flex items-center justify-center gap-1.5 text-center">
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Design inspiration shared by customer for pricing—final cake may vary slightly.
                                    </p>
                                </div>
                            ) : undefined
                        }
                    />
                </CustomizationProvider>
            </Suspense>

            {/* Persistent SEO content — always visible to both users and Googlebot */}
            <SSRDesignContent design={design} prices={prices} />
        </>
    )
}

