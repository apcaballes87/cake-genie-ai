'use client';

// hooks/useIcingMask.ts
//
// React orchestration hook for the persistent, mask-based icing recolor flow on the
// customizing page. It bridges the data/IO layer (`icingMaskService`) and the
// client-side canvas compositor, owning:
//   - an in-memory decoded-mask cache (so warm-path recolors are pure client work),
//   - the mask lifecycle state (`idle | generating | ready | error`), and
//   - the public `recolorIcing` action.
//
// This file is built incrementally across three tasks:
//   - 7.1: mask prefetch + decode + lifecycle state.
//   - 7.2: implement `recolorIcing` (warm + cold + no-cacheId paths, last-click-wins).
//   - 7.3 (this task): fallback + error handling. `recolorIcing` now separates an
//     "obtain a usable decoded mask" phase (generation / regenerate-once, whose total
//     failure routes to `onFallback` exactly once) from a "composite" phase (whose
//     failure retains the current preview and reports `error` WITHOUT a fallback).
//
// The mask-decode effect mirrors the cancellation-guarded `renderPreview` effect in
// `src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx`, the URL→ImageData
// helper mirrors that lab's `loadImageElement` plus the `getImageData` usage in
// `src/lib/icingMaskComposite.ts`, and the request-id guard mirrors that lab's
// `generationRequestIdRef` so the latest click wins.

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CakeGenieIcingMask } from '@/lib/database.types';
import { recolorWithMask } from '@/lib/icingMaskComposite';
import { generateAndPersistIcingMask, getIcingMask } from '@/services/icingMaskService';
import { fileToBase64 } from '@/services/geminiService';

/** The mask lifecycle states surfaced to the UI (Requirement 4). */
export type IcingMaskStatus = 'idle' | 'generating' | 'ready' | 'error';

export interface UseIcingMaskParams {
  /** The `cakegenie_analysis_cache` row id keying the design (null for ad-hoc designs). */
  cacheId: string | null;
  /** The current working cake image, in the shape `editCakeImage` expects. */
  baseImage: { data: string; mimeType: string } | null;
  /** The current working cake image URL, used for canvas draw + provenance. */
  baseImageUrl: string | null;
  /** Studio-edited image URL (e.g. background change). When non-null, the hook
   *  auto-generates a mask from this image and clears any prior mask from the
   *  original, so the mask matches the displayed image. */
  studioEditedImageUrl: string | null;
  /** Human-readable icing color name for prompt accuracy (e.g. "white", "pink"). */
  icingColorName?: string;
  /** Called with the instantly composited recolored image on success. */
  onRecolored: (recoloredDataUrl: string, hex: string) => void;
  /** Delegates to the existing Gemini color-variant path when the mask path is unavailable. */
  onFallback: (hex: string, name: string) => void;
}

export interface UseIcingMaskResult {
  /** Current mask lifecycle state. */
  status: IcingMaskStatus;
  /** True once a decoded mask is held in memory for the current design. */
  hasMask: boolean;
  /** Recolors the icing for `hex` (named `name`), generating the mask first if needed. */
  recolorIcing: (hex: string, name: string) => Promise<void>;
  /** Force-regenerates the mask (clears cached mask and generates a fresh one). */
  regenerateMask: () => Promise<void>;
  /** Disables the mask overlay, reverting the display to the original un-recolored image. */
  disableMask: () => void;
}

/**
 * An icing mask decoded into memory and ready for client-side compositing.
 * `record` is the canonical Mask Record; `imageData` is the decoded mask pixels
 * (icing rendered red, everything else pitch-black) at its native `width`/`height`.
 */
interface DecodedMask {
  record: CakeGenieIcingMask;
  imageData: ImageData;
  width: number;
  height: number;
}

