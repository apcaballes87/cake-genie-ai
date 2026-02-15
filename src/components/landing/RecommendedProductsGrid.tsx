'use client';

import React, { useState, useCallback } from 'react';
import { getRecommendedProducts } from '@/services/supabaseService';
import { ProductCard } from '@/components/ProductCard';

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
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Recent searches by users</h2>
                    <p className="text-gray-500 text-sm md:text-base">Get the price in 15 seconds!</p>
                </div>
                <button className="text-purple-600 text-sm font-bold hover:underline hidden md:block">View All</button>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6 mb-12">
                {products.length > 0 ? (
                    <>
                        {products.map((item, index) => (
                            <ProductCard
                                key={`${item.p_hash}-${index}`}
                                p_hash={item.p_hash}
                                original_image_url={item.original_image_url}
                                price={item.price}
                                keywords={item.keywords}
                                slug={item.slug}
                                availability={item.availability}
                                analysis_json={item.analysis_json}
                                priority={index < 4}
                            />
                        ))}
                        {/* Loading More Skeleton */}
                        {isLoadingMore && (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={`loading-more-${i}`} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
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
                    </>
                ) : (
                    <div className="col-span-full text-center py-10 text-gray-500">
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
                        className="border border-gray-300 bg-white px-8 py-3 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoadingMore ? 'Loading...' : 'Load More'}
                    </button>
                ) : (
                    <div className="text-gray-400 text-xs">End of results</div>
                )}
            </div>
        </>
    );
};

export default RecommendedProductsGrid;
