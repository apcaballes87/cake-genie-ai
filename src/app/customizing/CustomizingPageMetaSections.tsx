import React from 'react';
import Link from 'next/link';
import { DesignAboutSection } from '@/components/DesignAboutSection';
import type { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';

interface RecentSearchDesignMeta {
    slug: string | null;
    seo_title: string | null;
    keywords: string | null;
}

interface CustomizingPageMetaHeaderProps {
    product?: CakeGenieMerchantProduct;
    merchant?: CakeGenieMerchant;
    recentSearchDesign?: RecentSearchDesignMeta;
}

interface CustomizingSupplementalContentProps {
    product?: CakeGenieMerchantProduct;
    seoContentSlot?: React.ReactNode;
    showClientFallback: boolean;
}

export const cleanDisplayTitle = (title?: string | null) => (
    title?.split('|')[0]?.trim() || ''
);

export const getRecentSearchDisplayTitle = (recentSearchDesign?: RecentSearchDesignMeta) => (
    cleanDisplayTitle(recentSearchDesign?.seo_title)
    || recentSearchDesign?.keywords?.trim()
    || 'Custom Design'
);

export const CustomizingPageMetaHeader = React.memo(({
    product,
    merchant,
    recentSearchDesign,
}: CustomizingPageMetaHeaderProps) => {
    const productTitle = cleanDisplayTitle(product?.title) || product?.title;
    const recentSearchTitle = getRecentSearchDisplayTitle(recentSearchDesign);
    const showBreadcrumbs = Boolean((product && merchant) || (recentSearchDesign && recentSearchDesign.slug));

    if (!showBreadcrumbs && !product && !recentSearchDesign) {
        return null;
    }

    return (
        <>
            {showBreadcrumbs && (
                <nav className="w-full min-w-0" aria-label="Breadcrumb">
                    <ol className="flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-hidden whitespace-nowrap text-xs text-slate-500">
                        <li className="shrink-0"><Link href="/" className="hover:text-purple-600 transition-colors">Home</Link></li>
                        <li className="shrink-0"><span className="mx-1">/</span></li>
                        {product && merchant ? (
                            <>
                                <li className="shrink-0"><Link href="/shop" className="hover:text-purple-600 transition-colors">Shop</Link></li>
                                <li className="shrink-0"><span className="mx-1">/</span></li>
                                <li className="min-w-0 max-w-[28vw] shrink truncate sm:max-w-xs md:max-w-sm">
                                    <Link href={`/shop/${merchant.slug}`} className="block truncate hover:text-purple-600 transition-colors">{merchant.business_name}</Link>
                                </li>
                                <li className="shrink-0"><span className="mx-1">/</span></li>
                                <li className="min-w-0 truncate text-slate-700 font-medium" aria-current="page">{productTitle}</li>
                            </>
                        ) : recentSearchDesign ? (
                            <>
                                <li className="shrink-0"><Link href="/customizing" className="hover:text-purple-600 transition-colors">Customizing</Link></li>
                                <li className="shrink-0"><span className="mx-1">/</span></li>
                                <li className="min-w-0 truncate text-slate-700 font-medium" aria-current="page">{recentSearchTitle}</li>
                            </>
                        ) : null}
                    </ol>
                </nav>
            )}

            {(product || recentSearchDesign) && (
                <div className="w-full">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight truncate whitespace-nowrap">
                        {product ? productTitle : recentSearchTitle}
                    </h1>
                    {product?.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            {product.category}
                        </span>
                    )}
                </div>
            )}
        </>
    );
});

CustomizingPageMetaHeader.displayName = 'CustomizingPageMetaHeader';

export const CustomizingSupplementalContent = React.memo(({
    product,
    seoContentSlot,
    showClientFallback,
}: CustomizingSupplementalContentProps) => {
    const showFallbackContent = showClientFallback && Boolean(
        product && (product.long_description || product.short_description || (product.tags && product.tags.length > 0))
    );

    if (!seoContentSlot && !showFallbackContent) {
        return null;
    }

    return (
        <div className="w-full mt-0">
            <div className="bg-white/70 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-slate-200">
                {seoContentSlot}
                {!seoContentSlot && showFallbackContent && product && (
                    <>
                        {(product.long_description || product.short_description) && (
                            <DesignAboutSection
                                title="About This Cake"
                                description={product.long_description || product.short_description || ''}
                                showDisclaimer={false}
                            />
                        )}
                        {(product.tags?.length ?? 0) > 0 && (
                            <div>
                                <h3 className="text-xs font-medium text-slate-500 mb-2">Related Tags</h3>
                                <div className="flex flex-wrap gap-2">
                                    {product.tags?.map((tag, index) => (
                                        <a
                                            key={`${tag}-${index}`}
                                            href={`/search?q=${encodeURIComponent(tag)}`}
                                            className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-purple-100 hover:text-purple-700 transition-colors cursor-pointer"
                                        >
                                            {tag}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
});

CustomizingSupplementalContent.displayName = 'CustomizingSupplementalContent';
