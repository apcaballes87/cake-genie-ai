import type { RecommendedProductsQueryOptions } from '@/services/supabaseService';
import { RecommendedProductsGrid } from './RecommendedProductsGrid';

interface RecommendedProduct {
    p_hash: string;
    original_image_url: string;
    studio_edited_image_url?: string | null;
    price: number;
    keywords?: string;
    slug?: string;
    availability?: string;
    analysis_json?: {
        cakeType?: string;
        icing_design?: string;
        [key: string]: unknown;
    };
    image_width?: number | null;
    image_height?: number | null;
    /** Variant manifest jsonb. ProductCard parses it. */
    image_variants?: unknown;
}

interface RecommendedProductsSectionProps {
    products: RecommendedProduct[];
    queryOptions?: RecommendedProductsQueryOptions;
    headingHighlight?: string;
    headingText?: string;
    description?: string;
    listName?: string;
    emptyStateText?: string;
    loadMoreEnabled?: boolean;
}

export const RecommendedProductsSection = ({
    products,
    queryOptions,
    headingHighlight,
    headingText,
    description,
    listName,
    emptyStateText,
    loadMoreEnabled,
}: RecommendedProductsSectionProps) => {
    return (
        <RecommendedProductsGrid
            initialProducts={products}
            queryOptions={queryOptions}
            headingHighlight={headingHighlight}
            headingText={headingText}
            description={description}
            listName={listName}
            emptyStateText={emptyStateText}
            loadMoreEnabled={loadMoreEnabled}
        />
    );
};

export default RecommendedProductsSection;
