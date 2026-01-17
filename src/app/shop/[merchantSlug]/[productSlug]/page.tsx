import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import CustomizingClient from '@/app/customizing/CustomizingClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getMerchantBySlug, getMerchantProductBySlug } from '@/services/supabaseService';
import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';

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
function ProductSchema({ product, merchant }: { product: CakeGenieMerchantProduct; merchant: CakeGenieMerchant }) {
    // Sanitize string to prevent script injection in JSON-LD
    const sanitize = (str: string | undefined | null) => str ? str.replace(/<\/script/g, '<\\/script') : '';

    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: sanitize(product.title),
        description: sanitize(product.long_description || product.short_description || `Custom cake from ${merchant.business_name}`),
        image: product.image_url ? {
            '@type': 'ImageObject',
            url: product.image_url,
            caption: sanitize(product.alt_text || product.title),
        } : undefined,
        brand: {
            '@type': 'Brand',
            name: sanitize(product.brand || merchant.business_name),
        },
        category: sanitize(product.category || 'Cakes'),
        ...(product.sku && { sku: sanitize(product.sku) }),
        ...(product.gtin && { gtin: sanitize(product.gtin) }),
        offers: {
            '@type': 'Offer',
            price: product.custom_price || 0,
            priceCurrency: 'PHP',
            availability: product.availability === 'in_stock'
                ? 'https://schema.org/InStock'
                : product.availability === 'preorder'
                    ? 'https://schema.org/PreOrder'
                    : product.availability === 'made_to_order'
                        ? 'https://schema.org/MadeToOrder'
                        : 'https://schema.org/OutOfStock',
            priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            seller: {
                '@type': 'Organization',
                name: sanitize(merchant.business_name),
            },
            url: `https://genie.ph/shop/${merchant.slug}/${product.slug}`,
        },
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
                item: `https://genie.ph/shop/${merchant.slug}/${product.slug}`,
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
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
        </>
    );
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { merchantSlug, productSlug } = await params;
    const { data: merchant } = await getMerchantBySlug(merchantSlug);
    const { data: product } = await getMerchantProductBySlug(merchantSlug, productSlug);

    if (!product || !merchant) {
        notFound();
    }

    return (
        <>
            <ProductSchema product={product} merchant={merchant} />
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizingClient product={product} merchant={merchant} />
            </Suspense>
        </>
    );
}
