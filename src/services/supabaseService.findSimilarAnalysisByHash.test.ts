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
          p_hash: 'abc123',
          analysis_json: { cakeType: 'Bento', keyword: 'lavender' },
          seo_title: 'Lavender Cake',
          seo_description: 'Known design',
          keywords: 'lavender',
          alt_text: 'Lavender cake',
          slug: 'lavender-cake-abc123',
          original_image_url: 'https://example.com/lavender.webp',
          price: 999,
          availability: 'made_to_order',
        },
      ],
      error: null,
    });

    const { findSimilarAnalysisByHash } = await import('./supabaseService');
    const result = await findSimilarAnalysisByHash('abc123');

    expect(result?.seoMetadata.slug).toBe('lavender-cake-abc123');
    expect(rpcMock).toHaveBeenCalledWith('find_similar_analysis_by_fingerprint', {
      new_hash: null,
      new_pipeline: null,
      legacy_hashes: ['abc123'],
    });
    expect(mockClient.from).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(eqMock).not.toHaveBeenCalled();
  });

  it('prefers canonical server pHash lookup when provided', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          p_hash: 'server123',
          analysis_json: { cakeType: 'Bento', keyword: 'server' },
          seo_title: 'Server Cake',
          seo_description: 'Found via server fingerprint',
          keywords: 'server',
          alt_text: 'Server cake',
          slug: 'server-cake-server123',
          original_image_url: 'https://example.com/server.webp',
          price: 1499,
          availability: 'made_to_order',
        },
      ],
      error: null,
    });

    const { findSimilarAnalysisByHash } = await import('./supabaseService');
    const result = await findSimilarAnalysisByHash({
      pHash: 'server123',
      pipeline: 'v1-test',
      legacyPHashes: ['legacy123'],
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('find_similar_analysis_by_fingerprint', {
      new_hash: 'server123',
      new_pipeline: 'v1-test',
      legacy_hashes: ['legacy123'],
    });
    expect(result?.seoMetadata.slug).toBe('server-cake-server123');
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
            p_hash: 'compat456',
            analysis_json: { cakeType: 'Bento', keyword: 'compat' },
            seo_title: 'Compat Cake',
            seo_description: 'Found via compatibility hash',
            keywords: 'compat',
            alt_text: 'Compat cake',
            slug: 'compat-cake-compat456',
            original_image_url: 'https://example.com/compat.webp',
            price: 1299,
            availability: 'made_to_order',
          },
        ],
        error: null,
      });

    const { findSimilarAnalysisByHash } = await import('./supabaseService');
    const result = await findSimilarAnalysisByHash(['primary123', 'compat456']);

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'find_similar_analysis_by_fingerprint', {
      new_hash: null,
      new_pipeline: null,
      legacy_hashes: ['primary123', 'compat456'],
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'find_similar_analysis', { new_hash: 'primary123' });
    expect(rpcMock).toHaveBeenNthCalledWith(3, 'find_similar_analysis', { new_hash: 'compat456' });
    expect(result?.seoMetadata.slug).toBe('compat-cake-compat456');
  });
});
