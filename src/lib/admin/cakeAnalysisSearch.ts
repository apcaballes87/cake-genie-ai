import { runActiveCakeAnalysis } from '@/lib/ai/analyzeCakeImage';
import { isRejectedGeneratedCakeAnalysis } from '@/lib/ai/generatedAnalysisContract';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { calculateCachePriceFromAnalysis, searchProductsFTS, searchProductsFTSCount } from '@/services/supabaseService';

const SOURCE_IMAGE_TIMEOUT_MS = 30_000;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type CakeSearchResult = {
  id: string | null;
  slug: string | null;
  keywords: string | null;
  original_image_url: string;
  price: number | null;
  alt_text: string | null;
  usage_count: number;
  p_hash: string;
  availability: string | null;
  analysis_json: Record<string, unknown> | null;
  image_width: number | null;
  image_height: number | null;
  rank_score: number | null;
  created_at: string | null;
  seo_title: string | null;
  studio_edited_image_url?: string | null;
  studio_edited_at?: string | null;
  image_variants?: unknown;
};

export class CakeAnalysisSearchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CakeAnalysisSearchError';
    this.status = status;
  }
}

function normalizeSearchResult(row: Record<string, unknown>): CakeSearchResult {
  return {
    id: null,
    slug: typeof row.slug === 'string' ? row.slug : null,
    keywords: typeof row.keywords === 'string' ? row.keywords : null,
    original_image_url: String(row.original_image_url || ''),
    price: row.price == null ? null : Number(row.price),
    alt_text: typeof row.alt_text === 'string' ? row.alt_text : null,
    usage_count: Number(row.usage_count || 0),
    p_hash: String(row.p_hash || ''),
    availability: typeof row.availability === 'string' ? row.availability : null,
    analysis_json: row.analysis_json && typeof row.analysis_json === 'object'
      ? row.analysis_json as Record<string, unknown>
      : null,
    image_width: row.image_width == null ? null : Number(row.image_width),
    image_height: row.image_height == null ? null : Number(row.image_height),
    rank_score: row.rank_score == null ? null : Number(row.rank_score),
    created_at: null,
    seo_title: null,
    studio_edited_image_url: typeof row.studio_edited_image_url === 'string'
      ? row.studio_edited_image_url
      : null,
    studio_edited_at: typeof row.studio_edited_at === 'string' ? row.studio_edited_at : null,
    image_variants: row.image_variants,
  };
}

export async function searchCakeAnalysisResults(query: string, limit: number, offset: number) {
  const [results, total] = await Promise.all([
    searchProductsFTS(query, limit, offset),
    searchProductsFTSCount(query),
  ]);

  if (results.error) {
    throw new CakeAnalysisSearchError(`Cake search failed: ${results.error.message}`, 502);
  }

  const data = (results.data || []).map((row) => normalizeSearchResult(row as Record<string, unknown>));
  const pHashes = data.map((item) => item.p_hash).filter(Boolean);

  if (pHashes.length > 0) {
    const admin = createAdminServerSupabaseClient();
    const { data: cacheRows, error: cacheLookupError } = await admin
      .from('cakegenie_analysis_cache')
      .select('id, p_hash, created_at, seo_title, studio_edited_image_url, studio_edited_at')
      .in('p_hash', pHashes);

    if (cacheLookupError) {
      throw new CakeAnalysisSearchError(`Could not load cache metadata for the search results: ${cacheLookupError.message}`, 502);
    }

    const metadataByHash = new Map((cacheRows || []).map((row) => [row.p_hash, row]));
    for (const item of data) {
      const metadata = metadataByHash.get(item.p_hash);
      if (!metadata) continue;
      item.id = metadata.id ?? null;
      item.created_at = metadata.created_at ?? null;
      item.seo_title = metadata.seo_title ?? null;
      item.studio_edited_image_url = metadata.studio_edited_image_url ?? null;
      item.studio_edited_at = metadata.studio_edited_at ?? null;
    }
  }

  return {
    data,
    total,
  };
}

function inferMimeType(url: string): string | null {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

async function downloadSourceImage(url: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new CakeAnalysisSearchError('The cache row has an invalid original image URL.', 422);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new CakeAnalysisSearchError('The cache row image URL must use HTTP or HTTPS.', 422);
  }

  const response = await fetch(parsedUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(SOURCE_IMAGE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new CakeAnalysisSearchError(`Could not download the source image (HTTP ${response.status}).`, 502);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_SOURCE_IMAGE_BYTES) {
    throw new CakeAnalysisSearchError('The source image is too large for AI analysis.', 413);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new CakeAnalysisSearchError('The source image is empty.', 422);
  }
  if (bytes.byteLength > MAX_SOURCE_IMAGE_BYTES) {
    throw new CakeAnalysisSearchError('The source image is too large for AI analysis.', 413);
  }

  const headerMimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const mimeType = headerMimeType && SUPPORTED_MIME_TYPES.has(headerMimeType)
    ? headerMimeType
    : inferMimeType(parsedUrl.toString());

  if (!mimeType || !SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new CakeAnalysisSearchError('The source image format is not supported.', 422);
  }

  return { data: bytes.toString('base64'), mimeType };
}

export async function replaceCakeAnalysisByHash(pHash: string, requestContext?: Request) {
  const admin = createAdminServerSupabaseClient();
  const { data: cacheRow, error: lookupError } = await admin
    .from('cakegenie_analysis_cache')
    .select('p_hash, slug, price, original_image_url')
    .eq('p_hash', pHash)
    .maybeSingle();

  if (lookupError) {
    throw new CakeAnalysisSearchError(`Could not load the cache row: ${lookupError.message}`, 502);
  }
  if (!cacheRow) {
    throw new CakeAnalysisSearchError('No cache row exists for this cake item.', 404);
  }
  if (!cacheRow.original_image_url) {
    throw new CakeAnalysisSearchError('This cache row has no original image URL.', 422);
  }

  const image = await downloadSourceImage(cacheRow.original_image_url);
  const { result, promptVersion } = await runActiveCakeAnalysis({
    imageData: image.data,
    mimeType: image.mimeType,
    requestContext,
    sourceContext: `admin-cake-analysis-search:${pHash}`,
  });
  if (isRejectedGeneratedCakeAnalysis(result)) {
    throw new CakeAnalysisSearchError(
      `The replacement analysis was rejected (${result.rejection.reason}): ${result.rejection.message}`,
      422,
    );
  }
  const price = await calculateCachePriceFromAnalysis(result);

  const { data: updatedRow, error: updateError } = await admin
    .from('cakegenie_analysis_cache')
    .update({ analysis_json: result, price })
    .eq('p_hash', pHash)
    .select('p_hash, slug, price, analysis_json')
    .single();

  if (updateError || !updatedRow) {
    throw new CakeAnalysisSearchError(
      `The AI result was generated, but the cache row was not updated: ${updateError?.message || 'row not found'}`,
      502,
    );
  }

  return {
    p_hash: updatedRow.p_hash,
    slug: updatedRow.slug ?? null,
    price: updatedRow.price == null ? null : Number(updatedRow.price),
    analysis_json: updatedRow.analysis_json as Record<string, unknown>,
    promptVersion,
  };
}
