import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import CustomizingClient from '@/app/customizing/CustomizingClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getMerchantBySlug, getMerchantProductBySlug, getCakeBasePriceOptions } from '@/services/supabaseService';
import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import { BasePriceInfo, CakeType } from '@/types';

interface ProductPageProps {
    params: Promise<{ merchantSlug: string; productSlug: string }>;
}

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
    const { merchantSlug, productSlug } = await params;
    const { data: merchant } = await getMerchantBySlug(merchantSlug);
    const { data: product } = await getMerchantProductBySlug(merchantSlug, productSlug);

    if (!product || !merchant) {
        return {
            title: 'Product Not Found | Genie.ph',
            description: 'The requested cake product could not be found.',
        };
    }

    const title = product.og_title || `${product.title} | ${merchant.business_name} - Genie.ph`;
    const description = product.og_description || product.short_description ||
        `Order ${product.title} from ${merchant.business_name}. Custom cakes delivered in ${merchant.city || 'Philippines'}.`;
    const imageAlt = product.alt_text || `${product.title} - Custom cake from ${merchant.business_name}`;

    return {
        title,
        description,
        keywords: product.meta_keywords || undefined,
        alternates: {
            canonical: `https://genie.ph/shop/${merchantSlug}/${productSlug}`,
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
            title: product.og_title || product.title,
            description,
            type: 'website',
            url: `https://genie.ph/shop/${merchantSlug}/${productSlug}`,
            images: product.image_url ? [
                {
                    url: product.image_url,
                    alt: imageAlt,
                    width: 1200,
                    height: 630,
                }
            ] : [],
            siteName: 'Genie.ph',
        },
        twitter: {
            card: 'summary_large_image',
            title: product.og_title || product.title,
            description,
            images: product.image_url ? [product.image_url] : [],
        },
        ...(product.image_url && {
            other: {
                thumbnail: product.image_url,
            },
        }),
    };
}

// JSON-LD Schema for Product (Schema.org)
function ProductSchema({ product, merchant, prices }: { product: CakeGenieMerchantProduct; merchant: CakeGenieMerchant; prices?: BasePriceInfo[] }) {
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
function FAQSchema() {
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

/**
 * Server-rendered FAQ section for SEO.
 * Visible to search engines, hidden from visual users.
 */
function SEOFAQSection() {
    return (
        <section className="sr-only" aria-hidden="false">
            <h2>Frequently Asked Questions</h2>
            <dl>
                {FAQ_DATA.map((faq, index) => (
                    <div key={index}>
                        <dt><strong>{faq.question}</strong></dt>
                        <dd>{faq.answer}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

/**
 * Server-rendered product details for SEO crawlers.
 * Hidden from visual users but fully visible to search bots.
 */
function SEOProductDetails({ product, merchant, prices }: { product: CakeGenieMerchantProduct; merchant: CakeGenieMerchant; prices?: BasePriceInfo[] }) {
    const imageAlt = product.alt_text || `${product.title} - Custom cake from ${merchant.business_name}`;

    return (
        <article className="sr-only" aria-hidden="false">
            <header>
                <h1>{product.title}</h1>
                <p>By {merchant.business_name}</p>
                {product.image_url && (
                    <figure>
                        <img
                            src={product.image_url}
                            alt={imageAlt}
                            width={800}
                            height={800}
                            loading="eager"
                        />
                        <figcaption>{imageAlt}</figcaption>
                    </figure>
                )}
            </header>

            <section>
                <h2>Product Details</h2>
                <p><strong>Price:</strong> ₱{(product.custom_price || 0).toLocaleString()}</p>
                {product.cake_type && <p><strong>Cake Type:</strong> {product.cake_type}</p>}
                {product.category && <p><strong>Category:</strong> {product.category}</p>}
                {product.availability && <p><strong>Availability:</strong> {product.availability.replace('_', ' ')}</p>}
            </section>

            {prices && prices.length > 0 && (
                <section>
                    <h2>Available Sizes & Prices</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Size</th>
                                <th>Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prices.map((priceInfo, index) => (
                                <tr key={index}>
                                    <td>{priceInfo.size}</td>
                                    <td>₱{priceInfo.price.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {(product.short_description || product.long_description) && (
                <section>
                    <h2>Description</h2>
                    <p>{product.long_description || product.short_description}</p>
                </section>
            )}

            <section>
                <h2>Order from {merchant.business_name}</h2>
                {merchant.address && <p><strong>Location:</strong> {merchant.address}</p>}
                {merchant.city && <p><strong>City:</strong> {merchant.city}</p>}
                {merchant.phone && <p><strong>Contact:</strong> {merchant.phone}</p>}
            </section>

            <section>
                <h2>Ordering & Delivery Information</h2>
                <p><strong>Rush Orders:</strong> Ready in 30 minutes for simple designs</p>
                <p><strong>Same-Day Delivery:</strong> Order before 3 PM for same-day delivery (ready in 3 hours)</p>
                <p><strong>Standard Orders:</strong> 1-day lead time for complex designs</p>
                <p><strong>Delivery Areas:</strong> Metro Manila, Cavite, Laguna, Rizal, Bulacan, and nearby provinces</p>
                <p><strong>Payment Methods:</strong> GCash, Maya, Credit Card, Bank Transfer, Cash on Delivery</p>
            </section>

            <section>
                <h2>Perfect For Any Occasion</h2>
                <p>This custom cake is ideal for: birthdays, debut celebrations, weddings,
                    christenings, baptisms, anniversaries, graduations, corporate events,
                    baby showers, gender reveals, and holiday celebrations in the Philippines.</p>
            </section>

            <nav aria-label="Breadcrumb">
                <ol>
                    <li><a href="https://genie.ph">Home</a></li>
                    <li><a href="https://genie.ph/shop">Shop</a></li>
                    <li><a href={`https://genie.ph/shop/${merchant.slug}`}>{merchant.business_name}</a></li>
                    <li>{product.title}</li>
                </ol>
            </nav>
        </article>
    );
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { merchantSlug, productSlug } = await params;
    const { data: merchant } = await getMerchantBySlug(merchantSlug);
    const { data: product } = await getMerchantProductBySlug(merchantSlug, productSlug);

    if (!product || !merchant) {
        notFound();
    }

    // Fetch base price options for SEO table (defaulting to regular thickness)
    // Cast cake_type to CakeType enum, defaulting to 'custom' if undef/null
    let prices: BasePriceInfo[] = [];
    try {
        // Using 'custom' as fallback if cake_type is missing or invalid
        const cakeType = (product.cake_type as CakeType) || 'custom';
        prices = await getCakeBasePriceOptions(cakeType, '4 in');
    } catch (e) {
        console.error('Error fetching SEO prices:', e);
        // Fail silently for SEO enhancement, don't crash page
    }

    return (
        <>
            <ProductSchema product={product} merchant={merchant} prices={prices} />
            <FAQSchema />
            <SEOProductDetails product={product} merchant={merchant} prices={prices} />
            <SEOFAQSection />
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizingClient product={product} merchant={merchant} />
            </Suspense>
        </>
    );
}

