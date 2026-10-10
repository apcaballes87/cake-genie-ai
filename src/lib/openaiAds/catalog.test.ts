import { describe, expect, it } from 'vitest';
import {
  buildLowestPriceOptionsByCakeType,
  buildOpenAIAdsCatalogCsv,
  buildOpenAIAdsCatalogProducts,
  mapDesignAvailabilityToOpenAIAds,
} from './catalog';

describe('OpenAI Ads product catalog', () => {
  const pricesByCakeType = buildLowestPriceOptionsByCakeType([
    { type: '1 Tier', cakesize: '8 inch', price: 1500, display_order: 1 },
    { type: '1 Tier', cakesize: '6 inch', price: 1200, display_order: 2 },
  ]);

  it('uses the page-visible starting price and stable slug ID with explicit eligibility', () => {
    const [product] = buildOpenAIAdsCatalogProducts([{
      slug: 'pink-cake-1a2b',
      seo_title: 'Pink Cake, Special "Edition" | Genie.ph',
      seo_description: 'A custom pink cake, made for celebrations.',
      price: 1200,
      availability: 'normal',
      studio_edited_image_url: 'https://images.genie.ph/pink-cake.webp',
      analysis_json: { cakeType: '1 Tier' },
    }], {
      pricesByCakeType,
      returnPolicyUrl: 'https://genie.ph/return-policy',
    });

    expect(product).toMatchObject({
      item_id: 'pink-cake-1a2b',
      title: 'Pink Cake, Special "Edition"',
      url: 'https://genie.ph/customizing/pink-cake-1a2b',
      image_url: 'https://images.genie.ph/pink-cake.webp',
      price: '1500.00 PHP',
      availability: 'pre_order',
      is_eligible_search: 'false',
      is_eligible_checkout: 'false',
      is_ads_eligible: 'true',
      target_countries: 'PH',
      store_country: 'PH',
    });
  });

  it('excludes rows without a reliable price or public edited image and deduplicates slugs', () => {
    const products = buildOpenAIAdsCatalogProducts([
      {
        slug: 'same-design',
        price: null,
        availability: 'in_stock',
        studio_edited_image_url: 'https://images.genie.ph/design.webp',
        analysis_json: { cakeType: '1 Tier' },
      },
      {
        slug: 'same-design',
        price: 1300,
        availability: 'in_stock',
        studio_edited_image_url: 'https://images.genie.ph/design.webp',
        analysis_json: { cakeType: '1 Tier' },
      },
      {
        slug: 'signed-image',
        price: 1300,
        studio_edited_image_url: 'https://images.genie.ph/storage/v1/object/sign/design.webp?token=secret',
        analysis_json: { cakeType: '1 Tier' },
      },
      {
        slug: 'no-price',
        price: null,
        studio_edited_image_url: 'https://images.genie.ph/no-price.webp',
        analysis_json: { cakeType: 'Bento' },
      },
    ], {
      pricesByCakeType,
      returnPolicyUrl: 'https://genie.ph/return-policy',
    });

    expect(products.map((product) => product.item_id)).toEqual(['same-design']);
  });

  it('maps known availability values and preserves unknown as unknown', () => {
    expect(mapDesignAvailabilityToOpenAIAds('rush')).toBe('in_stock');
    expect(mapDesignAvailabilityToOpenAIAds('same-day')).toBe('in_stock');
    expect(mapDesignAvailabilityToOpenAIAds('out_of_stock')).toBe('out_of_stock');
    expect(mapDesignAvailabilityToOpenAIAds(null)).toBe('unknown');
    expect(mapDesignAvailabilityToOpenAIAds('unrecognized')).toBe('unknown');
  });

  it('quotes and doubles CSV values that contain commas and quotes', () => {
    const products = buildOpenAIAdsCatalogProducts([{
      slug: 'comma-cake',
      seo_title: 'Cake, with "quotes"',
      seo_description: 'A cake, with "details".',
      price: 1300,
      studio_edited_image_url: 'https://images.genie.ph/cake.webp',
      analysis_json: { cakeType: 'Bento' },
    }], {
      pricesByCakeType: { Bento: [{ size: '4 inch', price: 1300 }] },
      returnPolicyUrl: 'https://genie.ph/return-policy',
    });

    const csv = buildOpenAIAdsCatalogCsv(products);
    expect(csv.split('\r\n')[0]).toContain('item_id,title,description,url');
    expect(csv).toContain('"Cake, with ""quotes"""');
    expect(csv).toContain('"A cake, with ""details""."');
  });
});
