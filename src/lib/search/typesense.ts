import type { SupabaseClient } from '@supabase/supabase-js';

export const TYPESENSE_COLLECTION = 'products_shadow_v1';

type CacheRow = {
  p_hash: string;
  slug: string | null;
  keywords: string | null;
  alt_text: string | null;
  seo_description?: string | null;
  original_image_url: string | null;
  studio_edited_image_url?: string | null;
  price: number | string | null;
  usage_count?: number | null;
  availability?: string | null;
  icing_colors?: string | string[] | null;
  tags?: string[] | null;
  analysis_json?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type TypesenseCakeDocument = {
  id: string;
  slug: string;
  title: string;
  keywords: string;
  aliases: string[];
  tags: string[];
  alt_text: string;
  cake_type: string;
  colors: string[];
  availability: string;
  price: number;
  usage_count: number;
  created_at: number;
  original_image_url: string;
  studio_edited_image_url: string;
};

export type TypesenseSearchHit = {
  document: TypesenseCakeDocument;
  text_match?: number;
};

export type TypesenseSearchResponse = {
  found: number;
  search_time_ms?: number;
  hits: TypesenseSearchHit[];
};

const readTypesenseConfig = () => {
  const host = process.env.TYPESENSE_URL?.trim().replace(/\/+$/, '');
  const apiKey = process.env.TYPESENSE_API_KEY?.trim();
  if (!host || !apiKey) return null;
  return { host, apiKey };
};

export const isTypesenseConfigured = () => Boolean(readTypesenseConfig());

const getSampleRate = () => {
  const configured = Number(process.env.TYPESENSE_SHADOW_SAMPLE_RATE ?? '0.05');
  if (!Number.isFinite(configured)) return 0.05;
  return Math.min(1, Math.max(0, configured));
};

export const shouldSampleTypesenseShadow = () =>
  isTypesenseConfigured() && Math.random() < getSampleRate();

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const analysisString = (analysis: Record<string, unknown> | null | undefined, key: string) => {
  const value = analysis?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

const analysisTags = (analysis: Record<string, unknown> | null | undefined) =>
  asStringArray(analysis?.tags);

export function mapCacheRowToTypesenseDocument(row: CacheRow): TypesenseCakeDocument | null {
  if (!row.slug || !row.original_image_url) return null;

  const analysis = row.analysis_json ?? null;
  const keywords = row.keywords?.trim() || analysisString(analysis, 'keyword') || row.slug;
  const tags = Array.from(new Set([
    ...asStringArray(row.tags),
    ...analysisTags(analysis),
  ]));
  const colors = Array.from(new Set(asStringArray(row.icing_colors)));
  const aliases = Array.from(new Set([
    ...keywords.split(/[,|]/).map((item) => item.trim()).filter(Boolean),
    ...tags,
  ]));

  return {
    id: row.p_hash,
    slug: row.slug,
    title: keywords,
    keywords,
    aliases,
    tags,
    alt_text: row.alt_text?.trim() || '',
    cake_type: analysisString(analysis, 'cakeType'),
    colors,
    availability: row.availability?.trim() || 'normal',
    price: Number(row.price ?? 0),
    usage_count: Number(row.usage_count ?? 0),
    created_at: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : 0,
    original_image_url: row.original_image_url,
    studio_edited_image_url: row.studio_edited_image_url?.trim() || '',
  };
}

async function typesenseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = readTypesenseConfig();
  if (!config) throw new Error('Typesense is not configured. Set TYPESENSE_URL and TYPESENSE_API_KEY.');

  const response = await fetch(`${config.host}${path}`, {
    ...init,
    headers: {
      'X-TYPESENSE-API-KEY': config.apiKey,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Typesense ${response.status}: ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) as T : (undefined as T);
}

export async function ensureTypesenseCollection(): Promise<void> {
  try {
    await typesenseRequest(`/collections/${TYPESENSE_COLLECTION}`, { method: 'GET' });
    return;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Typesense 404')) throw error;
  }

  await typesenseRequest('/collections', {
    method: 'POST',
    body: JSON.stringify({
      name: TYPESENSE_COLLECTION,
      default_sorting_field: 'usage_count',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'slug', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'keywords', type: 'string' },
        { name: 'aliases', type: 'string[]' },
        { name: 'tags', type: 'string[]', facet: true },
        { name: 'alt_text', type: 'string' },
        { name: 'cake_type', type: 'string', facet: true },
        { name: 'colors', type: 'string[]', facet: true },
        { name: 'availability', type: 'string', facet: true },
        { name: 'price', type: 'float', sort: true },
        { name: 'usage_count', type: 'int32', sort: true },
        { name: 'created_at', type: 'int64', sort: true },
        { name: 'original_image_url', type: 'string', index: false },
        { name: 'studio_edited_image_url', type: 'string', index: false },
      ],
    }),
  });
}

export async function importTypesenseDocuments(documents: TypesenseCakeDocument[]): Promise<void> {
  const config = readTypesenseConfig();
  if (!config) throw new Error('Typesense is not configured. Set TYPESENSE_URL and TYPESENSE_API_KEY.');
  if (documents.length === 0) return;

  const response = await fetch(
    `${config.host}/collections/${TYPESENSE_COLLECTION}/documents/import?action=upsert`,
    {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': config.apiKey,
        'Content-Type': 'text/plain',
      },
      body: `${documents.map((document) => JSON.stringify(document)).join('\n')}\n`,
      cache: 'no-store',
    },
  );
  const body = await response.text();
  if (!response.ok) throw new Error(`Typesense import ${response.status}: ${body.slice(0, 500)}`);

  const failed = body.split('\n').filter(Boolean).filter((line) => {
    try { return !(JSON.parse(line) as { success?: boolean }).success; } catch { return true; }
  });
  if (failed.length > 0) throw new Error(`Typesense rejected ${failed.length} imported documents.`);
}

