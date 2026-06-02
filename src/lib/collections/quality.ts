export const COLLECTION_MIN_MATCHED_DESIGNS = 8;

export type CollectionPublicationStatus = 'candidate' | 'stocking' | 'published' | 'retired';

export type CollectionQualityInput = {
  matchedDesignCount: number;
  sampleImage: string | null | undefined;
  hasDistinctIntent: boolean;
  hasTrendEvidence: boolean;
};

export function canPublishCollection(input: CollectionQualityInput): boolean {
  return input.hasDistinctIntent
    && input.hasTrendEvidence
    && input.matchedDesignCount >= COLLECTION_MIN_MATCHED_DESIGNS
    && Boolean(input.sampleImage?.trim());
}

export function resolveCollectionPublicationStatus(
  input: CollectionQualityInput,
): CollectionPublicationStatus {
  return canPublishCollection(input) ? 'published' : 'stocking';
}

export function normalizeTrendCollectionSlug(keyword: string): string {
  const normalized = keyword
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(cakes?|designs?|ideas?|themed|theme|birthday|custom|order|delivery|cebu|philippines)\b/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) return '';
  return normalized.endsWith('-cake') ? normalized : `${normalized}-cake`;
}

export function isIndexableCollection(collection: {
  publication_status?: string | null;
  is_indexable?: boolean | null;
  item_count?: number | null;
}): boolean {
  return collection.publication_status === 'published'
    && collection.is_indexable === true
    && (collection.item_count || 0) >= COLLECTION_MIN_MATCHED_DESIGNS;
}

