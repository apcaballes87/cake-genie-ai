import { describe, expect, it } from 'vitest';
import { getBasePriceCatalogForEntrySource } from './basePriceCatalog';

describe('getBasePriceCatalogForEntrySource', () => {
  it.each(['shopify', 'shopify_cse'])('uses the Cakes & Memories catalog for %s handoffs', (source) => {
    expect(getBasePriceCatalogForEntrySource(source)).toBe('cakes_and_memories');
  });

  it.each([null, undefined, '', 'chrome_extension', 'landing'])('keeps every other upload on Genie pricing', (source) => {
    expect(getBasePriceCatalogForEntrySource(source)).toBe('genie');
  });
});
