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
    expect(mockClient.from).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(eqMock).not.toHaveBeenCalled();
  });
});