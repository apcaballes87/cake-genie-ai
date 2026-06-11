import { describe, expect, it } from 'vitest';

import { getMobileHeroCarouselVisibleIndices } from './landingHeroCarousel';

describe('getMobileHeroCarouselVisibleIndices', () => {
    it('wraps from the start of the carousel to show previous, current, and next slides', () => {
        expect(getMobileHeroCarouselVisibleIndices(6, 0)).toEqual([5, 0, 1]);
    });

    it('returns the previous, current, and next slides for a middle index', () => {
        expect(getMobileHeroCarouselVisibleIndices(6, 3)).toEqual([2, 3, 4]);
    });

    it('wraps from the end of the carousel back to the first slide', () => {
        expect(getMobileHeroCarouselVisibleIndices(6, 5)).toEqual([4, 5, 0]);
    });

    it('keeps a two-slide carousel stable without duplicating indices', () => {
        expect(getMobileHeroCarouselVisibleIndices(2, 0)).toEqual([1, 0]);
        expect(getMobileHeroCarouselVisibleIndices(2, 1)).toEqual([0, 1]);
    });
});
