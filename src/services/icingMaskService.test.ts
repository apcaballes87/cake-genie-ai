// @vitest-environment jsdom
//
// Tests for the persistent icing mask service (`src/services/icingMaskService.ts`).
//
// Covers spec tasks:
//   4.3 — Property test for at-most-once generation idempotency
//         (design Property 1: At-most-once generation per design/version,
//          and Property 5: Idempotent persistence).
//   4.4 — Unit tests for `getIcingMask` / `generateAndPersistIcingMask`.
//
// Strategy:
//   The service depends on three external modules. We mock the two with side
//   effects and back the Supabase client with an in-memory double:
//     - '@/services/geminiService'  -> `editCakeImage` (controllable resolve/reject)
//     - '@/lib/supabase/client'     -> `getSupabaseClient` (in-memory table + storage)
//     - '@/lib/icingConversionPrompt' is a pure string, left un-mocked.
//
//   `generateAndPersistIcingMask` re-encodes the mask to a lossless PNG via an
//   internal `decodeMaskToPngBlob` that uses `Image` + `<canvas>.toBlob`, neither
//   of which jsdom implements for data URLs. We stub the global `Image` so setting
//   `.src` resolves `onload` (with naturalWidth/Height), and stub the canvas
//   prototype so `getContext('2d')` and `toBlob('image/png')` behave.

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import fc from 'fast-check';

// --- Hoisted mock state (safe to reference inside vi.mock factories) ---------
const { mockEditCakeImage, supabaseRef } = vi.hoisted(() => ({
  mockEditCakeImage: vi.fn(),
  // Mutable holder so each test can swap in a fresh in-memory Supabase double.
  supabaseRef: { current: null as unknown as InMemorySupabase['client'] },
}));

vi.mock('@/services/geminiService', () => ({
  editCakeImage: mockEditCakeImage,
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => supabaseRef.current,
}));

import {
  CURRENT_MASK_VERSION,
  generateAndPersistIcingMask,
  getIcingMask,
} from './icingMaskService';

// -----------------------------------------------------------------------------
// In-memory Supabase double
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

function seedReadyRow(
  store: InMemorySupabase,
  overrides: Partial<MaskRow> = {}
): MaskRow {
  const row: MaskRow = {
    id: 'seeded-1',
    cache_id: 'seeded-cache',
    mask_url: 'https://example.test/icing-masks/seeded-cache/v1.png',
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
// DOM stubs for the internal `decodeMaskToPngBlob` (Image + canvas.toBlob)
// -----------------------------------------------------------------------------

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
  crossOrigin: string | null = null;
  naturalWidth = 1000;
  naturalHeight = 1000;
  width = 1000;
  height = 1000;
  private _src = '';

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    // Mimic async image decoding; onload is always assigned before src by the
    // module under test, so it is available by the time this microtask runs.
    queueMicrotask(() => {
      this.onload?.();
    });
  }
}

const OriginalImage = globalThis.Image;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;

beforeAll(() => {
  globalThis.Image = FakeImage as unknown as typeof Image;

  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback) {
    callback(new Blob(['fake-png-bytes'], { type: 'image/png' }));
  } as unknown as typeof HTMLCanvasElement.prototype.toBlob;
});

afterAll(() => {
  globalThis.Image = OriginalImage;
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
});

const FAKE_MASK_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhFAKE';

beforeEach(() => {
  const store = createInMemorySupabase();
  supabaseRef.current = store.client;
  mockEditCakeImage.mockReset();
  mockEditCakeImage.mockResolvedValue(FAKE_MASK_DATA_URL);
});

// -----------------------------------------------------------------------------
// Task 4.4 — Unit tests for the service
// -----------------------------------------------------------------------------

describe('getIcingMask', () => {
  it('returns null (does not throw) when no row exists', async () => {
    await expect(getIcingMask('no-such-cache')).resolves.toBeNull();
  });

  it('returns the ready row when one is present', async () => {
    const store = createInMemorySupabase();
    supabaseRef.current = store.client;
    const seeded = seedReadyRow(store, { cache_id: 'cache-abc' });

    const result = await getIcingMask('cache-abc');

    expect(result).not.toBeNull();
    expect(result?.cache_id).toBe('cache-abc');
    expect(result?.status).toBe('ready');
    expect(result?.mask_url).toBe(seeded.mask_url);
  });

  it('does not return a non-ready row', async () => {
    const store = createInMemorySupabase();
    supabaseRef.current = store.client;
    seedReadyRow(store, { cache_id: 'cache-failed', status: 'failed', mask_url: '' });

    await expect(getIcingMask('cache-failed')).resolves.toBeNull();
  });
});

