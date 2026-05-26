import { Metadata, ResolvingMetadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CustomizingClient from '../CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getCakeBasePriceOptions, getRelatedProductsByKeywords, getCollectionForDesignKeyword } from '@/services/supabaseService'
import { CakeType, CakeThickness, BasePriceInfo, HybridAnalysisResult, CakeInfoUI } from '@/types'
import { CustomizationProvider, CustomizationState } from '@/contexts/CustomizationContext'
// FAQPageSchema deprecated (restricted to gov/healthcare Aug 2023) — using HTML accordions instead
import { DesignAboutSection } from '@/components/DesignAboutSection'
import LazyImage from '@/components/LazyImage'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { mapAnalysisToState, mapProductToDefaultState } from '@/utils/customizationMapper'
import { upgradeLegacySlug, downgradeCakeSlug } from '@/lib/utils/urlHelpers'
import { generateDesignDetails, generateDynamicFAQ, generateRichAltText } from '@/utils/designContentUtils'
import {
    buildCustomCakeAdditionalProperties,
    buildMerchantReturnPolicy,
    buildOfferShippingDetails,
    getCommercePolicyUrls,
    getLeadTimeLabel,
    getMerchantListingActivePrice,
    mapDesignAvailabilityToSchema,
} from '@/lib/commerce/machineReadable'

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

const firstNonBlankImageUrl = (...urls: unknown[]) => {
    for (const url of urls) {
        if (typeof url === 'string' && url.trim()) {
            return url.trim();
        }
    }

    return null;
};

type DesignWithHeroImageUrls = {
    original_image_url?: string | null;
    studio_edited_image_url?: string | null;
};

const withPreferredHeroImage = <T extends DesignWithHeroImageUrls>(design: T): T => ({
    ...design,
    original_image_url: firstNonBlankImageUrl(
        design.studio_edited_image_url,
        design.original_image_url,
    ),
});

type LinkedMerchantProduct = {
    product_id: string;
    title: string;
    slug: string;
    custom_price: number | null;
    availability: string;
    merchant_id: string;
    merchant_name: string;
    merchant_slug: string;
    merchant_city: string | null;
};

const getLinkedMerchantProductsByHash = cache(async (pHash: string | null | undefined): Promise<LinkedMerchantProduct[]> => {
    if (!pHash) return [];

    const supabase = await createClient();
    const { data: products, error } = await supabase
        .from('cakegenie_merchant_products')
        .select('product_id, title, slug, custom_price, availability, merchant_id')
        .eq('p_hash', pHash)
        .eq('is_active', true)
        .limit(5);

    if (error || !products || products.length === 0) {
        return [];
    }

    const merchantIds = [...new Set(products.map(product => product.merchant_id).filter(Boolean))];
    const { data: merchants } = await supabase
        .from('cakegenie_merchants')
        .select('merchant_id, business_name, slug, city')
        .in('merchant_id', merchantIds)
        .eq('is_active', true);

    const merchantMap = new Map(
        (merchants || []).map((merchant) => [merchant.merchant_id, merchant]),
    );

    return products
        .map((product) => {
            const merchant = merchantMap.get(product.merchant_id);
            if (!merchant) return null;

            return {
                product_id: product.product_id,
                title: product.title,
                slug: product.slug,
                custom_price: product.custom_price,
                availability: product.availability,
                merchant_id: product.merchant_id,
                merchant_name: merchant.business_name,
                merchant_slug: merchant.slug,
                merchant_city: merchant.city,
            };
        })
        .filter((product): product is LinkedMerchantProduct => Boolean(product));
});

/**
 * Detects whether a description is generic or templated.
 */
const isGenericDescription = (desc: string | null | undefined): boolean => {
    if (!desc) return true;
    const d = desc.toLowerCase().trim();
    if (d.includes('get instant pricing for this') && d.includes('genie.ph')) return true;
    if (d.includes('get the price of any cake instantly')) return true;
    if (d.includes('customize and order at genie.ph')) return true;
    return false;
};

/**
 * Resolves the richest, most unique visual description available for a design,
 * falling back to high-fidelity prose generation.
 */
const resolveRichDescription = (design: any, prices?: BasePriceInfo[]): string => {
    const rawDesc = design.seo_description || '';
    if (!isGenericDescription(rawDesc)) {
        return rawDesc;
    }
    
    if (design.analysis_json) {
        return generateDesignDetails(design, prices);
    }
    
    if (design.alt_text) {
        return design.alt_text;
    }
    
    const keywords = design.keywords || 'custom';
    const tags = design.tags || [];
    const tagsPrefix = tags.length > 0 ? tags.slice(0, 2).map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ') + ' ' : '';
    return `Customize this ${tagsPrefix}${keywords} cake design on Genie.ph. Get instant pricing from local bakers in Cebu and Cavite.`;
};

/**
 * Truncates a string to a maximum length at a word boundary, appending '...' if truncated.
 */
function truncateToWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    // Find last space before maxLength - 3 (to account for '...')
    const truncated = text.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
        return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
}

