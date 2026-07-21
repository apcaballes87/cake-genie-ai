import { describe, expect, it } from 'vitest';

import { getSeoImageUploadHeaders, SEO_IMAGE_X_ROBOTS_TAG } from './storageImageHeaders';

describe('SEO image storage headers', () => {
  it('opts crawler-facing public images into indexing', () => {
    expect(SEO_IMAGE_X_ROBOTS_TAG).toBe('all');
    expect(getSeoImageUploadHeaders()).toEqual({ 'x-robots-tag': 'all' });
  });

  it('returns a fresh header object for each upload', () => {
    const first = getSeoImageUploadHeaders();
    first['x-robots-tag'] = 'none';

    expect(getSeoImageUploadHeaders()).toEqual({ 'x-robots-tag': 'all' });
  });
});
