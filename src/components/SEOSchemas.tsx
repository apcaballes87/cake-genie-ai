import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import { BasePriceInfo } from '@/types';
import {
    buildCustomCakeAdditionalProperties,
    buildMerchantCenterCustomLabels,
    buildMerchantCenterDescription,
    buildMerchantReturnPolicy,
    buildOfferShippingDetails,
    getCommercePolicyUrls,
    getMerchantListingActivePrice,
    getMerchantListingNote,
    getMerchantCenterGoogleProductCategory,
    mapDesignAvailabilityToSchema,
} from '@/lib/commerce/machineReadable';
import { buildPositiveAggregateRating } from '@/lib/seo/aggregateRating';
import { buildLicensedImageObject, isPublicHttpImageUrl } from '@/lib/seo/crawlerImage';

// JSON-LD Schema for Product (Schema.org)
export function ProductSchema({ product, merchant, prices, ratingValue, reviewCount, imageWidth, imageHeight }: { product: CakeGenieMerchantProduct; merchant: CakeGenieMerchant; prices?: BasePriceInfo[]; ratingValue?: string; reviewCount?: string; imageWidth?: number | null; imageHeight?: number | null }) {
    // Sanitize string to prevent script injection in JSON-LD
    const sanitize = (str: string | undefined | null) => str ? str.replace(/<\/script/g, '<\\/script') : '';
    const pageUrl = `https://genie.ph/shop/${merchant.slug}/${product.slug}`;
    const policyUrls = getCommercePolicyUrls();
    const customLabels = buildMerchantCenterCustomLabels({
        availability: product.availability,
        merchantCity: merchant.city,
        cakeType: product.cake_type,
        uploadAssisted: Boolean(product.p_hash),
        madeToOrder: product.availability === 'made_to_order' || product.availability === 'preorder',
    });

    // Calculate generic availability
    const availability = mapDesignAvailabilityToSchema(product.availability);

    // Calculate priceValidUntil as 1 year from now (clearer approach)
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const priceValidUntil = nextYear.toISOString().split('T')[0];

    const activePrice = getMerchantListingActivePrice(prices, product.custom_price || null);

    const offers = {
        '@type': 'Offer',
        ...(activePrice !== null ? { price: activePrice } : {}),
        ...(activePrice !== null ? {
            priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: activePrice,
                priceCurrency: 'PHP',
            }
        } : {}),
        priceCurrency: 'PHP',
        availability: availability,
        itemCondition: 'https://schema.org/NewCondition',
        priceValidUntil: priceValidUntil,
        seller: {
            '@type': 'Organization',
            name: sanitize(merchant.business_name),
            url: `https://genie.ph/shop/${merchant.slug}`,
        },
        url: pageUrl
    };

    // Only include aggregateRating when real review data is provided.
    // Hardcoded/fake ratings risk a manual action from Google for misleading structured data.
    const aggregateRating = buildPositiveAggregateRating(ratingValue, reviewCount);

    // Enhanced ImageObject with licensing metadata for Google Images "Licensable" badge
    const imageObject = product.image_url ? buildLicensedImageObject({
        url: product.image_url,
        width: imageWidth || 1200,
        height: imageHeight || 1200,
        name: sanitize(product.title),
        caption: sanitize(product.alt_text || product.title),
        creatorName: sanitize(merchant.business_name),
        representativeOfPage: true,
    }) || undefined : undefined;

    // Standard Shipping Details (Placeholder for now as dynamic calculation isn't available here)
    const shippingDetails = buildOfferShippingDetails(merchant);

    // Merchant Return Policy (No Returns for Perishable Custom Goods)
    const returnPolicy = buildMerchantReturnPolicy();

    // Update offers with new merchant listing properties
    const enhancedOffers = offers ? {
        ...offers,
        hasMerchantReturnPolicy: returnPolicy,
        shippingDetails: shippingDetails
    } : undefined;

    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': pageUrl, // Unique ID to link with WebPage
        url: pageUrl, // Explicit URL property
        name: sanitize(product.title),
        description: sanitize(buildMerchantCenterDescription(product, merchant)),
        image: imageObject ? [imageObject] : [],
        brand: {
            '@type': 'Brand',
            name: sanitize(product.brand || merchant.business_name),
        },
        category: sanitize(product.category || 'Cakes'),
        additionalProperty: buildCustomCakeAdditionalProperties({
            cakeType: product.cake_type,
            availability: product.availability,
            sizeLabel: prices?.[0]?.size || null,
            merchantName: merchant.business_name,
            selectedDesignSource: product.p_hash ? 'merchant_product' : null,
            uploadAssisted: Boolean(product.p_hash),
        }),
        ...(product.sku && { sku: sanitize(product.sku) }),
        ...(product.gtin && { gtin: sanitize(product.gtin) }),
        itemCondition: 'https://schema.org/NewCondition',
        offers: enhancedOffers,
        subjectOf: [
            { '@type': 'WebPage', name: 'Delivery rates', url: policyUrls.deliveryRates },
            { '@type': 'WebPage', name: 'Return policy', url: policyUrls.returnPolicy },
            { '@type': 'WebPage', name: 'Customer reviews', url: policyUrls.reviews },
        ],
        ...(aggregateRating && { aggregateRating })
    };

    // WebPage schema with explicit primaryImageOfPage signal
    const webPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: sanitize(product.title),
        mainEntity: {
            '@id': pageUrl
        },
        isPartOf: {
            '@type': 'CollectionPage',
            '@id': `https://genie.ph/shop/${merchant.slug}`,
            url: `https://genie.ph/shop/${merchant.slug}`,
        },
        ...(imageObject && { primaryImageOfPage: { ...imageObject, representativeOfPage: true } }),
        ...(imageObject && { thumbnailUrl: imageObject.contentUrl })
    };

    const merchantSchema = {
        '@context': 'https://schema.org',
        '@type': 'Bakery',
        '@id': `https://genie.ph/shop/${merchant.slug}#merchant`,
        name: sanitize(merchant.business_name),
        url: `https://genie.ph/shop/${merchant.slug}`,
        areaServed: merchant.city ? {
            '@type': 'City',
            name: sanitize(merchant.city),
        } : {
            '@type': 'Country',
            name: 'Philippines',
        },
        makesOffer: {
            '@id': pageUrl,
        },
        hasMerchantReturnPolicy: {
            ...returnPolicy,
            url: policyUrls.returnPolicy,
        },
        subjectOf: [
            { '@type': 'WebPage', url: policyUrls.deliveryRates, name: 'Delivery rates and covered areas' },
            { '@type': 'WebPage', url: policyUrls.reviews, name: 'Customer reviews' },
        ],
        description: sanitize(getMerchantListingNote(merchant)),
    };

    const merchantCenterHintsSchema = {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        '@id': `${pageUrl}#merchant-center-hints`,
        name: 'Merchant Center Export Hints',
        hasDefinedTerm: [
            { '@type': 'DefinedTerm', name: 'google_product_category', termCode: getMerchantCenterGoogleProductCategory() },
            { '@type': 'DefinedTerm', name: 'custom_label_0', termCode: customLabels.customLabel0 },
            { '@type': 'DefinedTerm', name: 'custom_label_1', termCode: customLabels.customLabel1 },
            { '@type': 'DefinedTerm', name: 'custom_label_2', termCode: customLabels.customLabel2 },
            { '@type': 'DefinedTerm', name: 'custom_label_3', termCode: customLabels.customLabel3 },
            { '@type': 'DefinedTerm', name: 'custom_label_4', termCode: customLabels.customLabel4 },
        ],
    };

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
                name: 'Shop',
                item: 'https://genie.ph/shop',
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: sanitize(merchant.business_name),
                item: `https://genie.ph/shop/${merchant.slug}`,
            },
            {
                '@type': 'ListItem',
                position: 4,
                name: sanitize(product.title),
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
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(merchantSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(merchantCenterHintsSchema) }}
            />
        </>
    );
}

