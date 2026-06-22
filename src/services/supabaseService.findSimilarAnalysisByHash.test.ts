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

describe('findSimilarAnalysisByHash', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    updateMock.mockReset();
    selectMock.mockReset().mockReturnValue(queryMock);
    eqMock.mockReset();
    eqMock.mockReturnValue(queryMock);
    maybeSingleMock.mockReset();
    mockClient.from.mockClear();
  });

  it('returns a similarity hit without incrementing usage_count', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'cache-row-1',
          p_hash: 'abc123def4567890',
          analysis_json: { cakeType: 'Bento', keyword: 'lavender' },
          seo_title: 'Lavender Cake',
          seo_description: 'Known design',
          keywords: 'lavender',
          alt_text: 'Lavender cake',
          slug: 'lavender-cake-abc123de',
          original_image_url: 'https://example.com/lavender.webp',
          price: 999,
          availability: 'made_to_order',
        },
      ],
      error: null,
    });

    const { findSimilarAnalysisByHash } = await import('./supabaseService');
    const result = await findSimilarAnalysisByHash({
      pHash: 'abc123def4567890',
      pipeline: 'v2-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-dhash8',
    });

    expect(result?.seoMetadata.slug).toBe('lavender-cake-abc123de');
    expect(result?.id).toBe('cache-row-1');
    expect(rpcMock).toHaveBeenCalledWith('find_similar_analysis_by_fingerprint', {
      new_hash: 'abc123def4567890',
      new_pipeline: 'v2-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-dhash8',
    });
    expect(mockClient.from).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(eqMock).not.toHaveBeenCalled();
  });

  it('prefers canonical server pHash lookup when provided', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'cache-row-2',
          p_hash: 'deadbeef1234abcd',
          analysis_json: { cakeType: 'Bento', keyword: 'server' },
          seo_title: 'Server Cake',
          seo_description: 'Found via server fingerprint',
          keywords: 'server',
          alt_text: 'Server cake',
          slug: 'server-cake-deadbeef',
          original_image_url: 'https://example.com/server.webp',
          price: 1499,
          availability: 'made_to_order',
        },
      ],
      error: null,
    });

    const { findSimilarAnalysisByHash } = await import('./supabaseService');
    const result = await findSimilarAnalysisByHash({
      pHash: 'deadbeef1234abcd',
      pipeline: 'v1-test',
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(result?.id).toBe('cache-row-2');
    expect(rpcMock).toHaveBeenCalledWith('find_similar_analysis_by_fingerprint', {
      new_hash: 'deadbeef1234abcd',
      new_pipeline: 'v1-test',
    });
    expect(result?.seoMetadata.slug).toBe('server-cake-deadbeef');
  });

  it('drops malformed non-hex hashes before calling the RPCs', async () => {
    rpcMock.mockResolvedValue({
      data: [],
      error: null,
    });

    const { findSimilarAnalysisByHash } = await import('./supabaseService');
    const result = await findSimilarAnalysisByHash({
      pHash: 'not-a-real-phash',
      pipeline: 'v1-test',
    });

    expect(rpcMock).toHaveBeenCalledTimes(0);
    expect(result).toBeNull();
  });

  it('looks up saved hashes by exact p_hash without a legacy pipeline fallback', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
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
    expect(result?.seoMetadata.slug).toBe('exact-cake-abc123');
    expect(rpcMock).not.toHaveBeenCalled();
    expect(mockClient.from).toHaveBeenCalledWith('cakegenie_analysis_cache');
    expect(eqMock).toHaveBeenCalledWith('p_hash', 'abc123def4567890');
  });
});
