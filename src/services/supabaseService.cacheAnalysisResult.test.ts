import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HybridAnalysisResult } from '@/types';

const upsertMock = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn();

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
  rpc: vi.fn(),
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
});
