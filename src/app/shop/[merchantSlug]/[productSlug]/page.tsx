import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CustomizingClient from '@/app/customizing/CustomizingClient';
import { CustomizingPageSkeleton } from '@/components/LoadingSkeletons';
import { getMerchantBySlug, getMerchantProductBySlug, getCakeBasePriceOptions, getAnalysisByExactHash, getImageDimensionsByHash, getProductReviewStats } from '@/services/supabaseService';
import { BasePriceInfo, CakeType, ProductPageProps, CakeThickness } from '@/types';
import { ProductSchema } from '@/components/SEOSchemas';
import { CustomizationProvider } from '@/contexts/CustomizationContext';
import { mapAnalysisToState } from '@/utils/customizationMapper';
import { getCommercePolicyUrls, getMerchantListingNote, getLeadTimeLabel } from '@/lib/commerce/machineReadable';

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
    const { merchantSlug, productSlug } = await params;
    const { data: merchant } = await getMerchantBySlug(merchantSlug);
    const { data: product } = await getMerchantProductBySlug(merchantSlug, productSlug);

    if (!product || !merchant) {
        return {
            title: { absolute: 'Product Not Found | Genie.ph' },
            description: 'The requested cake product could not be found.',
        };
    }

    const title = product.og_title || `${product.title} | ${merchant.business_name} - Genie.ph`;
    const pageTitle = title.includes('Genie.ph') ? title : `${title} | Genie.ph`;
    const description = product.og_description || product.short_description ||
        `Order ${product.title} from ${merchant.business_name}. Custom cakes delivered in ${merchant.city || 'Philippines'}.`;
    const imageAlt = product.alt_text || `${product.title} - Custom cake from ${merchant.business_name}`;

    return {
        title: { absolute: pageTitle },
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
                    width: 1200,
                    height: 630,
                    alt: imageAlt,
                }
            ] : [],
            siteName: 'Genie.ph',
        },
        twitter: {
            card: 'summary_large_image',
            title: product.og_title || product.title,
            description,
            images: product.image_url ? [
                {
                    url: product.image_url,
                    width: 1200,
                    height: 630,
                    alt: imageAlt,
                }
            ] : [],
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
    const policyUrls = getCommercePolicyUrls();

    if (!product || !merchant) {
        notFound();
    }

    // 1. Fetch Analysis Result and Image Dimensions (if p_hash exists)
    let initialCustomizationState = undefined;
    let imageDims: { image_width: number | null; image_height: number | null } | null = null;
    if (product.p_hash) {
        try {
            const [analysisResult, dims] = await Promise.all([
                getAnalysisByExactHash(product.p_hash),
                getImageDimensionsByHash(product.p_hash),
            ]);
            if (analysisResult) {
                initialCustomizationState = mapAnalysisToState(analysisResult);
            }
            imageDims = dims;
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

    const { data: productReviewStats } = await getProductReviewStats(product.product_id);

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

    return (
        <>
            <ProductSchema
                product={product}
                merchant={merchant}
                prices={prices}
                imageWidth={imageDims?.image_width}
                imageHeight={imageDims?.image_height}
                ratingValue={productReviewStats && productReviewStats.total > 0 ? productReviewStats.averageRating.toFixed(1) : undefined}
                reviewCount={productReviewStats && productReviewStats.total > 0 ? String(productReviewStats.total) : undefined}
            />
            {product.image_url && (
                <link
                    rel="preload"
                    as="image"
                    href={product.image_url}
                />
            )}

            <Suspense fallback={<CustomizingPageSkeleton />}>
                <CustomizationProvider initialData={initialCustomizationState} key={product.product_id}>
                    <CustomizingClient
                        product={product}
                        merchant={merchant}
                        initialPrices={prices}
                        hideAiChat={true}
                        enableMobileHeroPan={true}
                    />
                </CustomizationProvider>
            </Suspense>
            {/* SEO Content: Rendered visibly for crawlers and users */}
            <div className="bg-white relative z-0 container mx-auto px-4 py-8 max-w-4xl">
                {/* LCP Optimization: Render main image visibly (can be styled to look good or hidden if needed, but better to be part of content) */}
                <figure className="mb-6">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Intentional SEO/LCP image markup for the primary product image. */}
                    <img
                        src={product.image_url || ''}
                        alt={product.alt_text || product.title}
                        width={600}
                        height={600}
                        className="w-full max-w-md h-auto rounded-xl shadow-md"
                        loading="eager" // Force early load for LCP
                        fetchPriority="high"
                        itemProp="image"
                    />
                    <figcaption className="mt-2 text-sm text-slate-500">
                        {product.alt_text || `${product.title} — Custom cake from ${merchant.business_name}`}
                    </figcaption>
                </figure>

                <div className="prose prose-slate max-w-none">
                    <h1 className="text-3xl font-bold text-slate-900 mb-4">{product.title}</h1>
                    <p className="text-lg text-slate-700 leading-relaxed mb-6">
                        {product.long_description || product.short_description || `Customize this ${product.title} from ${merchant.business_name}.`}
                    </p>

                    <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 my-6">
                        <h2 className="text-lg font-semibold text-slate-800 mb-2">Merchant-center-ready product context</h2>
                        <p className="text-sm text-slate-700">
                            {getMerchantListingNote(merchant)} {getLeadTimeLabel(product.availability) || 'Made-to-order custom cake'}.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm">
                            <Link href={policyUrls.deliveryRates.replace('https://genie.ph', '')} className="font-medium text-purple-700 hover:text-purple-800">
                                Delivery rates
                            </Link>
                            <Link href={policyUrls.returnPolicy.replace('https://genie.ph', '')} className="font-medium text-purple-700 hover:text-purple-800">
                                Return policy
                            </Link>
                            <Link href={policyUrls.reviews.replace('https://genie.ph', '')} className="font-medium text-purple-700 hover:text-purple-800">
                                Customer reviews
                            </Link>
                            <Link href="/customizing" className="font-medium text-purple-700 hover:text-purple-800">
                                Open the customizer
                            </Link>
                        </div>
                    </div>

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
                            <li className="flex items-center gap-2">
                                <span className="text-slate-500">Lead Time:</span>
                                <span className="font-medium">{getLeadTimeLabel(product.availability) || 'Depends on customization'}</span>
                            </li>
                            {productReviewStats && productReviewStats.total > 0 && (
                                <li className="flex items-center gap-2">
                                    <span className="text-slate-500">Product Reviews:</span>
                                    <span className="font-medium">{productReviewStats.averageRating.toFixed(1)} / 5 from {productReviewStats.total} review{productReviewStats.total === 1 ? '' : 's'}</span>
                                </li>
                            )}
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

                    {/* Visible FAQ section (FAQPage schema restricted to gov/healthcare Aug 2023) */}
                    <section className="mt-8">
                        <h2 className="text-xl font-semibold text-slate-800 mb-4">Frequently Asked Questions</h2>
                        <div className="space-y-3">
                            {faqs.map((faq, idx) => (
                                <details key={idx} className="group bg-slate-50 rounded-lg border border-slate-200">
                                    <summary className="cursor-pointer px-4 py-3 font-medium text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                                        {faq.question}
                                    </summary>
                                    <p className="px-4 pb-3 text-slate-600 text-sm">
                                        {faq.answer}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}
