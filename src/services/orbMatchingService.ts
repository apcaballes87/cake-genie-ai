import { CacheSEOMetadata, HybridAnalysisResult } from '@/types';
import { getOrbBackendUnavailableMessage, getOrbBackendUrl } from '@/services/orbBackendConfig';

export type OrbMatchingMode = 'default' | 'strict' | 'loose';

const ORB_MATCH_TIMEOUT_MS = 2000;
// When the ORB backend is unreachable we short-circuit subsequent calls for this
// long instead of paying the full timeout each time. Cleared as soon as any call
// succeeds, so the system self-heals as soon as the backend comes back online.
const ORB_OFFLINE_MEMOIZE_MS = 60_000;

let orbOfflineUntil: number | null = null;

function isOrbKnownOffline(now: number = Date.now()): boolean {
  return orbOfflineUntil !== null && orbOfflineUntil > now;
}

function markOrbOffline(now: number = Date.now()) {
  orbOfflineUntil = now + ORB_OFFLINE_MEMOIZE_MS;
}

function markOrbOnline() {
  orbOfflineUntil = null;
}

/** Test/admin hook — clears the cached offline state so callers retry immediately. */
export function resetOrbBackendHealth() {
  orbOfflineUntil = null;
}

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
    timeoutMs?: number;
  }
): Promise<OrbCacheHitResult | null> {
  const params = new URLSearchParams({
    mode: options?.mode ?? 'default',
    visualize: String(options?.visualize ?? false),
  });
  const endpoint = options?.endpoint ?? getOrbBackendUrl('/api/match');
  const timeoutMs = options?.timeoutMs ?? ORB_MATCH_TIMEOUT_MS;

  if (!endpoint) {
    throw new Error(getOrbBackendUnavailableMessage());
  }

  // Skip the network round-trip and 2s timeout if we recently learned the
  // backend is unreachable. Historical/admin callers can treat this as a
  // plain miss without blocking the rest of their workflow.
  if (isOrbKnownOffline()) {
    throw new Error('ORB backend recently unavailable; skipping fetch.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    markOrbOffline();
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error(`ORB match timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    // 5xx → backend is up but broken; treat as offline.
    // 4xx → backend is up and responsive (e.g. bad request); don't memoize.
    if (response.status >= 500) {
      markOrbOffline();
    }
    console.error(`❌ ORB backend returned ${response.status}`, {
      endpoint,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`ORB backend returned ${response.status}`);
  }

  // Any successful response confirms the backend is reachable.
  markOrbOnline();

  const matchData = await response.json() as OrbMatchApiResponse;

  if (!matchData.match || !matchData.analysis_json) {
    console.log(
      '%c🔍 ORB backend: no match found',
      'color: #94a3b8;',
      matchData.execution_time_ms != null ? `(${matchData.execution_time_ms}ms)` : '',
    );
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
