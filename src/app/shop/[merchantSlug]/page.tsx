import { Metadata } from 'next';
import { MerchantPageClient } from '../MerchantPageClient';
import { getMerchantBySlug, getMerchantProductsWithCache } from '@/services/supabaseService';
import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';

interface MerchantPageProps {
    params: Promise<{ merchantSlug: string }>;
}

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({ params }: MerchantPageProps): Promise<Metadata> {
    const { merchantSlug } = await params;
    const { data: merchant } = await getMerchantBySlug(merchantSlug);

    if (!merchant) {
        return {
            title: 'Bakeshop Not Found | CakeGenie',
            description: 'The requested bakeshop could not be found.',
        };
    }

    const title = `${merchant.business_name} | CakeGenie Partner Bakeshop`;
    const description = merchant.description || `Order custom cakes from ${merchant.business_name} in ${merchant.city || 'Philippines'}`;

    return {
        title,
        description,
        openGraph: {
            title: merchant.business_name,
            description,
            type: 'website',
            images: merchant.cover_image_url ? [
                {
                    url: merchant.cover_image_url,
                    alt: `${merchant.business_name} cover image`,
                    width: 1200,
                    height: 630,
                }
            ] : merchant.profile_image_url ? [
                {
                    url: merchant.profile_image_url,
                    alt: merchant.business_name,
                }
            ] : [],
            siteName: 'CakeGenie',
        },
        twitter: {
            card: 'summary_large_image',
            title: merchant.business_name,
            description,
            images: merchant.cover_image_url ? [merchant.cover_image_url] :
                merchant.profile_image_url ? [merchant.profile_image_url] : [],
        },
        alternates: {
            canonical: `https://genie.ph/shop/${merchantSlug}`,
        },
    };
}

// JSON-LD Schema for Local Business / Bakery
function MerchantSchema({ merchant, products }: { merchant: CakeGenieMerchant; products: CakeGenieMerchantProduct[] }) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Bakery',
        name: merchant.business_name,
        description: merchant.description,
        image: merchant.cover_image_url || merchant.profile_image_url,
        telephone: merchant.phone,
        address: {
            '@type': 'PostalAddress',
            streetAddress: merchant.address,
            addressLocality: merchant.city,
            addressCountry: 'PH'
        },
        url: `https://genie.ph/shop/${merchant.slug}`,
        ...(merchant.rating && {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: merchant.rating,
                reviewCount: merchant.review_count
            }
        }),
        // Add products to schema for richer indexing
        ...(products.length > 0 && {
            hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'Available Cakes',
                numberOfItems: products.length,
                itemListElement: products.slice(0, 20).map((product, index) => ({
                    '@type': 'Product',
                    position: index + 1,
                    name: product.title,
                    description: product.short_description || `Custom cake from ${merchant.business_name}`,
                    image: product.image_url,
                    offers: {
                        '@type': 'Offer',
                        price: product.custom_price || 0,
                        priceCurrency: 'PHP',
                        availability: 'https://schema.org/InStock',
                    },
                    url: `https://genie.ph/shop/${merchant.slug}/${product.slug}`,
                }))
            }
        })
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

/**
 * Server-rendered product list for SEO crawlers.
 * This content is visible to search bots but hidden from visual users.
 * Uses sr-only class to be accessible but not displayed.
 */
function SEOProductList({ merchant, products }: { merchant: CakeGenieMerchant; products: CakeGenieMerchantProduct[] }) {
    if (products.length === 0) return null;

    return (
        <div className="sr-only" aria-hidden="false">
            <h2>{merchant.business_name} - Available Cakes</h2>
            <p>{merchant.description}</p>
            <ul>
                {products.map((product) => (
                    <li key={product.product_id}>
                        <a href={`/shop/${merchant.slug}/${product.slug}`}>
                            {product.image_url && (
                                <img
                                    src={product.image_url}
                                    alt={product.alt_text || `${product.title} - Custom cake from ${merchant.business_name}`}
                                    width={400}
                                    height={400}
                                    loading="lazy"
                                />
                            )}
                            <h3>{product.title}</h3>
                            <p>Price: ₱{(product.custom_price || 0).toLocaleString()}</p>
                            {product.short_description && <p>{product.short_description}</p>}
                            {product.cake_type && <p>Type: {product.cake_type}</p>}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default async function MerchantPage({ params }: MerchantPageProps) {
    const { merchantSlug } = await params;
    const { data: merchant } = await getMerchantBySlug(merchantSlug);
    const { data: products } = await getMerchantProductsWithCache(merchantSlug);

    if (!merchant) {
        return <MerchantPageClient slug={merchantSlug} />;
    }

    const productList = products || [];

    return (
        <>
            <MerchantSchema merchant={merchant} products={productList} />
            <SEOProductList merchant={merchant} products={productList} />
            <MerchantPageClient slug={merchantSlug} />
        </>
    );
}

