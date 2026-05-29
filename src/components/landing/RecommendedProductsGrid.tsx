'use client';

import React, { memo, useState, useCallback } from 'react';
import { getRecommendedProducts, type RecommendedProductsQueryOptions } from '@/services/supabaseService';
import { ProductCard } from '@/components/ProductCard';
import Masonry from 'react-masonry-css';
import { ImagePlus } from 'lucide-react';

interface RecommendedProduct {
    p_hash: string;
    original_image_url: string;
    studio_edited_image_url?: string | null;
    price: number;
    keywords?: string;
    slug?: string;
    availability?: string;
    analysis_json?: {
        cakeType?: string;
        icing_design?: string;
        [key: string]: unknown;
    };
    image_width?: number | null;
    image_height?: number | null;
    /** Variant manifest jsonb. ProductCard parses it. */
    image_variants?: unknown;
}

interface RecommendedProductsGridProps {
    initialProducts: RecommendedProduct[];
    queryOptions?: RecommendedProductsQueryOptions;
    headingHighlight?: string;
    headingText?: string;
    description?: string;
    listName?: string;
    emptyStateText?: string;
    loadMoreEnabled?: boolean;
}

const RecommendedProductsGridComponent = ({
    initialProducts,
    queryOptions,
    headingHighlight = 'Trending Now:',
    headingText = 'What others are pricing',
    description = 'Join the community getting instant prices in under 10 seconds.',
    listName = 'recommended',
    emptyStateText = 'No recommended cakes found at the moment.',
    loadMoreEnabled = true,
}: RecommendedProductsGridProps) => {
    const [products, setProducts] = useState<RecommendedProduct[]>(initialProducts);
    const [offset, setOffset] = useState(initialProducts.length);
    const [hasMore, setHasMore] = useState(loadMoreEnabled && initialProducts.length >= 8);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const handleOpenUploader = () => {
        window.dispatchEvent(new Event('genie:open-upload-modal'));
    };

    const fetchMoreProducts = useCallback(async (currentOffset: number) => {
        try {
            const { data, error } = await getRecommendedProducts(8, currentOffset, queryOptions);

            if (data) {
                setProducts(prev => [...prev, ...data]);
                if (data.length < 8) {
                    setHasMore(false);
                }
            } else {
                console.error("Failed to load more products:", error);
            }
        } catch (err) {
            console.error("Error loading more products:", err);
        } finally {
            setIsLoadingMore(false);
        }
    }, [queryOptions]);

    const handleLoadMore = () => {
        const currentOffset = offset;
        setIsLoadingMore(true);
        fetchMoreProducts(currentOffset);
        setOffset(currentOffset + 8);
    };

    return (
        <>
            {/* Section Header */}
            <div className="text-center mb-8 md:mb-12">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-3">
                    <span className="text-purple-400">{headingHighlight}</span> {headingText}
                </h2>
                <p className="text-base text-slate-500 max-w-2xl mx-auto">
                    {description}
                </p>
            </div>

            {/* Product Grid */}
            <div className="mb-0">
                {products.length > 0 ? (
                    <Masonry
                        breakpointCols={{
                            default: 6,
                            1280: 5,
                            1024: 4,
                            768: 3,
                            490: 2,
                            0: 2
                        }}
                        className="flex w-auto -ml-4 md:-ml-5 lg:-ml-6"
                        columnClassName="pl-4 md:pl-5 lg:pl-6 bg-clip-padding"
                    >
                        {products.map((item, index) => (
                            <div key={`${item.p_hash}-${index}`} className="mb-2 md:mb-3">
                                <ProductCard
                                    p_hash={item.p_hash}
                                    original_image_url={item.original_image_url}
                                    studio_edited_image_url={item.studio_edited_image_url}
                                    price={item.price}
                                    keywords={item.keywords}
                                    slug={item.slug}
                                    availability={item.availability}
                                    analysis_json={item.analysis_json}
                                    image_width={item.image_width}
                                    image_height={item.image_height}
                                    image_variants={item.image_variants}
                                    listName={listName}
                                />
                            </div>
                        ))}
                        {/* Loading More Skeleton */}
                        {isLoadingMore && (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={`loading-more-${i}`} className="mb-4 md:mb-5 lg:mb-6 bg-white p-3 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                                    <div className="aspect-square mb-3 rounded-xl bg-gray-200"></div>
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                                    <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                                        <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                                        <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </Masonry>
                ) : (
                    <div className="text-center py-10 text-gray-500">
                        {emptyStateText}
                    </div>
                )}
            </div>

            {/* Load More Button */}
            <div className="text-center mt-1 pb-10">
                {loadMoreEnabled ? (
                    hasMore ? (
                        <button
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                            className="genie-btn-secondary px-8 py-3 font-semibold rounded-full disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                        >
                            {isLoadingMore ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                    Loading...
                                </>
                            ) : (
                                'Load More'
                            )}
                        </button>
                    ) : (
                        <div className="text-gray-400 text-xs">End of results</div>
                    )
                ) : null}

                <div className="mt-10 flex w-full max-w-[440px] flex-col items-center mx-auto">
                    <button
                        type="button"
                        onClick={handleOpenUploader}
                        className="genie-btn-primary flex w-full items-center justify-center gap-3 rounded-[1.35rem] py-[15px] px-6 md:px-8 text-[12px] min-[360px]:text-[13px] min-[390px]:text-sm md:text-[17px] lg:text-lg font-bold active:scale-[0.99] shadow-lg shadow-purple-100/50"
                    >
                        <ImagePlus className="h-[22px] w-[22px] shrink-0" />
                        <span className="whitespace-nowrap">Upload any image, get instant pricing</span>
                    </button>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                        Have your own cake peg? Upload it and see an instant price in seconds.
                    </p>
                </div>
            </div>
        </>
    );
};

export const RecommendedProductsGrid = memo(RecommendedProductsGridComponent);
RecommendedProductsGrid.displayName = 'RecommendedProductsGrid';

export default RecommendedProductsGrid;
