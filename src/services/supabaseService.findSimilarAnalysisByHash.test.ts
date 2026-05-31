import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();

const mockClient = {
  rpc: rpcMock,
  from: vi.fn(() => ({
    update: updateMock,
    eq: eqMock,
  })),
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
    eqMock.mockReset();
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
    const result = await findSimilarAnalysisByHash('abc123def4567890');

    expect(result?.seoMetadata.slug).toBe('lavender-cake-abc123de');
    expect(result?.id).toBe('cache-row-1');
    expect(rpcMock).toHaveBeenCalledWith('find_similar_analysis_by_fingerprint', {
      new_hash: null,
      new_pipeline: null,
      legacy_hashes: ['abc123def4567890'],
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
      legacyPHashes: ['feedface5678dcba'],
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(result?.id).toBe('cache-row-2');
    expect(rpcMock).toHaveBeenCalledWith('find_similar_analysis_by_fingerprint', {
      new_hash: 'deadbeef1234abcd',
      new_pipeline: 'v1-test',
      legacy_hashes: ['feedface5678dcba'],
    });
    expect(result?.seoMetadata.slug).toBe('server-cake-deadbeef');
  });

  it('retries compatibility hashes until one matches', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'function not found' },
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'cache-row-3',
            p_hash: 'facefeed9876abcd',
            analysis_json: { cakeType: 'Bento', keyword: 'compat' },
            seo_title: 'Compat Cake',
            seo_description: 'Found via compatibility hash',
            keywords: 'compat',
            alt_text: 'Compat cake',
            slug: 'compat-cake-facefeed',
            original_image_url: 'https://example.com/compat.webp',
            price: 1299,
            availability: 'made_to_order',
          },
        ],
        error: null,
      });

    const { findSimilarAnalysisByHash } = await import('./supabaseService');
    const result = await findSimilarAnalysisByHash(['1234567890abcdef', 'facefeed9876abcd']);

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'find_similar_analysis_by_fingerprint', {
      new_hash: null,
      new_pipeline: null,
      legacy_hashes: ['1234567890abcdef', 'facefeed9876abcd'],
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'find_similar_analysis', { new_hash: '1234567890abcdef' });
    expect(rpcMock).toHaveBeenNthCalledWith(3, 'find_similar_analysis', { new_hash: 'facefeed9876abcd' });
    expect(result?.seoMetadata.slug).toBe('compat-cake-facefeed');
    expect(result?.id).toBe('cache-row-3');
  });

  it('drops malformed non-hex hashes before calling the RPCs', async () => {
    rpcMock.mockResolvedValue({
      data: [],
      error: null,
    });

    const { findSimilarAnalysisByHash } = await import('./supabaseService');
    await findSimilarAnalysisByHash({
      pHash: 'not-a-real-phash',
      pipeline: 'v1-test',
      legacyPHashes: ['p123', 'abcdef1234567890'],
    });

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'find_similar_analysis_by_fingerprint', {
      new_hash: null,
      new_pipeline: 'v1-test',
      legacy_hashes: ['abcdef1234567890'],
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'find_similar_analysis', {
      new_hash: 'abcdef1234567890',
    });
  });
});
