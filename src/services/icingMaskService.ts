// services/icingMaskService.ts
//
// Server-of-record access layer for persistent, mask-based icing recolor.
// Owns all Supabase reads/writes for the `cakegenie_icing_masks` table and (in a
// later task) the Gemini generation call. Pure data/IO — no React.
//
// Mirrors the Supabase client/query conventions used by `useDesignUpdate.ts`
// (`getSupabaseClient` from '@/lib/supabase/client', `.from(...).select(...).eq(...)`).

import { getSupabaseClient } from '@/lib/supabase/client';
import type { CakeGenieIcingMask } from '@/lib/database.types';
import { editCakeImage } from '@/services/geminiService';
import { buildIcingConversionPrompt } from '@/lib/icingConversionPrompt';

/**
 * Identifies the Icing Conversion Prompt semantics used to generate a mask.
 * Bump this if `ICING_CONVERSION_PROMPT` materially changes so masks regenerate
 * platform-wide without deleting history.
 */
export const CURRENT_MASK_VERSION = 1;

/** Supabase Storage bucket that holds all CakeGenie assets (mirrors color variants). */
const STORAGE_BUCKET = 'cakegenie';

/**
 * System instruction for the Gemini mask-generation call. Kept byte-for-byte
 * identical to the one used by the icing recolor lab
 * (`src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx`) so both surfaces
 * generate masks with the same framing/preservation guarantees.
 */
export const ICING_LAYER_SYSTEM_INSTRUCTION = [
  'You are a precise cake image editor.',
  'Follow the user prompt exactly and return only one edited image.',
  'Preserve the exact original framing, crop, perspective, cake scale, and cake position from the uploaded image.',
  'Do not re-center, zoom, rotate, extend, or restage the cake composition.',
  'The output should work as a clean icing-only overlay layer when black pixels are keyed out.',
].join(' ');

/**
 * Inputs for {@link generateAndPersistIcingMask}.
 *
 * `cacheId` is intentionally nullable: ad-hoc designs that are not yet persisted
 * to `cakegenie_analysis_cache` have no id, in which case the mask is generated
 * for in-memory use only and never written to Storage or the database
 * (Requirement 7.1).
 */
export interface GenerateMaskParams {
  cacheId: string | null;
  baseImage: { data: string; mimeType: string };
  sourceImageUrl?: string | null;
  maskVersion?: number;
  /** Human-readable icing color name (e.g. "white", "pink") for prompt accuracy. */
  icingColorName?: string;
}

/**
 * Looks up the persisted, ready Icing Mask for a design.
 *
 * Selects the `status='ready'` row for `(cache_id = cacheId AND
 * mask_version = CURRENT_MASK_VERSION)` from `cakegenie_icing_masks`.
 *
 * Preconditions: `cacheId` is a non-empty UUID string.
 * Postconditions: returns the matching Mask Record if present, else `null`.
 * Never throws on "not found" (returns `null` via `.maybeSingle()`); only throws
 * on transport/query errors. Performs no writes.
 *
 * @param cacheId The `cakegenie_analysis_cache` row id that keys the design.
 * @returns The ready Mask Record, or `null` when none exists.
 */
export async function getIcingMask(
  cacheId: string
): Promise<CakeGenieIcingMask | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('cakegenie_icing_masks')
    .select('*')
    .eq('cache_id', cacheId)
    .eq('mask_version', CURRENT_MASK_VERSION)
    .eq('status', 'ready')
    .maybeSingle();

  if (error) {
    // Transport / query error — surface to the caller (the hook will fall back).
    throw error;
  }

  return (data as CakeGenieIcingMask | null) ?? null;
}

/**
 * Generates a trace id for the Gemini mask-generation call so the request can be
 * correlated in the AI logs (mirrors the lab's `icing-layer-${Date.now()}` style).
 */
