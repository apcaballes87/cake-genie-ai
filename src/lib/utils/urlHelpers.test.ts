import { describe, expect, it } from 'vitest';
import { generateCakeAnalysisSlug, downgradeCakeSlug } from './urlHelpers';

describe('generateCakeAnalysisSlug', () => {
  it('generates a slug with all parameters provided', () => {
    expect(
      generateCakeAnalysisSlug({
        keyword: 'Unicorn Birthday',
        icingColor: 'pink',
        cakeType: '2-tier',
        pHash: 'b7c4ef9',
      }),
    ).toBe('unicorn-birthday-pink-2-tier-cake-b7c4');
  });

  it('handles missing keyword by defaulting to custom-cake', () => {
    expect(
      generateCakeAnalysisSlug({
        icingColor: 'blue',
        cakeType: 'bento',
        pHash: 'a1b2',
      }),
    ).toBe('custom-cake-blue-bento-cake-a1b2');
  });

  it('handles missing optional parameters correctly', () => {
    expect(
      generateCakeAnalysisSlug({
        keyword: 'Minimalist',
      }),
    ).toBe('minimalist-cake');

    expect(
      generateCakeAnalysisSlug({
        keyword: 'Minecraft Cake',
        pHash: 'a1b2c3d4',
      }),
    ).toBe('minecraft-cake-a1b2'); // prevent duplicate cake, and truncate pHash
  });

  it('converts hex colors to closest color name', () => {
    // Exact match
    expect(
      generateCakeAnalysisSlug({
        keyword: 'flower cake',
        icingColor: '#ff0000', // red
      }),
    ).toBe('flower-cake-red-cake');

    // Close match
    expect(
      generateCakeAnalysisSlug({
        keyword: 'simple cake',
        icingColor: '#fafafa', // closest to white (#ffffff)
      }),
    ).toBe('simple-cake-white-cake');

    // Without # symbol
    expect(
      generateCakeAnalysisSlug({
        keyword: 'chocolate',
        icingColor: 'a52a2a', // brown
      }),
    ).toBe('chocolate-brown-cake');
  });

  it('truncates pHash to 4 characters', () => {
    expect(
      generateCakeAnalysisSlug({
        keyword: 'Dinosaur',
        pHash: '1234567890abcdef',
      }),
    ).toBe('dinosaur-cake-1234');
  });

  it('prevents duplicate cake suffixes', () => {
    expect(
      generateCakeAnalysisSlug({
        keyword: 'Spider-man cake', // Ends in cake
        pHash: 'abcd',
      }),
    ).toBe('spider-man-cake-abcd'); // Should not be spider-man-cake-cake-abcd

    // Testing when it's just cake
    expect(
      generateCakeAnalysisSlug({
        keyword: 'cake',
        cakeType: 'cake',
      }),
    ).toBe('cake-cake-cake');
  });
});

describe('downgradeCakeSlug', () => {
  it('returns stripped slug first, then hex-converted slug', () => {
    // "white" is a color name, so both candidates are returned
    expect(downgradeCakeSlug('mickey-mouse-white-1-tier-cake-ffdf'))
      .toEqual([
        'mickey-mouse-white-1-tier-ffdf',      // stripped only
        'mickey-mouse-ffffff-1-tier-ffdf',      // stripped + hex conversion
      ]);
  });

  it('strips cake and converts color names for full transformation', () => {
    expect(downgradeCakeSlug('wedding-cake-ivory-2-tier-cake-e7e7'))
      .toEqual([
        'wedding-cake-ivory-2-tier-e7e7',       // stripped only
        'wedding-cake-fffff0-2-tier-e7e7',      // stripped + hex conversion
      ]);
  });

  it('returns only hex-converted candidate when no -cake- to strip', () => {
    // No -cake- before hash, but has color name "white" to convert
    expect(downgradeCakeSlug('mickey-mouse-white-1-tier-ffdf'))
      .toEqual(['mickey-mouse-ffffff-1-tier-ffdf']);
  });

  it('handles slugs without color names (only strips cake)', () => {
    expect(downgradeCakeSlug('construction-boss-1-tier-cake-fffb'))
      .toEqual(['construction-boss-1-tier-fffb']);
  });

  it('handles hyphenated color names like sky-blue', () => {
    expect(downgradeCakeSlug('unicorn-sky-blue-2-tier-cake-abcd'))
      .toEqual([
        'unicorn-sky-blue-2-tier-abcd',         // stripped only
        'unicorn-87ceeb-2-tier-abcd',           // stripped + hex conversion
      ]);
  });

  it('returns empty array for empty slugs', () => {
    expect(downgradeCakeSlug('')).toEqual([]);
  });

  it('handles slugs with no hash suffix (no -cake- to strip)', () => {
    // No trailing hex hash, so no -cake- stripping happens
    // But "red" is a color name, so hex conversion is returned
    expect(downgradeCakeSlug('simple-red-cake'))
      .toEqual(['simple-ff0000-cake']);
  });
});
