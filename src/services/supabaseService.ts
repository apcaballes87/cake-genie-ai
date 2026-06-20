// services/supabaseService.ts
import { getSupabaseClient } from '@/lib/supabase/client';
import { CakeType, BasePriceInfo, CakeThickness, ReportPayload, CartItemDetails, HybridAnalysisResult, AiPrompt, PricingRule, PricingFeedback, AvailabilitySettings, CartItem, CacheSEOMetadata } from '@/types';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/env';
import { notifyIndexNow } from './indexNowService';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { CakeGenieCartItem, CakeGenieAddress, CakeGenieOrder, CakeGenieOrderItem, OrderContribution, CakeGenieSavedItem, CustomizationDetails, CakeGenieMerchant, CakeGenieMerchantProduct, MerchantStaff, MerchantPayout, MerchantDashboardStats, MerchantStaffRole, CakeGenieReview } from '@/lib/database.types';
import { normalizePublicReviewRecord, normalizePublicReviews, REVIEW_SELECT, REVIEW_SELECT_WITH_ORDER_NUMBER } from '@/lib/reviews';

import { compressImage, validateImageFile } from '@/lib/utils/imageOptimization';
import { firstNonBlankImageUrl } from '@/lib/utils/imageSelection';
import { calculatePriceFromDatabase } from './pricingService.database';
import { roundDownToNearest99 } from '@/lib/utils/pricing';
import { getDesignAvailability } from '@/lib/utils/availability';
import { MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI } from '@/types';
import { generateCakeAnalysisSlug } from '@/lib/utils/urlHelpers';
import { generateTagsForAnalysis } from '@/utils/tagUtils';
import { buildCakeTitle, extractTitleInputFromAnalysis } from '@/lib/seo/cakeTitle';
import { enrichStoredSeoDescription } from '@/lib/seo/analysisCopy';
import {
  getDistinctiveRelatedSearchTerms,
  normalizeRelatedSearchPhrase,
  rankRelatedProducts,
} from './relatedProductSearch';
import { getOrbBackendUrl } from './orbBackendConfig';

// The default client (uses @supabase/ssr browser client)
const supabase: SupabaseClient = getSupabaseClient();

// A completely public, cookie-less client for concurrent SSR queries
// This prevents Next.js 15's cookies() Map.set / WeakRef.deref stack overflows.
export const publicSupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: 'genie-public-supabase',
    },
  }
);

// Type for service responses
export type SupabaseServiceResponse<T> = {
  data: T | null;
  error: Error | PostgrestError | null;
};


// --- New Types for Delivery Date RPCs ---
export interface AvailableDate {
  available_date: string;
  day_of_week: string;
  is_rush_available: boolean;
  is_same_day_available: boolean;
  is_standard_available: boolean;
}

export interface BlockedDateInfo {
  closure_reason: string | null;
  is_all_day: boolean;
  blocked_time_start: string | null;
  blocked_time_end: string | null;
}

// --- Dynamic Config Fetchers ---

export const savePricingFeedback = async (feedback: PricingFeedback): Promise<void> => {
  try {
    const { error } = await supabase
      .from('pricing_feedback')
      .insert([feedback]);

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    console.error("Error saving pricing feedback:", err);
    throw new Error("Could not save feedback to the database.");
  }
};


export const getCakeBasePriceOptions = async (
  type: CakeType,
  thickness: CakeThickness
): Promise<BasePriceInfo[]> => {
  try {
    const { data, error } = await supabase
      .from('productsizes_cakegenie')
      .select('cakesize, price, display_order')
      .eq('type', type)
      .eq('thickness', thickness)
      .order('display_order', { ascending: true })
      .order('cakesize', { ascending: true });

    if (error) {
      console.error("Supabase error:", error.message);
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      return data.map(item => ({ size: item.cakesize, price: item.price }));
    }

    // Return empty array instead of throwing error if no options are found
    return [];

  } catch (err) {
    // FIX: Serialize error object to prevent '[object Object]' in logs.
    console.error("Error fetching cake base price options:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    if (err instanceof Error && err.message.includes('not available')) {
      throw err;
    }
    throw new Error("Could not connect to the pricing database.");
  }
};

/**
 * Uploads a base64 image to Supabase storage for report purposes.
 * @param base64Data The base64 image data (with or without data URL prefix)
 * @param imageType 'original' or 'customized'
 * @returns The public URL of the uploaded image
 */
