import { describe, expect, it } from 'vitest';
import { resolveBlogCommercialLinks } from './blogCommercialLinks';

describe('resolveBlogCommercialLinks', () => {
  it('uses known collection routes when the topic is confidently matched', () => {
    expect(resolveBlogCommercialLinks({ keyword: 'minimalist cake' }).primary).toEqual({
      href: '/collections/minimalist-cake',
      label: 'Browse Minimalist Cake Designs',
    });
  });

  it.each([
    ['bento cake', '/collections/bento-cake'],
    ['minecraft cake', '/collections/minecraft-cake'],
    ['hello kitty cake', '/collections/hello-kitty-cake'],
  ])('uses the canonical collection slug for %s', (keyword, href) => {
    expect(resolveBlogCommercialLinks({ keyword }).primary.href).toBe(href);
  });

  it('uses the published collection directory for buyer-intent topics', () => {
    expect(
      resolveBlogCommercialLinks({ title: 'Where to Order Custom Cakes in Cebu' }).primary,
    ).toEqual({
      href: '/collections',
      label: 'Browse Cakes Collections',
    });
  });

  it('does not link birthday posts to an unpublished birthday collection', () => {
    expect(resolveBlogCommercialLinks({ keyword: 'birthday cake' }).primary.href).toBe('/collections');
  });

  it('falls back to the published collections directory for unknown topics', () => {
    expect(resolveBlogCommercialLinks({ keyword: 'boho rainbow cake' }).primary).toEqual({
      href: '/collections',
      label: 'Browse Cake Collections',
    });
  });
});
