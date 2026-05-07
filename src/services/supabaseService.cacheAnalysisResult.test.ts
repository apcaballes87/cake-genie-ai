import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HybridAnalysisResult } from '@/types';

const upsertMock = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();

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

const analysisCacheQuery = {
  upsert: upsertMock,
};

const mockClient = {
  rpc: rpcMock,
  from: fromMock,
  storage: {
    from: vi.fn(),
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
  getDesignAvailability: () => ['made_to_order'],
}));

vi.mock('@/utils/tagUtils', () => ({
  generateTagsForAnalysis: () => ['fingerprint'],
}));

vi.mock('./indexNowService', () => ({
  notifyIndexNow: vi.fn(),
}));

describe('cacheAnalysisResult', () => {
  beforeEach(() => {
    upsertMock.mockReset().mockResolvedValue({ error: null });
    maybeSingleMock.mockReset().mockResolvedValue({ data: { price: 999 }, error: null });
    rpcMock.mockReset().mockResolvedValue({ data: [], error: null });
    fromMock.mockReset().mockImplementation((table: string) => {
      if (table === 'productsizes_cakegenie') return productSizesQuery;
      if (table === 'cakegenie_analysis_cache') return analysisCacheQuery;
      return analysisCacheQuery;
    });
  });

  it('stores fingerprint pipeline metadata with the canonical p_hash', async () => {
    const { cacheAnalysisResult } = await import('./supabaseService');

    await cacheAnalysisResult(
      'serverabc1234567',
      {
        cakeType: 'Bento',
        cakeThickness: '4 in',
        keyword: 'lavender',
        icing_design: {
          base: 'soft_icing',
          colors: { top: 'purple', side: 'white' },
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

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        p_hash: 'serverabc1234567',
        fingerprint_pipeline: 'v1-test-pipeline',
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

    await cacheAnalysisResult(
      'ff4f040c0703c7bf',
      {
        cakeType: 'Bento',
        cakeThickness: '4 in',
        keyword: 'roblox',
        icing_design: {
          base: 'soft_icing',
          colors: { top: 'blue', side: 'white' },
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
});
