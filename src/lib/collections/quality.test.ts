import { describe, expect, it } from 'vitest';
import {
  canPublishCollection,
  isIndexableCollection,
  normalizeTrendCollectionSlug,
  resolveCollectionPublicationStatus,
} from './quality';

describe('collection quality gates', () => {
  it('normalizes transactional keyword variants into one collection slug', () => {
    expect(normalizeTrendCollectionSlug('Order Custom Aespa Birthday Cakes Cebu')).toBe('aespa-cake');
    expect(normalizeTrendCollectionSlug('Blackpink cake designs')).toBe('blackpink-cake');
  });

  it('publishes only stocked collections with evidence and a sample image', () => {
    const ready = {
      matchedDesignCount: 8,
      sampleImage: 'https://example.com/aespa.webp',
      hasDistinctIntent: true,
      hasTrendEvidence: true,
    };

    expect(canPublishCollection(ready)).toBe(true);
    expect(resolveCollectionPublicationStatus(ready)).toBe('published');
    expect(resolveCollectionPublicationStatus({ ...ready, matchedDesignCount: 7 })).toBe('stocking');
  });

  it('keeps non-published or thin collections out of indexable surfaces', () => {
    expect(isIndexableCollection({ publication_status: 'published', is_indexable: true, item_count: 8 })).toBe(true);
    expect(isIndexableCollection({ publication_status: 'stocking', is_indexable: true, item_count: 20 })).toBe(false);
    expect(isIndexableCollection({ publication_status: 'published', is_indexable: true, item_count: 7 })).toBe(false);
  });
});

