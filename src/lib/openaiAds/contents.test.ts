import { describe, expect, it } from 'vitest';
import { buildOpenAIAdsProductContents } from './contents';

describe('buildOpenAIAdsProductContents', () => {
  it('uses the design slug from the order commerce snapshot', () => {
    expect(buildOpenAIAdsProductContents([{
      cake_type: 'Bento',
      quantity: 2,
      customization_details: {
        commerce_snapshot: {
          product: { designSlug: 'blue-bento-cake', sourceSurface: 'customizing' },
        },
      },
    }])).toEqual([{
      id: 'blue-bento-cake',
      name: 'Custom Cake - Bento',
      content_type: 'product',
      quantity: 2,
    }]);
  });

  it('omits non-feed merchant and uploaded-image items', () => {
    expect(buildOpenAIAdsProductContents([
      {
        cake_type: 'Bento',
        quantity: 1,
        customization_details: {
          commerce_snapshot: {
            product: { designSlug: 'merchant-cake', sourceSurface: 'merchant_product' },
          },
        },
      },
      {
        cake_type: 'Bento',
        quantity: 1,
        customization_details: {
          commerce_snapshot: {
            product: { designSlug: null, sourceSurface: 'uploaded_image' },
          },
        },
      },
    ])).toEqual([]);
  });
});
