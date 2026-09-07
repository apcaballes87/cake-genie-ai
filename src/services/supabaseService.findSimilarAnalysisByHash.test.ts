import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const maybeSingleMock = vi.fn();

const queryMock = {
  update: updateMock,
  select: selectMock,
  eq: eqMock,
  maybeSingle: maybeSingleMock,
};

const mockClient = {
  rpc: rpcMock,
  from: vi.fn(() => queryMock),
};

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mockClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}));

const pdqHash = 'ab'.repeat(32);

describe('findSimilarAnalysisByHash', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    updateMock.mockReset();
    selectMock.mockReset().mockReturnValue(queryMock);
    eqMock.mockReset().mockReturnValue(queryMock);
    maybeSingleMock.mockReset();
    mockClient.from.mockClear();
  });

  it('uses the PDQ RPC with quality, pipeline, and the initial distance threshold', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        seo_status: 'published',
        id: 'cache-row-1',
        p_hash: 'abc123def4567890',
        pdq_hash: pdqHash,
        pdq_quality: 92,
        pdq_pipeline: 'pdq-test',
        analysis_json: { cakeType: 'Bento', keyword: 'lavender' },
        seo_title: 'Lavender Cake',
        seo_description: 'Known design',
        keywords: 'lavender',
        alt_text: 'Lavender cake',
        slug: 'lavender-cake-abc123de',
        original_image_url: 'https://example.com/lavender.webp',
        price: 999,
        availability: 'made_to_order',
      }],
      error: null,
    });

    const { findSimilarAnalysisByHash } = await import('./supabaseService');
    const result = await findSimilarAnalysisByHash({
      pdqHash,
      pdqQuality: 92,
      pdqPipeline: 'pdq-test',
    });

    expect(result?.seoMetadata.slug).toBe('lavender-cake-abc123de');
    expect(result?.pdqHash).toBe(pdqHash);
    expect(rpcMock).toHaveBeenCalledWith('find_similar_analysis_by_pdq', {
      new_hash: pdqHash,
      new_quality: 92,
      new_pipeline: 'pdq-test',
      max_distance: 35,
      min_quality: 50,
    });
  });

  it('fails closed for malformed, low-quality, or incomplete PDQ inputs', async () => {
    const { findSimilarAnalysisByHash } = await import('./supabaseService');

    expect(await findSimilarAnalysisByHash({ pdqHash: 'not-a-hash', pdqQuality: 90, pdqPipeline: 'pdq-test' })).toBeNull();
    expect(await findSimilarAnalysisByHash({ pdqHash, pdqQuality: 49, pdqPipeline: 'pdq-test' })).toBeNull();
    expect(await findSimilarAnalysisByHash({ pdqHash, pdqQuality: 90, pdqPipeline: null })).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('keeps exact legacy p_hash lookup available for saved references', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        seo_status: 'published',
        id: 'cache-row-exact',
        p_hash: 'abc123def4567890',
        analysis_json: { cakeType: 'Bento', keyword: 'exact' },
        seo_title: 'Exact Cake',
        seo_description: 'Found exactly',
        keywords: 'exact',
        alt_text: 'Exact cake',
        slug: 'exact-cake-abc123',
        original_image_url: 'https://example.com/exact.webp',
        price: 1200,
        availability: 'made_to_order',
      },
      error: null,
    });

    const { findAnalysisByExactHash } = await import('./supabaseService');
    const result = await findAnalysisByExactHash('ABC123DEF4567890');

    expect(result?.id).toBe('cache-row-exact');
    expect(mockClient.from).toHaveBeenCalledWith('cakegenie_analysis_cache');
    expect(eqMock).toHaveBeenCalledWith('p_hash', 'abc123def4567890');
  });
});
