import { RecommendedProductsGrid } from './RecommendedProductsGrid';

interface RecommendedProduct {
    p_hash: string;
    original_image_url: string;
    price: number;
    keywords?: string;
    slug?: string;
    analysis_json?: {
        cakeType?: string;
        icing_design?: string;
        [key: string]: unknown;
    };
}

interface RecommendedProductsSectionProps {
    products: RecommendedProduct[];
}

export const RecommendedProductsSection = ({ products }: RecommendedProductsSectionProps) => {
    return <RecommendedProductsGrid initialProducts={products} />;
};

export default RecommendedProductsSection;
