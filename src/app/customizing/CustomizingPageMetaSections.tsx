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

const getRecentSearchTitle = (recentSearchDesign?: RecentSearchDesignMeta) => (
    recentSearchDesign?.seo_title?.replace(/\s*\|\s*Genie\.ph\s*$/i, '')
    || recentSearchDesign?.keywords
    || 'Custom Design'
);

export const CustomizingPageMetaHeader = React.memo(({
    product,
    merchant,
    recentSearchDesign,
}: CustomizingPageMetaHeaderProps) => {
    const recentSearchTitle = getRecentSearchTitle(recentSearchDesign);
    const showBreadcrumbs = Boolean((product && merchant) || (recentSearchDesign && recentSearchDesign.slug));

    if (!showBreadcrumbs && !product && !recentSearchDesign) {
        return null;
    }

    return (
        <>
            {showBreadcrumbs && (
                <nav className="w-full" aria-label="Breadcrumb">
                    <ol className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
                        <li><Link href="/" className="hover:text-purple-600 transition-colors">Home</Link></li>
                        <li><span className="mx-1">/</span></li>
                        {product && merchant ? (
                            <>
                                <li><Link href="/shop" className="hover:text-purple-600 transition-colors">Shop</Link></li>
                                <li><span className="mx-1">/</span></li>
                                <li><Link href={`/shop/${merchant.slug}`} className="hover:text-purple-600 transition-colors">{merchant.business_name}</Link></li>
                                <li><span className="mx-1">/</span></li>
                                <li className="text-slate-700 font-medium" aria-current="page">{product.title}</li>
                            </>
                        ) : recentSearchDesign ? (
                            <>
                                <li><Link href="/customizing" className="hover:text-purple-600 transition-colors">Customizing</Link></li>
                                <li><span className="mx-1">/</span></li>
                                <li className="text-slate-700 font-medium" aria-current="page">{recentSearchTitle}</li>
                            </>
                        ) : null}
                    </ol>
                </nav>
            )}

            {(product || recentSearchDesign) && (
                <div className="w-full">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
                        {product ? product.title : recentSearchTitle}
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
                                        <span
                                            key={`${tag}-${index}`}
                                            className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-purple-100 hover:text-purple-700 transition-colors cursor-default"
                                        >
                                            {tag}
                                        </span>
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