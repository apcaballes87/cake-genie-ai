import { describe, expect, it } from 'vitest';
import type { CakeGenieMerchantProduct } from '@/lib/database.types';
import { buildKnownSeoMetadata } from './knownSeoMetadata';

describe('buildKnownSeoMetadata', () => {
  it('preserves exact product SEO fields for known merchant products', () => {
    const product = {
      title: 'Lavender Bento Cake',
      slug: 'lavender-bento-cake-abc123',
      short_description: 'A minimalist lavender cake.',
      long_description: null,
      image_url: 'https://example.com/lavender.webp',
      alt_text: 'Lavender Korean minimalist bento cake',
      meta_keywords: 'lavender,bento,minimalist',
      og_title: 'Lavender Bento Cake | Genie.ph',
      og_description: 'Exact SEO metadata for the lavender cake.',
      tags: ['lavender', 'bento'],
      category: 'Minimalist',
      custom_price: 1299,
      availability: 'made_to_order',
    } as CakeGenieMerchantProduct;

    expect(buildKnownSeoMetadata(product)).toEqual({
      seo_title: 'Lavender Bento Cake | Genie.ph',
      seo_description: 'Exact SEO metadata for the lavender cake.',
      keywords: 'lavender,bento,minimalist',
      alt_text: 'Lavender Korean minimalist bento cake',
      slug: 'lavender-bento-cake-abc123',
      original_image_url: 'https://example.com/lavender.webp',
      price: 1299,
      availability: 'made_to_order',
    });
  });

  it('maps known recent-search designs without inventing availability', () => {
    expect(buildKnownSeoMetadata(undefined, {
      seo_title: 'Lavender Korean Minimalist Bento Cake',
      seo_description: 'Known SEO description from cached design.',
      keywords: 'lavender korean minimalist bento cake',
      alt_text: 'A lavender minimalist bento cake',
      slug: 'lavender-korean-minimalist-bento-cake-abc123',
      original_image_url: 'https://example.com/design.webp',
      price: 999,
    })).toEqual({
      seo_title: 'Lavender Korean Minimalist Bento Cake',
      seo_description: 'Known SEO description from cached design.',
      keywords: 'lavender korean minimalist bento cake',
      alt_text: 'A lavender minimalist bento cake',
      slug: 'lavender-korean-minimalist-bento-cake-abc123',
      original_image_url: 'https://example.com/design.webp',
      price: 999,
      availability: null,
    });
  });
});