describe('generateAndPersistIcingMask', () => {
  const baseImage = { data: 'YmFzZTY0', mimeType: 'image/jpeg' };

  it('uploads the mask to icing-masks/{cacheId}/v{version}.png', async () => {
    const store = createInMemorySupabase();
    supabaseRef.current = store.client;
    const cacheId = 'cache-path-1';

    const record = await generateAndPersistIcingMask({ cacheId, baseImage });

    const expectedPath = `icing-masks/${cacheId}/v${CURRENT_MASK_VERSION}.png`;
    expect(store.uploads).toHaveLength(1);
    expect(store.uploads[0].path).toBe(expectedPath);
    // The stored PNG must be uploaded with the lossless image/png content type.
    expect(store.uploads[0].opts).toMatchObject({ contentType: 'image/png', upsert: true });
    // The persisted record points at the public URL for that exact path with a
    // cache-busting query string so regenerated masks cannot be mistaken for an older
    // object cached at the same storage path.
    expect(record.mask_url).toMatch(
      new RegExp(`^https://example\\.test/${expectedPath.replace(/\//g, '\\/')}\\?t=\\d+$`)
    );
    expect(record.status).toBe('ready');
  });

  it('refreshes the existing ready row in place when regenerating from a new source image', async () => {
    const store = createInMemorySupabase();
    supabaseRef.current = store.client;
    const cacheId = 'seeded-cache';
    seedReadyRow(store, { cache_id: cacheId, source_image_url: 'https://example.test/original.webp' });

    const record = await generateAndPersistIcingMask({
      cacheId,
      baseImage,
      sourceImageUrl: 'https://example.test/studio.webp',
    });

    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].source_image_url).toBe('https://example.test/studio.webp');
    expect(store.rows[0].mask_url).toMatch(
      /^https:\/\/example\.test\/icing-masks\/seeded-cache\/v1\.png\?t=\d+$/
    );
    expect(record.source_image_url).toBe('https://example.test/studio.webp');
    expect(record.mask_url).toMatch(
      /^https:\/\/example\.test\/icing-masks\/seeded-cache\/v1\.png\?t=\d+$/
    );
  });

  it('records a status="failed" row and rethrows when editCakeImage throws', async () => {
    const store = createInMemorySupabase();
    supabaseRef.current = store.client;
    const cacheId = 'cache-fail-1';

    const boom = new Error('gemini exploded');
    mockEditCakeImage.mockReset();
    mockEditCakeImage.mockRejectedValue(boom);

    await expect(
      generateAndPersistIcingMask({ cacheId, baseImage })
    ).rejects.toThrow('gemini exploded');

    const failedRows = store.rows.filter(
      (row) =>
        row.cache_id === cacheId &&
        row.mask_version === CURRENT_MASK_VERSION &&
        row.status === 'failed'
    );
    expect(failedRows).toHaveLength(1);
    // No mask was uploaded because generation failed before storage.
    expect(store.uploads).toHaveLength(0);
  });

  it('falls back to in-memory mask and does not throw when Supabase database or storage upsert fails (e.g. 403 Forbidden)', async () => {
    const store = createInMemorySupabase();
    // Stub upload to return an error
    store.client.storage.from = () => ({
      upload: async () => ({ data: null, error: new Error('403 Forbidden storage write') }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    });
    supabaseRef.current = store.client;
    const cacheId = 'cache-403-forbidden';

    const record = await generateAndPersistIcingMask({ cacheId, baseImage });

    // Should return a ready record with the raw data URL!
    expect(record.mask_url).toBe(FAKE_MASK_DATA_URL);
    expect(record.status).toBe('ready');
    expect(record.cache_id).toBe(cacheId);
    // No upload should succeed, and no row should be written to the database double
    expect(store.rows).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// Task 4.3 — Property test: at-most-once generation idempotency
//
// Property 1: At-most-once generation per design/version
// Property 5: Idempotent persistence
// Validates: Requirements 1.5, 6.6
// -----------------------------------------------------------------------------

describe('generateAndPersistIcingMask — idempotency (Properties 1 & 5)', () => {
  it('yields exactly one ready row and one stored object for one cacheId under concurrent/repeated calls', async () => {
    const baseImage = { data: 'YmFzZTY0', mimeType: 'image/jpeg' };

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 8 }),
        async (cacheId, concurrentCalls) => {
          // Fresh store per run so each generated example is isolated.
          const store = createInMemorySupabase();
          supabaseRef.current = store.client;
          mockEditCakeImage.mockReset();
          mockEditCakeImage.mockResolvedValue(FAKE_MASK_DATA_URL);

          // N concurrent first-clicks for the same design...
          await Promise.all(
            Array.from({ length: concurrentCalls }, () =>
              generateAndPersistIcingMask({ cacheId, baseImage })
            )
          );
          // ...plus a later repeated call (re-run / second visitor).
          await generateAndPersistIcingMask({ cacheId, baseImage });

          // Exactly one ready row for (cacheId, version) — ON CONFLICT DO NOTHING.
          const readyRows = store.rows.filter(
            (row) =>
              row.cache_id === cacheId &&
              row.mask_version === CURRENT_MASK_VERSION &&
              row.status === 'ready'
          );
          expect(readyRows).toHaveLength(1);

          // Exactly one DISTINCT stored object path (storage upsert collapses writes).
          const distinctPaths = new Set(store.uploads.map((u) => u.path));
          expect(distinctPaths.size).toBe(1);
          expect(distinctPaths.has(`icing-masks/${cacheId}/v${CURRENT_MASK_VERSION}.png`)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