export async function searchTypesense(
  query: string,
  options?: { limit?: number; offset?: number; maxPrice?: number | null; icingColor?: string | null },
): Promise<TypesenseSearchResponse> {
  const params = new URLSearchParams({
    q: query.trim(),
    query_by: 'title,keywords,aliases,tags,cake_type,alt_text,slug',
    query_by_weights: '12,10,8,6,4,2,3',
    prefix: 'true,true,true,true,false,false,false',
    num_typos: '1',
    typo_tokens_threshold: '1',
    drop_tokens_threshold: '0',
    prioritize_exact_match: 'true',
    text_match_type: 'sum_score',
    sort_by: '_text_match:desc,usage_count:desc,created_at:desc',
    limit: String(Math.min(options?.limit ?? 10, 50)),
    offset: String(options?.offset ?? 0),
    include_fields: 'id,slug,title,keywords,alt_text,price,usage_count,availability,colors,original_image_url,studio_edited_image_url',
  });

  const filters: string[] = [];
  if (typeof options?.maxPrice === 'number') filters.push(`price:<=${options.maxPrice}`);
  if (options?.icingColor) filters.push(`colors:=${options.icingColor}`);
  if (filters.length > 0) params.set('filter_by', filters.join(' && '));

  return typesenseRequest<TypesenseSearchResponse>(
    `/collections/${TYPESENSE_COLLECTION}/documents/search?${params.toString()}`,
  );
}

export async function recordTypesenseShadowComparison(input: {
  query: string;
  baselineSlugs: string[];
  typesenseSlugs: string[];
  baselineCount: number;
  typesenseCount: number;
  baselineLatencyMs: number;
  typesenseLatencyMs: number | null;
  requestPath: string;
  supabase: SupabaseClient;
}) {
  const { supabase, ...payload } = input;
  const { error } = await supabase.from('cakegenie_search_shadow_comparisons').insert({
    query: payload.query.slice(0, 200),
    baseline_slugs: payload.baselineSlugs.slice(0, 20),
    typesense_slugs: payload.typesenseSlugs.slice(0, 20),
    baseline_count: payload.baselineCount,
    typesense_count: payload.typesenseCount,
    baseline_latency_ms: payload.baselineLatencyMs,
    typesense_latency_ms: payload.typesenseLatencyMs,
    request_path: payload.requestPath,
  });
  if (error) throw error;
}
