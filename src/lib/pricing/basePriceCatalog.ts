export type BasePriceCatalog = 'genie' | 'cakes_and_memories';

const CAKES_AND_MEMORIES_ENTRY_SOURCES = new Set(['shopify', 'shopify_cse']);

/**
 * Cakes & Memories uploads arrive through the established Shopify handoff.
 * The source is authoritative here because the uploaded image itself is stored
 * in Genie.ph's public Supabase bucket, not under cakesandmemories.com.
 */
export function getBasePriceCatalogForEntrySource(source: string | null | undefined): BasePriceCatalog {
  return source && CAKES_AND_MEMORIES_ENTRY_SOURCES.has(source)
    ? 'cakes_and_memories'
    : 'genie';
}

export function isCakesAndMemoriesCatalog(catalog: BasePriceCatalog): boolean {
  return catalog === 'cakes_and_memories';
}
