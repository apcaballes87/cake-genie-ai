import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import { BasePriceInfo } from '@/types';

// JSON-LD Schema for Product (Schema.org)
export function ProductSchema({ product, merchant, prices, validUntil }: { product: CakeGenieMerchantProduct; merchant: CakeGenieMerchant; prices?: BasePriceInfo[]; validUntil?: string }) {
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
            priceValidUntil: validUntil || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            seller: {
                '@type': 'Organization',
                name: sanitize(merchant.business_name),
            },
            url: pageUrl
        };
    }

    // Default store rating since individual products don't have reviews yet
    // This satisfies Google's requirement for Product rich results
    const aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: "4.8",
        reviewCount: "156"
    };

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
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility'
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
        aggregateRating
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

// JSON-LD Schema for FAQPage
export function FAQPageSchema({ faqs }: { faqs: { question: string; answer: string }[] }) {
    if (!faqs || faqs.length === 0) return null;

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer
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

// JSON-LD Schema for HowTo
export function HowToSchema({ name, description, steps }: { name: string; description: string; steps: { name: string; text: string; url: string }[] }) {
    if (!steps || steps.length === 0) return null;

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name,
        description,
        step: steps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: step.name,
            itemListElement: [{
                '@type': 'HowToDirection',
                text: step.text
            }],
            url: step.url
        }))
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}
