'use client';

import React from 'react';
import Link from 'next/link';
import { ProductCard, type ProductCardProps } from '@/components/ProductCard';
import { GoogleSearchSection } from './GoogleSearchSection';

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
    const pageHref = (page: number) => page <= 1 ? basePath : `${basePath}?page=${page}`;

    return (
        <div>
            {/* Designs Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {initialDesigns.map((design, index) => (
                    <div
                        key={`${design.slug}-${design.p_hash}`}
                        className={index === 0 ? 'col-span-2 min-w-0 sm:col-span-1' : 'min-w-0'}
                    >
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
                            priority={index === 0}
                            collectionContext={collectionTitle}
                            listName="collection_page"
                        />
                        <p className="mt-2 px-1 text-xs leading-5 text-slate-600">
                            {design.alt_text || `${design.keywords || collectionTitle || 'Custom cake'} design available for customization in Cebu.`}
                        </p>
                    </div>
                ))}
            </div>

            <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Collection pages">
                {currentPage > 1 && (
                    <Link
                        rel="prev"
                        href={pageHref(currentPage - 1)}
                        className="rounded-full border border-purple-200 bg-white px-5 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50"
                    >
                        Previous
                    </Link>
                )}
                <span className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages && (
                    <Link
                        rel="next"
                        href={pageHref(currentPage + 1)}
                        className="rounded-full border border-purple-200 bg-white px-5 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50"
                    >
                        Next designs
                    </Link>
                )}
            </nav>

            {/* Optional external inspiration should not compete with the
                collection's above-the-fold commercial images. It loads only
                when a visitor approaches this below-the-fold section. */}
            <DeferredGoogleSearchSection keyword={keyword} />
        </div>
    );
};
