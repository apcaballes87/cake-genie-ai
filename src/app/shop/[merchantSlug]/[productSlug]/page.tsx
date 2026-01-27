import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import CustomizingClient from '@/app/customizing/CustomizingClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getMerchantBySlug, getMerchantProductBySlug, getCakeBasePriceOptions, getAnalysisByExactHash } from '@/services/supabaseService';
import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import { BasePriceInfo, CakeType, ProductPageProps, CakeThickness } from '@/types';
import { ProductSchema, FAQSchema } from '@/components/SEOSchemas';
import { CustomizationProvider } from '@/contexts/CustomizationContext';
import { mapAnalysisToState } from '@/utils/customizationMapper';

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

export default async function ProductPage({ params }: ProductPageProps) {
    const { merchantSlug, productSlug } = await params;
    const { data: merchant } = await getMerchantBySlug(merchantSlug);
    const { data: product } = await getMerchantProductBySlug(merchantSlug, productSlug);

    if (!product || !merchant) {
        notFound();
    }

    // 1. Fetch Analysis Result (if p_hash exists)
    let initialCustomizationState = undefined;
    if (product.p_hash) {
        try {
            const analysisResult = await getAnalysisByExactHash(product.p_hash);
            if (analysisResult) {
                initialCustomizationState = mapAnalysisToState(analysisResult);
            }
        } catch (e) {
            console.error('Error fetching analysis for SSR:', e);
        }
    }

    // 2. Fetch Pricing Options for SEO & SSR List
    let prices: BasePriceInfo[] = [];
    try {
        const effectiveCakeType = (initialCustomizationState?.cakeInfo?.type || product.cake_type || '1 Tier') as CakeType;
        const effectiveThickness = (initialCustomizationState?.cakeInfo?.thickness || '3 in') as CakeThickness;

        prices = await getCakeBasePriceOptions(effectiveCakeType, effectiveThickness);
    } catch (e) {
        console.error('Error fetching SSR prices:', e);
    }

    return (
        <>
            <ProductSchema product={product} merchant={merchant} prices={prices} />
            <FAQSchema />
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizationProvider initialData={initialCustomizationState} key={product.product_id}>
                    <CustomizingClient
                        product={product}
                        merchant={merchant}
                        initialPrices={prices}
                    />
                </CustomizationProvider>
            </Suspense>
            {/* SEO Content: Rendered visibly below the main app */}
            <div className="bg-white relative z-0">
            </div>
        </>
    );
}