// RESTRICTED: FAQPage schema is restricted to government and healthcare authority sites only (August 2023).
// Using it on e-commerce sites risks a manual action from Google.
// See: https://developers.google.com/search/docs/appearance/structured-data/faqpage
// Use visible HTML <details>/<summary> accordions instead for FAQ content.
/** @deprecated FAQPage restricted to government/healthcare sites (Aug 2023). Use HTML accordions instead. */
export function FAQPageSchema({ faqs }: { faqs: { question: string; answer: string }[] }) {
    // Returns null — FAQPage schema restricted to government/healthcare only
    return null;
}

// DEPRECATED: HowTo schema was deprecated by Google in September 2023.
// Rich results are no longer generated for HowTo markup.
// Keeping export signature for backward compatibility but rendering nothing.
// See: https://developers.google.com/search/docs/appearance/structured-data/how-to
/** @deprecated HowTo rich results removed by Google September 2023. Use visible HTML steps instead. */
export function HowToSchema({ name, description, steps }: { name: string; description: string; steps: { name: string; text: string; url: string }[] }) {
    // Returns null — HowTo schema no longer generates rich results
    return null;
}

// JSON-LD Schema for BlogPosting
// Spec: https://developers.google.com/search/docs/appearance/structured-data/article
// - image: prefer multiple aspect ratios (16x9, 4x3, 1x1) on a property we own.
// - License/copyright fields are only emitted when the image is hosted on a
//   domain we control to avoid claiming ownership over third-party images.
const OWNED_IMAGE_HOSTS = ['genie.ph', 'cqmhanqnfybyxezhobkx.supabase.co'];