export const uploadReportImage = async (base64Data: string, imageType: 'original' | 'customized'): Promise<string> => {
  try {
    // Remove data URL prefix if present
    const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    // Convert base64 to blob
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/webp' });

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 8);
    const fileName = `${imageType}_${timestamp}_${randomId}.webp`;
    const filePath = `customizations/reported_cakes/${fileName}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('cakegenie')
      .upload(filePath, blob, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload ${imageType} image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('cakegenie')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error(`Error uploading ${imageType} report image:`, err);
    throw new Error(`Could not upload ${imageType} image to storage.`);
  }
};

export const reportCustomization = async (payload: ReportPayload): Promise<void> => {
  try {
    const { error } = await supabase
      .from('cakegenie_reports')
      .insert([payload]);

    if (error) {
      console.error("Supabase report error:", error.message);
      throw new Error(error.message);
    }
  } catch (err) {
    // FIX: Serialize error object to prevent '[object Object]' in logs.
    console.error("Error reporting customization:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    throw new Error("Could not submit the report to the database.");
  }
};

/**
 * Tracks a search term by calling a Supabase RPC function.
 * This is a "fire-and-forget" operation for analytics.
 * @param term The search term to track.
 */
export async function trackSearchTerm(term: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('track_search', {
      p_term: term.toLowerCase().trim(),
    });

    if (error) {
      // Log the error but don't throw, as this is a non-critical background task.
      console.warn("Supabase search tracking error:", error.message);
    }
  } catch (err) {
    // Also catch network or other unexpected errors.
    console.warn("Error tracking search term:", err);
  }
}

// --- Analysis Cache Functions ---

/**
 * Helper to map HybridAnalysisResult to the UI state structure expected by calculatePriceFromDatabase.
 */
function mapAnalysisToPricingState(analysis: HybridAnalysisResult) {
  const mainToppers: MainTopperUI[] = (analysis.main_toppers || []).map(t => ({
    ...t,
    id: uuidv4(),
    isEnabled: true,
    price: 0,
    original_type: t.type,
  }));

  const supportElements: SupportElementUI[] = (analysis.support_elements || []).map(t => ({
    ...t,
    id: uuidv4(),
    isEnabled: true,
    price: 0,
    original_type: t.type,
  }));

  const cakeMessages: CakeMessageUI[] = (analysis.cake_messages || []).map(t => ({
    ...t,
    id: uuidv4(),
    isEnabled: true,
    price: 0,
  }));

  const icingDesign: IcingDesignUI = {
    ...analysis.icing_design,
    dripPrice: 0,
    gumpasteBaseBoardPrice: 0,
  };

  const cakeInfo: CakeInfoUI = {
    type: analysis.cakeType,
    thickness: analysis.cakeThickness,
    size: '6" Round', // Default size for pricing calculation (will be overridden by lowest price logic if needed, but pricing service needs a size)
    flavors: [],
  };

  return { mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo };
}

/**
 * Fetches the lowest base price for a given cake type.
 */
async function getLowestBasePrice(type: CakeType): Promise<number> {
  const { data, error } = await supabase
    .from('productsizes_cakegenie')
    .select('price')
    .eq('type', type)
    .order('price', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.warn(`Could not find base price for type ${type}, defaulting to 0`);
    return 0;
  }

  return data.price;
}

/**
 * Backfills missing price, keywords, and optionally original_image_url for a cached analysis entry.
 */
export async function backfillCacheFields(pHash: string, analysisResult: HybridAnalysisResult, imageUrl?: string) {
  try {
    console.log('🔄 Backfilling cache fields for pHash:', pHash);

    // 1. Calculate Price
    const pricingState = mapAnalysisToPricingState(analysisResult);
    const { addOnPricing } = await calculatePriceFromDatabase(pricingState);
    const lowestBasePrice = await getLowestBasePrice(analysisResult.cakeType);
    let totalPrice = lowestBasePrice + addOnPricing.addOnPrice;

    // Apply "round down to nearest 99" logic
    totalPrice = roundDownToNearest99(totalPrice, lowestBasePrice);

    // 2. Extract Keywords
    const keywords = analysisResult.keyword || '';

    // 3. Prepare Update Object
    const updatePayload: any = {
      price: totalPrice,
      keywords: keywords
    };

    if (imageUrl) {
      updatePayload.original_image_url = imageUrl;
    }

    // 4. Update Database
    const { error } = await supabase
      .from('cakegenie_analysis_cache')
      .update(updatePayload)
      .eq('p_hash', pHash);

    if (error) {
      console.error('❌ Failed to backfill cache fields:', error);
    } else {
      console.log('✅ Cache backfilled successfully. Price:', totalPrice, 'Keywords:', keywords, imageUrl ? 'Image URL updated' : '');
    }

  } catch (err) {
    console.error('❌ Exception during cache backfill:', err);
  }
}

/**
 * Searches for a similar analysis result in the cache using a perceptual hash.
 * @param pHash The perceptual hash of the new image.
 * @param imageUrl Optional URL of the image being searched (used for backfilling if cache hit has no URL).
 * @returns The cached analysis JSON if a similar one is found, otherwise null.
 */
export interface CacheHitResult {
  id: string | null;
  pHash: string;
  analysisResult: HybridAnalysisResult;
  seoMetadata: CacheSEOMetadata;
}

export interface CacheWriteResult {
  slug: string;
  seo_title: string;
  price: number;
  original_image_url: string | null;
  storedPHash: string;
  id?: string;
}

export interface FingerprintHashLookup {
  pHash?: string | null;
  pipeline?: string | null;
  legacyPHashes?: string[];
}

const HEX_PHASH_PATTERN = /^[0-9a-f]{16}$/i;

function normalizeHexPHash(candidate: string | null | undefined): string | null {
  if (typeof candidate !== 'string') {
    return null;
  }

  const normalized = candidate.trim().toLowerCase();
  return HEX_PHASH_PATTERN.test(normalized) ? normalized : null;
}

function uniqueHashCandidates(candidates: Array<string | null | undefined>) {
  const validCandidates = candidates
    .map((candidate) => normalizeHexPHash(candidate))
    .filter((candidate): candidate is string => candidate !== null);

  return [...new Set(validCandidates)];
}

function normalizeHashLookup(input: string | string[] | FingerprintHashLookup) {
  if (typeof input === 'object' && !Array.isArray(input)) {
    const canonicalHash = normalizeHexPHash(input.pHash);
    const legacyHashes = uniqueHashCandidates(input.legacyPHashes || [])
      .filter((candidate) => candidate !== canonicalHash);

    return {
      canonicalHash,
      pipeline: input.pipeline || null,
      legacyHashes,
      allCandidates: uniqueHashCandidates([canonicalHash, ...legacyHashes]),
    };
  }

  const legacyHashes = uniqueHashCandidates(Array.isArray(input) ? input : [input]);
  return {
    canonicalHash: null,
    pipeline: null,
    legacyHashes,
    allCandidates: legacyHashes,
  };
}

function getHexHashHammingDistance(left: string, right: string): number | null {
  if (!/^[0-9a-f]{16}$/i.test(left) || !/^[0-9a-f]{16}$/i.test(right)) {
    return null;
  }

  let distance = 0;
  let xor = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);

  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }

  return distance;
}

const WRITE_TIME_DUPLICATE_DISTANCE_THRESHOLD = 2;

async function resolveExistingWriteHash(
  incomingHash: string,
  fingerprintPipeline: string | null,
  client: SupabaseClient
): Promise<string> {
  if (!fingerprintPipeline) {
    return incomingHash;
  }

  try {
    const { data, error } = await client.rpc('find_similar_analysis_by_fingerprint', {
      new_hash: incomingHash,
      new_pipeline: fingerprintPipeline,
      legacy_hashes: [],
    });

    if (error || !data || data.length === 0) {
      return incomingHash;
    }

    const matchedHash = typeof data[0]?.p_hash === 'string' ? data[0].p_hash : null;
    if (!matchedHash) {
      return incomingHash;
    }

    const distance = getHexHashHammingDistance(incomingHash, matchedHash);

    // Only collapse writes when the canonical match is effectively the same
    // fingerprint under our two-bit tolerance rule.
    if (distance !== null && distance <= WRITE_TIME_DUPLICATE_DISTANCE_THRESHOLD) {
      return matchedHash;
    }
  } catch (error) {
    console.warn('⚠️ Failed to resolve existing cache row before write:', error);
  }

  return incomingHash;
}

interface AnalysisCacheLookupRow {
  id?: string | null;
  p_hash: string;
  analysis_json: HybridAnalysisResult;
  seo_title?: string | null;
  seo_description?: string | null;
  keywords?: string | null;
  alt_text?: string | null;
  slug?: string | null;
  original_image_url?: string | null;
  price?: number | string | null;
  availability?: CacheSEOMetadata['availability'] | null;
}

async function resolveCacheHitId(result: AnalysisCacheLookupRow): Promise<string | null> {
  if (typeof result.id === 'string' && result.id.trim()) {
    return result.id;
  }

  try {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('id')
      .eq('p_hash', result.p_hash)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return typeof data?.id === 'string' ? data.id : null;
  } catch (error) {
    console.warn('⚠️ Failed to resolve cache row id for analysis hit:', error);
    return null;
  }
}

function mapCacheHitResult(result: AnalysisCacheLookupRow, id: string | null): CacheHitResult {
  const analysisResult: HybridAnalysisResult = result.analysis_json;
  const seoMetadata: CacheSEOMetadata = {
    seo_title: result.seo_title || null,
    seo_description: result.seo_description || null,
    keywords: result.keywords || null,
    alt_text: result.alt_text || null,
    slug: result.slug || null,
    original_image_url: result.original_image_url || null,
    price: result.price ? Number(result.price) : null,
    availability: result.availability || null,
  };

  return { id, pHash: result.p_hash, analysisResult, seoMetadata };
}

async function findSimilarAnalysisByLegacyHashes(
  hashCandidates: string[],
  imageUrl?: string
): Promise<CacheHitResult | null> {
  for (let i = 0; i < hashCandidates.length; i++) {
    const candidate = hashCandidates[i];
    console.log(`🔍 Starting legacy pHash cache lookup for hash ${i + 1}/${hashCandidates.length}: ${candidate}`);
    console.log('🔍 Calling find_similar_analysis RPC with pHash:', candidate);

    const { data, error } = await supabase.rpc('find_similar_analysis', {
      new_hash: candidate,
    });

    if (data) {
      console.log(`📡 RPC 'find_similar_analysis' returned ${data.length} potential hash matches.`);
    }

    if (error) {
      console.error('❌ Analysis cache lookup error:', error);
      console.error('Error details:', { code: error.code, message: error.message, hint: error.hint });
      return null;
    }

    if (!data || data.length === 0) {
      continue;
    }

    const result = data[0];
    const hitLabel = hashCandidates.length > 1 && candidate !== hashCandidates[0]
      ? '✅ Cache HIT! Found matching analysis via compatibility pHash:'
      : '✅ Cache HIT! Found matching analysis for pHash:';
    console.log(hitLabel, candidate);

    const needsBackfill = result.price === null || result.keywords === null || (result.original_image_url === null && imageUrl);

    if (needsBackfill) {
      backfillCacheFields(result.p_hash, result.analysis_json, imageUrl);
    }

    const cacheId = await resolveCacheHitId(result);
    return mapCacheHitResult(result, cacheId);
  }

  return null;
}

export async function findSimilarAnalysisByHash(pHash: string | string[] | FingerprintHashLookup, imageUrl?: string): Promise<CacheHitResult | null> {
  try {
    const lookup = normalizeHashLookup(pHash);

    if (typeof pHash === 'object' && !Array.isArray(pHash)) {
      const droppedCanonical = pHash.pHash && !lookup.canonicalHash;
      const droppedLegacyCount = (pHash.legacyPHashes || []).length - lookup.legacyHashes.length;

      if (droppedCanonical || droppedLegacyCount > 0) {
        console.warn('⚠️ Dropping invalid non-hex fingerprint candidates before cache lookup.', {
          droppedCanonical,
          droppedLegacyCount,
        });
      }
    }

    if (lookup.allCandidates.length === 0) {
      console.log('⚫️ Cache MISS. No pHash candidates were available.');
      return null;
    }

    if (lookup.canonicalHash || lookup.legacyHashes.length > 0) {
      console.log('🔍 Calling canonical fingerprint lookup RPC:', {
        canonicalHash: lookup.canonicalHash,
        pipeline: lookup.pipeline,
        legacyCandidates: lookup.legacyHashes.length,
      });

      const { data, error } = await supabase.rpc('find_similar_analysis_by_fingerprint', {
        new_hash: lookup.canonicalHash,
        new_pipeline: lookup.pipeline,
        legacy_hashes: lookup.legacyHashes,
      });

      if (error) {
        console.warn('⚠️ Canonical fingerprint lookup unavailable, falling back to legacy pHash RPC:', error.message);
      } else if (data && data.length > 0) {
        const result = data[0];
        console.log('✅ Cache HIT! Found matching analysis via canonical fingerprint lookup:', lookup.canonicalHash || lookup.legacyHashes[0]);

        const needsBackfill = result.price === null || result.keywords === null || (result.original_image_url === null && imageUrl);

        if (needsBackfill) {
          backfillCacheFields(result.p_hash, result.analysis_json, imageUrl);
        }

        const cacheId = await resolveCacheHitId(result);
        return mapCacheHitResult(result, cacheId);
      }
    }

    const legacyHit = await findSimilarAnalysisByLegacyHashes(lookup.legacyHashes, imageUrl);
    if (legacyHit) {
      return legacyHit;
    }

    console.log('⚫️ Cache MISS. No matching fingerprint found in database.');
    return null;
  } catch (err) {
    console.error('❌ Exception during analysis cache lookup:', err);
    return null;
  }
}


/**
 * Fetches analysis directly by exact p_hash string match.
 * Used when we already have the p_hash from the product record.
 */
export async function getAnalysisByExactHash(pHash: string): Promise<HybridAnalysisResult | null> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('analysis_json')
      .eq('p_hash', pHash)
      .single();

    if (error) {
      console.error('Error fetching analysis by hash:', error);
      return null;
    }

    return data?.analysis_json || null;
  } catch (err) {
    console.error('Exception fetching analysis by hash:', err);
    return null;
  }
}

export interface StudioImageAvailability {
  original_image_url: string | null;
  studio_edited_image_url: string | null;
  studio_edit_status: string | null;
}

export async function getStudioImageAvailabilityByHash(
  pHash: string
): Promise<StudioImageAvailability | null> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('original_image_url, studio_edited_image_url, studio_edit_status')
      .eq('p_hash', pHash)
      .maybeSingle();

    if (error) {
      console.error('Error fetching studio image availability by hash:', error);
      return null;
    }

    return data ?? null;
  } catch (err) {
    console.error('Exception fetching studio image availability by hash:', err);
    return null;
  }
}

/** Fetch image dimensions from analysis cache by pHash */
export async function getImageDimensionsByHash(pHash: string): Promise<{ image_width: number | null; image_height: number | null } | null> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('image_width, image_height')
      .eq('p_hash', pHash)
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Converts an image Blob to a WebP Blob using the browser's Canvas API.
 * This should only be called on the client side.
 */
export async function convertToWebP(blob: Blob): Promise<Blob> {
  if (typeof window === 'undefined') return blob; // Fallback if server-side

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((webpBlob) => {
        if (webpBlob) {
          resolve(webpBlob);
        } else {
          reject(new Error('Canvas to WebP conversion failed'));
        }
      }, 'image/webp', 0.85); // 0.85 quality
    };
    img.onerror = () => reject(new Error('Failed to load image for WebP conversion'));
    img.src = URL.createObjectURL(blob);
  });
}

type AnalysisCacheCoverageUpdate = {
  fingerprint_status?: string;
  fingerprint_error?: string | null;
  fingerprinted_at?: string | null;
  orb_index_status?: string;
  orb_index_error?: string | null;
  orb_index_attempted_at?: string | null;
  orb_indexed_at?: string | null;
};

function getInitialOrbIndexCoverage(imageUrl?: string | null, imageBlob?: Blob) {
  if (imageBlob || (typeof imageUrl === 'string' && imageUrl.trim().length > 0)) {
    return {
      orb_index_status: 'pending',
      orb_index_error: null,
    };
  }

  return {
    orb_index_status: 'missing_source',
    orb_index_error: 'No cached image source available for ORB indexing.',
  };
}

async function updateAnalysisCacheCoverage(
  client: SupabaseClient,
  cacheId: string,
  fields: AnalysisCacheCoverageUpdate
): Promise<void> {
  const { error } = await client
    .from('cakegenie_analysis_cache')
    .update(fields)
    .eq('id', cacheId);

  if (error) {
    console.warn('⚠️ Failed to update analysis cache coverage state:', {
      cacheId,
      fields,
      error: error.message,
    });
  }
}

async function triggerOrbFeatureIndexing(
  client: SupabaseClient,
  cacheId: string,
  imageBlob: Blob
): Promise<void> {
  const indexUrl = getOrbBackendUrl('/api/index');
  const attemptedAt = new Date().toISOString();

  if (!indexUrl) {
    console.warn('⚠️ ORB backend is not configured; skipping feature indexing trigger.');
    await updateAnalysisCacheCoverage(client, cacheId, {
      orb_index_status: 'failed',
      orb_index_error: 'ORB backend is not configured for this environment.',
      orb_index_attempted_at: attemptedAt,
    });
    return;
  }

  try {
    await updateAnalysisCacheCoverage(client, cacheId, {
      orb_index_status: 'indexing',
      orb_index_error: null,
      orb_index_attempted_at: attemptedAt,
    });

    const formData = new FormData();
    formData.append('cache_id', cacheId);
    formData.append('skip_if_exists', 'true');

    const fileName = typeof File !== 'undefined' && imageBlob instanceof File
      ? imageBlob.name
      : 'orb-index-source.webp';

    formData.append('file', imageBlob, fileName);

    const response = await fetch(indexUrl, {
      method: 'POST',
      body: formData,
    });

    let payload: { already_indexed?: boolean; detail?: string; message?: string } | null = null;
    try {
      payload = await response.json() as { already_indexed?: boolean; detail?: string; message?: string };
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const detail = payload?.detail || payload?.message || 'Unknown error';
      console.warn('⚠️ ORB feature indexing failed:', {
        status: response.status,
        detail,
      });
      await updateAnalysisCacheCoverage(client, cacheId, {
        orb_index_status: 'failed',
        orb_index_error: detail,
        orb_index_attempted_at: attemptedAt,
      });
      return;
    }

    if (payload?.already_indexed) {
      console.log('ℹ️ ORB features already existed for cache row:', cacheId);
      await updateAnalysisCacheCoverage(client, cacheId, {
        orb_index_status: 'ready',
        orb_index_error: null,
        orb_index_attempted_at: attemptedAt,
        orb_indexed_at: attemptedAt,
      });
      return;
    }

    console.log('✅ ORB features indexed for cache row:', cacheId);
    await updateAnalysisCacheCoverage(client, cacheId, {
      orb_index_status: 'ready',
      orb_index_error: null,
      orb_index_attempted_at: attemptedAt,
      orb_indexed_at: attemptedAt,
    });
  } catch (err) {
    console.warn('⚠️ Failed to trigger ORB feature indexing:', err);
    await updateAnalysisCacheCoverage(client, cacheId, {
      orb_index_status: 'failed',
      orb_index_error: err instanceof Error ? err.message : 'Failed to trigger ORB feature indexing.',
      orb_index_attempted_at: attemptedAt,
    });
  }
}

/**
 * Saves a new AI analysis result to the cache table and returns the generated metadata
 * so callers (e.g. the chat widget) can immediately reply with a customizing link.
 * Returns null if caching fails for any reason other than a duplicate row.
 * @param pHash The perceptual hash of the image.
 * @param analysisResult The JSON result from the AI analysis.
 * @param imageUrl The public URL of the original image being cached.
 * @param imageBlob Optional Blob of the processed image to be converted and uploaded to Supabase.
 */
export async function cacheAnalysisResult(
  pHash: string,
  analysisResult: HybridAnalysisResult,
  imageUrl?: string,
  imageBlob?: Blob,
  options?: {
    client?: SupabaseClient;
    triggerStudioEdit?: boolean;
    fingerprintPipeline?: string | null;
    persistSourceAsset?: boolean | 'if_missing';
  }
): Promise<CacheWriteResult | null> {
  try {
    console.log('💾 Attempting to cache analysis result with pHash:', pHash);
    const client = options?.client || (typeof window === 'undefined' ? publicSupabaseClient : supabase);
    const fingerprintPipeline = options?.fingerprintPipeline || null;
    const persistSourceAsset = options?.persistSourceAsset ?? true;
    const resolvedPHash = await resolveExistingWriteHash(pHash, fingerprintPipeline, client);

    if (resolvedPHash !== pHash) {
      console.log('🧭 Reusing existing cache row for near-identical server fingerprint:', {
        incoming: pHash,
        resolved: resolvedPHash,
      });
    }

    // Calculate Price and Keywords before inserting
    const pricingState = mapAnalysisToPricingState(analysisResult);
    const { addOnPricing } = await calculatePriceFromDatabase(pricingState);
    const lowestBasePrice = await getLowestBasePrice(analysisResult.cakeType);
    let totalPrice = lowestBasePrice + addOnPricing.addOnPrice;

    // Apply "round down to nearest 99" logic
    totalPrice = roundDownToNearest99(totalPrice, lowestBasePrice);

    const keywords = analysisResult.keyword || '';

    // Generate SEO-friendly slug: keyword + icing color + type + phash
    const icingColor = analysisResult.icing_design?.colors?.top || analysisResult.icing_design?.colors?.side || null;
    const slug = generateCakeAnalysisSlug({
      keyword: keywords,
      icingColor,
      cakeType: analysisResult.cakeType,
      pHash: resolvedPHash
    });

    // Generate fallback SEO fields if AI didn't provide them
    const altText = analysisResult.alt_text || `${keywords || 'Custom'} cake design`;
    // Legacy AI/keyword title — retained ONLY as a token source for tag extraction
    // (preserves historical tag behaviour). The customer-facing seo_title is built
    // deterministically below via buildCakeTitle (R10), NOT from this value.
    const tagSourceTitle = analysisResult.seo_title || `${keywords || 'Custom'} Cake | Genie.ph`;
    const generatedSeoDescription = analysisResult.seo_description || `Get instant pricing for this ${keywords || 'custom'} cake design. Customize and order at Genie.ph. Starting at ₱${totalPrice.toLocaleString()}.`;
    const fingerprintedAt = new Date().toISOString();

    let finalImageUrl = imageUrl;
    let imageDimensions: { image_width: number | null; image_height: number | null } = {
      image_width: null,
      image_height: null,
    };

    // Measure image dimensions from blob (client-side only) for CLS prevention
    const blobToMeasure = imageBlob;
    if (blobToMeasure && typeof window !== 'undefined') {
      try {
        const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const img = new window.Image();
          const objectUrl = URL.createObjectURL(blobToMeasure);
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Image dimension measurement failed'));
          };
          img.src = objectUrl;
        });
        imageDimensions = { image_width: dims.w, image_height: dims.h };
        console.log(`📐 Image dimensions: ${dims.w}×${dims.h}`);
      } catch (dimErr) {
        console.warn('⚠️ Could not measure image dimensions:', dimErr);
      }
    }

    // If we have a blob, convert to WebP and upload to Supabase storage
    if (persistSourceAsset !== false && imageBlob) {
      try {
        console.log('🖼️ Converting image to WebP and uploading to Supabase...');
        const webpBlob = await convertToWebP(imageBlob);
        const fileName = `${slug}.webp`;
        const filePath = `customizations/${fileName}`;

        const { error: uploadError } = await client.storage
          .from('cakegenie')
          .upload(filePath, webpBlob, {
            contentType: 'image/webp',
            upsert: true,
          });

        if (uploadError) {
          console.error('❌ Failed to upload image to Supabase storage:', uploadError);
        } else {
          const { data: { publicUrl } } = client.storage
            .from('cakegenie')
            .getPublicUrl(filePath);

          finalImageUrl = publicUrl;
          console.log('✅ Image uploaded successfully to:', finalImageUrl);
        }
      } catch (uploadErr) {
        console.error('❌ Error during image upload process:', uploadErr);
      }
    }

    // Calculate availability from the analysis result
    const mainToppers = (analysisResult.main_toppers || []).map(t => ({ type: t.type, description: t.description || '' }));
    const supportElements = (analysisResult.support_elements || []).map(s => ({ type: s.type, description: s.description || '' }));
    const availability = getDesignAvailability({
      cakeType: analysisResult.cakeType,
      cakeSize: '6" Round', // Default size — initial analysis doesn't specify size
      icingBase: analysisResult.icing_design?.base || 'soft_icing',
      drip: analysisResult.icing_design?.drip || false,
      gumpasteBaseBoard: analysisResult.icing_design?.gumpasteBaseBoard || false,
      mainToppers,
      supportElements,
    });
    // Generate tags (uses the legacy title string only as a token source)
    const tags = generateTagsForAnalysis(analysisResult, keywords, tagSourceTitle, altText);
    const seoDescription = enrichStoredSeoDescription({
      analysisResult,
      availability,
      keywords,
      rawDescription: generatedSeoDescription,
      tags,
    });
    const finalizedAnalysisResult = {
      ...analysisResult,
      seo_description: seoDescription,
      tags,
    };

    // Build the customer-facing SEO title deterministically from structured
    // attributes (R10). Never derived from the AI seo_title or cake_messages (PII).
    const seoTitle = buildCakeTitle(
      extractTitleInputFromAnalysis(analysisResult, keywords, tags),
    );

    // Determine whether to write the original_image_url
    let shouldWriteImageUrl = false;
    if (finalImageUrl !== undefined) {
      if (persistSourceAsset === true) {
        shouldWriteImageUrl = true;
      } else if (persistSourceAsset === 'if_missing') {
        const { data: existingRecord } = await client
          .from('cakegenie_analysis_cache')
          .select('original_image_url')
          .eq('p_hash', resolvedPHash)
          .maybeSingle();
        if (!existingRecord || !existingRecord.original_image_url) {
          shouldWriteImageUrl = true;
        }
      }
    }

    const sourceInfoWasProvided = (persistSourceAsset === true || (persistSourceAsset === 'if_missing' && shouldWriteImageUrl)) && (imageUrl !== undefined || imageBlob !== undefined);
    const initialOrbCoverage = sourceInfoWasProvided
      ? {
        ...getInitialOrbIndexCoverage(finalImageUrl, imageBlob),
        orb_index_attempted_at: null,
        orb_indexed_at: null,
      }
      : {};

    const upsertPayload: Record<string, unknown> = {
      p_hash: resolvedPHash,
      fingerprint_pipeline: fingerprintPipeline,
      fingerprint_status: 'ready',
      fingerprint_error: null,
      fingerprinted_at: fingerprintedAt,
      analysis_json: finalizedAnalysisResult,
      price: totalPrice,
      keywords: keywords,
      slug: slug,
      alt_text: altText,
      seo_title: seoTitle,
      seo_description: seoDescription,
      availability: availability,
      tags: tags,
      ...initialOrbCoverage,
      ...imageDimensions,
    };

    if (shouldWriteImageUrl && finalImageUrl !== undefined) {
      upsertPayload.original_image_url = finalImageUrl;
    }

    const { data: upsertData, error } = await client
      .from('cakegenie_analysis_cache')
      .upsert(upsertPayload, {
        onConflict: 'p_hash',
        ignoreDuplicates: false // We set to false because we want to update with the new persistent image URL if it was already cached without one
      })
      .select('id')
      .single();

    let returnedId = upsertData?.id || undefined;
    if (!returnedId) {
      try {
        if (resolvedPHash) {
          const { data: existingData } = await client
            .from('cakegenie_analysis_cache')
            .select('id')
            .eq('p_hash', resolvedPHash)
            .single();
          if (existingData?.id) {
            returnedId = existingData.id;
          }
        }
        if (!returnedId && slug) {
          const { data: existingData } = await client
            .from('cakegenie_analysis_cache')
            .select('id')
            .eq('slug', slug)
            .single();
          if (existingData?.id) {
            returnedId = existingData.id;
            console.log(`🧭 Resolving slug collision: mapping to existing cache row ID ${returnedId} with same slug "${slug}".`);
          }
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch existing ID after upsert:', err);
      }
    }


    if (error) {
      // Log error but don't interrupt the user. Unique constraint violations (409) are expected and fine
      // especially during race conditions or when different designs share a truncated slug.
      if (error.code !== '23505' && error.code !== 'PGRST116') {
        console.warn('⚠️ Cache insert status:', error.message);
        return null;
      }
      console.log('ℹ️ Analysis already cached (duplicate pHash or slug - this is fine).');
    } else {
      console.log('✅ Analysis result cached successfully with pHash:', resolvedPHash, 'slug:', slug);

      // Notify IndexNow participating search engines
      if (slug) {
        notifyIndexNow(`https://genie.ph/customizing/${slug}`);
      }

      // Trigger background Image Studio edit (Fire and forget) for interactive
      // flows only. Bulk admin imports can create a second hidden AI pipeline
      // that collides with analysis traffic and causes quota contention.
      if (options?.triggerStudioEdit !== false && resolvedPHash && typeof window !== 'undefined') {
        fetch('/api/ai/trigger-studio-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pHash: resolvedPHash })
        }).catch(err => console.warn('Background trigger fetch error:', err));
      }
    }

    if (persistSourceAsset && returnedId && imageBlob) {
      // Keep ORB indexing in the shared write path, but don't block the
      // customizer's cache-write completion on a slow/offline ORB backend.
      void triggerOrbFeatureIndexing(client, returnedId, imageBlob);
    }

    return {
      slug,
      seo_title: seoTitle,
      price: totalPrice,
      original_image_url: finalImageUrl ?? null,
      storedPHash: resolvedPHash,
      id: returnedId,
    };
  } catch (err) {
    console.error('❌ Exception during cache write:', err);
    return null;
  }
}

