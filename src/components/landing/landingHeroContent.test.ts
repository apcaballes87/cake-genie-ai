import { describe, expect, it } from 'vitest';
import { DEFAULT_LANDING_HERO_CONTENT } from './landingHeroContent';

describe('default landing hero headline', () => {
  it('uses a static prefix and suffix around the image-driven cake phrase', () => {
    expect(DEFAULT_LANDING_HERO_CONTENT.headlinePrefix).toBe('Extraordinary');
    expect(DEFAULT_LANDING_HERO_CONTENT.headlineVariants[0]).toBe('Custom Cakes');
    expect(DEFAULT_LANDING_HERO_CONTENT.headlineSuffix).toBe('Crafted for you');
    expect(DEFAULT_LANDING_HERO_CONTENT.products.find(product => product.title === 'Vintage Cakes')?.headlineVariant)
      .toBe(2);
  });
});
