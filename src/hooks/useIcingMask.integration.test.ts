// @vitest-environment jsdom
//
// hooks/useIcingMask.integration.test.ts
//
// Integration tests for the wired icing-mask flow (spec task 8.3).
//
// Validates: Requirements 1.1, 1.3, 2.2, 3.3, 5.1, 5.5.
//
// Unlike the 7.4 unit test (`useIcingMask.test.ts`), which mocks `icingMaskService`
// wholesale to isolate the hook's state machine, THIS test exercises the REAL
// `icingMaskService` (getIcingMask + generateAndPersistIcingMask) wired to the REAL
// `useIcingMask` hook. Only the true external boundaries are mocked:
//
//   - '@/services/geminiService'  -> `editCakeImage`  (the Gemini network boundary;
//        the customizer's only path to /api/ai/edit-image). Call counts on it prove
//        cold vs warm: warm/cross-user reuse must NOT call it.
//   - '@/lib/supabase/client'     -> `getSupabaseClient` (in-memory Supabase double:
//        a rows array keyed by cache_id+mask_version with ON CONFLICT DO NOTHING
//        upsert, plus a storage uploads array + getPublicUrl). Persistence (row +
//        storage object) is observable and shareable across two hook mounts. This
//        double is adapted from `src/services/icingMaskService.test.ts`.
//   - '@/lib/icingMaskComposite'  -> `recolorWithMask` (canvas compositing isn't the
//        subject here; mocking it keeps the test focused on the wiring/persistence
//        seam. We assert `onRecolored` receives its result).
//
// Why the service+hook seam (not the full CustomizingClient)? The page component is
// very large and network-heavy (Supabase realtime channels, analysis fetches, pricing
// hooks, etc.), so rendering it would test infrastructure unrelated to the mask flow.
// The hook is the exact integration point where `recolorIcing` joins the service and
// the compositor; `onRecolored`/`onFallback` are the seams the page wires to
// `setEditedImage`/`handleUpdateDesign`. Asserting on those callbacks is equivalent to
// asserting the page renders a recolored hero (cold/warm) or runs the color-variant
// flow (fallback), without the page's unrelated machinery.
//
// jsdom provides no real image decode or canvas 2D context, so we stub the global
// `Image` (so `.src` resolves `onload`/`onerror` asynchronously), `ImageData` (if
// absent), and the canvas prototype (`getContext` + `toBlob`). These cover BOTH the
// service's `decodeMaskToPngBlob` (Image + canvas.toBlob) AND the hook's
// `decodeImageUrlToImageData` / `loadImageElement` (Image + getImageData), mirroring
// the stubs already used in `icingMaskService.test.ts` and `useIcingMask.test.ts`.

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mock state (safe to reference inside vi.mock factories) ----------------
const { mockEditCakeImage, mockRecolorWithMask, supabaseRef } = vi.hoisted(() => ({
  mockEditCakeImage: vi.fn(),
  mockRecolorWithMask: vi.fn(),
  // Mutable holder so each test can swap in a fresh in-memory Supabase double.
  supabaseRef: { current: null as unknown as InMemorySupabase['client'] },
}));

// Only the external boundaries are mocked — the service itself is REAL.
vi.mock('@/services/geminiService', () => ({
  editCakeImage: mockEditCakeImage,
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => supabaseRef.current,
  createClient: () => supabaseRef.current,
}));

vi.mock('@/lib/icingMaskComposite', () => ({
  recolorWithMask: mockRecolorWithMask,
  PREVIEW_MAX_DIMENSION: 1200,
}));

import { CURRENT_MASK_VERSION } from '@/services/icingMaskService';
import { useIcingMask, type UseIcingMaskParams } from './useIcingMask';