function isOwnedImage(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return OWNED_IMAGE_HOSTS.some((owned) => host === owned || host.endsWith(`.${owned}`));
    } catch {
        return false;
    }
}

export function BlogPostingSchema({
    headline,
    datePublished,
    dateModified,
    authorName,
    authorUrl,
    image,
    imageWidth,
    imageHeight,
    imageAlt,
    description,
    url
}: {
    headline: string;
    datePublished: string;
    dateModified?: string;
    authorName: string;
    authorUrl?: string;
    /** Single image URL or array of image URLs (Google recommends multiple aspect ratios: 16x9, 4x3, 1x1). */
    image?: string | string[];
    /** Width of the primary image (only applied to the first image when an array is provided). */
    imageWidth?: number;
    /** Height of the primary image (only applied to the first image when an array is provided). */
    imageHeight?: number;
    imageAlt?: string;
    description: string;
    url?: string;
}) {
    // Sanitize string to prevent script injection in JSON-LD
    const sanitize = (str: string | undefined | null) => str ? str.replace(/<\/script/g, '<\\/script') : '';

    const imageUrls = (Array.isArray(image) ? image.filter(Boolean) : (image ? [image] : []))
        .filter(isPublicHttpImageUrl);

    const imageObjects = imageUrls.map((src, index) => {
        const owned = isOwnedImage(src);
        if (owned) {
            return buildLicensedImageObject({
                url: src,
                name: sanitize(imageAlt || headline),
                caption: sanitize(imageAlt || headline),
                width: index === 0 ? imageWidth : null,
                height: index === 0 ? imageHeight : null,
                representativeOfPage: index === 0,
            });
        }

        return {
            '@type': 'ImageObject',
            url: src,
            contentUrl: src,
            ...(index === 0 && imageWidth ? { width: imageWidth } : {}),
            ...(index === 0 && imageHeight ? { height: imageHeight } : {}),
            caption: sanitize(imageAlt || headline),
            representativeOfPage: index === 0,
        };
    }).filter(Boolean);

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: sanitize(headline),
        datePublished: datePublished,
        ...(dateModified && { dateModified }),
        author: {
            '@type': 'Person',
            name: sanitize(authorName),
            ...(authorUrl && { url: sanitize(authorUrl) })
        },
        ...(imageObjects.length > 0 && { image: imageObjects }),
        description: sanitize(description),
        ...(url && {
            url: sanitize(url),
            mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': sanitize(url)
            }
        }),
        publisher: {
            '@type': 'Organization',
            name: 'Genie.ph',
            logo: {
                '@type': 'ImageObject',
                url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp'
            }
        }
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

// JSON-LD Breadcrumb Schema for Blog Posts
export function BlogBreadcrumbSchema({ postTitle, postSlug }: { postTitle: string; postSlug: string }) {
    const sanitize = (str: string) => str.replace(/<\/script/g, '<\\/script');

    const schema = {
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
                name: 'Blog',
                item: 'https://genie.ph/blog',
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: sanitize(postTitle),
                item: `https://genie.ph/blog/${postSlug}`,
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

// JSON-LD Schema for Blog Listing
export function BlogSchema({ posts }: { posts: { title: string; slug: string; date: string; excerpt: string; author: string; authorUrl?: string }[] }) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Genie.ph Blog',
        description: 'Guides, tips, and helpful articles for your special celebrations.',
        url: 'https://genie.ph/blog',
        publisher: {
            '@type': 'Organization',
            name: 'Genie.ph',
            logo: {
                '@type': 'ImageObject',
                url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp'
            }
        },
        blogPost: posts.map(post => ({
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            datePublished: post.date,
            author: {
                '@type': 'Organization',
                name: post.author,
                ...(post.authorUrl && { url: post.authorUrl })
            },
            url: `https://genie.ph/blog/${post.slug}`,
            mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': `https://genie.ph/blog/${post.slug}`
            }
        }))
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}
