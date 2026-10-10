import { describe, expect, it } from 'vitest';
import { buildLowestCakeBasePriceOptions } from './cakeBasePriceOptions';

describe('buildLowestCakeBasePriceOptions', () => {
  it('keeps the cheapest row per size and preserves page display order', () => {
    expect(buildLowestCakeBasePriceOptions([
      { cakesize: '8 inch', price: 1800, display_order: 2 },
      { cakesize: '6 inch', price: 1200, display_order: 1 },
      { cakesize: '6 inch', price: 1100, display_order: 1 },
      { cakesize: '10 inch', price: 2300, display_order: null },
    ])).toEqual([
      { size: '6 inch', price: 1100 },
      { size: '8 inch', price: 1800 },
      { size: '10 inch', price: 2300 },
    ]);
  });
});