// -----------------------------------------------------------------------------
// In-memory Supabase double (adapted from src/services/icingMaskService.test.ts)
// -----------------------------------------------------------------------------
//
// Backs `cakegenie_icing_masks` with a JS array keyed by (cache_id, mask_version)
// and the `cakegenie` storage bucket with an uploads array. `upsert` with
// `ignoreDuplicates: true` mimics Postgres `ON CONFLICT DO NOTHING`: it never
// overwrites an existing row for the conflict key. Storage `upload` with
// `upsert: true` allows repeated writes to the same path (one logical object).

interface MaskRow extends Record<string, unknown> {
  id: string;
  cache_id: string;
  mask_url: string;
  source_image_url: string | null;
  mask_version: number;
  width: number | null;
  height: number | null;
  status: string;
  created_at: string;
}

interface UploadRecord {
  path: string;
  blob: unknown;
  opts: unknown;
}

interface InMemorySupabase {
  client: {
    from: (table: string) => unknown;
    storage: { from: (bucket: string) => unknown };
  };
  rows: MaskRow[];
  uploads: UploadRecord[];
}

function createInMemorySupabase(): InMemorySupabase {
  const rows: MaskRow[] = [];
  const uploads: UploadRecord[] = [];
  let idCounter = 0;

  function makeTableQuery() {
    const filters: Array<{ col: string; val: unknown }> = [];

    const builder = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return builder;
      },
      async maybeSingle() {
        const match = rows.find((row) => filters.every((f) => row[f.col] === f.val));
        return { data: match ?? null, error: null };
      },
      async upsert(
        row: Record<string, unknown>,
        opts?: { onConflict?: string; ignoreDuplicates?: boolean }
      ) {
        const conflictCols = (opts?.onConflict ?? '')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);

        const existing = rows.find((existingRow) =>
          conflictCols.every((col) => existingRow[col] === row[col])
        );

        if (existing) {
          // ON CONFLICT DO NOTHING — never clobber an existing row.
          if (opts?.ignoreDuplicates) {
            return { data: null, error: null };
          }
          Object.assign(existing, row);
          return { data: null, error: null };
        }

        idCounter += 1;
        rows.push({
          id: `mask-${idCounter}`,
          source_image_url: null,
          width: null,
          height: null,
          created_at: new Date().toISOString(),
          ...(row as Partial<MaskRow>),
        } as MaskRow);
        return { data: null, error: null };
      },
    };

    return builder;
  }

  const storageBucket = {
    async upload(path: string, blob: unknown, opts: unknown) {
      // upsert:true semantics: repeated writes to the same path are allowed and
      // collapse to one logical object. We record every call so tests can assert
      // on the number of DISTINCT paths.
      uploads.push({ path, blob, opts });
      return { data: { path }, error: null };
    },
    getPublicUrl(path: string) {
      return { data: { publicUrl: `https://example.test/${path}` } };
    },
  };

  return {
    client: {
      from: () => makeTableQuery(),
      storage: { from: () => storageBucket },
    },
    rows,
    uploads,
  };
}

/**
 * Seeds a ready Mask Record directly into the store — simulating a mask another
 * user (or a prior session) already generated and persisted. Used by the warm-path
 * and cross-user-reuse flows.
 */
function seedReadyRow(store: InMemorySupabase, overrides: Partial<MaskRow> = {}): MaskRow {
  const cacheId = (overrides.cache_id as string) ?? 'seeded-cache';
  const row: MaskRow = {
    id: 'seeded-1',
    cache_id: cacheId,
    mask_url: `https://example.test/icing-masks/${cacheId}/v${CURRENT_MASK_VERSION}.png`,
    source_image_url: null,
    mask_version: CURRENT_MASK_VERSION,
    width: 1000,
    height: 1000,
    status: 'ready',
    created_at: new Date().toISOString(),
    ...overrides,
  };
  store.rows.push(row);
  return row;
}

// -----------------------------------------------------------------------------
// DOM stubs — cover the service's decodeMaskToPngBlob AND the hook's decode/load
// -----------------------------------------------------------------------------

