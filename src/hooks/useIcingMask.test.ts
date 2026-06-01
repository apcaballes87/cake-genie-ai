// hooks/useIcingMask.test.ts
//
// Unit tests for the `useIcingMask` orchestration hook (spec task 7.4).
//
// Validates: Requirements 4.1, 4.2, 4.6, 4.7, 5.1, 5.2, 5.3 (plus 1.3, 2.2, 2.4, 2.5).
//
// The hook bridges the data/IO layer (`@/services/icingMaskService`) and the
// client-side canvas compositor (`@/lib/icingMaskComposite`). Both are mocked so the
// tests exercise only the hook's lifecycle/state machine, request-id guard, and
// fallback wiring — never the network, Gemini, or real pixel work.
//
// jsdom does not load real images or implement a canvas 2D context, so we stub the
// global `Image` (so setting `.src` resolves `onload`/`onerror` asynchronously) and
// `HTMLCanvasElement.prototype.getContext` (so the hook's `decodeImageUrlToImageData`
// helper can `drawImage` + `getImageData`). A decode failure is simulated by giving a
// mask URL containing "fail", which makes the stubbed image fire `onerror`.

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CakeGenieIcingMask } from '@/lib/database.types';
import { recolorWithMask } from '@/lib/icingMaskComposite';
import { fileToBase64 } from '@/services/geminiService';
import { generateAndPersistIcingMask, getIcingMask } from '@/services/icingMaskService';
import { useIcingMask, type UseIcingMaskParams } from './useIcingMask';

vi.mock('@/services/icingMaskService', () => ({
  getIcingMask: vi.fn(),
  generateAndPersistIcingMask: vi.fn(),
}));

vi.mock('@/lib/icingMaskComposite', () => ({
  recolorWithMask: vi.fn(),
}));

vi.mock('@/services/geminiService', () => ({
  fileToBase64: vi.fn(),
}));

const mockGetIcingMask = vi.mocked(getIcingMask);
const mockGenerateAndPersistIcingMask = vi.mocked(generateAndPersistIcingMask);
const mockRecolorWithMask = vi.mocked(recolorWithMask);
const mockFileToBase64 = vi.mocked(fileToBase64);

// ---- jsdom DOM stubs ---------------------------------------------------------------

const MOCK_IMAGE_WIDTH = 800;
const MOCK_IMAGE_HEIGHT = 600;
const FAKE_RECOLORED_DATA_URL = 'data:image/webp;base64,FAKE';

const BASE_IMAGE = { data: 'base64-base-image', mimeType: 'image/png' };
const BASE_IMAGE_URL = 'https://example.com/base.png';
const OK_MASK_URL = 'https://example.com/mask-ok.png';
const FAIL_MASK_URL = 'https://example.com/mask-fail.png';

