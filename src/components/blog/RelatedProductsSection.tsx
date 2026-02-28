'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { getRelatedProductsByKeywords } from '@/services/supabaseService';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface RelatedProductsProps {
    initialProducts: any[];
    keyword: string;
    slug: string;
    /** Optional contextual sentence that bridges the blog content to the designs grid */
    intro?: string;
}

export const RelatedProductsSection: React.FC<RelatedProductsProps> = ({
    initialProducts,
    keyword,
    slug,
    intro,
}) => {
    const [products, setProducts] = useState<any[]>(initialProducts);
    const [offset, setOffset] = useState(4);
    const [hasMore, setHasMore] = useState(initialProducts.length >= 4);
    const [isLoading, setIsLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const sectionRef = useRef<HTMLDivElement>(null);

    // Fade-in when section scrolls into view
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.05 }
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

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
        <div
            ref={sectionRef}
            className={`mt-12 pt-10 border-t border-purple-100 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
        >
            {/* Contextual header */}
            <div className="mb-6 space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span>🎂</span>
                        <span>Relevant Cake Designs</span>
                    </h2>
                    {hasMore && (
                        <a
                            href={`/collections?search=${encodeURIComponent(keyword)}`}
                            className="text-sm text-purple-600 hover:text-purple-800 font-semibold shrink-0"
                        >
                            View all
                        </a>
                    )}
                </div>
                {intro && (
                    <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">
                        {intro}
                    </p>
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
