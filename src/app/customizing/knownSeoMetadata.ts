import type { CakeGenieMerchantProduct } from '@/lib/database.types';
import type { CacheSEOMetadata } from '@/types';

export interface KnownRecentSearchDesignLike {
  seo_title: string | null;
  seo_description: string | null;
  keywords: string | null;
  alt_text: string | null;
  slug: string | null;
  original_image_url: string | null;
  price: number | null;
}

export function buildKnownSeoMetadata(
  product?: CakeGenieMerchantProduct,
  recentSearchDesign?: KnownRecentSearchDesignLike
): CacheSEOMetadata | null {
  if (product) {
    return {
      seo_title: product.og_title || product.title,
      seo_description: product.og_description || product.short_description || product.long_description,
      keywords: product.meta_keywords || product.tags?.join(', ') || product.category,
      alt_text: product.alt_text || product.title,
      slug: product.slug,
      original_image_url: product.image_url,
      price: product.custom_price,
      availability: product.availability,
    };
  }

  if (recentSearchDesign) {
    return {
      seo_title: recentSearchDesign.seo_title,
      seo_description: recentSearchDesign.seo_description,
      keywords: recentSearchDesign.keywords,
      alt_text: recentSearchDesign.alt_text,
      slug: recentSearchDesign.slug,
      original_image_url: recentSearchDesign.original_image_url,
      price: recentSearchDesign.price,
      availability: null,
    };
  }

  return null;
}