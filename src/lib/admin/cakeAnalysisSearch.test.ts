import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunActiveCakeAnalysis = vi.fn();
const mockCreateAdminServerSupabaseClient = vi.fn();
const mockSearchProductsFTS = vi.fn();
const mockSearchProductsFTSCount = vi.fn();

vi.mock('@/lib/ai/analyzeCakeImage', () => ({
  runActiveCakeAnalysis: (...args: unknown[]) => mockRunActiveCakeAnalysis(...args),
}));

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: () => mockCreateAdminServerSupabaseClient(),
}));

vi.mock('@/services/supabaseService', () => ({
  searchProductsFTS: (...args: unknown[]) => mockSearchProductsFTS(...args),
  searchProductsFTSCount: (...args: unknown[]) => mockSearchProductsFTSCount(...args),
}));

describe('cake analysis search server helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    mockRunActiveCakeAnalysis.mockReset();
    mockCreateAdminServerSupabaseClient.mockReset();
    mockSearchProductsFTS.mockReset();
    mockSearchProductsFTSCount.mockReset();
    vi.restoreAllMocks();
  });

  it('uses the same ranked search services and returns the result count', async () => {
    mockSearchProductsFTS.mockResolvedValue({
      data: [{
        slug: 'birthday-cake',
        keywords: 'Birthday Cake',
        original_image_url: 'https://example.com/cake.jpg',
        price: '1299',
        alt_text: 'Birthday cake',
        usage_count: 4,
        p_hash: 'abc',
        availability: 'normal',
        analysis_json: { cakeType: '1 Tier' },
        image_width: 600,
        image_height: 600,
        rank_score: 5.5,
      }],
      error: null,
    });
    mockSearchProductsFTSCount.mockResolvedValue(1);
    const { searchCakeAnalysisResults } = await import('./cakeAnalysisSearch');

    await expect(searchCakeAnalysisResults('birthday cake', 30, 0)).resolves.toEqual({
      data: [expect.objectContaining({ p_hash: 'abc', price: 1299, slug: 'birthday-cake' })],
      total: 1,
    });
    expect(mockSearchProductsFTS).toHaveBeenCalledWith('birthday cake', 30, 0);
    expect(mockSearchProductsFTSCount).toHaveBeenCalledWith('birthday cake');
  });

  it('writes exactly analysis_json and leaves the other cache fields to the database', async () => {
    const originalAnalysis = { cakeType: '1 Tier', keyword: 'Birthday Cake' };
    const newAnalysis = { cakeType: '2 Tier', keyword: 'Birthday Cake' };
    const lookupChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          p_hash: 'abc',
          slug: 'birthday-cake',
          price: 1299,
          original_image_url: 'https://example.com/cake.jpg',
        },
        error: null,
      }),
    };
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { p_hash: 'abc', slug: 'birthday-cake', price: 1299, analysis_json: newAnalysis },
        error: null,
      }),
    };
    const from = vi.fn().mockReturnValueOnce(lookupChain).mockReturnValueOnce(updateChain);
    mockCreateAdminServerSupabaseClient.mockReturnValue({ from });
    mockRunActiveCakeAnalysis.mockResolvedValue({ result: newAnalysis, promptVersion: '3.32' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    })));
    const { replaceCakeAnalysisByHash } = await import('./cakeAnalysisSearch');

    await expect(replaceCakeAnalysisByHash('abc', new Request('http://localhost'))).resolves.toEqual({
      p_hash: 'abc',
      slug: 'birthday-cake',
      price: 1299,
      analysis_json: newAnalysis,
      promptVersion: '3.32',
    });
    expect(mockRunActiveCakeAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: 'image/jpeg',
      sourceContext: 'admin-cake-analysis-search:abc',
    }));
    expect(updateChain.update).toHaveBeenCalledWith({ analysis_json: newAnalysis });
    expect(Object.keys(updateChain.update.mock.calls[0][0])).toEqual(['analysis_json']);
    expect(originalAnalysis).not.toEqual(newAnalysis);
  });

  it('does not run AI or update when the cache row is missing', async () => {
    const lookupChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockCreateAdminServerSupabaseClient.mockReturnValue({ from: vi.fn().mockReturnValue(lookupChain) });
    const { replaceCakeAnalysisByHash, CakeAnalysisSearchError } = await import('./cakeAnalysisSearch');

    await expect(replaceCakeAnalysisByHash('missing', new Request('http://localhost'))).rejects.toMatchObject({
      name: 'CakeAnalysisSearchError',
      status: 404,
    });
    expect(mockRunActiveCakeAnalysis).not.toHaveBeenCalled();
  });
});
