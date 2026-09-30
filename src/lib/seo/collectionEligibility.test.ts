import { describe, expect, it } from 'vitest';
import { isPublishedIndexableCollection } from './collectionEligibility';

describe('isPublishedIndexableCollection', () => {
  it('requires a published, indexable collection with at least eight items', () => {
    expect(isPublishedIndexableCollection(null)).toBe(false);
    expect(isPublishedIndexableCollection({ publication_status: 'published', is_indexable: true, item_count: 7 })).toBe(false);
    expect(isPublishedIndexableCollection({ publication_status: 'draft', is_indexable: true, item_count: 8 })).toBe(false);
    expect(isPublishedIndexableCollection({ publication_status: 'published', is_indexable: false, item_count: 8 })).toBe(false);
    expect(isPublishedIndexableCollection({ publication_status: 'published', is_indexable: true, item_count: 8 })).toBe(true);
  });
});