/**
 * Helper to prefer studio-edited images when present, with original image as backup.
 * Modifies the object in place and returns it.
 */
export const applyImageFallback = (item: any) => {
  if (item) {
    item.original_image_url = firstNonBlankImageUrl(
      item.studio_edited_image_url,
      item.original_image_url,
    );
  }
  return item;
};

/**
 * Fetches recommended products from the analysis cache.
 * Returns items that have an original_image_url and a price.
 */
export interface RecommendedProductsQueryOptions {
  keyword?: string;
  keywords?: string[];
  availability?: string[];
}

export async function getRecommendedProducts(
  limit: number = 8,
  offset: number = 0,
  options?: RecommendedProductsQueryOptions,
  customClient?: SupabaseClient
): Promise<SupabaseServiceResponse<any[]>> {
  const client = customClient || (typeof window === 'undefined' ? publicSupabaseClient : supabase);
  try {
    let query = client
      .from('cakegenie_analysis_cache')
      .select('p_hash, original_image_url, price, keywords, analysis_json, slug, alt_text, availability, image_width, image_height, studio_edited_image_url, image_variants')
      .not('original_image_url', 'is', null)
      .not('price', 'is', null)
      .neq('original_image_url', '');

    const keywordTerms = [
      options?.keyword,
      ...(options?.keywords || []),
    ]
      .map(term => term?.trim())
      .filter((term): term is string => Boolean(term));

    if (keywordTerms.length === 1) {
      query = query.ilike('keywords', `%${keywordTerms[0]}%`);
    } else if (keywordTerms.length > 1) {
      query = query.or(
        keywordTerms
          .map(term => `keywords.ilike.%${term.replaceAll(',', ' ').trim()}%`)
          .join(',')
      );
    }

    if (options?.availability && options.availability.length > 0) {
      query = query.in('availability', options.availability);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching recommended products:', error);
      return { data: null, error };
    }

    if (data) {
      return { data: data.map(applyImageFallback), error: null };
    }

    return { data: [], error: null };
  } catch (err) {
    console.error('Exception fetching recommended products:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches the most popular designs by usage_count for SSR homepage section.
 * Returns designs with real <Link> tags for Google crawlability.
 */
export async function getPopularDesigns(
  limit: number = 20,
  options?: { keyword?: string; availability?: string[] },
  customClient?: SupabaseClient
): Promise<SupabaseServiceResponse<any[]>> {
  const client = customClient || (typeof window === 'undefined' ? publicSupabaseClient : supabase);
  try {
    let query = client
      .from('cakegenie_analysis_cache')
      .select('p_hash, slug, keywords, original_image_url, price, alt_text, availability, image_width, image_height, studio_edited_image_url, image_variants')
      .not('original_image_url', 'is', null)
      .not('slug', 'is', null)
      .not('price', 'is', null)
      .neq('keywords', '');

    if (options?.keyword) {
      query = query.ilike('keywords', `%${options.keyword}%`);
    }

    if (options?.availability && options.availability.length > 0) {
      query = query.in('availability', options.availability);
    }

    const { data, error } = await query
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching popular designs:', error);
      return { data: null, error };
    }

    return { data: data ? data.map(applyImageFallback) : [], error: null };
  } catch (err) {
    console.error('Exception fetching popular designs:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Builds a Supabase OR-filter string that matches products across
 * keywords (text), alt_text (text), slug (text), and tags (array)
 * for each collection tag. This allows a product to appear in any
 * collection where at least one field matches any of its tags.
 */
/**
 * Strips " Cakes", " Cake", " Themed", etc. from a collection name to get at the core keyword.
 */
const cleanCollectionName = (name: string): string => {
    return name
        .replace(/(?:\s+Cakes?|\s+Themed|\s+Design|\s+Collections?)$/i, '')
        .trim();
};

/**
 * Maps a collection's clean keyword to a canonical icing_colors bucket
 * (if the collection is a color collection). Sub-colors like "lavender" or
 * "sage green" map to their parent bucket. Returns null for non-color
 * collections so the existing tag/keyword matching path is used.
 *
 * icing_colors is the analyst's normalized "side color" of the cake — far
 * more accurate than the noisy `tags` array (which includes accent colors).
 * See cakegenie_analysis_cache.icing_colors and the
 * `get_closest_icing_color()` function for the canonical bucket list.
 */
const COLOR_CANONICAL: Record<string, string> = {
    white: 'white',
    black: 'black',
    blue: 'blue',
    pink: 'pink',
    yellow: 'yellow',
    purple: 'purple',
    lavender: 'purple',    // lavender is a sub-color of purple
    red: 'red',
    green: 'green',
    sage: 'green',        // sage green maps to green
    'sage green': 'green',
    emerald: 'green',     // emerald green maps to green
    'emerald green': 'green',
    orange: 'orange',
    brown: 'brown',
    gold: 'yellow',       // gold is rare; treat as a yellow variant
    silver: 'white',      // silver accents usually ride on white
    maroon: 'red',
    teal: 'blue',
    cream: 'white',
    ivory: 'white',
};

const canonicalColorFor = (cleanKeyword: string): string | null => {
    return COLOR_CANONICAL[cleanKeyword] || null;
};

/**
 * Builds a Supabase OR-filter string that matches products against
 * the core keyword derived from the collection name.
 *
 * For color collections (cleanKeyword matches COLOR_CANONICAL), only
 * `icing_colors.eq.<canonical>` is used. The tag/keyword/slug fallbacks
 * are skipped because they produce noisy results (e.g. a teal cake with
 * yellow stars gets tagged "yellow" but is not actually a yellow cake).
 *
 * As the icing_colors column is backfilled for more designs, the
 * collection's item_count will grow automatically.
 */
const buildCollectionOrFilter = (collectionName: string, collectionTags: string[] = []): string => {
    const keyword = cleanCollectionName(collectionName);
    const cleanKeyword = keyword.toLowerCase();

    if (!cleanKeyword) return 'id.eq.-1'; // Should not happen with valid names

    const filters: string[] = [];

    // 0. Color collection: strict match on icing_colors ONLY.
    // No keyword/slug/multi-word tag fallbacks — those are too noisy
    // for color matching and pull in accent-only designs.
    const canonical = canonicalColorFor(cleanKeyword);
    if (canonical) {
        filters.push(`icing_colors.eq.${canonical}`);
        return filters.join(',');
    }

    // 1. Exact match in tags array
    filters.push(`tags.cs.{"${cleanKeyword}"}`);

    // 2. Keyword match in keywords field (text search)
    filters.push(`keywords.ilike.%${cleanKeyword}%`);

    // 3. Slug match
    const slugKeyword = cleanKeyword.replace(/\s+/g, '-');
    filters.push(`slug.ilike.%${slugKeyword}%`);

    // 4. (Optional) If we still want some tags but only very specific ones (length > 1 word)
    for (const tag of collectionTags) {
        const cleanTag = tag.trim().toLowerCase();
        if (cleanTag === cleanKeyword || cleanTag.split(/\s+/).length < 2) continue;

        // Only add multi-word tags from the collection's tag list for precision
        filters.push(`tags.cs.{"${cleanTag}"}`);
    }

    return filters.join(',');
};

/**
 * Fetches design categories from the cakegenie_collections table.
 */
export async function getDesignCategories(customClient?: SupabaseClient): Promise<SupabaseServiceResponse<{ keyword: string; slug: string; count: number; sample_image: string, description?: string; collection_type?: string; trend_score?: number | null }[]>> {
  const client = customClient || (typeof window === 'undefined' ? publicSupabaseClient : supabase);
  try {
    const { data: collections, error: collectionsError } = await client
      .from('cakegenie_collections')
      .select('name, slug, tags, sample_image, description, item_count, collection_type, trend_score')
      .eq('publication_status', 'published')
      .eq('is_indexable', true)
      .gte('item_count', 8)
      .order('name', { ascending: true });

    if (collectionsError) {
      console.error('Error fetching design categories from collections:', collectionsError);
      return { data: null, error: collectionsError };
    }

    if (!collections || collections.length === 0) {
      return { data: [], error: null };
    }

    // Return categories using the pre-calculated item_count from the DB table.
    // This avoids heavy dynamic ILIKE queries that caused V8 call stack size exceeded errors.
    const resolvedCategories = collections.map((collection: any) => ({
      keyword: collection.name,
      slug: collection.slug,
      count: collection.item_count || 0,
      sample_image: collection.sample_image || 'https://images.unsplash.com/photo-1542826438-bd32f43d626f?q=80&w=600&auto=format&fit=crop',
      description: collection.description || undefined,
      collection_type: collection.collection_type || undefined,
      trend_score: collection.trend_score ?? null,
    }));

    // Optionally sort them alphabetically since we don't have real counts
    const sortedCategories = resolvedCategories;

    return { data: sortedCategories, error: null };
  } catch (err) {
    console.error('Exception fetching design categories:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches ALL recent designs for the "Newest" fallback section in Collections.
 * This ensures "orphan" designs (count < 3) are still indexable.
 */
export async function getAllRecentDesigns(limit: number = 24, offset: number = 0): Promise<SupabaseServiceResponse<any[]>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('slug, keywords, original_image_url, price, alt_text, created_at, p_hash, availability, analysis_json, image_width, image_height, studio_edited_image_url, image_variants')
      .not('original_image_url', 'is', null)
      .not('slug', 'is', null)
      .not('price', 'is', null)
      .neq('keywords', '')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching all recent designs:', error);
      return { data: null, error };
    }

    return { data: data ? data.map(applyImageFallback) : [], error: null };
  } catch (err) {
    console.error('Exception fetching all recent designs:', err);
    return { data: null, error: err as Error };
  }
}

function buildCollectionSlugCandidates(rawSlug: string): string[] {
  const normalizedSlug = decodeURIComponent(rawSlug).trim().toLowerCase();
  const candidates = new Set<string>();

  if (!normalizedSlug) {
    return [];
  }

  candidates.add(normalizedSlug);

  if (normalizedSlug.endsWith('-cakes')) {
    candidates.add(normalizedSlug.replace(/-cakes$/i, '-cake'));
  } else if (normalizedSlug.endsWith('-cake')) {
    candidates.add(normalizedSlug.replace(/-cake$/i, '-cakes'));
  } else {
    candidates.add(`${normalizedSlug}-cake`);
    candidates.add(`${normalizedSlug}-cakes`);
  }

  return Array.from(candidates);
}

/**
 * Convert a free-form theme keyword (e.g. "Kuromi", "My Melody", "Katseye Kpop")
 * into a slug suitable for collection lookup ("kuromi", "my-melody",
 * "katseye-kpop"). Returns an empty string when nothing usable remains.
 */
function keywordToCollectionSlugBase(keyword: string): string {
  return keyword
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Given a design's primary keyword, find the matching `cakegenie_collections`
 * row (if any) so we can link a single-variant page to its theme gallery.
 *
 * Used to fix Search Console pages where high-impression broad queries (e.g.
 * "kuromi cake design") land on a single product variant instead of a gallery.
 *
 * Resolution order:
 *   1. The full keyword as a slug (e.g. "Kuromi" → kuromi-cake).
 *   2. Each individual word in the keyword (e.g. "Graduation Bento" →
 *      graduation-cake, bento-cake).
 * Skips words shorter than 3 characters and very generic terms.
 * Returns null if no candidate matches a collection with at least 2 items.
 */
const COLLECTION_KEYWORD_STOPWORDS = new Set([
  'and', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'with', 'cake', 'cakes',
  'design', 'designs', 'custom', 'birthday', 'simple', 'mini', 'genie',
]);

export async function getCollectionForDesignKeyword(
  keyword: string | null | undefined,
): Promise<SupabaseServiceResponse<{ slug: string; name: string; item_count: number } | null>> {
  if (!keyword || !keyword.trim()) {
    return { data: null, error: null };
  }

  // Build prioritised probe list:
  //   priority 0 = full keyword
  //   priority 1+ = each meaningful word in the keyword (left-to-right)
  const probes: string[] = [];
  const seen = new Set<string>();

  const pushProbe = (raw: string) => {
    const base = keywordToCollectionSlugBase(raw);
    if (!base || seen.has(base)) return;
    seen.add(base);
    probes.push(base);
  };

  pushProbe(keyword);

  const words = keyword
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !COLLECTION_KEYWORD_STOPWORDS.has(w));
  for (const word of words) {
    pushProbe(word);
  }

  if (probes.length === 0) {
    return { data: null, error: null };
  }

  // Build all collection slug candidates for every probe, preserving probe order
  // so the first probe's matches outrank later probes' matches.
  const orderedCandidates: string[] = [];
  const candidateSeen = new Set<string>();
  for (const probe of probes) {
    for (const candidate of buildCollectionSlugCandidates(probe)) {
      if (candidateSeen.has(candidate)) continue;
      candidateSeen.add(candidate);
      orderedCandidates.push(candidate);
    }
  }

  if (orderedCandidates.length === 0) {
    return { data: null, error: null };
  }

  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;
  try {
    const { data, error } = await client
      .from('cakegenie_collections')
      .select('slug, name, item_count')
      .in('slug', orderedCandidates)
      .gt('item_count', 1)
      .returns<Array<{ slug: string; name: string; item_count: number }>>();

    if (error || !data || data.length === 0) {
      return { data: null, error: error || null };
    }

    // Prefer the candidate that appears earliest in the priority list
    const ranked = [...data].sort(
      (a, b) => orderedCandidates.indexOf(a.slug) - orderedCandidates.indexOf(b.slug),
    );
    return { data: ranked[0], error: null };
  } catch (err) {
    console.error('Exception fetching collection for keyword:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Gets a specific collection by its slug.
 */
export async function getCollectionBySlug(slug: string): Promise<SupabaseServiceResponse<any>> {
  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;
  try {
    const slugsToTry = buildCollectionSlugCandidates(slug);

    if (slugsToTry.length === 0) {
      return { data: null, error: null };
    }

    const { data, error } = await client
      .from('cakegenie_collections')
      .select('*')
      .in('slug', slugsToTry)
      .returns<any[]>();

    if (error) {
      console.error('Error fetching collection by slug:', error);
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      return { data: null, error: null };
    }

    const rankedResults = [...data].sort((a, b) => {
      const aIndex = slugsToTry.indexOf(a.slug);
      const bIndex = slugsToTry.indexOf(b.slug);
      return aIndex - bIndex;
    });

    return { data: rankedResults[0], error: null };
  } catch (err) {
    console.error('Exception fetching collection by slug:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches designs matching a specific keyword or category slug.
 * Matches against product keywords, alt_text, slug, and tags array.
 * If the slug maps to a collection, its tags are used for wide matching.
 */
export async function getDesignsByKeyword(keywordOrSlug: string, limit: number = 50, offset: number = 0): Promise<SupabaseServiceResponse<any[]>> {
  try {
    // Step 1: Resolve collection aliases to the official collection row when possible.
    const { data: collection } = await getCollectionBySlug(keywordOrSlug);
    const normalizedKeyword = decodeURIComponent(collection?.slug || keywordOrSlug).replace(/-/g, ' ').trim();

    // Build the FTS query.
    // For collections: use ONLY the cleaned collection name (single key term).
    // Joining all tags with spaces would produce an AND query in tsquery,
    // which is far too restrictive — most products only match one tag, not all.
    // A single term uses stemming (airplane = airplanes) and searches the full
    // search_vector including analysis_json, finding more results than ILIKE.
    // For raw keyword searches: normalize slug-like paths such as "pickleball-cake"
    // into spaced phrases so collection pages can still resolve even before a
    // corresponding collections-table row exists.
    const ftsQuery = collection ? cleanCollectionName(collection.name) : normalizedKeyword;

    // During `next build`, dozens of category/customizing pages can prerender in
    // parallel. The FTS RPC is useful at runtime, but it is the path most likely
    // to hit Supabase statement timeouts under static-build fan-out.
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      // Step 2: Use FTS search (ranked, searches keywords + analysis_json + alt_text + slug)
      const ftsResult = await searchProductsFTS(ftsQuery, limit, offset);
      if (ftsResult.data && ftsResult.data.length > 0) {
        return ftsResult;
      }
    }

    // Step 3: FTS returned nothing, or we intentionally skipped it during the
    // production build — fall back to ILIKE.
    const orFilters = collection
      ? buildCollectionOrFilter(collection.name, collection.tags || [])
      : buildCollectionOrFilter(normalizedKeyword);
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('slug, keywords, original_image_url, price, alt_text, usage_count, p_hash, availability, analysis_json, image_width, image_height, studio_edited_image_url, image_variants, icing_colors')
      .not('original_image_url', 'is', null)
      .not('slug', 'is', null)
      .or(orFilters)
      .order('usage_count', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching designs by keyword (fallback):', error);
      return { data: null, error };
    }

    return { data: data ? data.map(applyImageFallback) : [], error: null };
  } catch (err) {
    console.error('Exception fetching designs by keyword/slug:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches collections that are related to a design's tags or keywords.
 */
export async function getCollectionsForDesign(tags: string[] | null, keywords?: string | null): Promise<SupabaseServiceResponse<any[]>> {
  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;
  try {
    // 1. Fetch all collections
    const { data: collections, error: collectionsError } = await client
      .from('cakegenie_collections')
      .select('name, slug, tags, sample_image, description, item_count')
      .order('name', { ascending: true });

    if (collectionsError) {
      console.error('Error fetching collections for design matching:', collectionsError);
      return { data: null, error: collectionsError };
    }

    if (!collections || collections.length === 0) {
      return { data: [], error: null };
    }

    // 2. Filter collections that match design tags or keywords
    const designTags = new Set((tags || []).map(t => t.toLowerCase().trim()));
    const designKeywords = (keywords || '').toLowerCase().split(/[\s,]+/).filter(k => k.length > 2);

    // Add keywords to the matching set
    designKeywords.forEach(k => designTags.add(k));

    const matchedCollections = collections.filter((collection: any) => {
      const collectionName = collection.name.toLowerCase();
      const collectionTags = (collection.tags || []).map((t: string) => t.toLowerCase().trim());

      // Match if any design tag is in collection tags
      const tagMatch = collectionTags.some((t: string) => designTags.has(t));

      // Match if collection name is in design keywords or tags
      const nameMatch = Array.from(designTags).some(t => collectionName.includes(t));

      return tagMatch || nameMatch;
    });

    return { data: matchedCollections, error: null };
  } catch (err) {
    console.error('Exception fetching collections for design:', err);
    return { data: null, error: err as Error };
  }
}


/**
 * Fetches related products based on keywords from the current blog post or design.
 * Matches across keywords, alt_text, and slug columns using ILIKE for broad recall.
 * Falls back to recent products if no keyword matches found.
 */
export async function getRelatedProductsByKeywords(
  keywords: string | null,
  excludeSlug: string | null,
  limit: number = 6,
  offset: number = 0
): Promise<SupabaseServiceResponse<any[]>> {
  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;
  try {
    const normalizedPhrase = normalizeRelatedSearchPhrase(keywords);
    if (!normalizedPhrase) {
      return getRecommendedProducts(limit, offset);
    }

    const candidateLimit = Math.max(limit * 4, 72);

    const fetchRelatedProductsWithFilters = async () => {
      const distinctiveTerms = getDistinctiveRelatedSearchTerms(keywords);
      const selectFields =
        'p_hash, original_image_url, price, keywords, analysis_json, slug, alt_text, availability, image_width, image_height, usage_count, studio_edited_image_url, image_variants';

      const buildBaseQuery = () => {
        let query = client
          .from('cakegenie_analysis_cache')
          .select(selectFields)
          .not('original_image_url', 'is', null)
          .not('price', 'is', null)
          .neq('original_image_url', '');

        if (excludeSlug) {
          query = query.neq('slug', excludeSlug);
        }

        return query;
      };

      const termFilters = (distinctiveTerms.length > 0 ? distinctiveTerms : [normalizedPhrase])
        .flatMap((term) => {
          const slugTerm = term.replace(/\s+/g, '-');
          return [
            `keywords.ilike.%${term}%`,
            `alt_text.ilike.%${term}%`,
            `slug.ilike.%${slugTerm}%`,
          ];
        })
        .join(',');

      const { data, error } = await buildBaseQuery()
        .or(termFilters)
        .order('usage_count', { ascending: false })
        .range(0, candidateLimit - 1);

      if (error || !data || data.length === 0) {
        return getRecommendedProducts(limit, offset);
      }

      const filtered = data.filter((p: any) => !excludeSlug || p.slug !== excludeSlug);
      const rankedProducts = rankRelatedProducts(filtered, keywords, offset + limit).slice(offset);
      return {
        data: rankedProducts.length > 0
          ? rankedProducts.map(applyImageFallback)
          : (await getRecommendedProducts(limit, offset)).data || [],
        error: null,
      };
    };

    // During `next build`, many pages prerender related-product slots in parallel.
    // The FTS RPC is great for runtime search, but it can hit Supabase statement
    // timeouts when dozens of static pages call it at once. Use the lighter
    // indexed column filters for SSG and keep FTS for normal runtime requests.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return fetchRelatedProductsWithFilters();
    }

    const { data: initialFtsResults, error: ftsError } = await client.rpc('search_products', {
      p_query: normalizedPhrase,
      p_limit: candidateLimit,
      p_offset: 0,
    });
    let ftsResults: any[] | null = initialFtsResults;

    if (ftsError) {
      console.error('Error in FTS related search:', ftsError);
      return fetchRelatedProductsWithFilters();
    }

    // The search_products RPC may omit studio_edited_image_url. Hydrate it from
    // the base table so applyImageFallback can prefer the studio image. Mirrors
    // the same logic in searchProductsFTS.
    const needsStudioHydration = (ftsResults || []).some(
      (item: any) => item.studio_edited_image_url === undefined,
    );

    if (needsStudioHydration) {
      const pHashes = (ftsResults || [])
        .map((item: any) => item.p_hash)
        .filter((pHash: any): pHash is string =>
          typeof pHash === 'string' && pHash.trim().length > 0,
        );

      if (pHashes.length > 0) {
        const { data: studioRows, error: studioError } = await client
          .from('cakegenie_analysis_cache')
          .select('p_hash, original_image_url, studio_edited_image_url')
          .in('p_hash', pHashes);

        if (!studioError && studioRows) {
          const studioByHash = new Map(
            studioRows.map((row) => [row.p_hash, row]),
          );

          ftsResults = (ftsResults || []).map((item: any) => {
            const studioRow = studioByHash.get(item.p_hash);
            return applyImageFallback({
              ...item,
              original_image_url:
                item.original_image_url ?? studioRow?.original_image_url ?? null,
              studio_edited_image_url:
                item.studio_edited_image_url ?? studioRow?.studio_edited_image_url ?? null,
            });
          });
        }
      }
    }

    // Filter out the excluded slug
    let candidates = (ftsResults || []).filter(
      (p: any) => !excludeSlug || p.slug !== excludeSlug
    );

    // Apply existing JS-side ranking for fine-grained relevance
    const rankedProducts = rankRelatedProducts(candidates, keywords, offset + limit).slice(offset);

    if (rankedProducts.length > 0) {
      return { data: rankedProducts.map(applyImageFallback), error: null };
    }

    // Fallback to recent products if no keyword matches
    console.log('No FTS keyword matches found, falling back to recent products');
    return getRecommendedProducts(limit, offset);
  } catch (err) {
    console.error('Exception fetching related products by keywords:', err);
    return { data: null, error: err as Error };
  }
}


// =============================================================================
// Full-Text Search (PostgreSQL FTS + pg_trgm)
// =============================================================================

/**
 * Full-text search for products using PostgreSQL FTS + pg_trgm.
 * Replaces ILIKE-based search with ranked, typo-tolerant results.
 */
export async function searchProductsFTS(
  query: string,
  limit: number = 30,
  offset: number = 0,
  options?: {
    availability?: string[];
    minPrice?: number;
    maxPrice?: number;
    icingColors?: string;
  }
): Promise<SupabaseServiceResponse<any[]>> {
  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;
  try {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      return { data: [], error: null };
    }

    const { data, error } = await client.rpc('search_products', {
      p_query: cleanQuery,
      p_limit: limit,
      p_offset: offset,
      p_availability: options?.availability || null,
      p_min_price: options?.minPrice || null,
      p_max_price: options?.maxPrice || null,
      p_icing_colors: options?.icingColors || null,
    });

    if (error) {
      console.error('FTS search error:', error);
      return { data: null, error };
    }

    const rows = data || [];
    const needsStudioHydration = rows.some((item: any) => item.studio_edited_image_url === undefined);

    if (needsStudioHydration) {
      const pHashes = rows
        .map((item: any) => item.p_hash)
        .filter((pHash: any): pHash is string => typeof pHash === 'string' && pHash.trim().length > 0);

      if (pHashes.length > 0) {
        const { data: studioRows, error: studioError } = await client
          .from('cakegenie_analysis_cache')
          .select('p_hash, original_image_url, studio_edited_image_url')
          .in('p_hash', pHashes);

        if (!studioError && studioRows) {
          const studioByHash = new Map(
            studioRows.map((row) => [row.p_hash, row]),
          );

          return {
            data: rows.map((item: any) => {
              const studioRow = studioByHash.get(item.p_hash);
              return applyImageFallback({
                ...item,
                original_image_url: item.original_image_url ?? studioRow?.original_image_url ?? null,
                studio_edited_image_url: item.studio_edited_image_url ?? studioRow?.studio_edited_image_url ?? null,
              });
            }),
            error: null,
          };
        }
      }
    }

    return { data: rows.map(applyImageFallback), error: null };
  } catch (err) {
    console.error('Exception in FTS search:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Gets the total count of FTS search results for pagination.
 */
export async function searchProductsFTSCount(
  query: string,
  options?: {
    availability?: string[];
    minPrice?: number;
    maxPrice?: number;
    icingColors?: string;
  }
): Promise<number> {
  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;
  try {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return 0;

    const { data, error } = await client.rpc('search_products_count', {
      p_query: cleanQuery,
      p_availability: options?.availability || null,
      p_min_price: options?.minPrice || null,
      p_max_price: options?.maxPrice || null,
      p_icing_colors: options?.icingColors || null,
    });

    if (error) {
      console.warn('FTS count error:', error);
      return 0;
    }

    return data || 0;
  } catch (err) {
    console.warn('Exception in FTS count:', err);
    return 0;
  }
}


/**
 * Type for recent search design data returned by getAnalysisBySlug
 */
export interface RecentSearchDesign {
  p_hash: string;
  original_image_url: string | null;
  studio_edited_image_url?: string | null;
  price: number | null;
  keywords: string | null;
  analysis_json: HybridAnalysisResult | null;
  slug: string | null;
  alt_text: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  icing_colors?: string | null;
}

/**
 * Fetches a cached analysis result by its SEO-friendly slug.
 * Used by the /customizing/[slug] dynamic route.
 * @param slug The SEO-friendly slug (e.g., 'unicorn-birthday-cake-a3f2')
 */
export async function getAnalysisBySlug(slug: string): Promise<SupabaseServiceResponse<RecentSearchDesign>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('p_hash, original_image_url, price, keywords, analysis_json, slug, alt_text, seo_title, seo_description, created_at, studio_edited_image_url, image_variants, icing_colors')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('Error fetching analysis by slug:', error);
      return { data: null, error };
    }

    return { data: data ? applyImageFallback(data) : null, error: null };
  } catch (err) {
    console.error('Exception fetching analysis by slug:', err);
    return { data: null, error: err as Error };
  }
}



// --- Cart Functions ---

/**
 * Fetches active cart items for a logged-in user or a guest session.
 * @param userId - The UUID of the logged-in user.
 * @param sessionId - The session ID for a guest user.
 * @returns An object containing an array of cart items or an error.
 */
export async function getCartItems(
  userId: string | null,
  sessionId: string | null
): Promise<SupabaseServiceResponse<CakeGenieCartItem[]>> {
  if (!userId && !sessionId) {
    return { data: [], error: null };
  }

  try {
    let query = supabase
      .from('cakegenie_cart')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Adds a new item to the shopping cart.
 * @param params - The details of the cart item to add.
 * @returns An object containing the newly added cart item or an error.
 */
export async function addToCart(
  params: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>
): Promise<SupabaseServiceResponse<CakeGenieCartItem>> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Item expires in 7 days

    const { data, error } = await supabase
      .from('cakegenie_cart')
      .insert({ ...params, expires_at: expiresAt.toISOString() })
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Optimistically bulk adds many items to the shopping cart.
 * If the bulk insert fails, falls back to N+1 inserts to isolate errors.
 * @param items - Array of cart items to add.
 * @returns An object containing an array of successfully added items or an error.
 */
export async function addManyToCart(
  items: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>[]
): Promise<SupabaseServiceResponse<CakeGenieCartItem[]>> {
  if (!items || items.length === 0) return { data: [], error: null };

  try {
    const expiresAtStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Allocate exactly sized array, mutate directly avoiding spread operators for perf
    const itemsToInsert = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
        itemsToInsert[i] = {
            ...items[i],
            expires_at: expiresAtStr
        };
    }

    // Try single bulk insert
    const { data, error } = await supabase
      .from('cakegenie_cart')
      .insert(itemsToInsert)
      .select();

    if (!error) {
      return { data, error: null };
    }

    // Fallback: If bulk fails (e.g., one item has bad constraints),
    // run one by one to ensure valid items are saved and we know which failed.
    console.warn("Bulk insert failed, falling back to one-by-one inserts:", error);

    const results = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
        results[i] = addToCart(itemsToInsert[i]).catch(() => ({ data: null, error: new Error('Unknown catch block error') }));
    }

    const settledResults = await Promise.all(results);
    const successfulItems: CakeGenieCartItem[] = [];

    for (let i = 0; i < settledResults.length; i++) {
        if (settledResults[i]?.data) {
             successfulItems.push(settledResults[i].data as CakeGenieCartItem);
        }
    }

    return { data: successfulItems, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Updates the quantity of an existing item in the cart.
 * @param cartItemId - The UUID of the cart item to update.
 * @param quantity - The new quantity for the item.
 * @returns An object containing the updated cart item or an error.
 */
export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number
): Promise<SupabaseServiceResponse<CakeGenieCartItem>> {
  try {
    if (quantity <= 0) {
      // Let removeCartItem handle deletion
      return { data: null, error: new Error("Quantity must be positive.") };
    }

    const { data, error } = await supabase
      .from('cakegenie_cart')
      .update({ quantity: quantity, updated_at: new Date().toISOString() })
      .eq('cart_item_id', cartItemId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Removes an item from the shopping cart.
 * @param cartItemId - The UUID of the cart item to remove.
 * @returns An object containing an error if the operation failed.
 */
export async function removeCartItem(
  cartItemId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase
      .from('cakegenie_cart')
      .delete()
      .eq('cart_item_id', cartItemId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// --- Address Functions ---

/**
 * Fetches all addresses for a given user.
 * @param userId The UUID of the user.
 */
export async function getUserAddresses(
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieAddress[]>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }
    return { data: data || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Adds a new address for a user. If setting as default, it will also handle
 * un-setting other addresses for that user.
 * @param userId The UUID of the user.
 * @param addressData The address data to insert.
 */
export async function addAddress(
  userId: string,
  addressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>
): Promise<SupabaseServiceResponse<CakeGenieAddress>> {
  try {
    // If this new address is the default, unset other defaults first
    if (addressData.is_default) {
      const { error: unsetError } = await supabase
        .from('cakegenie_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);

      if (unsetError) {
        return { data: null, error: unsetError };
      }
    }

    const { data, error } = await supabase
      .from('cakegenie_addresses')
      .insert({ ...addressData, user_id: userId })
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Updates an existing address for a user.
 * @param userId The UUID of the user (needed to unset other defaults).
 * @param addressId The UUID of the address to update.
 * @param addressData The new data for the address.
 */
export async function updateAddress(
  userId: string,
  addressId: string,
  addressData: Partial<Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>>
): Promise<SupabaseServiceResponse<CakeGenieAddress>> {
  try {
    // If updating to be the default, unset other defaults for this user first
    if (addressData.is_default) {
      const { error: unsetError } = await supabase
        .from('cakegenie_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .neq('address_id', addressId); // Don't unset the one we're about to set

      if (unsetError) {
        return { data: null, error: unsetError };
      }
    }

    const { data, error } = await supabase
      .from('cakegenie_addresses')
      .update({ ...addressData, updated_at: new Date().toISOString() })
      .eq('address_id', addressId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


/**
 * Deletes a user's address.
 * @param addressId The UUID of the address to delete.
 */
export async function deleteAddress(
  addressId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase
      .from('cakegenie_addresses')
      .delete()
      .eq('address_id', addressId);

    if (error) {
      return { data: null, error };
    }
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Sets a specific address as the default for a user using atomic RPC function.
 * @param addressId The UUID of the address to set as default.
 * @param userId The UUID of the user.
 */
export async function setDefaultAddress(
  addressId: string,
  userId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase.rpc('set_default_address', {
      p_user_id: userId,
      p_address_id: addressId
    });

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// --- Order Functions ---

export async function createOrderFromCart(
  params: {
    cartItems: CakeGenieCartItem[];
    eventDate: string;
    eventTime: string;
    deliveryAddressId: string | null;
    deliveryInstructions?: string;
    deliveryFee?: number;
    discountAmount?: number;
    discountCodeId?: string;
    guestAddress?: {
      recipientName: string;
      recipientPhone: string;
      streetAddress: string;
      city?: string;
      latitude?: number | null;
      longitude?: number | null;
    };
  }
): Promise<{ success: boolean, order?: any, error?: Error }> {
  const { cartItems, eventDate, eventTime, deliveryAddressId, deliveryInstructions, deliveryFee = 0, discountAmount, discountCodeId, guestAddress } = params;

  try {
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // FIX: Fetch the user directly before the operation to ensure the most
    // up-to-date session is used, preventing RLS violations.
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    let activeUser = user;

    if (userError || !activeUser) {
      console.warn("getUser failed, falling back to getSession:", userError);
      const { data: { session } } = await supabase.auth.getSession();
      activeUser = session?.user || null;
    }

    if (!activeUser) {
      throw new Error("Authentication error: User session not found.");
    }

    const subtotal = cartItems.reduce((sum, item) => sum + (item.final_price * item.quantity), 0);

    // Call the atomic RPC function
    const { data, error } = await supabase.rpc('create_order_from_cart', {
      p_user_id: activeUser.id,
      p_delivery_address_id: deliveryAddressId,
      p_delivery_date: eventDate,
      p_delivery_time_slot: eventTime,
      p_subtotal: subtotal,
      p_delivery_fee: deliveryFee,
      p_delivery_instructions: deliveryInstructions || null,
      p_discount_amount: discountAmount || 0,
      p_discount_code_id: discountCodeId || null,
      // Guest address params
      p_recipient_name: guestAddress?.recipientName || null,
      p_recipient_phone: guestAddress?.recipientPhone || null,
      p_delivery_address: guestAddress?.streetAddress || null,
      p_delivery_city: guestAddress?.city || 'Cebu City', // Default to Cebu City if not provided
      p_delivery_latitude: guestAddress?.latitude || null,
      p_delivery_longitude: guestAddress?.longitude || null,
    });

    if (error) throw error;

    // The RPC returns an array with one row
    const orderResult = data[0];

    // Fetch the complete order with items for return
    const { data: fullOrder, error: fetchError } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        cakegenie_addresses(*)
      `)
      .eq('order_id', orderResult.order_id)
      .single();

    if (fetchError) throw fetchError;

    return { success: true, order: fullOrder };
  } catch (error: any) {
    // FIX: Serialize error object to prevent '[object Object]' in logs.
    console.error('Error creating order:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    const message = (error && error.message) || 'An unknown error occurred during order creation.';
    return { success: false, error: new Error(message) };
  }
}

export async function createSplitOrderFromCart(params: {
  cartItems: CakeGenieCartItem[];
  eventDate: string;
  eventTime: string;
  deliveryAddressId: string | null;
  deliveryInstructions: string;
  deliveryFee: number;
  discountAmount?: number;
  discountCodeId?: string;
  guestAddress?: {
    recipientName: string;
    recipientPhone: string;
    streetAddress: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  isSplitOrder: boolean;
  splitMessage: string;
  splitCount: number;
}): Promise<{ success: boolean; order?: CakeGenieOrder; error?: Error }> {
  try {
    const {
      cartItems,
      eventDate,
      eventTime,
      deliveryAddressId,
      deliveryInstructions,
      deliveryFee,
      discountAmount = 0,
      discountCodeId = null,
      guestAddress,
      isSplitOrder,
      splitMessage,
      splitCount
    } = params;

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Calculate subtotal
    const subtotal = cartItems.reduce((sum, item) => sum + (item.final_price * item.quantity), 0);

    // Call the RPC function
    const { data, error } = await supabase.rpc('create_split_order_from_cart', {
      p_user_id: userId,
      p_delivery_address_id: deliveryAddressId,
      p_delivery_date: eventDate,
      p_delivery_time_slot: eventTime,
      p_subtotal: subtotal,
      p_delivery_fee: deliveryFee,
      p_delivery_instructions: deliveryInstructions,
      p_discount_amount: discountAmount,
      p_discount_code_id: discountCodeId,
      p_recipient_name: guestAddress?.recipientName || null,
      p_recipient_phone: guestAddress?.recipientPhone || null,
      p_delivery_address: guestAddress?.streetAddress || null,
      p_delivery_city: guestAddress?.city || null,
      p_delivery_latitude: guestAddress?.latitude || null,
      p_delivery_longitude: guestAddress?.longitude || null,
      p_is_split_order: isSplitOrder,
      p_split_message: splitMessage,
      p_split_count: splitCount,
      p_cart_item_ids: cartItems.map(item => item.cart_item_id)
    });

    if (error) throw error;

    // The RPC returns an array with one row
    const orderResult = data[0];

    // Fetch the complete order with items for return
    const { data: fullOrder, error: fetchError } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        cakegenie_addresses(*)
      `)
      .eq('order_id', orderResult.order_id)
      .single();

    if (fetchError) throw fetchError;

    return { success: true, order: fullOrder };
  } catch (error: any) {
    console.error('Error creating split order:', error);
    return { success: false, error };
  }
}

/**
 * Create a user record in cakegenie_users for an anonymous user
 * This is called when a guest places their first order
 */
export async function createGuestUser(params: {
  userId: string;
  email: string;
  firstName?: string;
  phoneNumber?: string;
}): Promise<{ success: boolean; error?: Error; emailAlreadyExists?: boolean }> {
  try {
    const { userId, email, firstName, phoneNumber } = params;

    // Check if email is already registered to A DIFFERENT user
    const { data: emailExists } = await supabase
      .from('cakegenie_users')
      .select('user_id')
      .eq('email', email)
      .neq('user_id', userId) // Exclude current user from check
      .maybeSingle();

    if (emailExists) {
      // Email is already registered with another account
      return {
        success: false,
        error: new Error('This email is already registered. Please sign in to continue.'),
        emailAlreadyExists: true
      };
    }

    // Check if user already exists to decide between insert and update
    const { data: existing } = await supabase
      .from('cakegenie_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    let error;

    if (existing) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('cakegenie_users')
        .update({
          email: email,
          first_name: firstName || 'Guest',
          phone_number: phoneNumber || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      error = updateError;
    } else {
      // Create new user
      const { error: insertError } = await supabase
        .from('cakegenie_users')
        .insert({
          user_id: userId,
          email: email,
          first_name: firstName || 'Guest',
          phone_number: phoneNumber || null,
          created_at: new Date().toISOString(),
        });
      error = insertError;
    }

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error creating/updating guest user:', error);
    return { success: false, error };
  }
}

export async function getUserOrders(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    includeItems?: boolean;
  }
): Promise<SupabaseServiceResponse<{
  orders: (CakeGenieOrder & { cakegenie_order_items?: any[]; cakegenie_addresses?: any })[];
  totalCount: number;
}>> {
  try {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const includeItems = options?.includeItems ?? true;

    // Build the select query. If not including items, fetch item count for efficiency.
    const selectQuery = includeItems
      ? `*, cakegenie_order_items(*), cakegenie_addresses(*)`
      : `*, cakegenie_order_items(count), cakegenie_addresses(*)`;

    const { data, error, count } = await supabase
      .from('cakegenie_orders')
      .select(selectQuery, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: null, error };
    }

    return {
      data: {
        orders: data || [],
        totalCount: count || 0
      },
      error: null
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getSingleOrder(
  orderId: string,
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieOrder & { cakegenie_order_items: CakeGenieOrderItem[], cakegenie_addresses: any }>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        cakegenie_addresses(*)
      `)
      .eq('order_id', orderId)
      .eq('user_id', userId) // Security check to ensure user owns the order
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


export async function uploadPaymentProof(
  orderId: string,
  userId: string,
  file: File
): Promise<SupabaseServiceResponse<CakeGenieOrder>> {
  try {
    // Validate file
    const validation = validateImageFile(file, { maxSizeMB: 10 });
    if (!validation.valid && validation.error) {
      throw new Error(validation.error);
    }

    // Compress image before upload, forcing JPEG format
    console.log('Compressing payment proof image to JPEG...');
    const compressedFile = await compressImage(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: 1920,
      fileType: 'image/jpeg',
    });

    const originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const filePath = `${userId}/${orderId}/${uuidv4()}-${originalFileName}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('payments')
      .upload(filePath, compressedFile, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('payments')
      .getPublicUrl(filePath);

    const { data, error: updateError } = await supabase
      .from('cakegenie_orders')
      .update({ payment_proof_url: publicUrl, payment_status: 'verifying' })
      .eq('order_id', orderId)
      .select().single();

    if (updateError) throw updateError;

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Merges anonymous user's cart into authenticated user's cart
 * Called after successful login to preserve items
 */
export async function mergeAnonymousCartToUser(
  anonymousUserId: string,
  realUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('merge_anonymous_cart_to_user', {
      p_anonymous_user_id: anonymousUserId,
      p_real_user_id: realUserId
    });

    if (error) {
      console.error('Error merging cart:', error);
      return { success: false, error: error.message };
    }

    console.log('Cart merge result:', data);
    return { success: true };
  } catch (error: any) {
    console.error('Exception merging cart:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancels a pending order for a user.
 * @param orderId The UUID of the order to cancel.
 * @param userId The UUID of the user who owns the order.
 */
export async function cancelOrder(
  orderId: string,
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieOrder>> {
  try {
    // FIX: The original rpc(...).select().single() chain is unreliable if the RPC
    // does not return a SETOF table record. A more robust pattern, consistent
    // with createOrderFromCart, is to perform the action and then fetch the result.
    const { error: rpcError } = await supabase.rpc('cancel_order', {
      p_order_id: orderId,
      p_user_id: userId,
    });

    if (rpcError) {
      return { data: null, error: rpcError };
    }

    // After a successful cancellation, fetch the updated order to return the full object.
    const { data, error } = await supabase
      .from('cakegenie_orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}



/**
 * Fetches a list of suggested search keywords from the database.
 * @returns An array of suggested search terms.
 */
export async function getSuggestedKeywords(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_search_analytics')
      .select('search_term')
      .eq('is_suggested', true)
      .limit(8); // A sensible limit for suggestions

    if (error) {
      console.warn("Supabase suggested keywords error:", error.message);
      return []; // Return empty on error, not critical
    }

    // The data is an array of objects like [{ search_term: '...' }], so we map it
    if (Array.isArray(data)) {
      return data.map(item => item.search_term);
    }

    return [];
  } catch (err) {
    console.warn("Error fetching suggested keywords:", err);
    return [];
  }
}

/**
 * Fetches a list of popular search keywords from the database.
 * @returns An array of the most searched terms.
 */
export async function getPopularKeywords(): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_popular_keywords');

    if (error) {
      console.warn("Supabase popular keywords error:", error.message);
      return []; // Return empty on error, not critical
    }

    // The RPC returns an array of objects like [{ search_term: '...' }], so we map it
    if (Array.isArray(data)) {
      return data.map(item => item.search_term);
    }

    return [];
  } catch (err) {
    console.warn("Error fetching popular keywords:", err);
    return [];
  }
}

/**
 * Logs a search keyword to track popular searches and clicks.
 * @param term The search query keyword
 * @param actionType Whether the user typed it out or clicked a suggestion
 */
export async function logSearchAnalytics(term: string, actionType: 'typed' | 'clicked' | 'product_click'): Promise<void> {
  try {
    // Only track meaningful keywords
    if (!term || term.trim().length < 3) return;

    // Call the RPC in the background without awaiting it 
    // so we don't slow down the user's redirect
    supabase.rpc('log_search_keyword', {
      p_search_term: term,
      p_action_type: actionType
    }).then(({ error }) => {
      if (error) console.error("Error logging search:", error);
    });
  } catch (err) {
    console.warn("Failed to log search analytics", err);
  }
}

/**
 * Fetches all necessary data for the cart page in parallel.
 * @param userId - The UUID of the logged-in user.
 * @param sessionId - The session ID for a guest user.
 * @returns An object containing cart items and user addresses, or an error.
 */
export async function getCartPageData(
  userId: string | null,
  sessionId: string | null
): Promise<{
  cartData: SupabaseServiceResponse<(CakeGenieCartItem & { merchant?: CakeGenieMerchant })[]>,
  addressesData: SupabaseServiceResponse<CakeGenieAddress[]>
}> {
  const isAnonymous = !userId && !!sessionId;

  // Use Promise.all to run queries in parallel
  const [cartResult, addressesResult] = await Promise.all([
    getCartItemsWithMerchant(userId, sessionId), // Use enriched version
    // Only fetch addresses for authenticated (non-anonymous) users AND if we have a valid userId
    (isAnonymous || !userId) ? Promise.resolve({ data: [], error: null }) : getUserAddresses(userId!),
  ]);

  return {
    cartData: cartResult,
    addressesData: addressesResult,
  };
}

// --- New Functions for Delivery Date ---
export async function getAvailableDeliveryDates(startDate: string, numDays: number): Promise<AvailableDate[]> {
  const { data, error } = await supabase.rpc('get_available_delivery_dates', {
    start_date: startDate,
    num_days: numDays,
  });
  if (error) {
    console.error("Error fetching available dates:", error);
    throw new Error("Could not fetch available delivery dates.");
  }
  return data || [];
}

export async function getBlockedDatesInRange(startDate: string, endDate: string): Promise<Record<string, BlockedDateInfo[]>> {
  try {
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('blocked_date, closure_reason, is_all_day, blocked_time_start, blocked_time_end')
      .gte('blocked_date', startDate)
      .lte('blocked_date', endDate)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    const groupedByDate: Record<string, BlockedDateInfo[]> = {};
    (data || []).forEach(row => {
      const date = row.blocked_date;
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push({
        closure_reason: row.closure_reason,
        is_all_day: row.is_all_day,
        blocked_time_start: row.blocked_time_start,
        blocked_time_end: row.blocked_time_end,
      });
    });

    return groupedByDate;

  } catch (err) {
    const error = err as PostgrestError;
    console.error("Error in getBlockedDatesInRange:", error);
    throw new Error("Could not verify date availability.");
  }
}


export async function getAvailabilitySettings(): Promise<SupabaseServiceResponse<AvailabilitySettings>> {
  try {
    const { data, error } = await supabase
      .from('availability_settings')
      .select('*')
      .eq('setting_id', '00000000-0000-0000-0000-000000000001')
      .single();
    if (error) {
      // Return default settings if table doesn't exist or query fails
      console.warn('Availability settings not found, using defaults:', error.message);
      const defaultSettings: AvailabilitySettings = {
        setting_id: '00000000-0000-0000-0000-000000000001',
        created_at: new Date().toISOString(),
        rush_to_same_day_enabled: false,
        rush_same_to_standard_enabled: false,
        minimum_lead_time_days: 3,
      };
      return { data: defaultSettings, error: null };
    }
    return { data, error: null };
  } catch (err) {
    // Fallback to defaults on any error
    const defaultSettings: AvailabilitySettings = {
      setting_id: '00000000-0000-0000-0000-000000000001',
      created_at: new Date().toISOString(),
      rush_to_same_day_enabled: false,
      rush_same_to_standard_enabled: false,
      minimum_lead_time_days: 3,
    };
    return { data: defaultSettings, error: null };
  }
}

/**
 * Fetches all bill-sharing designs created by a user.
 * @param userId The UUID of the user.
 */
export async function getBillSharingCreations(userId: string): Promise<SupabaseServiceResponse<any[]>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_shared_designs')
      .select('*, contributions:bill_contributions(amount, status)')
      .eq('created_by_user_id', userId)
      .eq('bill_sharing_enabled', true)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches a single order by ID for public access (e.g., for split contributions).
 * Includes order items and contributions to calculate progress.
 */
export async function getSingleOrderPublic(orderId: string): Promise<SupabaseServiceResponse<CakeGenieOrder & { cakegenie_order_items: CakeGenieOrderItem[], order_contributions: OrderContribution[], organizer?: { first_name: string | null, email: string } }>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        order_contributions(*),
        organizer:cakegenie_users!organizer_user_id(first_name, email)
      `)
      .eq('order_id', orderId)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Creates a contribution for a split order via the Edge Function.
 */
export async function createOrderContribution(params: {
  orderId: string;
  amount: number;
  contributorName: string;
  contributorEmail?: string;
}): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  try {
    const domain = window.location.origin;
    const paymentMode = (typeof window !== 'undefined' && localStorage.getItem('xendit_payment_mode')) || 'live';

    const { data, error } = await supabase.functions.invoke('create-order-contribution', {
      body: {
        ...params,
        payment_mode: paymentMode,
        success_redirect_url: `${domain}/#/contribute/${params.orderId}?payment=success`,
        failure_redirect_url: `${domain}/#/contribute/${params.orderId}?payment=failed`
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Failed to create contribution');

    return { success: true, paymentUrl: data.paymentUrl };
  } catch (err: any) {
    console.error('Error creating contribution:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}

// --- Saved Items (Wishlist) Functions ---

/**
 * Fetches all saved items for a user, enriched with analysis cache data for custom designs.
 * @param userId The UUID of the user.
 */
export async function getSavedItems(
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieSavedItem[]>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_saved_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    // Get unique pHashes for custom designs to fetch cache data
    const pHashes = data
      .filter(item => item.item_type === 'custom_design' && item.analysis_p_hash)
      .map(item => item.analysis_p_hash!);

    if (pHashes.length > 0) {
      // Fetch analysis cache data for all pHashes
      const { data: cacheData } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, keywords, price, analysis_json')
        .in('p_hash', pHashes);

      if (cacheData && cacheData.length > 0) {
        // Create a lookup map for fast access
        const cacheMap = new Map(cacheData.map(c => [c.p_hash, c]));

        // Enrich saved items with cache data
        const enrichedData = data.map(item => {
          if (item.item_type === 'custom_design' && item.analysis_p_hash) {
            const cached = cacheMap.get(item.analysis_p_hash);
            if (cached) {
              return {
                ...item,
                // Add cache data as extra properties
                cache_keywords: cached.keywords,
                cache_price: cached.price,
                cache_cake_type: cached.analysis_json?.cakeType || null,
              };
            }
          }
          return item;
        });

        return { data: enrichedData as CakeGenieSavedItem[], error: null };
      }
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


/**
 * Saves a catalog product to the user's saved items.
 */
export async function saveProductItem(
  userId: string,
  product: {
    productId: string;
    productName: string;
    productPrice: number;
    productImage: string;
  }
): Promise<SupabaseServiceResponse<CakeGenieSavedItem>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_saved_items')
      .insert({
        user_id: userId,
        product_id: product.productId,
        product_name: product.productName,
        product_price: product.productPrice,
        product_image: product.productImage,
        item_type: 'product'
      })
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Saves a custom design to the user's saved items.
 */
export async function saveCustomDesign(
  userId: string,
  design: {
    analysisPHash: string;
    customizationSnapshot: CustomizationDetails;
    customizedImageUrl: string;
  }
): Promise<SupabaseServiceResponse<CakeGenieSavedItem>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_saved_items')
      .insert({
        user_id: userId,
        analysis_p_hash: design.analysisPHash,
        customization_snapshot: design.customizationSnapshot,
        customized_image_url: design.customizedImageUrl,
        item_type: 'custom_design'
      })
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Removes a saved item by its ID.
 */
export async function removeSavedItem(
  savedItemId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase
      .from('cakegenie_saved_items')
      .delete()
      .eq('saved_item_id', savedItemId);

    if (error) {
      return { data: null, error };
    }
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Removes a saved product by user ID and product ID.
 */
export async function unsaveProduct(
  userId: string,
  productId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase
      .from('cakegenie_saved_items')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) {
      return { data: null, error };
    }
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Removes a saved custom design by user ID and analysis p_hash.
 */
export async function unsaveCustomDesign(
  userId: string,
  analysisPHash: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase
      .from('cakegenie_saved_items')
      .delete()
      .eq('user_id', userId)
      .eq('analysis_p_hash', analysisPHash);

    if (error) {
      return { data: null, error };
    }
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Checks if a product is saved for a user.
 */
export async function isProductSaved(
  userId: string,
  productId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_saved_items')
      .select('saved_item_id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();

    if (error) {
      console.error('Error checking if product is saved:', error);
      return false;
    }
    return data !== null;
  } catch (err) {
    console.error('Exception checking if product is saved:', err);
    return false;
  }
}

/**
 * Checks if a custom design is saved for a user.
 */
export async function isCustomDesignSaved(
  userId: string,
  analysisPHash: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_saved_items')
      .select('saved_item_id')
      .eq('user_id', userId)
      .eq('analysis_p_hash', analysisPHash)
      .maybeSingle();

    if (error) {
      console.error('Error checking if custom design is saved:', error);
      return false;
    }
    return data !== null;
  } catch (err) {
    console.error('Exception checking if custom design is saved:', err);
    return false;
  }
}


// --- Merchant/Partner Functions ---

/**
 * Fetches all active merchants.
 * @param city Optional city filter
 */
export async function getMerchants(
  city?: string
): Promise<SupabaseServiceResponse<CakeGenieMerchant[]>> {
  try {
    let query = supabase
      .from('cakegenie_merchants')
      .select('*')
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (city) {
      query = query.eq('city', city);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches a single merchant by their URL slug.
 * @param slug The URL-friendly identifier
 */
export async function getMerchantBySlug(
  slug: string
): Promise<SupabaseServiceResponse<CakeGenieMerchant>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_merchants')
      .select(`
        merchant_id,
        user_id,
        business_name,
        slug,
        description,
        cover_image_url,
        profile_image_url,
        address,
        city,
        latitude,
        longitude,
        phone,
        email,
        facebook_url,
        instagram_url,
        rating,
        review_count,
        is_verified,
        is_active,
        min_order_lead_days,
        delivery_fee,
        created_at,
        updated_at
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches a single merchant by their UUID.
 * @param merchantId The merchant's UUID
 */
export async function getMerchantById(
  merchantId: string
): Promise<SupabaseServiceResponse<CakeGenieMerchant>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_merchants')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


// --- Merchant Product Functions ---

/**
 * Fetches all active products for a merchant.
 * @param merchantId The merchant's UUID
 * @param options Optional filters (category, featured, etc.)
 */
export async function getMerchantProducts(
  merchantId: string,
  options?: { category?: string; featured?: boolean }
): Promise<SupabaseServiceResponse<CakeGenieMerchantProduct[]>> {
  try {
    let query = supabase
      .from('cakegenie_merchant_products')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (options?.category) {
      query = query.eq('category', options.category);
    }
    if (options?.featured) {
      query = query.eq('is_featured', true);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches products for a merchant by their slug.
 * @param merchantSlug The merchant's URL slug
 */
export async function getMerchantProductsBySlug(
  merchantSlug: string
): Promise<SupabaseServiceResponse<CakeGenieMerchantProduct[]>> {
  try {
    // First get the merchant by slug
    const { data: merchant, error: merchantError } = await supabase
      .from('cakegenie_merchants')
      .select('merchant_id')
      .eq('slug', merchantSlug)
      .eq('is_active', true)
      .single();

    if (merchantError || !merchant) {
      return { data: null, error: merchantError || new Error('Merchant not found') };
    }

    // Then get the products
    const { data, error } = await supabase
      .from('cakegenie_merchant_products')
      .select('*')
      .eq('merchant_id', merchant.merchant_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches a single merchant product by its slug.
 * @param merchantSlug The merchant's URL slug
 * @param productSlug The product's URL slug
 */
export async function getMerchantProductBySlug(
  merchantSlug: string,
  productSlug: string
): Promise<SupabaseServiceResponse<CakeGenieMerchantProduct>> {
  try {
    // First get the merchant by slug
    const { data: merchant, error: merchantError } = await supabase
      .from('cakegenie_merchants')
      .select('merchant_id')
      .eq('slug', merchantSlug)
      .eq('is_active', true)
      .single();

    if (merchantError || !merchant) {
      return { data: null, error: merchantError || new Error('Merchant not found') };
    }

    // Then get the product
    const { data, error } = await supabase
      .from('cakegenie_merchant_products')
      .select('*')
      .eq('merchant_id', merchant.merchant_id)
      .eq('slug', productSlug)
      .eq('is_active', true)
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches merchant products enriched with analysis cache data.
 * This combines product info with AI analysis for customization.
 * @param merchantSlug The merchant's URL slug
 */
export async function getMerchantProductsWithCache(
  merchantSlug: string
): Promise<SupabaseServiceResponse<(CakeGenieMerchantProduct & { analysis_json?: HybridAnalysisResult; cache_price?: number })[]>> {
  try {
    // Get products first
    const { data: products, error: productsError } = await getMerchantProductsBySlug(merchantSlug);

    if (productsError || !products) {
      return { data: null, error: productsError };
    }

    if (products.length === 0) {
      return { data: [], error: null };
    }

    // Get unique pHashes to fetch cache data
    const pHashes = products
      .filter(p => p.p_hash)
      .map(p => p.p_hash!);

    if (pHashes.length === 0) {
      return { data: products, error: null };
    }

    // Fetch analysis cache data
    const { data: cacheData } = await supabase
      .from('cakegenie_analysis_cache')
      .select('p_hash, analysis_json, price')
      .in('p_hash', pHashes);

    if (cacheData && cacheData.length > 0) {
      const cacheMap = new Map(cacheData.map(c => [c.p_hash, c]));

      const enrichedProducts = products.map(product => {
        if (product.p_hash) {
          const cached = cacheMap.get(product.p_hash);
          if (cached) {
            return {
              ...product,
              analysis_json: cached.analysis_json,
              cache_price: cached.price,
            };
          }
        }
        return product;
      });

      return { data: enrichedProducts, error: null };
    }

    return { data: products, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// ============================================================================
// MARKETPLACE FUNCTIONS: Merchant Staff & Dashboard
// ============================================================================

/**
 * Gets the current user's staff role for a specific merchant.
 * @param merchantId The merchant's UUID
 */
export async function getUserMerchantRole(
  merchantId: string
): Promise<SupabaseServiceResponse<MerchantStaffRole | null>> {
  try {
    const { data, error } = await supabase
      .from('merchant_staff')
      .select('role')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }
    return { data: data?.role || null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Gets all merchants the current user has access to.
 */
export async function getUserMerchants(): Promise<SupabaseServiceResponse<(MerchantStaff & { merchant: CakeGenieMerchant })[]>> {
  try {
    const { data, error } = await supabase
      .from('merchant_staff')
      .select(`
        *,
        merchant:cakegenie_merchants(*)
      `)
      .eq('is_active', true);

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Gets dashboard statistics for a merchant.
 * @param merchantId The merchant's UUID
 */
export async function getMerchantDashboardStats(
  merchantId: string
): Promise<SupabaseServiceResponse<MerchantDashboardStats>> {
  try {
    const { data, error } = await supabase
      .from('merchant_dashboard_stats')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Gets orders for a specific merchant (for merchant dashboard).
 * @param merchantId The merchant's UUID
 * @param options Filter options
 */
export async function getMerchantOrders(
  merchantId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<SupabaseServiceResponse<CakeGenieOrder[]>> {
  try {
    let query = supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*)
      `)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('order_status', options.status);
    }
    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Gets payout records for a merchant.
 * @param merchantId The merchant's UUID
 */
export async function getMerchantPayouts(
  merchantId: string,
  options?: { status?: string; limit?: number }
): Promise<SupabaseServiceResponse<MerchantPayout[]>> {
  try {
    let query = supabase
      .from('merchant_payouts')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Gets all staff members for a merchant (owner/admin only).
 * @param merchantId The merchant's UUID
 */
export async function getMerchantStaff(
  merchantId: string
): Promise<SupabaseServiceResponse<MerchantStaff[]>> {
  try {
    const { data, error } = await supabase
      .from('merchant_staff')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Updates a merchant's order status (for merchant fulfillment).
 * @param orderId The order's UUID
 * @param merchantId The merchant's UUID (for verification)
 * @param newStatus The new order status
 */
export async function updateMerchantOrderStatus(
  orderId: string,
  merchantId: string,
  newStatus: string
): Promise<SupabaseServiceResponse<CakeGenieOrder>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_orders')
      .update({
        order_status: newStatus,
        updated_at: new Date().toISOString(),
        ...(newStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
        ...(newStatus === 'confirmed' ? { confirmed_at: new Date().toISOString() } : {})
      })
      .eq('order_id', orderId)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// ============================================================================
// MARKETPLACE FUNCTIONS: Cart with Merchant Context
// ============================================================================

/**
 * Adds an item to cart with merchant context.
 * This should be used when adding items from a merchant's shop page.
 */
export async function addToCartWithMerchant(
  userId: string | null,
  sessionId: string | null,
  merchantId: string,
  item: {
    cake_type: string;
    cake_thickness: string;
    cake_size: string;
    base_price: number;
    addon_price: number;
    final_price: number;
    quantity: number;
    original_image_url: string;
    customized_image_url: string;
    customization_details: CustomizationDetails;
  }
): Promise<SupabaseServiceResponse<CakeGenieCartItem>> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiration

    const { data, error } = await supabase
      .from('cakegenie_cart')
      .insert({
        user_id: userId,
        session_id: sessionId,
        merchant_id: merchantId,
        ...item,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Groups cart items by merchant for multi-merchant cart display.
 */
export function groupCartItemsByMerchant(
  cartItems: CakeGenieCartItem[]
): Map<string, CakeGenieCartItem[]> {
  const grouped = new Map<string, CakeGenieCartItem[]>();

  for (const item of cartItems) {
    const merchantId = item.merchant_id || 'unknown';
    const existing = grouped.get(merchantId);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(merchantId, [item]);
    }
  }

  return grouped;
}

/**
 * Gets cart items with merchant details.
 */
export async function getCartItemsWithMerchant(
  userId: string | null,
  sessionId: string | null
): Promise<SupabaseServiceResponse<(CakeGenieCartItem & { merchant?: CakeGenieMerchant })[]>> {
  try {
    const cartResult = await getCartItems(userId, sessionId);

    if (cartResult.error || !cartResult.data) {
      return cartResult as SupabaseServiceResponse<(CakeGenieCartItem & { merchant?: CakeGenieMerchant })[]>;
    }

    if (cartResult.data.length === 0) {
      return { data: [], error: null };
    }

    // Get unique merchant IDs
    const merchantIds = [...new Set(
      cartResult.data
        .filter(item => item.merchant_id)
        .map(item => item.merchant_id!)
    )];

    if (merchantIds.length === 0) {
      return { data: cartResult.data, error: null };
    }

    // Fetch merchant details
    const { data: merchants } = await supabase
      .from('cakegenie_merchants')
      .select('*')
      .in('merchant_id', merchantIds);

    if (!merchants) {
      return { data: cartResult.data, error: null };
    }

    // Create lookup map
    const merchantMap = new Map(merchants.map(m => [m.merchant_id, m]));

    // Enrich cart items with merchant details
    const enrichedItems = cartResult.data.map(item => ({
      ...item,
      merchant: item.merchant_id ? merchantMap.get(item.merchant_id) : undefined
    }));

    return { data: enrichedItems, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// ============================================
// Blog Functions
// ============================================

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  author_url?: string;
  image?: string;
  keywords?: string;
  cake_search_keywords?: string;
  related_cakes_intro?: string;
  design_showcases?: Array<{
    id?: string | number;
    keyword?: string | string[];
    keywords?: string | string[];
    title?: string;
    intro?: string;
    description?: string;
  }> | string | null;
  design_showcase_keywords?: string;
  design_showcase_title?: string;
  design_showcase_intro?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface BlogHomepagePreview {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  image?: string;
}

/**
 * Fetches all published blog posts, sorted by date descending
 */
export async function getAllBlogs(): Promise<SupabaseServiceResponse<BlogPost[]>> {
  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;
  try {
    const { data, error } = await client
      .from('blogs')
      .select('*')
      .eq('is_published', true)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching all blogs:', error);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (err) {
    console.error('Exception fetching all blogs:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches a lightweight set of published blog fields for the homepage.
 */
export async function getHomepageBlogPreviews(
  limit: number = 3
): Promise<SupabaseServiceResponse<BlogHomepagePreview[]>> {
  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;

  try {
    const { data, error } = await client
      .from('blogs')
      .select('slug, title, excerpt, date, image')
      .eq('is_published', true)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching homepage blog previews:', error);
      return { data: null, error };
    }

    return { data: (data || []) as BlogHomepagePreview[], error: null };
  } catch (err) {
    console.error('Exception fetching homepage blog previews:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches a single blog post by slug
 */
export async function getBlogBySlug(slug: string): Promise<SupabaseServiceResponse<BlogPost | null>> {
  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;
  try {
    const { data, error } = await client
      .from('blogs')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return { data: null, error: null };
      }
      console.error('Error fetching blog by slug:', error);
      return { data: null, error };
    }

    return { data: data, error: null };
  } catch (err) {
    console.error('Exception fetching blog by slug:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches blog post slugs for static generation
 */
export async function getAllBlogSlugs(): Promise<SupabaseServiceResponse<{ slug: string; image?: string; updated_at: string }[]>> {
  const client = typeof window === 'undefined' ? publicSupabaseClient : supabase;
  try {
    const { data, error } = await client
      .from('blogs')
      .select('slug, image, updated_at')
      .eq('is_published', true);

    if (error) {
      console.error('Error fetching blog slugs:', error);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (err) {
    console.error('Exception fetching blog slugs:', err);
    return { data: null, error: err as Error };
  }
}
/**
 * Subscribes an email to the newsletter and returns a unique per-email
 * 20%-off discount code, or null on failure.
 *
 * Delegates to /api/newsletter (service-role) so the discount code can be
 * written to discount_codes without RLS friction. validateDiscountCode() in
 * discountService.ts picks it up automatically — no changes needed there.
 */
export const subscribeToNewsletter = async (email: string, source: string = 'popup'): Promise<string | null> => {
  try {
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source }),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Newsletter subscribe error:', error);
      return null;
    }

    const { success, code } = await res.json();
    return success && code ? (code as string) : null;
  } catch (err) {
    console.error('Unexpected error subscribing to newsletter:', err);
    return null;
  }
};

// ============================================================================
// REVIEW FUNCTIONS
// ============================================================================

/**
 * Submits a new review for an order or order item.
 * Only allows reviews for delivered orders.
 */
export async function submitReview(params: {
  orderId: string;
  orderItemId?: string;
  userId: string | null;
  merchantId: string;
  productId?: string;
  rating: number;
  title?: string;
  comment?: string;
  photos?: string[];
}): Promise<SupabaseServiceResponse<CakeGenieReview>> {
  try {
    // Verify the order exists and is eligible for review
    const { data: order, error: orderError } = await supabase
      .from('cakegenie_orders')
      .select('order_status, user_id, delivery_date')
      .eq('order_id', params.orderId)
      .single();

    if (orderError || !order) {
      return { data: null, error: orderError || new Error('Order not found') };
    }

    // Don't allow reviews for cancelled orders
    if (order.order_status === 'cancelled') {
      return { data: null, error: new Error('Cannot review cancelled orders') };
    }

    // Only allow reviews after the delivery date has passed
    const deliveryDate = new Date(order.delivery_date + 'T23:59:59');
    if (new Date() < deliveryDate) {
      return { data: null, error: new Error('You can review after the delivery date has passed') };
    }

    // Verify user owns this order or order is guest with matching email
    if (order.user_id && params.userId && order.user_id !== params.userId) {
      return { data: null, error: new Error('You can only review your own orders') };
    }

    // Check if a review already exists for this order/item
    const { data: existingReview } = await supabase
      .from('cakegenie_reviews')
      .select('review_id')
      .eq('order_id', params.orderId)
      .eq('order_item_id', params.orderItemId || null)
      .maybeSingle();

    if (existingReview) {
      return { data: null, error: new Error('You have already reviewed this item') };
    }

    // Insert the review (auto-approved and visible by default)
    const { data, error } = await supabase
      .from('cakegenie_reviews')
      .insert({
        order_id: params.orderId,
        order_item_id: params.orderItemId || null,
        user_id: params.userId,
        merchant_id: params.merchantId,
        product_id: params.productId || null,
        rating: params.rating,
        review_title: params.title || null,
        review_text: params.comment || null,
        review_photos: params.photos || [],
        is_approved: true,
        is_visible: true,
      })
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data ? normalizePublicReviewRecord(data) : null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches existing reviews for a specific order (to track which items have been reviewed).
 */
export async function getOrderReviews(
  orderId: string
): Promise<SupabaseServiceResponse<Pick<CakeGenieReview, 'review_id' | 'order_item_id' | 'rating'>[]>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_reviews')
      .select('review_id, order_item_id, rating')
      .eq('order_id', orderId);

    if (error) {
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches reviews for a specific merchant (for shop page display).
 */
export async function getMerchantReviews(
  merchantId: string,
  options?: {
    limit?: number;
    offset?: number;
    onlyVisible?: boolean;
  }
): Promise<SupabaseServiceResponse<CakeGenieReview[]>> {
  try {
    let query = supabase
      .from('cakegenie_reviews')
      .select(REVIEW_SELECT)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (options?.onlyVisible !== false) {
      query = query.eq('is_visible', true).eq('is_approved', true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    return { data: normalizePublicReviews(data), error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches reviews for a specific product.
 */
export async function getProductReviews(
  productId: string,
  options?: {
    limit?: number;
    offset?: number;
    onlyVisible?: boolean;
  }
): Promise<SupabaseServiceResponse<CakeGenieReview[]>> {
  try {
    let query = supabase
      .from('cakegenie_reviews')
      .select(REVIEW_SELECT)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (options?.onlyVisible !== false) {
      query = query.eq('is_visible', true).eq('is_approved', true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    return { data: normalizePublicReviews(data), error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches all reviews for a merchant (including hidden) - for merchant dashboard.
 */
export async function getMerchantAllReviews(
  merchantId: string,
  options?: {
    limit?: number;
    offset?: number;
    includeUnapproved?: boolean;
  }
): Promise<SupabaseServiceResponse<CakeGenieReview[]>> {
  try {
    let query = supabase
      .from('cakegenie_reviews')
      .select(REVIEW_SELECT_WITH_ORDER_NUMBER)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (options?.includeUnapproved === false) {
      query = query.eq('is_approved', true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    return { data: normalizePublicReviews(data), error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Updates review visibility and approval status (for merchant moderation).
 */
export async function updateReviewModeration(
  reviewId: string,
  merchantId: string,
  updates: {
    isApproved?: boolean;
    isVisible?: boolean;
  }
): Promise<SupabaseServiceResponse<CakeGenieReview>> {
  try {
    // Verify the review belongs to this merchant
    const { data: existing } = await supabase
      .from('cakegenie_reviews')
      .select('review_id')
      .eq('review_id', reviewId)
      .eq('merchant_id', merchantId)
      .single();

    if (!existing) {
      return { data: null, error: new Error('Review not found or access denied') };
    }

    const { data, error } = await supabase
      .from('cakegenie_reviews')
      .update({
        ...(updates.isApproved !== undefined ? { is_approved: updates.isApproved } : {}),
        ...(updates.isVisible !== undefined ? { is_visible: updates.isVisible } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('review_id', reviewId)
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data ? normalizePublicReviewRecord(data) : null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Adds a merchant response to a review.
 */
export async function respondToReview(
  reviewId: string,
  merchantId: string,
  response: string
): Promise<SupabaseServiceResponse<CakeGenieReview>> {
  try {
    // Verify the review belongs to this merchant
    const { data: existing } = await supabase
      .from('cakegenie_reviews')
      .select('review_id')
      .eq('review_id', reviewId)
      .eq('merchant_id', merchantId)
      .single();

    if (!existing) {
      return { data: null, error: new Error('Review not found or access denied') };
    }

    const { data, error } = await supabase
      .from('cakegenie_reviews')
      .update({
        merchant_response: response,
        merchant_response_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('review_id', reviewId)
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data ? normalizePublicReviewRecord(data) : null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Gets review statistics for a merchant.
 */
export async function getMerchantReviewStats(
  merchantId: string
): Promise<SupabaseServiceResponse<{
  total: number;
  averageRating: number;
  ratingDistribution: { rating: number; count: number }[];
}>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_reviews')
      .select('rating')
      .eq('merchant_id', merchantId)
      .eq('is_approved', true)
      .eq('is_visible', true);

    if (error) {
      return { data: null, error };
    }

    const total = data?.length || 0;
    const averageRating = total > 0
      ? data!.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;

    // Calculate rating distribution
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    data?.forEach(r => {
      if (distribution[r.rating] !== undefined) {
        distribution[r.rating]++;
      }
    });

    const ratingDistribution = Object.entries(distribution).map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
    }));

    return {
      data: { total, averageRating, ratingDistribution },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getProductReviewStats(
  productId: string
): Promise<SupabaseServiceResponse<{
  total: number;
  averageRating: number;
  ratingDistribution: { rating: number; count: number }[];
}>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_reviews')
      .select('rating')
      .eq('product_id', productId)
      .eq('is_approved', true)
      .eq('is_visible', true);

    if (error) {
      return { data: null, error };
    }

    const total = data?.length || 0;
    const averageRating = total > 0
      ? data!.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    data?.forEach((review) => {
      if (distribution[review.rating] !== undefined) {
        distribution[review.rating]++;
      }
    });

    const ratingDistribution = Object.entries(distribution).map(([rating, count]) => ({
      rating: parseInt(rating, 10),
      count,
    }));

    return {
      data: { total, averageRating, ratingDistribution },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
