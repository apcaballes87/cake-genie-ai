import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMerchantProductBySlug, getMerchantBySlug } from '@/services/supabaseService';
import { ProductDetailClient } from './ProductDetailClient';

interface PageProps {
    params: Promise<{ merchantSlug: string; productSlug: string }>;
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { merchantSlug, productSlug } = await params;

    const [productResult, merchantResult] = await Promise.all([
        getMerchantProductBySlug(merchantSlug, productSlug),
        getMerchantBySlug(merchantSlug)
    ]);

    const product = productResult.data;
    const merchant = merchantResult.data;

    if (!product || !merchant) {
        return {
            title: 'Product Not Found | CakeGenie',
            description: 'The requested product could not be found.',
        };
    }

    const title = product.og_title || `${product.title} - ${merchant.business_name}`;
    const description = product.og_description || product.short_description || product.long_description || '';

    return {
        title: `${title} | CakeGenie`,
        description,
        keywords: product.meta_keywords || undefined,
        openGraph: {
            title,
            description,
            type: 'website',
            images: product.image_url ? [
                {
                    url: product.image_url,
                    alt: product.alt_text || product.title,
                }
            ] : [],
            siteName: 'CakeGenie',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: product.image_url ? [product.image_url] : [],
        },
    };
}

// JSON-LD Product Schema for rich results
function ProductSchema({ product, merchant }: { product: any; merchant: any }) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: product.long_description || product.short_description,
        image: product.image_url,
        brand: {
            '@type': 'Brand',
            name: merchant.business_name,
        },
        ...(product.sku && { sku: product.sku }),
        ...(product.gtin && { gtin: product.gtin }),
        category: product.category || product.cake_type,
        offers: {
            '@type': 'Offer',
            price: product.custom_price || 0,
            priceCurrency: 'PHP',
            availability: getAvailabilityUrl(product.availability),
            seller: {
                '@type': 'Organization',
                name: merchant.business_name,
            },
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

function getAvailabilityUrl(availability: string | null): string {
    switch (availability) {
        case 'in_stock':
            return 'https://schema.org/InStock';
        case 'out_of_stock':
            return 'https://schema.org/OutOfStock';
        case 'preorder':
            return 'https://schema.org/PreOrder';
        case 'made_to_order':
            return 'https://schema.org/MadeToOrder';
        default:
            return 'https://schema.org/InStock';
    }
}

export default async function ProductPage({ params }: PageProps) {
    const { merchantSlug, productSlug } = await params;

    const [productResult, merchantResult] = await Promise.all([
        getMerchantProductBySlug(merchantSlug, productSlug),
        getMerchantBySlug(merchantSlug)
    ]);

    const product = productResult.data;
    const merchant = merchantResult.data;

    if (!product || !merchant) {
        notFound();
    }

    return (
        <>
            {/* JSON-LD for Google Rich Results */}
            <ProductSchema product={product} merchant={merchant} />

            {/* Client component for interactivity */}
            <ProductDetailClient
                product={product}
                merchant={merchant}
            />
        </>
    );
}
