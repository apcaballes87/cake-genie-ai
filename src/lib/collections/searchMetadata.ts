import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCollectionSearchPlan } from './searchPlan';

const SAMPLE_POOL_SIZE = 100;

type RankedSearchRow = {
  slug: string | null;
  keywords: string | null;
  p_hash: string | null;
  original_image_url: string | null;
};

type HydratedImageRow = RankedSearchRow & {
  studio_edited_image_url?: string | null;
};

export type CollectionSearchMetadata = {
  matchedDesignCount: number;
  studioImageCount: number;
  sampleImage: string | null;
  sampleSlug: string | null;
  sampleKeywords: string | null;
  searchQuery: string;
  matchKind: 'text' | 'color';
};

function pickSample(rows: HydratedImageRow[]) {
  const studioCandidate = rows.find((row) => row.studio_edited_image_url?.trim());
  const candidate = studioCandidate || rows[0] || null;

  return {
    sampleImage: candidate
      ? candidate.studio_edited_image_url?.trim() || candidate.original_image_url
      : null,
    sampleSlug: candidate?.slug || null,
    sampleKeywords: candidate?.keywords || null,
  };
}

export async function getCollectionSearchMetadata(
  client: SupabaseClient,
  collectionName: string,
): Promise<CollectionSearchMetadata> {
  const plan = buildCollectionSearchPlan(collectionName);
  if (!plan.query) {
    return {
      matchedDesignCount: 0,
      studioImageCount: 0,
      sampleImage: null,
      sampleSlug: null,
      sampleKeywords: null,
      searchQuery: '',
      matchKind: plan.kind,
    };
  }

  if (plan.kind === 'color') {
    const [{ count, error: countError }, { data, error: rowsError }] = await Promise.all([
      client
        .from('cakegenie_analysis_cache')
        .select('id', { count: 'exact', head: true })
        .not('original_image_url', 'is', null)
        .not('slug', 'is', null)
        .eq('icing_colors', plan.icingColor),
      client
        .from('cakegenie_analysis_cache')
        .select('slug,keywords,p_hash,original_image_url,studio_edited_image_url')
        .not('original_image_url', 'is', null)
        .not('slug', 'is', null)
        .eq('icing_colors', plan.icingColor)
        .order('usage_count', { ascending: false })
        .limit(SAMPLE_POOL_SIZE),
    ]);

    if (countError) throw countError;
    if (rowsError) throw rowsError;

    const rows = (data || []) as HydratedImageRow[];
    return {
      matchedDesignCount: count || 0,
      studioImageCount: rows.filter((row) => row.studio_edited_image_url?.trim()).length,
      ...pickSample(rows),
      searchQuery: plan.query,
      matchKind: plan.kind,
    };
  }

  const rpcBase = {
    p_query: plan.query.toLowerCase(),
    p_icing_colors: null,
  };
  const [{ data: count, error: countError }, { data, error: rowsError }] = await Promise.all([
    client.rpc('search_collection_products_count', rpcBase),
    client.rpc('search_collection_products', {
      ...rpcBase,
      p_limit: SAMPLE_POOL_SIZE,
      p_offset: 0,
    }),
  ]);

  if (countError) throw countError;
  if (rowsError) throw rowsError;

  const rankedRows = (data || []) as RankedSearchRow[];
  const pHashes = Array.from(new Set(
    rankedRows
      .map((row) => row.p_hash)
      .filter((pHash): pHash is string => Boolean(pHash?.trim())),
  ));
  const studioByHash = new Map<string, string | null>();

  if (pHashes.length > 0) {
    const { data: imageRows, error: imageError } = await client
      .from('cakegenie_analysis_cache')
      .select('p_hash,studio_edited_image_url')
      .in('p_hash', pHashes);

    if (imageError) throw imageError;
    for (const row of imageRows || []) {
      if (!studioByHash.has(row.p_hash)) {
        studioByHash.set(row.p_hash, row.studio_edited_image_url);
      }
    }
  }

  const hydratedRows = rankedRows.map((row) => ({
    ...row,
    studio_edited_image_url: row.p_hash ? studioByHash.get(row.p_hash) || null : null,
  }));

  return {
    matchedDesignCount: typeof count === 'number' ? count : 0,
    studioImageCount: hydratedRows.filter((row) => row.studio_edited_image_url?.trim()).length,
    ...pickSample(hydratedRows),
    searchQuery: plan.query,
    matchKind: plan.kind,
  };
}
