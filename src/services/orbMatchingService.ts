import { CacheSEOMetadata, HybridAnalysisResult } from '@/types';

export type OrbMatchingMode = 'default' | 'strict' | 'loose';

interface OrbMatchApiResponse {
  match: boolean;
  confidence?: number | null;
  matched_image_id?: string | null;
  matched_image_url?: string | null;
  analysis_json?: HybridAnalysisResult | null;
  execution_time_ms?: number | null;
  cache_p_hash?: string | null;
  cache_metadata?: Partial<CacheSEOMetadata> | null;
}

export interface OrbCacheHitResult {
  analysisResult: HybridAnalysisResult;
  confidence: number;
  executionTimeMs: number | null;
  matchedImageId: string | null;
  matchedImageUrl: string | null;
  pHash: string | null;
  seoMetadata: CacheSEOMetadata | null;
}

const ORB_BACKEND_ENDPOINT = 'http://localhost:8000/api/match';

function normalizeSeoMetadata(
  metadata: Partial<CacheSEOMetadata> | null | undefined,
  matchedImageUrl: string | null
): CacheSEOMetadata | null {
  if (!metadata && !matchedImageUrl) {
    return null;
  }

  return {
    seo_title: metadata?.seo_title ?? null,
    seo_description: metadata?.seo_description ?? null,
    keywords: metadata?.keywords ?? null,
    alt_text: metadata?.alt_text ?? null,
    slug: metadata?.slug ?? null,
    original_image_url: metadata?.original_image_url ?? matchedImageUrl ?? null,
    price: metadata?.price != null ? Number(metadata.price) : null,
    availability: metadata?.availability ?? null,
  };
}

export async function findOrbCacheHit(
  file: File,
  options?: {
    endpoint?: string;
    mode?: OrbMatchingMode;
    visualize?: boolean;
  }
): Promise<OrbCacheHitResult | null> {
  const params = new URLSearchParams({
    mode: options?.mode ?? 'default',
    visualize: String(options?.visualize ?? false),
  });

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${options?.endpoint ?? ORB_BACKEND_ENDPOINT}?${params.toString()}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`ORB backend returned ${response.status}`);
  }

  const matchData = await response.json() as OrbMatchApiResponse;

  if (!matchData.match || !matchData.analysis_json) {
    return null;
  }

  return {
    analysisResult: matchData.analysis_json,
    confidence: matchData.confidence ?? 0,
    executionTimeMs: matchData.execution_time_ms ?? null,
    matchedImageId: matchData.matched_image_id ?? null,
    matchedImageUrl: matchData.matched_image_url ?? null,
    pHash: matchData.cache_p_hash ?? null,
    seoMetadata: normalizeSeoMetadata(matchData.cache_metadata, matchData.matched_image_url ?? null),
  };
}