const MOCK_IMAGE_DIMENSION = 1000;
const FAKE_MASK_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhFAKE';
const FAKE_RECOLORED_DATA_URL = 'data:image/webp;base64,RECOLORED';

const BASE_IMAGE = { data: 'YmFzZTY0', mimeType: 'image/png' };
const BASE_IMAGE_URL = 'https://example.test/base.png';

// Records every URL assigned to an Image `.src`, so flows can assert WHICH mask was
// loaded for decoding (e.g. that cross-user reuse decoded the seeded mask_url).
let loadedImageSrcs: string[] = [];

/**
 * Stub Image: setting `.src` schedules a microtask that fires `onerror` when the URL
 * contains "fail" or `onload` with positive natural dimensions otherwise. Mirrors how
 * the real browser drives the service's and hook's image decoding asynchronously.
 */
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
  crossOrigin: string | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  width = 0;
  height = 0;
  complete = false;
  private _src = '';

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    loadedImageSrcs.push(value);
    queueMicrotask(() => {
      if (/fail/i.test(value)) {
        this.onerror?.();
        return;
      }
      this.naturalWidth = MOCK_IMAGE_DIMENSION;
      this.naturalHeight = MOCK_IMAGE_DIMENSION;
      this.width = MOCK_IMAGE_DIMENSION;
      this.height = MOCK_IMAGE_DIMENSION;
      this.complete = true;
      this.onload?.();
    });
  }
}

/** Minimal ImageData polyfill used only when the test environment lacks one. */
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(widthOrData: number | Uint8ClampedArray, widthOrHeight: number, maybeHeight?: number) {
    if (typeof widthOrData === 'number') {
      this.width = widthOrData;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(widthOrData * widthOrHeight * 4);
    } else {
      this.data = widthOrData;
      this.width = widthOrHeight;
      this.height = maybeHeight ?? widthOrData.length / 4 / widthOrHeight;
    }
  }
}

const fakeCanvasContext = {
  drawImage: vi.fn(),
  putImageData: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => new ImageData(w, h)),
};

let originalImage: typeof globalThis.Image | undefined;
let originalImageData: typeof globalThis.ImageData | undefined;
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext | undefined;
let originalToBlob: typeof HTMLCanvasElement.prototype.toBlob | undefined;
let polyfilledImageData = false;

beforeAll(() => {
  originalImage = globalThis.Image;
  (globalThis as unknown as { Image: unknown }).Image = MockImage;

  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as unknown as { ImageData: unknown }).ImageData = MockImageData;
    polyfilledImageData = true;
  } else {
    originalImageData = globalThis.ImageData;
  }

  originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => fakeCanvasContext
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  // The service's decodeMaskToPngBlob re-encodes the mask via canvas.toBlob('image/png').
  originalToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback) {
    callback(new Blob(['fake-png-bytes'], { type: 'image/png' }));
  } as unknown as typeof HTMLCanvasElement.prototype.toBlob;
});

afterAll(() => {
  if (originalImage) {
    (globalThis as unknown as { Image: unknown }).Image = originalImage;
  }
  if (polyfilledImageData) {
    delete (globalThis as unknown as { ImageData?: unknown }).ImageData;
  } else if (originalImageData) {
    (globalThis as unknown as { ImageData: unknown }).ImageData = originalImageData;
  }
  if (originalGetContext) {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  }
  if (originalToBlob) {
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  }
});

// ---- helpers -----------------------------------------------------------------------

function buildParams(overrides: Partial<UseIcingMaskParams> = {}): UseIcingMaskParams {
  return {
    cacheId: 'cache-1',
    baseImage: BASE_IMAGE,
    baseImageUrl: BASE_IMAGE_URL,
    onRecolored: vi.fn(),
    onFallback: vi.fn(),
    ...overrides,
  };
}

/** Flush pending microtasks (Image onload/onerror, resolved service promises). */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let store: InMemorySupabase;

