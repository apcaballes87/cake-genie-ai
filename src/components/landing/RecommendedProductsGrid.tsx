'use client';

import React, { useState, useCallback } from 'react';
import { getRecommendedProducts } from '@/services/supabaseService';
import { ProductCard } from '@/components/ProductCard';
import Masonry from 'react-masonry-css';

interface RecommendedProduct {
    p_hash: string;
    original_image_url: string;
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
}

interface RecommendedProductsGridProps {
    initialProducts: RecommendedProduct[];
}

export const RecommendedProductsGrid = ({ initialProducts }: RecommendedProductsGridProps) => {
    const [products, setProducts] = useState<RecommendedProduct[]>(initialProducts);
    const [offset, setOffset] = useState(initialProducts.length);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const fetchMoreProducts = useCallback(async (currentOffset: number) => {
        try {
            const { data, error } = await getRecommendedProducts(8, currentOffset);

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
    }, []);

    const handleLoadMore = () => {
        const nextOffset = offset + 8;
        setOffset(nextOffset);
        setIsLoadingMore(true);
        fetchMoreProducts(nextOffset);
    };

    return (
        <>
            {/* Section Header */}
            <div className="flex justify-between items-end mb-4 md:mb-6">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Recent searches by users</h2>
                    <p className="text-gray-500 text-sm md:text-base">Get the price in 15 seconds!</p>
                </div>
            </div>

            {/* Product Grid */}
            <div className="mb-8 md:mb-10">
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
                            <div key={`${item.p_hash}-${index}`} className="mb-4 md:mb-5 lg:mb-6">
                                <ProductCard
                                    p_hash={item.p_hash}
                                    original_image_url={item.original_image_url}
                                    price={item.price}
                                    keywords={item.keywords}
                                    slug={item.slug}
                                    availability={item.availability}
                                    analysis_json={item.analysis_json}
                                    priority={index < 4}
                                    image_width={item.image_width}
                                    image_height={item.image_height}
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
                        No recommended cakes found at the moment.
                    </div>
                )}
            </div>

            {/* Load More Button */}
            <div className="text-center pb-10">
                {hasMore ? (
                    <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-full border border-purple-200 shadow-sm hover:shadow-md hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
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
                )}
            </div>
        </>
    );
};

export default RecommendedProductsGrid;
