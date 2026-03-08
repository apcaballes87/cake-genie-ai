import { describe, expect, it } from 'vitest';
import {
  getDistinctiveRelatedSearchTerms,
  normalizeRelatedSearchPhrase,
  rankRelatedProducts,
} from './relatedProductSearch';

describe('relatedProductSearch helpers', () => {
  it('keeps the full phrase normalized while dropping generic terms from distinctive matching', () => {
    expect(normalizeRelatedSearchPhrase('Textured Buttercream Minimalist Cake')).toBe(
      'textured buttercream minimalist cake',
    );
    expect(getDistinctiveRelatedSearchTerms('Textured Buttercream Minimalist Cake')).toEqual([
      'textured',
      'buttercream',
    ]);
  });

  it('falls back to broad style terms only when nothing more distinctive exists', () => {
    expect(getDistinctiveRelatedSearchTerms('Minimalist Cake')).toEqual(['minimalist']);
  });

  it('does not treat short terms as substring matches inside unrelated words', () => {
    const ranked = rankRelatedProducts(
      [
        {
          slug: 'true-ube-cake',
          keywords: 'ube cake minimalist',
          alt_text: 'Minimalist ube cake',
          usage_count: 1,
        },
        {
          slug: 'youtube-themed-cake',
          keywords: 'youtube fondant cake',
          alt_text: 'Youtube birthday cake',
          usage_count: 999,
        },
      ],
      'Minimalist Ube Cake',
      2,
    );

    expect(ranked.map((product) => product.slug)).toEqual(['true-ube-cake']);
  });

  it('ranks phrase and distinctive-term matches above generic popular results', () => {
    const ranked = rankRelatedProducts(
      [
        {
          slug: 'generic-minimalist-cake',
          keywords: 'minimalist cake simple birthday',
          alt_text: 'Popular minimalist cake',
          usage_count: 999,
        },
        {
          slug: 'textured-buttercream-cake',
          keywords: 'textured buttercream wedding cake',
          alt_text: 'Textured buttercream minimalist cake design',
          usage_count: 25,
        },
        {
          slug: 'buttercream-cake',
          keywords: 'buttercream floral cake',
          alt_text: 'Buttercream cake design',
          usage_count: 500,
        },
      ],
      'Textured Buttercream Minimalist Cake',
      3,
    );

    expect(ranked.map((product) => product.slug)).toEqual([
      'textured-buttercream-cake',
      'buttercream-cake',
    ]);
  });
});