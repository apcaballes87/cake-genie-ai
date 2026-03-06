'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ProductCard } from '@/components/ProductCard';
import Masonry from 'react-masonry-css';
import { getRelatedProductsByKeywords } from '@/services/supabaseService';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BlogUploadButton } from './BlogUploadButton';

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
    const [offset, setOffset] = useState(8);
    const [hasMore, setHasMore] = useState(initialProducts.length >= 8);
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
            const { data } = await getRelatedProductsByKeywords(keyword, slug, 8, offset);
            const newProducts = data || [];

            if (newProducts.length === 0) {
                setHasMore(false);
            } else {
                setProducts(prev => [...prev, ...newProducts]);
                setOffset(prev => prev + 8);
                if (newProducts.length < 8) {
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
        <div ref={sectionRef} className="mt-16">
            {/* Upload Button Section */}
            <div className="mb-12 p-8 bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50 rounded-3xl border border-purple-100 shadow-sm">
                <div className="text-center max-w-2xl mx-auto">
                    <p className="text-gray-700 mb-6 font-medium text-lg leading-relaxed">
                        Have a different cake design in mind? Upload a photo and we'll give you a price estimate in seconds!
                    </p>
                    <BlogUploadButton />
                </div>
            </div>

            <div
                className={`pt-12 border-t border-purple-100 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
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

                <Masonry
                    breakpointCols={{
                        default: 6,
                        1536: 6,
                        1280: 5,
                        1024: 4,
                        768: 3,
                        0: 2
                    }}
                    className="flex w-auto -ml-4"
                    columnClassName="pl-4 bg-clip-padding"
                >
                    {products.map((product, index) => (
                        <div key={`${product.slug || product.p_hash}-${index}`} className="mb-4">
                            <ProductCard
                                p_hash={product.p_hash}
                                original_image_url={product.original_image_url}
                                price={product.price}
                                keywords={product.keywords}
                                slug={product.slug}
                                availability={product.availability}
                                analysis_json={product.analysis_json}
                            />
                        </div>
                    ))}
                </Masonry>

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
        </div>
    );
};
