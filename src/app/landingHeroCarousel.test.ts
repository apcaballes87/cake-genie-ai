import { describe, expect, it } from 'vitest';

import { getMobileHeroCarouselVisibleIndices, getNextMobileHeroScrollAccumulation } from './landingHeroCarousel';

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

describe('getNextMobileHeroScrollAccumulation', () => {
    it('accumulates downward scroll while the hero is visible', () => {
        expect(getNextMobileHeroScrollAccumulation({
            accumulatedDelta: 20,
            productCount: 6,
            scrollDelta: 40,
            threshold: 100,
            userCanSeeHero: true,
        })).toEqual({
            accumulatedDelta: 60,
            direction: null,
            shouldAdvance: false,
        });
    });

    it('advances once the downward scroll threshold is reached', () => {
        expect(getNextMobileHeroScrollAccumulation({
            accumulatedDelta: 70,
            productCount: 6,
            scrollDelta: 35,
            threshold: 100,
            userCanSeeHero: true,
        })).toEqual({
            accumulatedDelta: 0,
            direction: 'next',
            shouldAdvance: true,
        });
    });

    it('resets accumulation when the hero is not visible', () => {
        expect(getNextMobileHeroScrollAccumulation({
            accumulatedDelta: 70,
            productCount: 6,
            scrollDelta: 35,
            threshold: 100,
            userCanSeeHero: false,
        })).toEqual({
            accumulatedDelta: 0,
            direction: null,
            shouldAdvance: false,
        });
    });

    it('starts accumulating upward scroll immediately after a direction change', () => {
        expect(getNextMobileHeroScrollAccumulation({
            accumulatedDelta: 70,
            productCount: 6,
            scrollDelta: -12,
            threshold: 100,
            userCanSeeHero: true,
        })).toEqual({
            accumulatedDelta: -12,
            direction: null,
            shouldAdvance: false,
        });
    });

    it('advances to the previous slide once the upward threshold is reached', () => {
        expect(getNextMobileHeroScrollAccumulation({
            accumulatedDelta: -46,
            productCount: 6,
            scrollDelta: -18,
            threshold: 60,
            userCanSeeHero: true,
        })).toEqual({
            accumulatedDelta: 0,
            direction: 'prev',
            shouldAdvance: true,
        });
    });

    it('can advance immediately on a large direction-changing scroll', () => {
        expect(getNextMobileHeroScrollAccumulation({
            accumulatedDelta: 70,
            productCount: 6,
            scrollDelta: -120,
            threshold: 100,
            userCanSeeHero: true,
        })).toEqual({
            accumulatedDelta: -120,
            direction: 'prev',
            shouldAdvance: true,
        });
    });
});