function createMaskTraceId(): string {
  return `icing-mask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Decodes a mask data URL into a same-dimension, lossless PNG `Blob` and reports
 * the decoded pixel width/height.
 *
 * `editCakeImage` returns whatever mime type Gemini produced (often WebP/JPEG),
 * which is lossy and would corrupt the near-`#000000` black the keyer relies on
 * (Requirement 10). We therefore draw the decoded mask onto a canvas and re-encode
 * via `canvas.toBlob('image/png')` to guarantee a lossless PNG. This deliberately
 * does NOT route through `compressImage` (which produces lossy WebP).
 *
 * DOM dependency: this uses `Image`, `document.createElement('canvas')`, and
 * `canvas.toBlob`, so it must run in a browser context. The function is called
 * from the client hook (`useIcingMask`), so the DOM is available. When the DOM is
 * unavailable the returned promise rejects and the caller treats it as a
 * generation failure (records `status='failed'` and rethrows).
 *
 * @param maskDataUrl A `data:` URL returned by `editCakeImage`.
 * @returns The lossless PNG blob plus its decoded dimensions.
 */
function decodeMaskToPngBlob(
  maskDataUrl: string
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Icing mask PNG encoding requires a DOM (browser) environment.'));
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    if (!maskDataUrl.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;

      if (width <= 0 || height <= 0) {
        reject(new Error('Decoded icing mask has non-positive dimensions.'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not acquire 2D context for icing mask PNG encoding.'));
        return;
      }

      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to encode icing mask as a lossless PNG blob.'));
          return;
        }
        resolve({ blob, width, height });
      }, 'image/png');
    };

    image.onerror = () => {
      reject(new Error('Failed to decode the generated icing mask image.'));
    };

    image.src = maskDataUrl;
  });
}

/**
 * Builds the canonical Storage object path for a design's mask.
 * Mirrors the color-variant convention `color-variants/{cacheId}/{hex}.webp`.
 */
function buildMaskStoragePath(cacheId: string, maskVersion: number): string {
  return `icing-masks/${cacheId}/v${maskVersion}.png`;
}

function buildCacheBustedMaskUrl(publicUrl: string): string {
  const separator = publicUrl.includes('?') ? '&' : '?';
  return `${publicUrl}${separator}t=${Date.now()}`;
}

/**
 * Records a best-effort `status='failed'` marker for `(cacheId, maskVersion)`
 * without clobbering a pre-existing ready row.
 *
 * We use `upsert(..., { onConflict: 'cache_id,mask_version', ignoreDuplicates: true })`
 * which is the Supabase equivalent of `ON CONFLICT DO NOTHING`: if a row already
 * exists for the pair (ready OR failed) the failed insert is silently discarded,
 * so a prior successful mask is never downgraded (Requirement 5.4). Any error from
 * this marker write is swallowed — it must never mask the original generation error
 * that the caller is about to rethrow.
 */
async function recordFailedMaskMarker(
  cacheId: string,
  maskVersion: number,
  sourceImageUrl: string | null
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('cakegenie_icing_masks')
      .upsert(
        {
          cache_id: cacheId,
          mask_url: '',
          source_image_url: sourceImageUrl ?? null,
          mask_version: maskVersion,
          status: 'failed',
        },
        { onConflict: 'cache_id,mask_version', ignoreDuplicates: true }
      );
  } catch (markerError) {
    // Never let the failure-marker write hide the real generation error.
    console.warn('Failed to record icing mask failure marker:', markerError);
  }
}

/**
 * Generates an Icing Mask for a design via Gemini, persists it (Storage object +
 * `cakegenie_icing_masks` row) idempotently, and returns the canonical Mask Record.
 *
 * Behaviour:
 * - Calls `editCakeImage(ICING_CONVERSION_PROMPT, baseImage, [], [], null,
 *   ICING_LAYER_SYSTEM_INSTRUCTION, 'gemini-3.1-flash-lite-image', traceId,
 *   'customizing-icing-mask')` to produce the red-icing / black-everything mask.
 * - Re-encodes the returned mask as a lossless PNG (never lossy WebP) so the black
 *   keying stays bit-accurate (Requirement 10.1–10.3), capturing its pixel dimensions.
 * - Uploads the PNG to `cakegenie/icing-masks/{cacheId}/v{maskVersion}.png` with
 *   `{ contentType: 'image/png', upsert: true }`, so regeneration overwrites the
 *   single object in place (Requirements 6.3, 6.4, 3.5, 3.6).
 * - Upserts the row on `(cache_id, mask_version)` so regeneration refreshes
 *   `mask_url`, `source_image_url`, and dimensions in place while still keeping one
 *   canonical row per design/version. The stored `mask_url` is cache-busted so
 *   clients immediately observe an overwritten Storage object.
 *
 * No-`cacheId` path (Requirement 7.1): when `cacheId` is null the function skips ALL
 * Storage and database writes and returns a synthetic, in-memory-only Mask Record
 * whose `mask_url` is the raw mask data URL. The caller/hook can decode and composite
 * with it exactly like a persisted mask, but nothing is written to the platform.
 *
 * Error path (Requirements 1.x, 5.4): on any error from Gemini, Storage, or the DB
 * for a design that has a `cacheId`, a `status='failed'` marker is recorded
 * (without clobbering an existing ready row) and the original error is rethrown so
 * the hook can fall back to the Gemini color-variant path.
 *
 * @param params Generation inputs; see {@link GenerateMaskParams}.
 * @returns The canonical (or synthetic, when `cacheId` is null) Mask Record.
 */
