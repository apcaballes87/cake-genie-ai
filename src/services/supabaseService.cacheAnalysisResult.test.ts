import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HybridAnalysisResult } from '@/types';

const upsertMock = vi.fn();
const updateMock = vi.fn();
const selectAfterUpsertMock = vi.fn();
const singleAfterUpsertMock = vi.fn();
const maybeSingleAfterUpsertMock = vi.fn();
const selectFromAnalysisCacheMock = vi.fn();
const eqAfterAnalysisCacheSelectMock = vi.fn();
const singleAfterAnalysisCacheSelectMock = vi.fn();
const eqAfterUpdateMock = vi.fn();
const selectAfterUpdateMock = vi.fn();
const maybeSingleAfterUpdateMock = vi.fn();
const productSizesMaybeSingleMock = vi.fn();
const analysisCacheMaybeSingleMock = vi.fn();
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
productSizesQuery.maybeSingle = productSizesMaybeSingleMock;

const analysisCacheUpsertQuery = {
  select: selectAfterUpsertMock,
  single: singleAfterUpsertMock,
  maybeSingle: maybeSingleAfterUpsertMock,
};

const analysisCacheQuery = {
  upsert: upsertMock,
  select: selectFromAnalysisCacheMock,
  update: updateMock,
};

const analysisCacheSelectQuery = {
  eq: eqAfterAnalysisCacheSelectMock,
  single: singleAfterAnalysisCacheSelectMock,
  maybeSingle: analysisCacheMaybeSingleMock,
};

const analysisCacheUpdateSelectQuery = {
  maybeSingle: maybeSingleAfterUpdateMock,
};