/**
 * Decodes an image URL into `ImageData` via an offscreen canvas.
 *
 * Creates an `HTMLImageElement` (with `crossOrigin='anonymous'` so the canvas stays
 * untainted and `getImageData` is allowed for cross-origin Storage URLs), draws it to
 * a `willReadFrequently` 2D canvas, and reads back the pixels. Modeled on the lab's
 * `loadImageElement` and the `getImageData` usage in `icingMaskComposite.ts`.
 *
 * Rejects when run without a DOM, when the image fails to load, when the decoded
 * dimensions are non-positive, or when the 2D context / pixel read is unavailable.
 */
function decodeImageUrlToImageData(
  url: string
): Promise<{ imageData: ImageData; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Icing mask decoding requires a DOM (browser) environment.'));
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';

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

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Could not acquire a 2D context for icing mask decoding.'));
        return;
      }

      ctx.drawImage(image, 0, 0, width, height);

      try {
        const imageData = ctx.getImageData(0, 0, width, height);
        resolve({ imageData, width, height });
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error('Failed to read icing mask image data from canvas.')
        );
      }
    };

    image.onerror = () => {
      reject(new Error('Failed to load the icing mask image.'));
    };

    image.src = url;
  });
}

/**
 * Fetches an image URL and converts it to the `{ data, mimeType }` format expected by
 * `generateAndPersistIcingMask` / `editCakeImage`. Uses the client-side `fileToBase64`
 * utility from `geminiService`. Aborts after 10 seconds.
 */