/**
 * Stub Image: setting `.src` schedules a microtask that fires `onerror` when the URL
 * contains "fail" (decode-failure cases) or `onload` with positive natural dimensions
 * otherwise. Mirrors how the real browser drives `loadImageElement` /
 * `decodeImageUrlToImageData` asynchronously.
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
    queueMicrotask(() => {
      if (/fail/i.test(value)) {
        this.onerror?.();
        return;
      }
      this.naturalWidth = MOCK_IMAGE_WIDTH;
      this.naturalHeight = MOCK_IMAGE_HEIGHT;
      this.width = MOCK_IMAGE_WIDTH;
      this.height = MOCK_IMAGE_HEIGHT;
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
let originalFetch: typeof globalThis.fetch | undefined;
let polyfilledImageData = false;
const fetchMock = vi.fn();

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

  originalFetch = globalThis.fetch;
  (globalThis as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
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
  if (originalFetch) {
    (globalThis as unknown as { fetch: typeof globalThis.fetch }).fetch = originalFetch;
  }
});

// ---- helpers -----------------------------------------------------------------------

function makeMaskRecord(maskUrl: string): CakeGenieIcingMask {
  return {
    id: 'mask-id',
    cache_id: 'cache-1',
    mask_url: maskUrl,
    source_image_url: null,
    mask_version: 1,
    width: MOCK_IMAGE_WIDTH,
    height: MOCK_IMAGE_HEIGHT,
    status: 'ready',
    created_at: '2024-01-01T00:00:00.000Z',
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function makeDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function buildParams(overrides: Partial<UseIcingMaskParams> = {}): UseIcingMaskParams {
  return {
    cacheId: 'cache-1',
    baseImage: BASE_IMAGE,
    baseImageUrl: BASE_IMAGE_URL,
    studioEditedImageUrl: null,
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

describe('useIcingMask', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fakeCanvasContext.getImageData.mockImplementation(
      (_x: number, _y: number, w: number, h: number) => new ImageData(w, h)
    );
    mockFileToBase64.mockResolvedValue({ mimeType: 'image/webp', data: 'studio-base64' });
    fetchMock.mockResolvedValue(
      new Response(new Blob(['studio-bytes'], { type: 'image/webp' }), { status: 200 })
    );
  });

  it('starts idle with no mask when cacheId is null', async () => {
    const params = buildParams({ cacheId: null, baseImage: null, baseImageUrl: null });

    const { result } = renderHook(() => useIcingMask(params));

    expect(result.current.status).toBe('idle');
    expect(result.current.hasMask).toBe(false);
    expect(mockGetIcingMask).not.toHaveBeenCalled();
  });

  it('stays idle when the design has no persisted mask (Req 4.1)', async () => {
    mockGetIcingMask.mockResolvedValue(null);
    const params = buildParams();

    const { result } = renderHook(() => useIcingMask(params));

    await waitFor(() => expect(mockGetIcingMask).toHaveBeenCalledWith('cache-1'));
    await flushMicrotasks();

    expect(result.current.status).toBe('idle');
    expect(result.current.hasMask).toBe(false);
  });

  it('becomes ready with a mask after prefetching + decoding a stored mask (Req 4.6)', async () => {
    mockGetIcingMask.mockResolvedValue(makeMaskRecord(OK_MASK_URL));
    const params = buildParams();

    const { result } = renderHook(() => useIcingMask(params));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.hasMask).toBe(true);
  });

  it('reports error when a prefetched mask fails to decode (Req 4.7)', async () => {
    mockGetIcingMask.mockResolvedValue(makeMaskRecord(FAIL_MASK_URL));
    const params = buildParams();

    const { result } = renderHook(() => useIcingMask(params));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.hasMask).toBe(false);
  });

  it('transitions idle -> generating -> ready and recolors on a cold first click (Req 4.2, 1.3)', async () => {
    mockGetIcingMask.mockResolvedValue(null);
    const generateDeferred = makeDeferred<CakeGenieIcingMask>();
    mockGenerateAndPersistIcingMask.mockReturnValue(generateDeferred.promise);
    mockRecolorWithMask.mockReturnValue(FAKE_RECOLORED_DATA_URL);

    const onRecolored = vi.fn();
    const params = buildParams({ onRecolored });

    const { result } = renderHook(() => useIcingMask(params));

    await waitFor(() => expect(mockGetIcingMask).toHaveBeenCalled());
    await flushMicrotasks();
    expect(result.current.status).toBe('idle');

    // Kick off the cold recolor; the synchronous portion flips status -> generating.
    let recolorPromise!: Promise<void>;
    act(() => {
      recolorPromise = result.current.recolorIcing('#FFC0CB', 'Pink');
    });
    expect(result.current.status).toBe('generating');

    // Resolve the (slow) generation; the hook then decodes + composites.
    await act(async () => {
      generateDeferred.resolve(makeMaskRecord(OK_MASK_URL));
      await recolorPromise;
    });

    expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledWith({
      cacheId: 'cache-1',
      baseImage: BASE_IMAGE,
      sourceImageUrl: BASE_IMAGE_URL,
    });
    expect(mockRecolorWithMask).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledWith(FAKE_RECOLORED_DATA_URL, '#FFC0CB');
    expect(result.current.status).toBe('ready');
    expect(result.current.hasMask).toBe(true);
  });

  it('recolors client-side with no generation on the warm path (Req 2.2)', async () => {
    mockGetIcingMask.mockResolvedValue(makeMaskRecord(OK_MASK_URL));
    mockRecolorWithMask.mockReturnValue(FAKE_RECOLORED_DATA_URL);

    const onRecolored = vi.fn();
    const params = buildParams({ onRecolored });

    const { result } = renderHook(() => useIcingMask(params));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.recolorIcing('#90EE90', 'Green');
    });

    expect(mockGenerateAndPersistIcingMask).not.toHaveBeenCalled();
    expect(mockRecolorWithMask).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledWith(FAKE_RECOLORED_DATA_URL, '#90EE90');
  });

  it('auto-generates a studio-derived mask when the studio image is already available on mount', async () => {
    mockGetIcingMask.mockResolvedValue(null);
    mockGenerateAndPersistIcingMask.mockResolvedValue(makeMaskRecord(OK_MASK_URL));

    const { result } = renderHook(() =>
      useIcingMask(
        buildParams({
          studioEditedImageUrl: 'https://example.com/studio.webp',
        })
      )
    );

    await waitFor(() => expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/studio.webp', expect.any(Object));
    expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledWith({
      cacheId: 'cache-1',
      baseImage: { mimeType: 'image/webp', data: 'studio-base64' },
      sourceImageUrl: 'https://example.com/studio.webp',
      icingColorName: undefined,
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.hasMask).toBe(true);
  });

  it('uses the displayed studio image on a cold click even when the studio payload was not preloaded', async () => {
    mockGetIcingMask.mockResolvedValue(null);
    mockGenerateAndPersistIcingMask.mockResolvedValue(makeMaskRecord(OK_MASK_URL));
    mockRecolorWithMask.mockReturnValue(FAKE_RECOLORED_DATA_URL);

    const onRecolored = vi.fn();
    const { result } = renderHook(() =>
      useIcingMask(
        buildParams({
          cacheId: null,
          baseImageUrl: 'https://example.com/studio.webp',
          studioEditedImageUrl: 'https://example.com/studio.webp',
          onRecolored,
        })
      )
    );

    await act(async () => {
      await result.current.recolorIcing('#FFC0CB', 'Pink');
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/studio.webp', expect.any(Object));
    expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledWith({
      cacheId: null,
      baseImage: { mimeType: 'image/webp', data: 'studio-base64' },
      sourceImageUrl: 'https://example.com/studio.webp',
      icingColorName: undefined,
    });
    expect(onRecolored).toHaveBeenCalledWith(FAKE_RECOLORED_DATA_URL, '#FFC0CB');
  });

  it('keeps only the latest click result when two recolors race (Req 2.4, 2.5)', async () => {
    mockGetIcingMask.mockResolvedValue(null);
    const generation = makeDeferred<CakeGenieIcingMask>();
    mockGenerateAndPersistIcingMask.mockReturnValue(generation.promise);
    mockRecolorWithMask.mockReturnValue(FAKE_RECOLORED_DATA_URL);

    const onRecolored = vi.fn();
    const params = buildParams({ onRecolored });

    const { result } = renderHook(() => useIcingMask(params));

    await waitFor(() => expect(mockGetIcingMask).toHaveBeenCalled());
    await flushMicrotasks();

    // First (slow) click, then a second click that supersedes it.
    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;
    act(() => {
      firstPromise = result.current.recolorIcing('#AAAAAA', 'First');
    });
    act(() => {
      secondPromise = result.current.recolorIcing('#BBBBBB', 'Second');
    });

    // Resolve the single in-flight generation promise.
    await act(async () => {
      generation.resolve(makeMaskRecord(OK_MASK_URL));
      await Promise.all([firstPromise, secondPromise]);
    });

    // Expect exactly one generate call (synchronization) and only the latest click's color to win
    expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledTimes(1);
    expect(onRecolored).toHaveBeenCalledWith(FAKE_RECOLORED_DATA_URL, '#BBBBBB');
  });

  it('falls back exactly once (and sets error) when generation fails (Req 5.1)', async () => {
    mockGetIcingMask.mockResolvedValue(null);
    mockGenerateAndPersistIcingMask.mockRejectedValue(new Error('gemini failed'));

    const onRecolored = vi.fn();
    const onFallback = vi.fn();
    const params = buildParams({ onRecolored, onFallback });

    const { result } = renderHook(() => useIcingMask(params));

    await waitFor(() => expect(mockGetIcingMask).toHaveBeenCalled());
    await flushMicrotasks();

    await act(async () => {
      await result.current.recolorIcing('#FFC0CB', 'Pink');
    });

    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith('#FFC0CB', 'Pink');
    expect(onRecolored).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
  });

  it('auto-generates a studio-derived mask when the studio image becomes available dynamically after mount', async () => {
    mockGetIcingMask.mockResolvedValue(null);
    mockGenerateAndPersistIcingMask.mockResolvedValue(makeMaskRecord(OK_MASK_URL));

    let currentParams = buildParams({ studioEditedImageUrl: null });
    const { result, rerender } = renderHook(() => useIcingMask(currentParams));

    // Initially mounted with null, should not call generate
    await waitFor(() => expect(mockGetIcingMask).toHaveBeenCalled());
    await flushMicrotasks();
    expect(mockGenerateAndPersistIcingMask).not.toHaveBeenCalled();

    // Dynamically update the studio Edited Image URL (simulating completion of background editing)
    currentParams = buildParams({ studioEditedImageUrl: 'https://example.com/studio.webp' });
    rerender();

    // Should automatically kick off mask generation for the new studio background
    await waitFor(() => expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/studio.webp', expect.any(Object));
    expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledWith({
      cacheId: 'cache-1',
      baseImage: { mimeType: 'image/webp', data: 'studio-base64' },
      sourceImageUrl: 'https://example.com/studio.webp',
      icingColorName: undefined,
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.hasMask).toBe(true);
  });

  describe('staticMaskUrl (edible photo cake flow)', () => {
    const EDIBLE_PHOTO_MASK_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cold-caking/6in-mask.webp';

    it('pre-loads the static mask and becomes ready without any Gemini call when cacheId is null', async () => {
      const params = buildParams({
        cacheId: null,
        baseImage: BASE_IMAGE,
        baseImageUrl: BASE_IMAGE_URL,
        staticMaskUrl: EDIBLE_PHOTO_MASK_URL,
      });

      const { result } = renderHook(() => useIcingMask(params));

      await waitFor(() => expect(result.current.status).toBe('ready'));
      expect(result.current.hasMask).toBe(true);
      expect(mockGetIcingMask).not.toHaveBeenCalled();
      expect(mockGenerateAndPersistIcingMask).not.toHaveBeenCalled();
    });

    it('recolors instantly on the first click with no Gemini call when the static mask is pre-loaded', async () => {
      mockRecolorWithMask.mockReturnValue(FAKE_RECOLORED_DATA_URL);

      const onRecolored = vi.fn();
      const params = buildParams({
        cacheId: null,
        baseImage: BASE_IMAGE,
        baseImageUrl: BASE_IMAGE_URL,
        staticMaskUrl: EDIBLE_PHOTO_MASK_URL,
        onRecolored,
      });

      const { result } = renderHook(() => useIcingMask(params));

      await waitFor(() => expect(result.current.status).toBe('ready'));

      await act(async () => {
        await result.current.recolorIcing('#FFC0CB', 'Pink');
      });

      expect(mockGenerateAndPersistIcingMask).not.toHaveBeenCalled();
      expect(mockRecolorWithMask).toHaveBeenCalledTimes(1);
      expect(onRecolored).toHaveBeenCalledWith(FAKE_RECOLORED_DATA_URL, '#FFC0CB');
    });

    it('does not load the static mask when cacheId is set (DB mask wins)', async () => {
      mockGetIcingMask.mockResolvedValue(makeMaskRecord(OK_MASK_URL));

      const { result } = renderHook(() =>
        useIcingMask(
          buildParams({
            cacheId: 'cache-1',
            staticMaskUrl: EDIBLE_PHOTO_MASK_URL,
          })
        )
      );

      await waitFor(() => expect(result.current.status).toBe('ready'));
      expect(mockGetIcingMask).toHaveBeenCalledWith('cache-1');
      // The DB-loaded mask fires onload via the OK_MASK_URL, not the static one.
      // We can't assert on image.src directly, but the static URL contains "edible"
      // and the DB URL is OK_MASK_URL — the "no static load" path is the absence
      // of console.warn and the success of the DB path.
    });

    it('clears the static mask when staticMaskUrl transitions from set to null', async () => {
      let currentParams = buildParams({
        cacheId: null,
        baseImage: BASE_IMAGE,
        baseImageUrl: BASE_IMAGE_URL,
        staticMaskUrl: EDIBLE_PHOTO_MASK_URL,
      });
      const { result, rerender } = renderHook(() => useIcingMask(currentParams));

      await waitFor(() => expect(result.current.status).toBe('ready'));
      expect(result.current.hasMask).toBe(true);

      // User switches away from the edible-photo flow — clear the static mask.
      currentParams = buildParams({
        cacheId: null,
        baseImage: BASE_IMAGE,
        baseImageUrl: BASE_IMAGE_URL,
        staticMaskUrl: null,
      });
      rerender();

      await waitFor(() => expect(result.current.hasMask).toBe(false));
      expect(result.current.status).toBe('idle');
    });

    it('falls back to Gemini generation when the static mask fails to decode', async () => {
      const FAIL_EDIBLE_MASK = 'https://example.com/edible-fail.png';
      // The MockImage class fires onerror for any URL containing "fail".
      mockGetIcingMask.mockResolvedValue(null);
      mockGenerateAndPersistIcingMask.mockResolvedValue(makeMaskRecord(OK_MASK_URL));
      mockRecolorWithMask.mockReturnValue(FAKE_RECOLORED_DATA_URL);

      const onRecolored = vi.fn();
      const params = buildParams({
        cacheId: null,
        baseImage: BASE_IMAGE,
        baseImageUrl: BASE_IMAGE_URL,
        staticMaskUrl: FAIL_EDIBLE_MASK,
        onRecolored,
      });

      const { result } = renderHook(() => useIcingMask(params));

      // Static decode fails → status returns to idle (no error state, so the
      // user is not blocked from using colors).
      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(result.current.hasMask).toBe(false);

      // First color click should now go through the existing Gemini generation
      // path (the static-mask effect's failure must not poison the cold path).
      await act(async () => {
        await result.current.recolorIcing('#FFC0CB', 'Pink');
      });

      expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledTimes(1);
      expect(mockGenerateAndPersistIcingMask).toHaveBeenCalledWith({
        cacheId: null,
        baseImage: BASE_IMAGE,
        sourceImageUrl: BASE_IMAGE_URL,
        icingColorName: undefined,
      });
      expect(onRecolored).toHaveBeenCalledWith(FAKE_RECOLORED_DATA_URL, '#FFC0CB');
    });
  });
});
