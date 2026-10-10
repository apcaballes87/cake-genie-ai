import type { SupabaseClient } from '@supabase/supabase-js';

export type ChatbotCollection = { slug: string; name: string };

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_COLLECTIONS = 600;

let cache: { loadedAt: number; collections: ChatbotCollection[] } | null = null;

/**
 * Published, indexable design collections (same filter as the /collections page),
 * cached in memory so the assistant does not query on every message.
 * Returns [] on failure; the assistant then only links to /collections.
 */
export async function getChatbotCollections(supabase: SupabaseClient, now = Date.now()): Promise<ChatbotCollection[]> {
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.collections;
  }

  let data: unknown;
  try {
    const result = await supabase
      .from('cakegenie_collections')
      .select('name, slug')
      .eq('publication_status', 'published')
      .eq('is_indexable', true)
      .gte('item_count', 8)
      .order('hits', { ascending: false })
      .limit(MAX_COLLECTIONS);

    if (result.error || !result.data) {
      console.warn('[chat-assistant] Could not load collections:', result.error?.message);
      return cache?.collections ?? [];
    }
    data = result.data;
  } catch (error) {
    console.warn('[chat-assistant] Could not load collections:', error);
    return cache?.collections ?? [];
  }

  const collections = (data as Array<{ name: string | null; slug: string | null }>)
    .filter((row): row is { name: string; slug: string } => Boolean(row.slug && row.name))
    .map((row) => ({ slug: row.slug.toLowerCase(), name: row.name.trim() }));

  cache = { loadedAt: now, collections };
  return collections;
}

export function resetChatbotCollectionsCache() {
  cache = null;
}
