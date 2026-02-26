'use client';

import React, { useState } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { getRelatedProductsByKeywords } from '@/services/supabaseService';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface RelatedProductsProps {
    initialProducts: any[];
    keyword: string;
    slug: string;
}

export const RelatedProductsSection: React.FC<RelatedProductsProps> = ({
    initialProducts,
    keyword,
    slug
}) => {
    const [products, setProducts] = useState<any[]>(initialProducts);
    const [offset, setOffset] = useState(4);
    const [hasMore, setHasMore] = useState(initialProducts.length >= 4);
    const [isLoading, setIsLoading] = useState(false);

    const loadMore = async () => {
        if (isLoading || !hasMore) return;
        setIsLoading(true);

        try {
            const { data } = await getRelatedProductsByKeywords(keyword, slug, 4, offset);
            const newProducts = data || [];

            if (newProducts.length === 0) {
                setHasMore(false);
            } else {
                setProducts(prev => [...prev, ...newProducts]);
                setOffset(prev => prev + 4);
                if (newProducts.length < 4) {
                    setHasMore(false);
                }
            }
        } catch (error) {
            console.error('Error loading more products:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (products.length === 0) {
        return null;
    }

    return (
        <div className="mt-12 space-y-4 pt-8 border-t border-purple-100">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Relevant Cake Designs</h2>
                {hasMore && (
                    <a
                        href={`/collections?search=${encodeURIComponent(keyword)}`}
                        className="text-sm text-purple-600 hover:text-purple-800 font-semibold"
                    >
                        View all
                    </a>
                )}
            </div>

            <div className="columns-2 min-[490px]:columns-3 md:columns-4 gap-4 md:gap-5 space-y-4 md:space-y-5">
                {products.map((product, index) => (
                    <ProductCard
                        key={`${product.slug || product.p_hash}-${index}`}
                        p_hash={product.p_hash}
                        original_image_url={product.original_image_url}
                        price={product.price}
                        keywords={product.keywords}
                        slug={product.slug}
                        availability={product.availability}
                        analysis_json={product.analysis_json}
                    />
                ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
                <div className="mt-8 text-center">
                    <button
                        onClick={loadMore}
                        disabled={isLoading}
                        className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-full border border-purple-200 shadow-sm hover:shadow-md hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                    >
                        {isLoading ? (
                            <>
                                <LoadingSpinner />
                                Loading...
                            </>
                        ) : (
                            'Show More'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
