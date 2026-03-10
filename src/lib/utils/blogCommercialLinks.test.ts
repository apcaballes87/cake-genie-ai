import { describe, expect, it } from 'vitest';
import { resolveBlogCommercialLinks } from './blogCommercialLinks';

describe('resolveBlogCommercialLinks', () => {
  it('uses known collection routes when the topic is confidently matched', () => {
    expect(resolveBlogCommercialLinks({ keyword: 'minimalist cake' }).primary).toEqual({
      href: '/collections/minimalist',
      label: 'Browse Minimalist Cake Designs',
    });
  });

  it('uses birthday collection for buyer-intent topics instead of shop', () => {
    expect(
      resolveBlogCommercialLinks({ title: 'Where to Order Custom Cakes in Cebu' }).primary,
    ).toEqual({
      href: '/collections/birthday',
      label: 'Browse Cakes Collections',
    });
  });

  it('falls back to customizing category routes for unknown topics', () => {
    expect(resolveBlogCommercialLinks({ keyword: 'boho rainbow cake' }).primary).toEqual({
      href: '/customizing/category/boho-rainbow-cake',
      label: 'Browse Boho Rainbow Cake Designs',
    });
  });
});