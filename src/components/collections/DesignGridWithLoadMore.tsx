'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Masonry from 'react-masonry-css';
import { ProductCard, type ProductCardProps } from '@/components/ProductCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { fetchMoreDesigns } from '@/app/collections/actions';
import { GoogleSearchSection } from './GoogleSearchSection';

const COLLECTION_PAGE_SIZE = 30;
const SEARCH_RESULTS_BREAKPOINTS = {
    default: 6,
    1536: 6,
    1280: 5,
    1024: 4,
    768: 3,
    640: 2,
};

interface DesignGridWithLoadMoreProps {
    initialDesigns: CollectionDesign[];
    keyword: string;
    /** Collection title for enriching image alt text with gallery context */
    collectionTitle?: string;
    currentPage?: number;
    totalPages?: number;
    basePath?: string;
}

type CollectionDesign = Pick<
    ProductCardProps,
    | 'p_hash'
    | 'original_image_url'
    | 'studio_edited_image_url'
    | 'price'
    | 'keywords'
    | 'slug'
    | 'availability'
    | 'analysis_json'
    | 'image_width'
    | 'image_height'
    | 'image_variants'
> & {
    alt_text?: string | null;
};

function DeferredGoogleSearchSection({ keyword }: { keyword: string }) {
    const sentinelRef = React.useRef<HTMLDivElement>(null);
    const [shouldLoad, setShouldLoad] = React.useState(false);

    React.useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || shouldLoad) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (!entry?.isIntersecting) return;
            setShouldLoad(true);
            observer.disconnect();
        }, { rootMargin: '800px 0px' });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [shouldLoad]);

    return (
        <div ref={sentinelRef}>
            {shouldLoad ? <GoogleSearchSection keyword={keyword} /> : null}
        </div>
    );
}

export const DesignGridWithLoadMore: React.FC<DesignGridWithLoadMoreProps> = ({
    initialDesigns,
    keyword,
    collectionTitle,
    currentPage = 1,
    totalPages = 1,
    basePath = '/collections',
}) => {
    const [designs, setDesigns] = useState<CollectionDesign[]>(initialDesigns);
    const [nextOffset, setNextOffset] = useState(currentPage * COLLECTION_PAGE_SIZE);
    const [loadedThroughPage, setLoadedThroughPage] = useState(currentPage);
    const [isLoading, setIsLoading] = useState(false);
    const pageHref = (page: number) => page <= 1 ? basePath : `${basePath}?page=${page}`;
    const hasMore = loadedThroughPage < totalPages;

    useEffect(() => {
        setDesigns(initialDesigns);
        setNextOffset(currentPage * COLLECTION_PAGE_SIZE);
        setLoadedThroughPage(currentPage);
        setIsLoading(false);
    }, [currentPage, initialDesigns, keyword]);

    const loadMore = async () => {
        if (isLoading || !hasMore) return;
        setIsLoading(true);

        try {
            const result = await fetchMoreDesigns(keyword, nextOffset);
            const nextDesigns = result.designs as CollectionDesign[];

            setDesigns((previousDesigns) => {
                const existingDesigns = new Set(
                    previousDesigns.map((design) => design.slug || design.p_hash),
                );
                const uniqueDesigns = nextDesigns.filter(
                    (design) => !existingDesigns.has(design.slug || design.p_hash),
                );
                return [...previousDesigns, ...uniqueDesigns];
            });
            setNextOffset((offset) => offset + COLLECTION_PAGE_SIZE);
            setLoadedThroughPage((page) => (
                result.reachedEnd
                    ? totalPages
                    : Math.min(page + 1, totalPages)
            ));
        } catch (error) {
            console.error('Failed to load more collection designs', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <Masonry
                breakpointCols={SEARCH_RESULTS_BREAKPOINTS}
                className="flex -ml-3 w-auto"
                columnClassName="pl-3 bg-clip-padding"
            >
                {designs.map((design, index) => (
                    <div key={`${design.slug}-${design.p_hash}`} className="mb-3">
                        <ProductCard
                            p_hash={design.p_hash}
                            original_image_url={design.original_image_url}
                            studio_edited_image_url={design.studio_edited_image_url}
                            price={design.price}
                            keywords={design.keywords}
                            slug={design.slug}
                            availability={design.availability}
                            analysis_json={design.analysis_json}
                            image_width={design.image_width}
                            image_height={design.image_height}
                            image_variants={design.image_variants}
                            priority={index < 4}
                            collectionContext={collectionTitle}
                            listName="collection_page"
                        />
                    </div>
                ))}
            </Masonry>

            {hasMore && (
                <div className="flex justify-center mt-6 mb-2">
                    <Link
                        rel="next"
                        href={pageHref(loadedThroughPage + 1)}
                        onClick={(event) => {
                            event.preventDefault();
                            void loadMore();
                        }}
                        aria-disabled={isLoading}
                        className={`px-6 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-full border border-purple-200 transition-colors flex items-center gap-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isLoading ? (
                            <>
                                <LoadingSpinner />
                                Loading...
                            </>
                        ) : (
                            <>Load more designs</>
                        )}
                    </Link>
                </div>
            )}

            {/* Optional external inspiration should not compete with the
                collection's above-the-fold commercial images. It loads only
                when a visitor approaches this below-the-fold section. */}
            <DeferredGoogleSearchSection keyword={keyword} />
        </div>
    );
};
