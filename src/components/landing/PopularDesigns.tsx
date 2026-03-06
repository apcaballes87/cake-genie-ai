'use client';

import { useState } from 'react';
import Link from 'next/link';
import LazyImage from '@/components/LazyImage';
import { Heart, Cake, Star, Zap, Clock, CalendarDays } from 'lucide-react';
import Masonry from 'react-masonry-css';
import { ProductCard } from '@/components/ProductCard';
import { getPopularDesigns } from '@/services/supabaseService';
import { createClient } from '@/lib/supabase/client';
import { formatStartingPrice } from '@/lib/utils/currency';

export interface PopularDesign {
    p_hash: string;
    slug: string;
    keywords: string;
    original_image_url: string;
    price: number;
    alt_text?: string;
    availability?: string;
    image_width?: number | null;
    image_height?: number | null;
}

interface PopularDesignsProps {
    designs: PopularDesign[];
}

export const PopularDesigns = ({ designs: initialDesigns }: PopularDesignsProps) => {
    const [designs, setDesigns] = useState<PopularDesign[]>(initialDesigns || []);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [displayCount, setDisplayCount] = useState(6);

    // Create client-side supabase client
    const [supabase] = useState(() => createClient());

    const loadMore = async () => {
        if (isLoading || !hasMore) return;

        setIsLoading(true);
        try {
            const nextCount = displayCount + 6;
            const { data, error } = await getPopularDesigns(nextCount, { keyword: 'minimalist', availability: ['rush', 'same-day'] }, supabase);

            if (error) {
                console.error('Error loading more designs:', error);
            } else if (data && data.length > 0) {
                setDesigns(data);
                setDisplayCount(nextCount);

                // If we got fewer than we asked for, there are no more
                if (data.length < nextCount) {
                    setHasMore(false);
                }
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Error loading more designs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!designs || designs.length === 0) return null;

    return (
        <section className="py-4 md:py-6">
            <div className="flex justify-between items-end mb-4 md:mb-6">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Minimalist Cakes for Rush Order</h2>
                    <p className="text-gray-500 text-sm md:text-base">Simple yet elegant designs available for same-day or rush delivery</p>
                </div>
            </div>

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
                {designs.slice(0, displayCount).map((design) => (
                    <div key={design.slug} className="mb-2 md:mb-3">
                        <ProductCard {...design} />
                    </div>
                ))}
            </Masonry>

            {/* Load More Button */}
            {hasMore ? (
                <div className="mt-1 text-center">
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
                            'Load More'
                        )}
                    </button>
                </div>
            ) : designs.length > 0 ? (
                <div className="mt-5 text-center text-slate-500">
                    <p>You've seen all the popular designs!</p>
                </div>
            ) : null}
        </section>
    );
};