beforeEach(() => {
  loadedImageSrcs = [];
  store = createInMemorySupabase();
  supabaseRef.current = store.client;

  mockEditCakeImage.mockReset();
  mockEditCakeImage.mockResolvedValue(FAKE_MASK_DATA_URL);

  mockRecolorWithMask.mockReset();
  mockRecolorWithMask.mockReturnValue(FAKE_RECOLORED_DATA_URL);

  fakeCanvasContext.drawImage.mockClear();
  fakeCanvasContext.putImageData.mockClear();
  fakeCanvasContext.clearRect.mockClear();
  fakeCanvasContext.getImageData.mockClear();
  fakeCanvasContext.getImageData.mockImplementation(
    (_x: number, _y: number, w: number, h: number) => new ImageData(w, h)
  );
});

describe('useIcingMask integration (real service + real hook)', () => {
  // ---------------------------------------------------------------------------------
  // Cold path (Req 1.1, 1.3)
  // ---------------------------------------------------------------------------------
  it('cold path: first click on a maskless design generates, persists (row + storage object), and renders a recolored hero', async () => {
    const cacheId = 'cache-cold';
    const onRecolored = vi.fn();
    const params = buildParams({ cacheId, onRecolored });

    const { result } = renderHook(() => useIcingMask(params));

    // Prefetch finds no persisted mask → stays idle (generation is lazy).
    await flushMicrotasks();
    expect(result.current.status).toBe('idle');
    expect(result.current.hasMask).toBe(false);
    expect(mockEditCakeImage).not.toHaveBeenCalled();

    // First color click on the maskless design.
    await act(async () => {
      await result.current.recolorIcing('#FFC0CB', 'Pink');
    });

    // (Req 1.1) Gemini invoked EXACTLY ONCE to generate the mask from the base image,
    // using the icing conversion prompt + the customizing-icing-mask request source.
    expect(mockEditCakeImage).toHaveBeenCalledTimes(1);
    const editArgs = mockEditCakeImage.mock.calls[0];
    expect(editArgs[1]).toEqual(BASE_IMAGE); // base image payload
    expect(editArgs[8]).toBe('customizing-icing-mask'); // request source

    // (Req 1.1 / 3.x) Persistence is observable: exactly one ready row for
    // (cacheId, version) and exactly one stored object at the canonical path.
    const readyRows = store.rows.filter(
      (row) =>
        row.cache_id === cacheId &&
        row.mask_version === CURRENT_MASK_VERSION &&
        row.status === 'ready'
    );
    expect(readyRows).toHaveLength(1);

    const expectedPath = `icing-masks/${cacheId}/v${CURRENT_MASK_VERSION}.png`;
    expect(store.uploads).toHaveLength(1);
    expect(store.uploads[0].path).toBe(expectedPath);
    expect(store.uploads[0].opts).toMatchObject({ contentType: 'image/png', upsert: true });
    expect(readyRows[0].mask_url).toBe(`https://example.test/${expectedPath}`);

    // (Req 1.3) The triggering color is applied: the compositor ran and the recolored
    // hero is surfaced via onRecolored (the seam CustomizingClient wires to
    // setEditedImage + setActiveTab('customized')).
    expect(mockRecolorWithMask).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledWith(FAKE_RECOLORED_DATA_URL, '#FFC0CB');
    expect(result.current.status).toBe('ready');
    expect(result.current.hasMask).toBe(true);

    // The persisted mask_url was the one decoded for compositing (wiring proof).
    expect(loadedImageSrcs).toContain(`https://example.test/${expectedPath}`);
  });

  // ---------------------------------------------------------------------------------
  // Warm path (Req 2.2)
  // ---------------------------------------------------------------------------------
  it('warm path: a design that already has a mask recolors with ZERO Gemini edit calls', async () => {
    const cacheId = 'cache-warm';
    seedReadyRow(store, { cache_id: cacheId });

    const onRecolored = vi.fn();
    const params = buildParams({ cacheId, onRecolored });

    const { result } = renderHook(() => useIcingMask(params));

    // Prefetch loads + decodes the stored mask → ready before the first click.
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.hasMask).toBe(true);

    await act(async () => {
      await result.current.recolorIcing('#90EE90', 'Green');
    });

    // (Req 2.2) No network to the Gemini edit endpoint (no /api/ai/edit-image): the
    // warm recolor is pure client-side work.
    expect(mockEditCakeImage).not.toHaveBeenCalled();
    // No new persistence either — the existing row/object are reused.
    expect(store.uploads).toHaveLength(0);
    expect(store.rows).toHaveLength(1);

    // The recolored preview is produced and surfaced.
    expect(mockRecolorWithMask).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledWith(FAKE_RECOLORED_DATA_URL, '#90EE90');
  });

  // ---------------------------------------------------------------------------------
  // Fallback path (Req 5.1, 5.5)
  // ---------------------------------------------------------------------------------
  it('fallback path: when editCakeImage throws, onFallback runs the color-variant flow (and a failed row is recorded)', async () => {
    const cacheId = 'cache-fallback';
    mockEditCakeImage.mockReset();
    mockEditCakeImage.mockRejectedValue(new Error('gemini exploded'));

    const onRecolored = vi.fn();
    const onFallback = vi.fn();
    const params = buildParams({ cacheId, onRecolored, onFallback });

    const { result } = renderHook(() => useIcingMask(params));

    await flushMicrotasks();
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.recolorIcing('#FFC0CB', 'Pink');
    });

    // Generation was attempted once and threw.
    expect(mockEditCakeImage).toHaveBeenCalledTimes(1);

    // (Req 5.1 / 5.5) The hook delegates to the existing Gemini color-variant path
    // EXACTLY ONCE — CustomizingClient wires onFallback to handleUpdateDesign — and
    // never produces a mask-composited preview.
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith('#FFC0CB', 'Pink');
    expect(mockRecolorWithMask).not.toHaveBeenCalled();
    expect(onRecolored).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');

    // (Req 5.4, observed end-to-end) The service recorded a failed marker for the design.
    const failedRows = store.rows.filter(
      (row) =>
        row.cache_id === cacheId &&
        row.mask_version === CURRENT_MASK_VERSION &&
        row.status === 'failed'
    );
    expect(failedRows).toHaveLength(1);
    expect(store.uploads).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------------
  // Cross-user reuse (Req 3.3)
  // ---------------------------------------------------------------------------------
  it('cross-user reuse: a seeded mask row is reused by a fresh hook mount WITHOUT generation', async () => {
    const cacheId = 'cache-shared';
    // Simulate user A's already-persisted mask. The fresh hook mount below represents
    // user B with an empty in-memory decoded-mask cache.
    const seeded = seedReadyRow(store, { cache_id: cacheId });

    const onRecolored = vi.fn();
    const params = buildParams({ cacheId, onRecolored });

    const { result } = renderHook(() => useIcingMask(params));

    // (Req 3.3) The stored mask is served to this fresh "user" — prefetched + decoded
    // into the new in-memory cache, reaching ready with no generation.
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.hasMask).toBe(true);
    expect(mockEditCakeImage).not.toHaveBeenCalled();
    // The seeded mask_url (not a freshly generated one) was loaded for decoding.
    expect(loadedImageSrcs).toContain(seeded.mask_url);

    await act(async () => {
      await result.current.recolorIcing('#ADD8E6', 'Blue');
    });

    // Still no generation; the recolor reused the seeded mask and produced a preview.
    expect(mockEditCakeImage).not.toHaveBeenCalled();
    expect(store.uploads).toHaveLength(0);
    expect(store.rows).toHaveLength(1);
    expect(mockRecolorWithMask).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledWith(FAKE_RECOLORED_DATA_URL, '#ADD8E6');
  });
});
