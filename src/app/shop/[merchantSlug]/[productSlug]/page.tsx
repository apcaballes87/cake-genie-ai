import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import CustomizingClient from '@/app/customizing/CustomizingClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { CustomizingPageSkeleton } from '@/components/LoadingSkeletons';
import { getMerchantBySlug, getMerchantProductBySlug, getCakeBasePriceOptions, getAnalysisByExactHash } from '@/services/supabaseService';
import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import { BasePriceInfo, CakeType, ProductPageProps, CakeThickness } from '@/types';
import { ProductSchema, FAQPageSchema } from '@/components/SEOSchemas';
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

    const faqs = [
        {
            question: `How much is the ${product.title} from ${merchant.business_name}?`,
            answer: `The ${product.title} starts at ₱${product.custom_price?.toLocaleString()}. Prices may vary based on your selected customization options.`
        },
        {
            question: `Can I customize the ${product.title}?`,
            answer: `Yes! You can fully customize the ${product.title} with different flavors, colors, sizes, and toppers directly here on Genie.ph.`
        },
        {
            question: `Do you deliver ${product.title} in ${merchant.city || 'Cebu'}?`,
            answer: `Yes, ${merchant.business_name} delivers to ${merchant.city || 'Cebu City'} and surrounding areas. You can check delivery availability during checkout.`
        }
    ];

    // Generate a stable validUntil date for the schema (1 year from now)
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);
    const validUntilStr = validUntil.toISOString().split('T')[0];

    return (
        <>
            <ProductSchema product={product} merchant={merchant} prices={prices} validUntil={validUntilStr} />
            <FAQPageSchema faqs={faqs} />

            <Suspense fallback={<CustomizingPageSkeleton />}>
                <CustomizationProvider initialData={initialCustomizationState} key={product.product_id}>
                    <CustomizingClient
                        product={product}
                        merchant={merchant}
                        initialPrices={prices}
                    />
                </CustomizationProvider>
            </Suspense>
            {/* SEO Content: Rendered visibly for crawlers and users */}
            <div className="bg-white relative z-0 container mx-auto px-4 py-8 max-w-4xl">
                {/* LCP Optimization: Render main image visibly (can be styled to look good or hidden if needed, but better to be part of content) */}
                <div className="mb-6">
                    <img
                        src={product.image_url || ''}
                        alt={product.alt_text || product.title}
                        width={600}
                        height={600}
                        className="w-full max-w-md h-auto rounded-xl shadow-md"
                        loading="eager" // Force early load for LCP
                        {...({ fetchPriority: "high" } as any)} // Hint for LCP
                    />
                </div>

                <div className="prose prose-slate max-w-none">
                    <h1 className="text-3xl font-bold text-slate-900 mb-4">{product.title}</h1>
                    <p className="text-lg text-slate-700 leading-relaxed mb-6">
                        {product.long_description || product.short_description || `Customize this ${product.title} from ${merchant.business_name}.`}
                    </p>

                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 my-8">
                        <h2 className="text-xl font-semibold text-slate-800 mb-4">Product Details</h2>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <li className="flex items-center gap-2">
                                <span className="text-slate-500">Category:</span>
                                <span className="font-medium">{product.category || 'Custom Cake'}</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-slate-500">Base Price:</span>
                                <span className="font-medium">Starts at ₱{product.custom_price?.toLocaleString()}</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-slate-500">Merchant:</span>
                                <span className="font-medium">{merchant.business_name}</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-slate-500">Availability:</span>
                                <span className="font-medium">{product.availability === 'in_stock' ? 'Available Now' : 'Pre-order / Made to Order'}</span>
                            </li>
                        </ul>
                    </div>

                    {prices.length > 0 && (
                        <div className="mt-8">
                            <h2 className="text-xl font-semibold text-slate-800 mb-4">Available Sizes & Pricing</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3">Size</th>
                                            <th className="px-4 py-3">Description</th>
                                            <th className="px-4 py-3">Starting Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {prices.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-900">{p.size}</td>
                                                <td className="px-4 py-3 text-slate-600">{p.description}</td>
                                                <td className="px-4 py-3 text-slate-900">₱{p.price.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
