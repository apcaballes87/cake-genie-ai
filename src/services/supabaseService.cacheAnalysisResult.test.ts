import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HybridAnalysisResult } from '@/types';

const upsertMock = vi.fn();
const updateMock = vi.fn();
const selectAfterUpsertMock = vi.fn();
const singleAfterUpsertMock = vi.fn();
const selectFromAnalysisCacheMock = vi.fn();
const eqAfterAnalysisCacheSelectMock = vi.fn();
const singleAfterAnalysisCacheSelectMock = vi.fn();
const eqAfterUpdateMock = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();
const fetchMock = vi.fn();
const storageUploadMock = vi.fn();
const storageGetPublicUrlMock = vi.fn();
const getDesignAvailabilityMock = vi.fn();

interface ProductSizesQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

const productSizesQuery = {} as ProductSizesQuery;
productSizesQuery.select = vi.fn(() => productSizesQuery);
productSizesQuery.eq = vi.fn(() => productSizesQuery);
productSizesQuery.order = vi.fn(() => productSizesQuery);
productSizesQuery.limit = vi.fn(() => productSizesQuery);
productSizesQuery.maybeSingle = maybeSingleMock;

const analysisCacheUpsertQuery = {
  select: selectAfterUpsertMock,
  single: singleAfterUpsertMock,
};

const analysisCacheQuery = {
  upsert: upsertMock,
  select: selectFromAnalysisCacheMock,
  update: updateMock,
};

const analysisCacheSelectQuery = {
  eq: eqAfterAnalysisCacheSelectMock,
  single: singleAfterAnalysisCacheSelectMock,
  maybeSingle: maybeSingleMock,
};

const analysisCacheUpdateQuery = {
  eq: eqAfterUpdateMock,
};

const mockClient = {
  rpc: rpcMock,
  from: fromMock,
  storage: {
    from: vi.fn(() => ({
      upload: storageUploadMock,
      getPublicUrl: storageGetPublicUrlMock,
    })),
  },
};

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mockClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}));

vi.mock('./pricingService.database', () => ({
  calculatePriceFromDatabase: vi.fn().mockResolvedValue({
    addOnPricing: { addOnPrice: 0 },
  }),
}));

vi.mock('@/lib/utils/pricing', () => ({
  roundDownToNearest99: (total: number) => total,
}));

vi.mock('@/lib/utils/availability', () => ({
  getDesignAvailability: (...args: unknown[]) => getDesignAvailabilityMock(...args),
}));

vi.mock('@/utils/tagUtils', () => ({
  generateTagsForAnalysis: () => ['fingerprint'],
}));

vi.mock('./indexNowService', () => ({
  notifyIndexNow: vi.fn(),
}));