const analysisCacheUpdateEqQuery = {
  select: selectAfterUpdateMock,
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
    maybeSingleAfterUpsertMock.mockReset().mockResolvedValue({ data: { id: 'cache-row-id' }, error: null });
    selectAfterUpsertMock.mockReset().mockReturnValue(analysisCacheUpsertQuery);
    upsertMock.mockReset().mockReturnValue(analysisCacheUpsertQuery);
    singleAfterAnalysisCacheSelectMock.mockReset().mockResolvedValue({ data: { id: 'cache-row-id' }, error: null });
    eqAfterAnalysisCacheSelectMock.mockReset().mockReturnValue(analysisCacheSelectQuery);
    selectFromAnalysisCacheMock.mockReset().mockReturnValue(analysisCacheSelectQuery);
    selectAfterUpdateMock.mockReset().mockReturnValue(analysisCacheUpdateSelectQuery);
    maybeSingleAfterUpdateMock.mockReset().mockResolvedValue({ data: { id: 'cache-row-id' }, error: null });
    eqAfterUpdateMock.mockReset().mockReturnValue(analysisCacheUpdateEqQuery);
    updateMock.mockReset().mockReturnValue(analysisCacheUpdateQuery);
    productSizesMaybeSingleMock.mockReset().mockResolvedValue({ data: { price: 999 }, error: null });
    analysisCacheMaybeSingleMock.mockReset().mockResolvedValue({ data: { price: 999 }, error: null });
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
        fingerprintPipeline: 'v2-test-pipeline',
        triggerStudioEdit: false,
      },
    );

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        seo_description: expect.stringContaining('A sky blue soft-icing cake with basketball details.'),
        analysis_json: expect.objectContaining({
          seo_description: expect.any(String),
        }),
        availability: 'same-day',
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
      }),
    );

    const [[payload]] = upsertMock.mock.calls;
    expect(payload.seo_description).toContain(
      'This design is available for same-day orders with 3 to 4 hours of preparation.',
    );
    expect(payload.analysis_json.seo_description).toBe(payload.seo_description);
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
        fingerprintPipeline: 'v2-test-pipeline',
        triggerStudioEdit: false,
      }
    );

    expect(result?.storedPHash).toBe('deadc0de1234beef');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_hash: 'deadc0de1234beef',
        fingerprint_pipeline: 'v2-test-pipeline',
        fingerprint_status: 'ready',
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
      })
    );
  });

  it('prepares a new studio-processing cache row before full analysis is available', async () => {
    const { prepareStudioEditCacheRow } = await import('./supabaseService');
    maybeSingleAfterUpsertMock.mockResolvedValue({
      data: { id: 'new-cache-row-id' },
      error: null,
    });
    analysisCacheMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'new-cache-row-id',
        analysis_json: {
          __studio_edit_placeholder: true,
          status: 'studio_processing',
        },
        studio_edit_status: 'processing',
        studio_edited_image_url: null,
        studio_edit_started_at: new Date().toISOString(),
      },
      error: null,
    });
    maybeSingleAfterUpdateMock.mockResolvedValue({
      data: { id: 'new-cache-row-id' },
      error: null,
    });

    const result = await prepareStudioEditCacheRow('deadc0de1234beef', {
      client: mockClient as never,
      fingerprintPipeline: 'v2-test-pipeline',
      originalImageUrl: 'https://example.com/uploaded-source.webp',
    });

    expect(result).toEqual({
      id: 'new-cache-row-id',
      storedPHash: 'deadc0de1234beef',
      shouldTriggerStudioEdit: true,
      studioTriggerHandled: false,
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_hash: 'deadc0de1234beef',
        analysis_json: expect.objectContaining({
          __studio_edit_placeholder: true,
          status: 'studio_processing',
        }),
        fingerprint_pipeline: 'v2-test-pipeline',
        fingerprint_status: 'ready',
        original_image_url: 'https://example.com/uploaded-source.webp',
        studio_edit_status: 'processing',
        studio_edit_error: null,
        studio_edit_started_at: expect.any(String),
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
        ignoreDuplicates: true,
      })
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fingerprint_pipeline: 'v2-test-pipeline',
        fingerprint_status: 'ready',
        original_image_url: 'https://example.com/uploaded-source.webp',
        studio_edit_status: 'processing',
        studio_edit_error: null,
        studio_edit_started_at: expect.any(String),
      })
    );

    const [[updatePayload]] = updateMock.mock.calls;
    expect(updatePayload).not.toHaveProperty('analysis_json');
    expect(updatePayload).not.toHaveProperty('price');
    expect(updatePayload).not.toHaveProperty('keywords');
    expect(updatePayload).not.toHaveProperty('slug');
    expect(updatePayload).not.toHaveProperty('seo_title');
    expect(updatePayload).not.toHaveProperty('seo_description');
    expect(updatePayload).not.toHaveProperty('availability');
  });

  it('does not overwrite an existing completed analysis row while preparing Studio', async () => {
    const { prepareStudioEditCacheRow } = await import('./supabaseService');
    maybeSingleAfterUpsertMock.mockResolvedValue({ data: null, error: null });
    analysisCacheMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'completed-cache-row-id',
        analysis_json: {
          cakeType: 'Bento',
          keyword: 'real completed analysis',
        },
        studio_edit_status: 'completed',
        studio_edited_image_url: 'https://example.com/studio.webp',
        studio_edit_started_at: '2026-07-01T00:00:00.000Z',
      },
      error: null,
    });

    const result = await prepareStudioEditCacheRow('deadc0de1234beef', {
      client: mockClient as never,
      fingerprintPipeline: 'v2-test-pipeline',
      originalImageUrl: 'https://example.com/uploaded-source.webp',
    });

    expect(result).toEqual({
      id: 'completed-cache-row-id',
      storedPHash: 'deadc0de1234beef',
      shouldTriggerStudioEdit: false,
      studioTriggerHandled: true,
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis_json: expect.objectContaining({
          __studio_edit_placeholder: true,
        }),
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
        ignoreDuplicates: true,
      })
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'completed row with a studio image',
      row: {
        studio_edit_status: 'completed',
        studio_edited_image_url: 'https://example.com/studio.webp',
        studio_edit_started_at: '2026-07-01T00:00:00.000Z',
      },
      shouldTriggerStudioEdit: false,
    },
    {
      label: 'active processing row',
      row: {
        studio_edit_status: 'processing',
        studio_edited_image_url: null,
        studio_edit_started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      },
      shouldTriggerStudioEdit: false,
    },
    {
      label: 'failed row',
      row: {
        studio_edit_status: 'failed',
        studio_edited_image_url: null,
        studio_edit_started_at: '2026-07-01T00:00:00.000Z',
      },
      shouldTriggerStudioEdit: true,
    },
    {
      label: 'completed row missing its studio image',
      row: {
        studio_edit_status: 'completed',
        studio_edited_image_url: null,
        studio_edit_started_at: '2026-07-01T00:00:00.000Z',
      },
      shouldTriggerStudioEdit: true,
    },
    {
      label: 'stale processing row',
      row: {
        studio_edit_status: 'processing',
        studio_edited_image_url: null,
        studio_edit_started_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      },
      shouldTriggerStudioEdit: true,
    },
  ])('applies Studio retry policy for $label', async ({ row, shouldTriggerStudioEdit }) => {
    const { prepareStudioEditCacheRow } = await import('./supabaseService');
    maybeSingleAfterUpsertMock.mockResolvedValue({ data: null, error: null });
    analysisCacheMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'existing-cache-row-id',
        analysis_json: {
          cakeType: 'Bento',
          keyword: 'existing analysis',
        },
        ...row,
      },
      error: null,
    });
    maybeSingleAfterUpdateMock.mockResolvedValue({
      data: { id: 'existing-cache-row-id' },
      error: null,
    });

    const result = await prepareStudioEditCacheRow('deadc0de1234beef', {
      client: mockClient as never,
      fingerprintPipeline: 'v2-test-pipeline',
      originalImageUrl: 'https://example.com/uploaded-source.webp',
    });

    expect(result).toEqual({
      id: 'existing-cache-row-id',
      storedPHash: 'deadc0de1234beef',
      shouldTriggerStudioEdit,
      studioTriggerHandled: !shouldTriggerStudioEdit,
    });
    if (shouldTriggerStudioEdit) {
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
        studio_edit_status: 'processing',
        studio_edit_error: null,
        studio_edit_started_at: expect.any(String),
      }));
    } else {
      expect(updateMock).not.toHaveBeenCalled();
    }
  });

  it('does not return placeholder rows from getAnalysisByExactHash', async () => {
    const { getAnalysisByExactHash } = await import('./supabaseService');
    singleAfterAnalysisCacheSelectMock.mockResolvedValue({
      data: {
        analysis_json: {
          __studio_edit_placeholder: true,
          status: 'studio_processing',
        },
      },
      error: null,
    });

    await expect(getAnalysisByExactHash('deadc0de1234beef')).resolves.toBeNull();
  });

  it('reuses an existing one-bit canonical hash before upsert', async () => {
    rpcMock.mockResolvedValue({
      data: [{ p_hash: '0000000000000000' }],
      error: null,
    });

    const { cacheAnalysisResult } = await import('./supabaseService');

    const result = await cacheAnalysisResult(
      '0000000000000001',
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
        fingerprintPipeline: 'v2-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-dhash8',
        triggerStudioEdit: false,
      }
    );

    expect(result?.storedPHash).toBe('0000000000000000');
    expect(rpcMock).toHaveBeenCalledWith('find_similar_analysis_by_fingerprint', {
      new_hash: '0000000000000001',
      new_pipeline: 'v2-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-dhash8',
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_hash: '0000000000000000',
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
      })
    );
  });

  it('does not collapse writes when the matched hash is two bits away', async () => {
    rpcMock.mockResolvedValue({
      data: [{ p_hash: '0000000000000000' }],
      error: null,
    });

    const { cacheAnalysisResult } = await import('./supabaseService');

    const result = await cacheAnalysisResult(
      '0000000000000003',
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
        fingerprintPipeline: 'v2-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-dhash8',
        triggerStudioEdit: false,
      }
    );

    expect(result?.storedPHash).toBe('0000000000000003');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_hash: '0000000000000003',
      }),
      expect.objectContaining({
        onConflict: 'p_hash',
      })
    );
  });

  it('does not write ORB indexing state or trigger ORB indexing when a source image blob is available', async () => {
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
          fingerprintPipeline: 'v2-test-pipeline',
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

    const [payload] = upsertMock.mock.calls[0] ?? [];
    expect(payload).toBeTruthy();
    expect(payload).not.toHaveProperty('orb_index_status');
    expect(payload).not.toHaveProperty('orb_index_error');
    expect(payload).not.toHaveProperty('orb_index_attempted_at');
    expect(payload).not.toHaveProperty('orb_indexed_at');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves cache writes without waiting on any ORB indexing request', async () => {
    const { cacheAnalysisResult } = await import('./supabaseService');
    const originalWindow = globalThis.window;
    fetchMock.mockReset().mockRejectedValue(new Error('ORB should not be called'));

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
            fingerprintPipeline: 'v2-test-pipeline',
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
      await Promise.resolve();
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      });
    }

    expect(fetchMock).not.toHaveBeenCalled();
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
        fingerprintPipeline: 'v2-test-pipeline',
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
    analysisCacheMaybeSingleMock.mockResolvedValue({ data: null, error: null });

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
        fingerprintPipeline: 'v2-test-pipeline',
        triggerStudioEdit: false,
        persistSourceAsset: 'if_missing',
      }
    );

    const [payload] = upsertMock.mock.calls[0] ?? [];
    expect(payload).toBeTruthy();
    expect(payload.original_image_url).toBe('https://example.com/source.webp');
    expect(payload).not.toHaveProperty('orb_index_status');
  });

  it("does not write original_image_url if persistSourceAsset is 'if_missing' and the record already has an image", async () => {
    const { cacheAnalysisResult } = await import('./supabaseService');
    analysisCacheMaybeSingleMock.mockResolvedValue({ data: { original_image_url: 'https://example.com/existing.webp' }, error: null });

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
        fingerprintPipeline: 'v2-test-pipeline',
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
