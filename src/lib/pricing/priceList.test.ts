import { describe, expect, it } from 'vitest';

import { buildCakeTypePriceSummaries } from './priceList';

describe('buildCakeTypePriceSummaries', () => {
  it('keeps canonical cake-type order and lowest price per size', () => {
    const summaries = buildCakeTypePriceSummaries([
      { type: 'Cupcake', cakesize: 'Box of 6', price: 420, display_order: 2 },
      { type: '1 Tier', cakesize: '6" Round', price: 950, display_order: 2 },
      { type: '1 Tier', cakesize: '6" Round', price: 900, display_order: 2 },
      { type: '1 Tier', cakesize: '8" Round', price: 1400, display_order: 3 },
      { type: '1 Tier Fondant', cakesize: '6" Round', price: 1600, display_order: 1 },
      { type: 'Cupcake', cakesize: 'Box of 12', price: 780, display_order: 3 },
    ]);

    expect(summaries.map((summary) => summary.cakeType)).toEqual([
      '1 Tier',
      '1 Tier Fondant',
      'Cupcake',
    ]);

    expect(summaries[0]).toMatchObject({
      cakeType: '1 Tier',
      startingPrice: 900,
      maxPrice: 1400,
      filterKey: 'soft-icing',
    });
    expect(summaries[0]?.prices).toEqual([
      { size: '6" Round', price: 900 },
      { size: '8" Round', price: 1400 },
    ]);
  });
});