describe('cacheAnalysisResult', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ORB_BACKEND_URL = 'https://orb.genie.ph';
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
    storageUploadMock.mockReset().mockResolvedValue({ error: null });
    storageGetPublicUrlMock.mockReset().mockReturnValue({
      data: { publicUrl: 'https://example.com/uploaded.webp' },
    });
    singleAfterUpsertMock.mockReset().mockResolvedValue({ data: { id: 'cache-row-id' }, error: null });
    selectAfterUpsertMock.mockReset().mockReturnValue(analysisCacheUpsertQuery);
    upsertMock.mockReset().mockReturnValue(analysisCacheUpsertQuery);
    singleAfterAnalysisCacheSelectMock.mockReset().mockResolvedValue({ data: { id: 'cache-row-id' }, error: null });
    eqAfterAnalysisCacheSelectMock.mockReset().mockReturnValue(analysisCacheSelectQuery);
    selectFromAnalysisCacheMock.mockReset().mockReturnValue(analysisCacheSelectQuery);
    eqAfterUpdateMock.mockReset().mockResolvedValue({ error: null });
    updateMock.mockReset().mockReturnValue(analysisCacheUpdateQuery);
    maybeSingleMock.mockReset().mockResolvedValue({ data: { price: 999 }, error: null });
    rpcMock.mockReset().mockResolvedValue({ data: [], error: null });
    getDesignAvailabilityMock.mockReset().mockReturnValue('normal');
    fromMock.mockReset().mockImplementation((table: string) => {
      if (table === 'productsizes_cakegenie') return productSizesQuery;
      if (table === 'cakegenie_analysis_cache') return analysisCacheQuery;
      return analysisCacheQuery;
    });
  });

  it('stores the same finalized description in analysis_json and seo_description', async () => {
    getDesignAvailabilityMock.mockReturnValue('same-day');
    const { cacheAnalysisResult } = await import('./supabaseService');

    await cacheAnalysisResult(
      '1234567890abcdef',
      {
        cakeType: '1 Tier',
        cakeThickness: '4 in',
        keyword: 'basketball',
        seo_description: 'A sky blue soft-icing cake with basketball details.',
        icing_design: {
          base: 'soft_icing',
          colors: { side: 'blue', top: 'blue' },
        },
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
      } as unknown as HybridAnalysisResult,
      'https://example.com/basketball.webp',
      undefined,
      {
        fingerprintPipeline: 'v1-test-pipeline',
        triggerStudioEdit: false,
      },
    );

    const expected =
      'A sky blue soft-icing cake with basketball details. This design is available for same-day orders with 3 to 4 hours of preparation.';

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        seo_description: expected,
        analysis_json: expect.objectContaining({
          seo_description: expected,
        }),
        availability: 'same-day',
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
      }),
    );
  });

  it('stores fingerprint pipeline metadata with the canonical p_hash', async () => {
    const { cacheAnalysisResult } = await import('./supabaseService');

    const result = await cacheAnalysisResult(
      'deadc0de1234beef',
      {
        cakeType: 'Bento',
        cakeThickness: '4 in',
        keyword: 'lavender',
        icing_design: {
          base: 'soft_icing',
          colors: { side: 'white', top: 'purple' },
        },
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
      } as unknown as HybridAnalysisResult,
      'https://example.com/lavender.webp',
      undefined,
      {
        fingerprintPipeline: 'v1-test-pipeline',
        triggerStudioEdit: false,
      }
    );

    expect(result?.storedPHash).toBe('deadc0de1234beef');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_hash: 'deadc0de1234beef',
        fingerprint_pipeline: 'v1-test-pipeline',
        fingerprint_status: 'ready',
        orb_index_status: 'pending',
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
      })
    );
  });

  it('reuses an existing near-identical canonical hash before upsert', async () => {
    rpcMock.mockResolvedValue({
      data: [{ p_hash: 'ff4f040c070347bf' }],
      error: null,
    });

    const { cacheAnalysisResult } = await import('./supabaseService');

    const result = await cacheAnalysisResult(
      'ff4f040c0703c7bf',
      {
        cakeType: 'Bento',
        cakeThickness: '4 in',
        keyword: 'roblox',
        icing_design: {
          base: 'soft_icing',
          colors: { side: 'white', top: 'blue' },
        },
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
      } as unknown as HybridAnalysisResult,
      'https://example.com/roblox.webp',
      undefined,
      {
        fingerprintPipeline: 'v1-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-ahash8',
        triggerStudioEdit: false,
      }
    );

    expect(result?.storedPHash).toBe('ff4f040c070347bf');
    expect(rpcMock).toHaveBeenCalledWith('find_similar_analysis_by_fingerprint', {
      new_hash: 'ff4f040c0703c7bf',
      new_pipeline: 'v1-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-ahash8',
      legacy_hashes: [],
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_hash: 'ff4f040c070347bf',
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
      })
    );
  });

  it('does not collapse writes when the matched hash is more than two bits away', async () => {
    rpcMock.mockResolvedValue({
      data: [{ p_hash: '0000000000000000' }],
      error: null,
    });

    const { cacheAnalysisResult } = await import('./supabaseService');

    const result = await cacheAnalysisResult(
      '0000000000000007',
      {
        cakeType: 'Bento',
        cakeThickness: '4 in',
        keyword: 'separate-design',
        icing_design: {
          base: 'soft_icing',
          colors: { side: 'white', top: 'white' },
        },
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
      } as unknown as HybridAnalysisResult,
      'https://example.com/separate.webp',
      undefined,
      {
        fingerprintPipeline: 'v1-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-ahash8',
        triggerStudioEdit: false,
      }
    );

    expect(result?.storedPHash).toBe('0000000000000007');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_hash: '0000000000000007',
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
      })
    );
  });

  it('triggers ORB indexing when a source image blob is available', async () => {
    const { cacheAnalysisResult } = await import('./supabaseService');
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
    });

    try {
      await cacheAnalysisResult(
        'abcddcba12344321',
        {
          cakeType: 'Bento',
          cakeThickness: '4 in',
          keyword: 'indexed-design',
          icing_design: {
            base: 'soft_icing',
            colors: { side: 'white', top: 'pink' },
          },
          main_toppers: [],
          support_elements: [],
          cake_messages: [],
        } as unknown as HybridAnalysisResult,
        'https://example.com/indexed-design.webp',
        new Blob(['orb-image-bytes'], { type: 'image/webp' }),
        {
          fingerprintPipeline: 'v1-test-pipeline',
          triggerStudioEdit: false,
        }
      );
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
    }

    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://orb.genie.ph/api/index',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('does not wait for ORB indexing before resolving the cache write', async () => {
    const { cacheAnalysisResult } = await import('./supabaseService');
    const originalWindow = globalThis.window;
    let resolveIndexFetch!: (value: {
      ok: boolean;
      json: () => Promise<{ success: boolean }>;
    }) => void;

    fetchMock.mockReset().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveIndexFetch = resolve;
        })
    );

    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
    });

    try {
      const result = await Promise.race([
        cacheAnalysisResult(
          'fedcba9876543210',
          {
            cakeType: 'Bento',
            cakeThickness: '4 in',
            keyword: 'non-blocking-index',
            icing_design: {
              base: 'soft_icing',
              colors: { side: 'white', top: 'blue' },
            },
            main_toppers: [],
            support_elements: [],
            cake_messages: [],
          } as unknown as HybridAnalysisResult,
          'https://example.com/non-blocking-index.webp',
          new Blob(['orb-image-bytes'], { type: 'image/webp' }),
          {
            fingerprintPipeline: 'v1-test-pipeline',
            triggerStudioEdit: false,
          }
        ),
        new Promise<'timed_out'>((resolve) => setTimeout(() => resolve('timed_out'), 25)),
      ]);

      expect(result).not.toBe('timed_out');
      expect(result).toEqual(
        expect.objectContaining({
          storedPHash: 'fedcba9876543210',
        })
      );
    } finally {
      resolveIndexFetch({
        ok: true,
        json: async () => ({ success: true }),
      });
      await Promise.resolve();
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
    }
  });

  it('can refresh analysis fields without resetting stored source asset coverage', async () => {
    const { cacheAnalysisResult } = await import('./supabaseService');

    await cacheAnalysisResult(
      '1234abcd5678ef90',
      {
        cakeType: 'Bento',
        cakeThickness: '4 in',
        keyword: 'catalog-refresh',
        icing_design: {
          base: 'soft_icing',
          colors: { side: 'white', top: 'purple' },
        },
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
      } as unknown as HybridAnalysisResult,
      'https://example.com/already-stored.webp',
      undefined,
      {
        fingerprintPipeline: 'v1-test-pipeline',
        triggerStudioEdit: false,
        persistSourceAsset: false,
      }
    );

    const [payload] = upsertMock.mock.calls[0] ?? [];

    expect(payload).toBeTruthy();
    expect(payload).not.toHaveProperty('original_image_url');
    expect(payload).not.toHaveProperty('orb_index_status');
    expect(payload).not.toHaveProperty('orb_index_error');
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("writes original_image_url if persistSourceAsset is 'if_missing' and the record doesn't have an image", async () => {
    const { cacheAnalysisResult } = await import('./supabaseService');
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await cacheAnalysisResult(
      '1234abcd5678ef90',
      {
        cakeType: 'Bento',
        cakeThickness: '4 in',
        keyword: 'catalog-refresh',
        icing_design: {
          base: 'soft_icing',
          colors: { side: 'white', top: 'purple' },
        },
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
      } as unknown as HybridAnalysisResult,
      'https://example.com/source.webp',
      undefined,
      {
        fingerprintPipeline: 'v1-test-pipeline',
        triggerStudioEdit: false,
        persistSourceAsset: 'if_missing',
      }
    );

    const [payload] = upsertMock.mock.calls[0] ?? [];
    expect(payload).toBeTruthy();
    expect(payload.original_image_url).toBe('https://example.com/source.webp');
    expect(payload.orb_index_status).toBe('pending');
  });

  it("does not write original_image_url if persistSourceAsset is 'if_missing' and the record already has an image", async () => {
    const { cacheAnalysisResult } = await import('./supabaseService');
    maybeSingleMock.mockResolvedValue({ data: { original_image_url: 'https://example.com/existing.webp' }, error: null });

    await cacheAnalysisResult(
      '1234abcd5678ef90',
      {
        cakeType: 'Bento',
        cakeThickness: '4 in',
        keyword: 'catalog-refresh',
        icing_design: {
          base: 'soft_icing',
          colors: { side: 'white', top: 'purple' },
        },
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
      } as unknown as HybridAnalysisResult,
      'https://example.com/source.webp',
      undefined,
      {
        fingerprintPipeline: 'v1-test-pipeline',
        triggerStudioEdit: false,
        persistSourceAsset: 'if_missing',
      }
    );

    const [payload] = upsertMock.mock.calls[0] ?? [];
    expect(payload).toBeTruthy();
    expect(payload).not.toHaveProperty('original_image_url');
    expect(payload).not.toHaveProperty('orb_index_status');
  });
});