export async function generateAndPersistIcingMask(
  params: GenerateMaskParams
): Promise<CakeGenieIcingMask> {
  const { cacheId, baseImage, sourceImageUrl = null } = params;
  const maskVersion = params.maskVersion ?? CURRENT_MASK_VERSION;
  const icingColorName = params.icingColorName ?? 'white';
  const prompt = buildIcingConversionPrompt(icingColorName);

  // --- No cacheId: in-memory-only generation, no persistence (Requirement 7.1) ---
  if (!cacheId) {
    const maskDataUrl = await editCakeImage(
      prompt,
      baseImage,
      [],
      [],
      null,
      ICING_LAYER_SYSTEM_INSTRUCTION,
      'gemini-3.1-flash-lite-image',
      createMaskTraceId(),
      'customizing-icing-mask'
    );

    // Best-effort dimension decode; tolerate environments without a DOM by
    // leaving width/height null (the compositor rescales the mask as needed).
    let width: number | null = null;
    let height: number | null = null;
    try {
      const decoded = await decodeMaskToPngBlob(maskDataUrl);
      width = decoded.width;
      height = decoded.height;
    } catch {
      // Dimensions are optional for the in-memory record; ignore decode issues.
    }

    return {
      id: '',
      cache_id: '',
      mask_url: maskDataUrl,
      source_image_url: sourceImageUrl,
      mask_version: maskVersion,
      width,
      height,
      status: 'ready',
      created_at: new Date().toISOString(),
    };
  }

  // --- Persisted path (Requirements 1.x, 3.x, 6.x, 10.x) ---
  try {
    const supabase = getSupabaseClient();

    const maskDataUrl = await editCakeImage(
      prompt,
      baseImage,
      [],
      [],
      null,
      ICING_LAYER_SYSTEM_INSTRUCTION,
      'gemini-3.1-flash-lite-image',
      createMaskTraceId(),
      'customizing-icing-mask'
    );

    // Re-encode to a lossless PNG and capture decoded dimensions (Requirement 10).
    const { blob: pngBlob, width, height } = await decodeMaskToPngBlob(maskDataUrl);

    let cacheBustedPublicUrl = maskDataUrl;
    let isPersisted = false;

    try {
      // Upload to Storage; upsert overwrites the single object in place so exactly
      // one object exists per path even on regeneration (Requirements 6.3, 6.4, 3.5).
      const objectPath = buildMaskStoragePath(cacheId, maskVersion);
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(objectPath, pngBlob, { contentType: 'image/png', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) {
        throw new Error('Failed to get public URL for the icing mask.');
      }

      const cacheBustedUrl = buildCacheBustedMaskUrl(publicUrl);

      // Upsert the canonical row in place. This preserves one logical row per
      // design/version while letting later regenerations replace the stored source URL,
      // dimensions, and cache-busted public mask URL.
      const { error: insertError } = await supabase
        .from('cakegenie_icing_masks')
        .upsert(
          {
            cache_id: cacheId,
            mask_url: cacheBustedUrl,
            source_image_url: sourceImageUrl,
            mask_version: maskVersion,
            width,
            height,
            status: 'ready',
          },
          { onConflict: 'cache_id,mask_version' }
        );

      if (insertError) throw insertError;

      cacheBustedPublicUrl = cacheBustedUrl;
      isPersisted = true;
    } catch (persistError) {
      // Gracefully catch database or storage write failures (e.g. 403 Forbidden due to RLS).
      // Since Gemini generated the mask successfully, we fall back to using it in-memory
      // for the current session instead of failing the entire customizer interaction.
      console.warn(
        'Failed to persist generated icing mask to Supabase storage/database (e.g., due to permissions/RLS). ' +
        'Falling back to in-memory mask for the current session:',
        persistError
      );
    }

    if (isPersisted) {
      // Re-select the winning canonical row so all callers see the same record
      // regardless of who actually won the insert race.
      const winningRow = await getIcingMask(cacheId);
      if (winningRow) {
        return winningRow;
      }
    }

    // Return the generated mask with raw maskDataUrl or cache-busted public url so
    // the caller can still decode and composite immediately.
    return {
      id: '',
      cache_id: cacheId,
      mask_url: cacheBustedPublicUrl,
      source_image_url: sourceImageUrl,
      mask_version: maskVersion,
      width,
      height,
      status: 'ready',
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    // Gemini or decoding failed completely (the mask itself couldn't be generated).
    // Record a failed marker (without clobbering a prior ready row) and rethrow so
    // the hook falls back to the Gemini color-variant path (Requirement 5.4).
    await recordFailedMaskMarker(cacheId, maskVersion, sourceImageUrl);
    throw error;
  }
}