async function fetchUrlAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch studio-edited image (status ${response.status}).`);
    }
    const blob = await response.blob();
    const file = new File([blob], 'studio-edited.webp', { type: blob.type || 'image/webp' });
    return await fileToBase64(file);
  } finally {
    clearTimeout(timeoutId);
  }
}

function maskMatchesStudioSource(
  mask: Pick<CakeGenieIcingMask, 'source_image_url'> | null,
  studioEditedImageUrl: string | null
): boolean {
  if (!mask || !studioEditedImageUrl) {
    return false;
  }

  return mask.source_image_url === studioEditedImageUrl;
}

/**
 * Loads an image URL into a fully-decoded `HTMLImageElement`.
 *
 * `recolorWithMask` needs an actual `HTMLImageElement` for its `baseImage` param (it
 * draws it onto the working canvas), so this resolves only once the element is loaded
 * with positive natural dimensions. Uses `crossOrigin='anonymous'` so the resulting
 * canvas stays untainted for cross-origin Storage URLs. Mirrors the lab's
 * `loadImageElement` (minus the shared cache map).
 *
 * Rejects when run without a DOM or when the image fails to load.
 */
function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Loading the base image requires a DOM (browser) environment.'));
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(new Error('Failed to load the base cake image.'));
    };

    image.src = url;
  });
}

/**
 * Orchestrates persistent, mask-based icing recolor for one design.
 *
 * On mount and whenever `cacheId` changes, the hook prefetches the design's ready
 * Mask Record via `getIcingMask` and decodes its image into an in-memory `ImageData`
 * cache, transitioning the lifecycle state to `ready`. When no mask exists yet it
 * stays `idle` (generation is lazy, triggered on the first recolor); a decode/load
 * failure transitions to `error`. When `cacheId` is null the in-memory cache is
 * cleared and the state resets to `idle`.
 *
 * `recolorIcing` resolves a recolored preview for a chosen color:
 *   - Warm path: when a decoded mask is already in memory, it composites entirely
 *     client-side (no network/Gemini) and calls `onRecolored`.
 *   - Cold path (cacheId present, no mask yet): it generates + persists the mask via
 *     `generateAndPersistIcingMask`, decodes + caches it, then composites.
 *   - No-cacheId path: it generates an in-memory-only mask once, caches the decoded
 *     pixels for the session, and reuses them for subsequent clicks (warm path).
 * A request-id guard ensures only the latest click's result is displayed; superseded
 * clicks are discarded after each await.
 *
 * Error handling (task 7.3) splits the work into two phases so the two failure modes
 * stay distinct:
 *   - "Obtain a usable decoded mask" phase (generate/regenerate-once + decode). Total
 *     failure here — a generation error, an undecodable result, or a missing base
 *     image needed to generate — invokes `onFallback(hex, name)` EXACTLY ONCE and sets
 *     `status='error'`, leaving the current preview unchanged (no `onRecolored`)
 *     (Requirements 5.1, 5.2, 5.3, 5.6, 7.4). A single generation attempt covers both
 *     the cold "no mask yet" case and the "stored mask undecodable" regenerate-once
 *     case.
 *   - "Composite" phase (warm path, with a ready mask in memory). A failure here
 *     RETAINS the current preview (no `onRecolored`, no `onFallback`) and sets
 *     `status='error'` (Requirements 2.3, 2.6).
 * `onFallback` is invoked at most once per `recolorIcing` call, guarded by a local
 * boolean, and — like `onRecolored` and every `setStatus` — only when this click is
 * still the latest (last-click-wins).
 */
export function useIcingMask(params: UseIcingMaskParams): UseIcingMaskResult {
  const { cacheId, studioEditedImageUrl } = params;

  // Keep the latest params reachable from async callbacks without re-subscribing
  // effects. `recolorIcing` reads baseImage / baseImageUrl / onRecolored / onFallback
  // from here. The ref is synced in an effect (not during render) to satisfy the
  // react-hooks "no ref writes during render" rule; recolorIcing is only ever invoked
  // from user interactions (clicks), which occur after commit, so the effect has
  // always run by then and the ref holds the current params.
  const paramsRef = useRef(params);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    paramsRef.current = params;
  });

  // In-memory decoded-mask cache. Populated by the prefetch effect and, after a cold
  // (or no-cacheId in-memory) generation, by `recolorIcing`; consumed by the
  // warm-path compositor.
  const decodedMaskRef = useRef<DecodedMask | null>(null);

  // Cache the decoded base-image element so warm-path recolors don't re-decode the
  // base on every click. Keyed by URL so a base-image change re-decodes lazily.
  const baseImageElementRef = useRef<{ url: string; element: HTMLImageElement } | null>(null);

  // Cached base64 data of the studio-edited image, fetched+converted by the
  // auto-generation effect. `recolorIcing` uses this instead of `baseImage` (the
  // original upload) when available, so mask generation always targets the displayed image.
  const studioBaseImageRef = useRef<{ data: string; mimeType: string } | null>(null);

  // Monotonic request id mirroring `generationRequestIdRef` in the lab. Incremented at
  // the start of each `recolorIcing` call; after each await we compare against it so a
  // superseded click neither calls `onRecolored` nor mutates lifecycle state.
  const recolorRequestIdRef = useRef(0);

  const [status, setStatus] = useState<IcingMaskStatus>('idle');
  // `hasMask` mirrors whether `decodedMaskRef` is populated so consumers re-render
  // when the mask becomes available (a ref change alone would not re-render).
  const [hasMask, setHasMask] = useState(false);

  // Prefetch + decode the persisted mask for the current design.
  //
  // The synchronous resets below are an intentional "reset derived state when the
  // design key changes" — they clear any mask decoded for a previously selected
  // design so a stale mask can never be composited onto the newly loaded one. This
  // mirrors the cacheId-keyed reset in `useDesignUpdate`. The react-hooks
  // set-state-in-effect advisory is disabled for just these reset lines because the
  // reset is correctness-required, not a cascading-render smell.
  useEffect(() => {
    // No design key → no persisted mask. Clear any decoded mask and reset to idle.
    if (!cacheId) {
      decodedMaskRef.current = null;
      setHasMask(false);
      setStatus('idle');
      return;
    }

    // Reset while we (re)prefetch this design; clears any mask decoded for a
    // previously selected design so it can never be composited onto the new one.
    decodedMaskRef.current = null;
    studioBaseImageRef.current = null;
    setHasMask(false);
    setStatus('idle');

    // Cancellation guard: ignore stale async resolutions if the effect re-runs (or
    // unmounts) before this prefetch settles. Mirrors the lab's renderPreview effect.
    let cancelled = false;

    const prefetchMask = async (id: string) => {
      try {
        const record = await getIcingMask(id);

        // No mask yet for this design: stay idle (NOT an error). The mask is
        // generated lazily on the first recolor (task 7.2).
        if (!record) {
          if (!cancelled) {
            decodedMaskRef.current = null;
            setHasMask(false);
            setStatus('idle');
          }
          return;
        }

        const activeStudioEditedImageUrl = paramsRef.current.studioEditedImageUrl;
        if (
          activeStudioEditedImageUrl &&
          !maskMatchesStudioSource(record, activeStudioEditedImageUrl)
        ) {
          if (!cancelled) {
            decodedMaskRef.current = null;
            setHasMask(false);
            setStatus('idle');
          }
          return;
        }

        // Decode the stored mask into ImageData for instant client-side recolors.
        const { imageData, width, height } = await decodeImageUrlToImageData(record.mask_url);

        if (cancelled) {
          return;
        }

        decodedMaskRef.current = { record, imageData, width, height };
        setHasMask(true);
        setStatus('ready');
      } catch {
        // Decode/load (or transport) failure → error lifecycle state. The
        // single-retry regeneration + fallback path is implemented in task 7.3.
        if (!cancelled) {
          decodedMaskRef.current = null;
          setHasMask(false);
          setStatus('error');
        }
      }
    };

    void prefetchMask(cacheId);

    return () => {
      cancelled = true;
    };
  }, [cacheId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Resolves (and memoizes) the decoded base-image element for `baseImageUrl`. Reuses
  // the cached element when the URL is unchanged so warm-path recolors avoid
  // re-decoding the base image on every click.
  const resolveBaseImageElement = useCallback(
    async (url: string): Promise<HTMLImageElement> => {
      const cached = baseImageElementRef.current;
      if (cached && cached.url === url && cached.element.complete && cached.element.naturalWidth > 0) {
        return cached.element;
      }

      const element = await loadImageElement(url);
      baseImageElementRef.current = { url, element };
      return element;
    },
    []
  );

  const resolveStudioBaseImage = useCallback(
    async (url: string): Promise<{ data: string; mimeType: string }> => {
      const cached = studioBaseImageRef.current;
      if (cached) {
        return cached;
      }

      const baseImage = await fetchUrlAsBase64(url);
      studioBaseImageRef.current = baseImage;
      return baseImage;
    },
    []
  );

  // Auto-generate or hydrate a mask from the studio-edited image when it becomes available.
  //
  // When `studioEditedImageUrl` transitions from null to a valid URL and a `cacheId`
  // exists, this effect:
  //   1. Reuses the persisted studio-derived mask when one already exists.
  //   2. Otherwise clears any stale original-derived mask from memory.
  //   3. Fetches the studio image and converts it to base64 for Gemini.
  //   4. Generates a fresh mask via `generateAndPersistIcingMask` using the studio image.
  //   5. Decodes + caches the mask so subsequent color clicks take the warm path.
  useEffect(() => {
    if (!studioEditedImageUrl || !cacheId) return;

    const currentDecodedMask = decodedMaskRef.current;
    if (maskMatchesStudioSource(currentDecodedMask?.record ?? null, studioEditedImageUrl)) {
      return;
    }

    let cancelled = false;

    const syncMaskFromStudio = async () => {
      setStatus('generating');

      try {
        const persistedMask = await getIcingMask(cacheId);

        if (cancelled) return;

        if (persistedMask && maskMatchesStudioSource(persistedMask, studioEditedImageUrl)) {
          const { imageData, width, height } = await decodeImageUrlToImageData(persistedMask.mask_url);

          if (cancelled) return;

          decodedMaskRef.current = { record: persistedMask, imageData, width, height };
          setHasMask(true);
          setStatus('ready');
          return;
        }

        decodedMaskRef.current = null;
        setHasMask(false);

        const baseImage = await resolveStudioBaseImage(studioEditedImageUrl);

        if (cancelled) return;

        const record = await generateAndPersistIcingMask({
          cacheId,
          baseImage,
          sourceImageUrl: studioEditedImageUrl,
          icingColorName: paramsRef.current.icingColorName,
        });

        if (cancelled) return;

        const { imageData, width, height } = await decodeImageUrlToImageData(record.mask_url);

        if (cancelled) return;

        decodedMaskRef.current = { record, imageData, width, height };
        setHasMask(true);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          decodedMaskRef.current = null;
          setHasMask(false);
          setStatus('error');
        }
      }
    };

    void syncMaskFromStudio();

    return () => {
      cancelled = true;
    };
  }, [studioEditedImageUrl, cacheId, resolveStudioBaseImage]);

  const recolorIcing = useCallback(async (hex: string, name: string): Promise<void> => {
    // Last-click-wins guard: claim a fresh request id up front. After every await we
    // compare `recolorRequestIdRef.current` against this `requestId`; if a newer click
    // has since incremented it, we abort WITHOUT calling `onRecolored` / `onFallback`
    // or mutating lifecycle state, so only the most recent selection's result is
    // displayed and a stale click never fires the fallback (Requirements 2.4, 2.5).
    const requestId = recolorRequestIdRef.current + 1;
    recolorRequestIdRef.current = requestId;
    const isCurrent = () => recolorRequestIdRef.current === requestId;

    const {
      cacheId: currentCacheId,
      baseImage,
      baseImageUrl,
      studioEditedImageUrl: currentStudioEditedImageUrl,
    } = paramsRef.current;

    // Guarantees `onFallback` is invoked at most once per `recolorIcing` call. Every
    // fallback site routes through here, and the boolean short-circuits any second
    // attempt within the same call (Requirements 5.1, 5.3, 7.4).
    let fallbackInvoked = false;
    const invokeFallback = () => {
      if (fallbackInvoked) {
        return;
      }
      fallbackInvoked = true;
      paramsRef.current.onFallback(hex, name);
    };

    // A base image URL is required to composite in every path — `recolorWithMask`
    // draws an actual HTMLImageElement as the base layer. Without it the mask path is
    // unavailable, so route to the Color Variant Fallback exactly once and report
    // error, leaving the current preview unchanged (Requirements 5.1, 5.6).
    if (!baseImageUrl) {
      if (isCurrent()) {
        invokeFallback();
        setStatus('error');
      }
      return;
    }

    // ---- Phase 1: obtain a usable decoded mask -----------------------------------
    // Total failure of this phase (generation error, an undecodable generated mask, or
    // a missing base image needed to generate) routes to `onFallback` exactly once +
    // `status='error'`, leaving the preview unchanged. This is kept separate from the
    // compositing phase below so a compositing failure (which has a different remedy)
    // is never treated as a mask generation failure.
    //
    // A single `generateAndPersistIcingMask` call covers both:
    //   - the cold "no mask yet" case (Requirement 5.1 — generation error / no usable
    //     image → fallback once, no extra retry), and
    //   - the "stored mask undecodable" case (Requirements 5.2, 5.3). When the prefetch
    //     effect (7.1) fails to decode a stored mask it sets `status='error'` and
    //     leaves `decodedMaskRef` null, so this call IS the "regenerate exactly once",
    //     and its failure is the regeneration failure that falls back once.
    // `generateAndPersistIcingMask` always issues a fresh Gemini call, so we
    // deliberately do NOT loop here — that would double the expensive generation.
    let decoded = decodedMaskRef.current;

    if (!decoded) {
      let effectiveBaseImage = studioBaseImageRef.current ?? baseImage;

      if (currentStudioEditedImageUrl && !studioBaseImageRef.current) {
        try {
          effectiveBaseImage = await resolveStudioBaseImage(currentStudioEditedImageUrl);
        } catch {
          effectiveBaseImage = null;
        }
      }

      // Generating a mask requires the base image payload. If it is missing we cannot
      // produce an in-memory mask, so fall back exactly once (Requirements 5.1, 7.4;
      // covers the no-`cacheId` "mask cannot be produced" case too).
      if (!effectiveBaseImage) {
        if (isCurrent()) {
          invokeFallback();
          setStatus('error');
        }
        return;
      }

      // Lazy generation is in progress (Requirement 4.2). For a null `cacheId` the
      // service skips all persistence and returns an in-memory-only record whose
      // `mask_url` is the raw mask data URL (Requirement 7.2/7.4).
      setStatus('generating');

      let record: CakeGenieIcingMask;
      try {
        record = await generateAndPersistIcingMask({
          cacheId: currentCacheId,
          baseImage: effectiveBaseImage,
          sourceImageUrl: currentStudioEditedImageUrl ?? baseImageUrl,
          icingColorName: paramsRef.current.icingColorName,
        });
      } catch {
        // Generation error / no usable mask image (Requirements 5.1, 5.3): fall back
        // exactly once and report error, leaving the preview unchanged.
        if (isCurrent()) {
          invokeFallback();
          setStatus('error');
        }
        return;
      }

      // Superseded by a newer click — discard silently (no fallback, no status).
      if (!isCurrent()) {
        return;
      }

      try {
        const { imageData, width, height } = await decodeImageUrlToImageData(record.mask_url);

        if (!isCurrent()) {
          return;
        }

        decoded = { record, imageData, width, height };
      } catch {
        // The generated/regenerated mask could not be decoded into usable ImageData
        // ("no usable Icing Mask image"): fall back exactly once + error
        // (Requirements 5.1, 5.3, 5.6).
        if (isCurrent()) {
          invokeFallback();
          setStatus('error');
        }
        return;
      }

      // Mask obtained: cache the decoded pixels and mark ready so subsequent clicks
      // take the warm path (Requirement 2.x).
      decodedMaskRef.current = decoded;
      setHasMask(true);
      setStatus('ready');
    }

    // ---- Phase 2: composite (warm path) ------------------------------------------
    // Shared by all paths once a mask is in memory: composite entirely client-side —
    // no network or Gemini call (Requirement 2.2). A failure HERE (base-image load or
    // `recolorWithMask` throwing) means a ready mask is in memory but compositing
    // failed, so we RETAIN the current preview (no `onRecolored`, no `onFallback`) and
    // report error (Requirements 2.6, 2.3). The base image element is cached across
    // clicks so repeat recolors stay fast.
    let recoloredDataUrl: string;
    try {
      const baseImageEl = await resolveBaseImageElement(baseImageUrl);

      // Superseded during the base-image decode — discard silently.
      if (!isCurrent()) {
        return;
      }

      recoloredDataUrl = recolorWithMask({
        baseImage: baseImageEl,
        maskImageData: decoded.imageData,
        maskWidth: decoded.width,
        maskHeight: decoded.height,
        targetHex: hex,
      });
    } catch {
      // Compositing failed with a ready mask: retain preview, no fallback, set error.
      if (isCurrent()) {
        setStatus('error');
      }
      return;
    }

    // `recolorWithMask` is synchronous, but re-check once more so a click that arrived
    // during the base-image decode can't have its stale result emitted.
    if (!isCurrent()) {
      return;
    }

    paramsRef.current.onRecolored(recoloredDataUrl, hex);
  }, [resolveBaseImageElement, resolveStudioBaseImage]);

  // Force-regenerates the mask: clears the in-memory decoded mask, then the next
  // recolorIcing call (or an explicit recolor triggered here) will re-invoke
  // generateAndPersistIcingMask with a fresh Gemini call. This lets users fix a
  // poor-quality mask.
  const regenerateMask = useCallback(async (): Promise<void> => {
    decodedMaskRef.current = null;
    setHasMask(false);
    setStatus('idle');
  }, []);

  // Disables the mask overlay: reverts the display to the original (un-recolored)
  // image. The decoded mask stays in memory so the next color click is still instant
  // (no re-generation needed). Only signals the caller to restore the original preview.
  const disableMask = useCallback((): void => {
    // Signal the caller to restore the original image — mask stays cached for reuse.
    paramsRef.current.onRecolored('__DISABLE_MASK__', '');
  }, []);

  return {
    status,
    hasMask,
    recolorIcing,
    regenerateMask,
    disableMask,
  };
}
