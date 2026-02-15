import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import { BasePriceInfo } from '@/types';

// JSON-LD Schema for Product (Schema.org)
export function ProductSchema({ product, merchant, prices, ratingValue, reviewCount }: { product: CakeGenieMerchantProduct; merchant: CakeGenieMerchant; prices?: BasePriceInfo[]; ratingValue?: string; reviewCount?: string }) {
    // Sanitize string to prevent script injection in JSON-LD
    const sanitize = (str: string | undefined | null) => str ? str.replace(/<\/script/g, '<\\/script') : '';
    const pageUrl = `https://genie.ph/shop/${merchant.slug}/${product.slug}`;

    // Calculate generic availability
    const availability = product.availability === 'in_stock'
        ? 'https://schema.org/InStock'
        : product.availability === 'preorder'
            ? 'https://schema.org/PreOrder'
            : product.availability === 'made_to_order'
                ? 'https://schema.org/MadeToOrder'
                : 'https://schema.org/OutOfStock';

    let offers;

    if (prices && prices.length > 0) {
        // Find min and max prices
        const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
        const lowPrice = sortedPrices[0].price;
        const highPrice = sortedPrices[sortedPrices.length - 1].price;

        offers = {
            '@type': 'AggregateOffer',
            lowPrice: lowPrice,
            highPrice: highPrice,
            priceCurrency: 'PHP',
            offerCount: prices.length,
            availability: availability,
            itemCondition: 'https://schema.org/NewCondition',
            seller: {
                '@type': 'Organization',
                name: sanitize(merchant.business_name),
            },
            url: pageUrl
        };
    } else {
        // Fallback to single offer
        offers = {
            '@type': 'Offer',
            price: product.custom_price || 0,
            priceCurrency: 'PHP',
            availability: availability,
            itemCondition: 'https://schema.org/NewCondition',
            priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            seller: {
                '@type': 'Organization',
                name: sanitize(merchant.business_name),
            },
            url: pageUrl
        };
    }

    // Only include aggregateRating when real review data is provided.
    // Hardcoded/fake ratings risk a manual action from Google for misleading structured data.
    const aggregateRating = (ratingValue && reviewCount) ? {
        '@type': 'AggregateRating',
        ratingValue,
        reviewCount
    } : undefined;

    // Enhanced ImageObject
    const imageObject = product.image_url ? {
        '@type': 'ImageObject',
        url: product.image_url,
        contentUrl: product.image_url,
        width: 1200, // Best practice estimate if actual not valid, or valid if available
        height: 1200,
        caption: sanitize(product.alt_text || product.title),
        creditText: sanitize(merchant.business_name),
        creator: {
            '@type': 'Organization',
            name: sanitize(merchant.business_name)
        }
    } : undefined;

    // Standard Shipping Details (Placeholder for now as dynamic calculation isn't available here)
    const shippingDetails = {
        '@type': 'OfferShippingDetails',
        shippingRate: {
            '@type': 'MonetaryAmount',
            value: 0, // Placeholder or standard rate could be set here
            currency: 'PHP'
        },
        deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 1,
                maxValue: 3,
                unitCode: 'DAY'
            },
            transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 1,
                maxValue: 3,
                unitCode: 'DAY'
            }
        },
        shippingDestination: {
            '@type': 'DefinedRegion',
            addressCountry: 'PH'
        }
    };

    // Merchant Return Policy (No Returns for Perishable Custom Goods)
    const returnPolicy = {
        '@type': 'MerchantReturnPolicy',
        returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
        merchantReturnDays: 0,
        returnMethod: 'https://schema.org/ReturnByMail', // Required even if not permitted sometimes, but safe to include
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
        returnPolicyCountry: 'PH' // Required since March 2025
    };

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
        description: sanitize(product.long_description || product.short_description || `Custom cake from ${merchant.business_name}`),
        image: product.image_url ? [product.image_url] : [],
        brand: {
            '@type': 'Brand',
            name: sanitize(product.brand || merchant.business_name),
        },
        category: sanitize(product.category || 'Cakes'),
        ...(product.sku && { sku: sanitize(product.sku) }),
        ...(product.gtin && { gtin: sanitize(product.gtin) }),
        offers: enhancedOffers,
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
        ...(imageObject && { primaryImageOfPage: imageObject }),
        ...(product.image_url && { thumbnailUrl: product.image_url })
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
export function BlogPostingSchema({
    headline,
    datePublished,
    dateModified,
    authorName,
    image,
    description
}: {
    headline: string;
    datePublished: string;
    dateModified?: string;
    authorName: string;
    image?: string;
    description: string;
}) {
    // Sanitize string to prevent script injection in JSON-LD
    const sanitize = (str: string | undefined | null) => str ? str.replace(/<\/script/g, '<\\/script') : '';

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: sanitize(headline),
        datePublished: datePublished,
        ...(dateModified && { dateModified }),
        author: {
            '@type': 'Organization', // Or Person, but for company blogs Organization is often used if author is the brand
            name: sanitize(authorName)
        },
        image: image ? [image] : [],
        description: sanitize(description),
        publisher: {
            '@type': 'Organization',
            name: 'Genie.ph',
            logo: {
                '@type': 'ImageObject',
                url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp' // Ensure this path is correct or generic
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

// JSON-LD Schema for Blog Listing
export function BlogSchema({ posts }: { posts: { title: string; slug: string; date: string; excerpt: string; author: string }[] }) {
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
                name: post.author
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