/**
 * Optimizes a long metadata description by:
 * 1. Stripping repetitive boilerplate sentences (like CTAs and Genie.ph brand mentions).
 * 2. Keeping the highly descriptive, unique product details.
 * 3. Truncating to fit ~150-155 characters.
 * 4. Appending a concise price-actionable call-to-action for high CTR in SERPs.
 */
function optimizeMetaDescription(descriptionText: string, price: number | null): string {
    if (!descriptionText) return '';

    // Split sentences using dot + optional spaces
    const sentences = descriptionText.split(/(?<=\.)\s+/);
    
    // Filter out standard repetitive boilerplates
    const filteredSentences = sentences.filter(sentence => {
        const s = sentence.toLowerCase().trim();
        if (s.includes('genie.ph') || s.includes('genie\.ph')) return false;
        if (s.includes('delivery in cebu') || s.includes('delivery in cavite')) return false;
        if (s.includes('order your') && s.includes('today')) return false;
        if (s.includes('order custom') && s.includes('today')) return false;
        if (s.includes('order your dream') && s.includes('today')) return false;
        if (s.includes('get instant') && s.includes('pricing')) return false;
        if (s.includes('instant ai pricing')) return false;
        return true;
    });

    let uniqueText = filteredSentences.join(' ').trim();
    
    // Fallback if the clean process left nothing or too little
    if (uniqueText.length < 15) {
        uniqueText = descriptionText.trim();
    }

    const finalPrice = (price && price > 0) ? Math.round(price) : FALLBACK_MIN_PRICE;
    const suffix = ` | Price starts at ₱${finalPrice.toLocaleString()}. Customize now!`;
    
    // Total max is 155 for high assurance against SERP truncation
    const maxUniqueLength = 155 - suffix.length;
    
    const truncatedUnique = truncateToWordBoundary(uniqueText, maxUniqueLength);
    
    return `${truncatedUnique}${suffix}`;
}

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

    if (cacheData) return withPreferredHeroImage(cacheData);

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

        return withPreferredHeroImage({
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
        })
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
    // Ensure title always contains "Cake Design" for image search matching
    // Filipino users frequently search "{theme} cake design" or "{theme} cake design with price"
    const hasCakeDesignKeyword = baseSeoTitle && /cake\s*design/i.test(baseSeoTitle);
    const endsWithCake = baseSeoTitle && /cake\s*$/i.test(baseSeoTitle);
    const cakeDesignSuffix = hasCakeDesignKeyword ? '' : endsWithCake ? ' Design' : ' Cake Design';
    const title = baseSeoTitle
        ? `${baseSeoTitle}${cakeDesignSuffix}${priceDisplay ? ` with Price${priceDisplay}` : ''}`
        : `${tagsPrefix}${design.keywords || 'Custom'} Cake Design with Price${priceDisplay}`

    // Description with rich fallback chain:
    // 1. Use seo_description if available (unless it's generic/templated)
    // 2. Build from rich organic generateDesignDetails if analysis_json is available
    // 3. Alt-text fallback
    // 4. Generic fallback
    const rawDescription = resolveRichDescription(design);

    // Optimize description to strip boilerplate, target correct length and inject price CTR signals
    const description = optimizeMetaDescription(rawDescription, design.price);

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
            // Uses generateRichAltText so short/generic stored values get upgraded
            'og:image:alt': generateRichAltText(design),
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
    const policyUrls = getCommercePolicyUrls();

    const schemaDescription = resolveRichDescription(design, prices);
    const sanitizedDesc = sanitize(schemaDescription);

    // Detect MIME type from URL extension — 82% of stored images are .jpg (JPEG),
    // the remainder are .webp. Hardcoding 'image/webp' was incorrect for most pages.
    const detectMimeType = (url: string): string => {
        const path = url.split('?')[0].toLowerCase();
        if (path.endsWith('.webp')) return 'image/webp';
        if (path.endsWith('.png')) return 'image/png';
        return 'image/jpeg'; // .jpg / .jpeg / fallback
    };

    // ImageObject for better image indexing — includes licensing metadata for Google Images "Licensable" badge
    const imageObject = imageUrl ? {
        '@type': 'ImageObject',
        url: imageUrl,
        contentUrl: imageUrl,
        ...(design.image_width && { width: design.image_width }),
        ...(design.image_height && { height: design.image_height }),
        encodingFormat: detectMimeType(imageUrl),
        name: sanitize(generateRichAltText(design)),
        caption: sanitizedDesc,
        creditText: 'Genie.ph',
        creator: {
            '@type': 'Organization',
            name: 'Genie.ph'
        },
        copyrightHolder: {
            '@type': 'Organization',
            name: 'Genie.ph'
        },
        license: 'https://genie.ph/terms',
        acquireLicensePage: 'https://genie.ph/terms#image-licensing',
        copyrightNotice: '© ' + new Date().getFullYear() + ' Genie.ph',
        representativeOfPage: false
    } : null;

    const shippingDetails = buildOfferShippingDetails();

    // Merchant Return Policy (No Returns)
    const returnPolicy = buildMerchantReturnPolicy();

    // Use end of current year for stable schema (avoids changing on every render)
    const priceValidUntil = `${new Date().getFullYear()}-12-31`;
    const productMpn = design.p_hash || design.slug;
    const availability = mapDesignAvailabilityToSchema(design.availability);
    const activePrice = getMerchantListingActivePrice(
        prices,
        (design.price && design.price > 0) ? design.price : FALLBACK_MIN_PRICE,
    );

    const offers = {
        '@type': 'Offer',
        ...(activePrice !== null ? { price: Math.round(activePrice).toString() } : {}),
        ...(activePrice !== null ? {
            priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: Math.round(activePrice),
                priceCurrency: 'PHP',
            }
        } : {}),
        priceCurrency: 'PHP',
        availability: availability,
        itemCondition: 'https://schema.org/NewCondition',
        priceValidUntil: priceValidUntil,
        sku: productMpn,
        mpn: productMpn,
        seller: {
            '@type': 'Organization',
            name: 'Genie.ph',
            url: 'https://genie.ph',
        },
        url: pageUrl,
        shippingDetails: shippingDetails,
        hasMerchantReturnPolicy: returnPolicy
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
        description: sanitizedDesc,
        image: schemaImage,
        brand: {
            '@type': 'Brand',
            name: 'Genie.ph'
        },
        offers: offers,
        category: 'Custom Cakes',
        additionalProperty: buildCustomCakeAdditionalProperties({
            cakeType: design.analysis_json?.cakeType || null,
            availability: design.availability || null,
            sizeLabel: prices?.[0]?.size || null,
            merchantName: 'Genie.ph',
            selectedDesignSource: design.isSharedDesign ? 'shared_design' : 'analysis_cache',
            uploadAssisted: true,
        }),
        // Link to the AI engine that analyzed this design
        subjectOf: [
            {
                '@type': 'SoftwareApplication',
                name: 'Genie.ph AI Cake Price Calculator',
                url: 'https://genie.ph/cake-price-calculator',
                applicationCategory: 'BusinessApplication'
            },
            { '@type': 'WebPage', name: 'Delivery rates', url: policyUrls.deliveryRates },
            { '@type': 'WebPage', name: 'Return policy', url: policyUrls.returnPolicy },
            { '@type': 'WebPage', name: 'Customer reviews', url: policyUrls.reviews },
        ],
        ...(design.alt_text && { 'alternateName': sanitize(design.alt_text) })
    };

    // WebPage schema with primaryImageOfPage - explicit signal for Google image thumbnails
    // Uses @id reference to link to the Product schema instead of creating a duplicate
    const webPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'ItemPage',
        name: sanitize(title),
        description: sanitizedDesc,
        url: pageUrl,
        mainEntity: {
            '@id': pageUrl // Reference the Product by URL instead of duplicating
        },
        isPartOf: {
            '@type': 'CollectionPage',
            '@id': 'https://genie.ph/customizing',
            url: 'https://genie.ph/customizing',
        },
        ...(imageObject && { primaryImageOfPage: { ...imageObject, representativeOfPage: true } }),
        ...(imageUrl && { thumbnailUrl: imageUrl })
    };

    const commerceFactsSchema = {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        '@id': `${pageUrl}#custom-cake-commerce-facts`,
        name: 'Custom Cake Commerce Facts',
        hasDefinedTerm: [
            { '@type': 'DefinedTerm', name: 'lead_time', termCode: getLeadTimeLabel(design.availability) || 'advance-order' },
            { '@type': 'DefinedTerm', name: 'return_policy', termCode: policyUrls.returnPolicy },
            { '@type': 'DefinedTerm', name: 'delivery_rates', termCode: policyUrls.deliveryRates },
        ],
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
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(commerceFactsSchema).replace(/</g, '\\u003c') }}
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
function SSRCakeDetails({
    design,
    prices,
    relatedDesigns,
    captionText,
    linkedMerchantProducts,
    themeCollection,
}: {
    design: any;
    prices?: BasePriceInfo[];
    relatedDesigns?: any[];
    captionText?: string;
    linkedMerchantProducts?: LinkedMerchantProduct[];
    themeCollection?: { slug: string; name: string; item_count: number } | null;
}) {
    const keywords = design.keywords || 'Custom';
    const analysis = design.analysis_json || {};
    const policyUrls = getCommercePolicyUrls();

    // Clean title: use keywords + "Cake Design" if seo_title is missing
    // Always include "Cake Design" — matches what Filipino users search in Google Images
    const rawTitle = (design.seo_title || `${keywords} Cake Design`).replace(/\s*\|\s*Genie\.ph\s*$/i, '');
    const title = /cake\s*design/i.test(rawTitle) ? rawTitle : /cake\s*$/i.test(rawTitle) ? `${rawTitle} Design` : `${rawTitle} Cake Design`;
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
                            {altText} — {captionText}
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

                    {/* Title — h1 for clean initial DOM crawler outline; client-rendered header conditionalized to prevent duplication */}
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
                                        &quot;{msg.text || 'Custom message'}&quot;
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
                            <p className="mt-2 text-sm text-slate-600">
                                {getLeadTimeLabel(design.availability) || 'Made-to-order custom cake'}.
                                Delivery and pickup availability depend on service area, branch coverage, and order timing.
                            </p>
                        </div>
                    )}

                    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h2 className="text-sm font-semibold text-slate-700">Ordering & policy details</h2>
                        <ul className="space-y-2 text-sm text-slate-600">
                            <li>
                                Delivery coverage and fees:
                                {' '}
                                <Link href={policyUrls.deliveryRates.replace('https://genie.ph', '')} className="font-medium text-purple-700 hover:text-purple-800">
                                    see covered areas and rates
                                </Link>
                            </li>
                            <li>
                                Custom cakes are perishable and made to order:
                                {' '}
                                <Link href={policyUrls.returnPolicy.replace('https://genie.ph', '')} className="font-medium text-purple-700 hover:text-purple-800">
                                    review the return and cancellation policy
                                </Link>
                            </li>
                            <li>
                                Buyer trust and social proof:
                                {' '}
                                <Link href={policyUrls.reviews.replace('https://genie.ph', '')} className="font-medium text-purple-700 hover:text-purple-800">
                                    browse Genie.ph customer reviews
                                </Link>
                            </li>
                        </ul>
                    </section>

                    {linkedMerchantProducts && linkedMerchantProducts.length > 0 && (
                        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                            <h2 className="text-sm font-semibold text-slate-700">Available from partner bakeries</h2>
                            <p className="text-sm text-slate-600">
                                This design is also linked to merchant product pages with cleaner pricing, review, and checkout signals.
                            </p>
                            <ul className="space-y-2">
                                {linkedMerchantProducts.map((product) => (
                                    <li key={product.product_id} className="rounded-lg border border-slate-200 px-3 py-2">
                                        <Link
                                            href={`/shop/${product.merchant_slug}/${product.slug}`}
                                            className="font-medium text-purple-700 hover:text-purple-800"
                                        >
                                            {product.title} at {product.merchant_name}
                                        </Link>
                                        <p className="text-xs text-slate-500">
                                            {product.custom_price ? `Starts at ₱${Math.round(product.custom_price).toLocaleString()}` : 'Custom pricing available'}
                                            {' • '}
                                            {product.merchant_city || 'Philippines'}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </section>
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

                    {/* Theme Collection CTA - sends Google + users to the gallery
                        page for broad "{theme} cake design" queries instead of
                        ranking this single variant for them. */}
                    {themeCollection && (
                        <div className="pt-4 border-t border-slate-200">
                            <Link
                                href={`/collections/${themeCollection.slug}`}
                                className="flex items-center justify-between gap-3 rounded-lg border border-pink-200 bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700 hover:border-pink-300 hover:bg-pink-100 transition-colors"
                                aria-label={`See all ${themeCollection.item_count} ${themeCollection.name} designs`}
                            >
                                <span>
                                    See all {themeCollection.item_count} {themeCollection.name} designs
                                </span>
                                <span aria-hidden="true">→</span>
                            </Link>
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
                                                style={{ backgroundImage: `url(/api/proxy-image?url=${encodeURIComponent(related.original_image_url)})` }}
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
    const designDetails = resolveRichDescription(design, prices);
    const dynamicFAQs = generateDynamicFAQ(design, prices);
    const keywords = design.keywords || 'Custom';
    const tags = design.tags || [];
    const analysis = design.analysis_json || {};

    return (
        <div className="w-full pb-4 pt-1 space-y-1">
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
    let linkedMerchantProducts: LinkedMerchantProduct[] = [];
    let themeCollection: { slug: string; name: string; item_count: number } | null = null;
    const supabase = await createClient();
    const [pricesResult, relatedDesignsResult, linkedProductsResult, ratingRowsResult, themeCollectionResult] = await Promise.allSettled([
        getCakeBasePriceOptions(seoCakeType, CAKE_TYPE_THICKNESS_MAP[seoCakeType] || '4 in'),
        getRelatedProductsByKeywords(design.keywords, slug, 6, 0),
        getLinkedMerchantProductsByHash(design.p_hash),
        supabase
            .from('cakegenie_reviews')
            .select('rating')
            .eq('is_visible', true)
            .eq('is_approved', true),
        getCollectionForDesignKeyword(design.keywords)
    ]);

    if (pricesResult.status === 'fulfilled') {
        prices = pricesResult.value;
    } else {
        console.error('Error fetching SEO prices:', pricesResult.reason);
    }

    if (relatedDesignsResult.status === 'fulfilled') {
        relatedDesigns = (relatedDesignsResult.value.data || []).map(withPreferredHeroImage);
    } else {
        console.error('Error fetching related designs:', relatedDesignsResult.reason);
    }

    if (linkedProductsResult.status === 'fulfilled') {
        linkedMerchantProducts = linkedProductsResult.value;
    } else {
        console.error('Error fetching linked merchant products:', linkedProductsResult.reason);
    }

    let reviewSummary = { total: 6, averageRating: 4.8 };
    if (ratingRowsResult.status === 'fulfilled' && ratingRowsResult.value.data) {
        const ratingRows = ratingRowsResult.value.data;
        const total = ratingRows.length || 0;
        const averageRating = total > 0
            ? ratingRows.reduce((sum: number, r: any) => sum + r.rating, 0) / total
            : 4.8;
        reviewSummary = { total, averageRating };
    }

    if (themeCollectionResult.status === 'fulfilled' && themeCollectionResult.value.data) {
        themeCollection = themeCollectionResult.value.data;
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
        const getFlavorCount = (type: CakeType): number => {
            if (!type) return 1;
            if (type.includes('2 Tier')) return 2;
            if (type.includes('3 Tier')) return 3;
            return 1;
        };
        const flavorCount = getFlavorCount(cakeType);
        const defaultCakeInfo: CakeInfoUI = {
            type: cakeType,
            thickness: analysis.cakeThickness || CAKE_TYPE_THICKNESS_MAP[cakeType] || '3 in',
            flavors: Array(flavorCount).fill('Chocolate Cake'), // Default flavor array based on tier count
            size: '6" Round' // Default size, ideally mapped from type
        };

        const mappedState = mapAnalysisToState(analysis as HybridAnalysisResult);

        initialState = {
            ...mappedState,
            cakeInfo: mappedState.cakeInfo || defaultCakeInfo,
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

            {/* Preload hero image for faster LCP */}
            {design.original_image_url && (
                <link
                    rel="preload"
                    as="image"
                    href={design.original_image_url}
                    fetchPriority="high"
                />
            )}

            <SSRCakeDetails
                design={design}
                prices={prices}
                relatedDesigns={relatedDesigns}
                captionText={captionText}
                linkedMerchantProducts={linkedMerchantProducts}
                themeCollection={themeCollection}
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
                        hideAiChat={false}
                        enableMobileHeroPan={true}
                        reviewSummary={reviewSummary}
                    />
                </CustomizationProvider>
            </Suspense>
            <LandingFooter reviewSummary={reviewSummary} />
        </>
    )
}
