'use client';

import React from 'react';
import Link from 'next/link';
import Masonry from 'react-masonry-css';
import { Star } from 'lucide-react';
import { ProductCard, type ProductCardProps } from '@/components/ProductCard';

export type CustomizingRelatedDesign = ProductCardProps & {
    alt_text?: string | null;
};

export interface CustomizingRelatedCollection {
    slug: string;
    name: string;
    item_count?: number | null;
    sample_image?: string | null;
}

interface CustomizingDiscoverySectionsProps {
    isAnalyzing: boolean;
    relatedDesigns: CustomizingRelatedDesign[];
    hasMoreDesigns: boolean;
    isLoadingMoreDesigns: boolean;
    onLoadMoreDesigns: () => void;
    relatedCollections: CustomizingRelatedCollection[];
}

const relatedDesignBreakpoints = {
    default: 6,
    1536: 6,
    1280: 5,
    1024: 4,
    768: 3,
    490: 2,
    0: 2,
};

const RelatedDesignsSection = React.memo(({
    relatedDesigns,
    hasMoreDesigns,
    isLoadingMoreDesigns,
    onLoadMoreDesigns,
}: Pick<CustomizingDiscoverySectionsProps, 'relatedDesigns' | 'hasMoreDesigns' | 'isLoadingMoreDesigns' | 'onLoadMoreDesigns'>) => {
    if (relatedDesigns.length === 0) return null;

    return (
        <div className="w-full pb-4 pt-1 mt-0">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">What other designs are trending in Cebu?</h2>
            <Masonry
                breakpointCols={relatedDesignBreakpoints}
                className="flex w-auto -ml-3"
                columnClassName="pl-3 bg-clip-padding"
            >
                {relatedDesigns.map((related, i) => (
                    <div key={`${related.slug}-${i}`} className="mb-3">
                        <ProductCard {...related} backgroundOnly />
                    </div>
                ))}
            </Masonry>

            {hasMoreDesigns && (
                <div className="flex justify-center mt-0">
                    <button
                        onClick={onLoadMoreDesigns}
                        disabled={isLoadingMoreDesigns}
                        className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-full border border-purple-200 shadow-sm hover:shadow-md hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                        aria-label="Show more related designs"
                    >
                        {isLoadingMoreDesigns ? (
                            <>
                                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                Loading...
                            </>
                        ) : (
                            'Show More Designs'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
});

RelatedDesignsSection.displayName = 'RelatedDesignsSection';

const RelatedCollectionsSection = React.memo(({
    relatedCollections,
}: Pick<CustomizingDiscoverySectionsProps, 'relatedCollections'>) => {
    if (relatedCollections.length === 0) return null;

    return (
        <div className="w-full pb-4 pt-1 mt-1 border-t border-slate-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Star className="w-5 h-5 text-purple-500 fill-purple-500" />
                        Explore Related Collections
                    </h2>
                    <p className="text-sm text-slate-500">Discover more designs in these curated categories</p>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {relatedCollections.map((collection) => (
                    <Link
                        key={collection.slug}
                        href={`/collections/${collection.slug}`}
                        className="group relative overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-200/60"
                    >
                        <div className="aspect-4/5 relative overflow-hidden">
                            {collection.sample_image && (
                                /* CSS background instead of <img> — prevents Google Images
                                   from indexing collection thumbnails as this page's images */
                                <div
                                    className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                    style={{ backgroundImage: `url(${collection.sample_image})` }}
                                    role="img"
                                    aria-label={collection.name}
                                />
                            )}
                            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

                            <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-500">
                                <h3 className="text-white font-bold text-sm md:text-base leading-tight drop-shadow-sm">{collection.name}</h3>
                                <div className="flex items-center gap-1.5 mt-1 opacity-90">
                                    <span className="text-[10px] md:text-xs text-white/90 font-medium bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full">
                                        {collection.item_count || 0} Designs
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
});

RelatedCollectionsSection.displayName = 'RelatedCollectionsSection';

export const CustomizingDiscoverySections = React.memo(({
    isAnalyzing,
    relatedDesigns,
    hasMoreDesigns,
    isLoadingMoreDesigns,
    onLoadMoreDesigns,
    relatedCollections,
}: CustomizingDiscoverySectionsProps) => {
    if (isAnalyzing || (relatedDesigns.length === 0 && relatedCollections.length === 0)) {
        return null;
    }

    return (
        <>
            <RelatedDesignsSection
                relatedDesigns={relatedDesigns}
                hasMoreDesigns={hasMoreDesigns}
                isLoadingMoreDesigns={isLoadingMoreDesigns}
                onLoadMoreDesigns={onLoadMoreDesigns}
            />
            <RelatedCollectionsSection relatedCollections={relatedCollections} />
        </>
    );
});

CustomizingDiscoverySections.displayName = 'CustomizingDiscoverySections';