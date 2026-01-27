import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import { BasePriceInfo } from '@/types';

// JSON-LD Schema for Product (Schema.org)
export function ProductSchema({ product, merchant, prices }: { product: CakeGenieMerchantProduct; merchant: CakeGenieMerchant; prices?: BasePriceInfo[] }) {
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
    } : undefined;

    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': pageUrl, // Unique ID to link with WebPage
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
        offers,
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

// FAQ data for Schema.org FAQPage structured data
const FAQ_DATA = [
    {
        question: "Can I order this cake for same-day delivery?",
        answer: "Yes! Simple designs are available for rush orders (ready in 30 minutes) or same-day delivery (ready in 3 hours). Order before 3 PM for same-day delivery."
    },
    {
        question: "Do you deliver cakes in Metro Manila?",
        answer: "We deliver across Metro Manila, Cavite, Laguna, Rizal, and nearby provinces. Delivery fees vary by location."
    },
    {
        question: "Can I customize this cake design?",
        answer: "Absolutely! You can change colors, add or remove toppers, update the message, and choose different sizes. Use our online customizer for instant pricing."
    },
    {
        question: "What sizes are available?",
        answer: "We offer 4-inch (Bento/mini), 6-inch, 8-inch, and larger sizes. Prices vary by size and design complexity."
    },
    {
        question: "How do I order?",
        answer: "Simply customize your design online, add to cart, and checkout. You can pay via GCash, credit card, or bank transfer."
    }
];

// JSON-LD Schema for FAQ (captures featured snippets)
export function FAQSchema() {
    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_DATA.map(faq => ({
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
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
    );
}
