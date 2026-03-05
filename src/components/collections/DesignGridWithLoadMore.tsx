'use client';

import React, { useState } from 'react';
import { ProductCard } from '@/components/ProductCard';
import Masonry from 'react-masonry-css';
import { GoogleSearchSection } from './GoogleSearchSection';
import { fetchMoreDesigns } from '@/app/collections/actions';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface DesignGridWithLoadMoreProps {
    initialDesigns: any[];
    keyword: string;
}

export const DesignGridWithLoadMore: React.FC<DesignGridWithLoadMoreProps> = ({ initialDesigns, keyword }) => {
    const [designs, setDesigns] = useState<any[]>(initialDesigns);
    const [offset, setOffset] = useState(30);
    const [hasMore, setHasMore] = useState(true); // Assume true initially if we have 30 items, or check length
    const [isLoading, setIsLoading] = useState(false);

    // If initial designs are less than 30, we probably don't have more.
    React.useEffect(() => {
        if (initialDesigns.length < 30) {
            setHasMore(false);
        }
    }, [initialDesigns.length]);

    const loadMore = async () => {
        if (isLoading || !hasMore) return;
        setIsLoading(true);

        try {
            const newDesigns = await fetchMoreDesigns(keyword, offset);

            if (newDesigns.length === 0) {
                setHasMore(false);
            } else {
                setDesigns(prev => [...prev, ...newDesigns]);
                setOffset(prev => prev + 30);
                if (newDesigns.length < 30) {
                    setHasMore(false);
                }
            }
        } catch (error) {
            console.error("Failed to load more designs", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            {/* Designs Grid */}
            <Masonry
                breakpointCols={{
                    default: 6,
                    1536: 6,
                    1280: 5,
                    1024: 4,
                    768: 3,
                    490: 2,
                    0: 2
                }}
                className="flex w-auto -ml-4"
                columnClassName="pl-4 bg-clip-padding"
            >
                {designs.map((design: any) => (
                    <div key={`${design.slug}-${design.p_hash}`} className="mb-4">
                        <ProductCard
                            p_hash={design.p_hash}
                            original_image_url={design.original_image_url}
                            price={design.price}
                            keywords={design.keywords}
                            slug={design.slug}
                            availability={design.availability}
                            analysis_json={design.analysis_json}
                            image_width={design.image_width}
                            image_height={design.image_height}
                        />
                    </div>
                ))}
            </Masonry>

            {/* Load More Button */}
            {hasMore ? (
                <div className="mt-12 text-center">
                    <button
                        onClick={loadMore}
                        disabled={isLoading}
                        className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-full border border-purple-200 shadow-sm hover:shadow-md hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                Loading...
                            </>
                        ) : (
                            'Load More Designs'
                        )}
                    </button>
                    {/* Render Google Search Section BELOW the button only if there are more items to load? 
                        The user requirement: "lets put a load more button at the bottom then just under the load more button, can we add a google search results"
                        So it should be always visible under the button.
                    */}
                </div>
            ) : (
                <div className="mt-12 text-center text-slate-500">
                    <p>You've seen all the designs in our collection.</p>
                </div>
            )}

            {/* Google Search Section - Always visible at the bottom of the list */}
            <GoogleSearchSection keyword={keyword} />
        </div>
    );
};
