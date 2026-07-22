import { describe, expect, it } from 'vitest';
import {
  buildCollectionSearchPlan,
  cleanCollectionSearchQuery,
} from './searchPlan';

describe('collection search plan', () => {
  it('uses the same core query as search for multi-word character collections', () => {
    const plan = buildCollectionSearchPlan('Boss Baby Cake');

    expect(plan).toEqual({
      kind: 'text',
      query: 'Boss Baby',
      icingColor: null,
    });
  });

  it('normalizes collection slugs and suffixes consistently', () => {
    expect(cleanCollectionSearchQuery('pickleball-cakes')).toBe('pickleball');
    expect(cleanCollectionSearchQuery('Minimalist Cake')).toBe('Minimalist');
  });

  it('keeps color collections strict to the analyzed cake-side color', () => {
    const plan = buildCollectionSearchPlan('Lavender Cakes');

    expect(plan).toEqual({
      kind: 'color',
      query: 'Lavender',
      icingColor: 'purple',
    });
  });

  it('does not broaden short collection names into substring matching', () => {
    expect(buildCollectionSearchPlan('BL Cake')).toEqual({
      kind: 'text',
      query: 'BL',
      icingColor: null,
    });
  });
});
