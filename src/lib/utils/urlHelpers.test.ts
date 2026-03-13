import { describe, expect, it } from 'vitest';
import { generateCakeAnalysisSlug } from './urlHelpers';

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
