export type CollectionPublicationFields = {
  publication_status?: string | null;
  is_indexable?: boolean | null;
  item_count?: number | null;
};

export function isPublishedIndexableCollection(
  collection: CollectionPublicationFields | null | undefined,
): boolean {
  return collection?.publication_status === 'published'
    && collection.is_indexable === true
    && (collection.item_count ?? 0) >= 8;
}
