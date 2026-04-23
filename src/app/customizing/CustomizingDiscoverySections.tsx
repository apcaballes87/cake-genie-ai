'use client';

import React from 'react';
import Masonry from 'react-masonry-css';
import { ProductCard, type ProductCardProps } from '@/components/ProductCard';

export type CustomizingRelatedDesign = ProductCardProps & {
    alt_text?: string | null;
};

interface CustomizingDiscoverySectionsProps {
    isAnalyzing: boolean;
    relatedDesigns: CustomizingRelatedDesign[];
    hasMoreDesigns: boolean;
    isLoadingMoreDesigns: boolean;
    onLoadMoreDesigns: () => void;
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
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Related Cake Designs</h2>
            <Masonry
                breakpointCols={relatedDesignBreakpoints}
                className="flex w-auto -ml-3"
                columnClassName="pl-3 bg-clip-padding"
            >
                {relatedDesigns.map((related, i) => (
                    <div key={`${related.slug}-${i}`} className="mb-3">
                        <ProductCard {...related} backgroundOnly listName="related_designs" />
                    </div>
                ))}
            </Masonry>

            {hasMoreDesigns && (
                <div className="flex justify-center mt-0">
                    <button
                        onClick={onLoadMoreDesigns}
                        disabled={isLoadingMoreDesigns}
                        className="genie-btn-secondary px-8 py-3 font-semibold rounded-full disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
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


export const CustomizingDiscoverySections = React.memo(({
    isAnalyzing,
    relatedDesigns,
    hasMoreDesigns,
    isLoadingMoreDesigns,
    onLoadMoreDesigns,
}: CustomizingDiscoverySectionsProps) => {
    if (isAnalyzing || relatedDesigns.length === 0) {
        return null;
    }

    return (
        <RelatedDesignsSection
            relatedDesigns={relatedDesigns}
            hasMoreDesigns={hasMoreDesigns}
            isLoadingMoreDesigns={isLoadingMoreDesigns}
            onLoadMoreDesigns={onLoadMoreDesigns}
        />
    );
});

CustomizingDiscoverySections.displayName = 'CustomizingDiscoverySections';
