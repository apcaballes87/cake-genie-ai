import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRunActiveCakeAnalysis = vi.fn();
const mockCacheAnalysisResult = vi.fn();
const mockStorageUpload = vi.fn();
const mockRpc = vi.fn();

const mockSupabase = {
  rpc: mockRpc,
  storage: {
    from: vi.fn(() => ({
      upload: mockStorageUpload,
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn.example/cake.webp' } })),
    })),
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}));

vi.mock('@/lib/ai/analyzeCakeImage', () => ({
  runActiveCakeAnalysis: (...args: unknown[]) => mockRunActiveCakeAnalysis(...args),
}));

vi.mock('@/services/supabaseService', () => ({
  cacheAnalysisResult: (...args: unknown[]) => mockCacheAnalysisResult(...args),
}));

vi.mock('@/lib/server/imageFingerprint', () => ({
  computeImageFingerprint: vi.fn(async () => ({
    pHash: 'abcdef1234567890',
    pipeline: 'server-v1',
  })),
}));

vi.mock('@/lib/utils/imageHash', () => ({
  convertToWebPBuffer: vi.fn(async () => Buffer.from('converted-webp')),
}));

describe('POST /api/ai/analyze-url', () => {
  beforeEach(() => {
    vi.resetModules();
    mockRunActiveCakeAnalysis.mockReset();
    mockCacheAnalysisResult.mockReset();
    mockStorageUpload.mockReset();
    mockRpc.mockReset().mockResolvedValue({ data: [], error: null });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from('image'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    })));
  });

  it('uses the shared runner and returns a rejection before cache upload or persistence', async () => {
    const rejectedResult = {
      cakeType: '',
      cakeThickness: '',
      main_toppers: [],
      support_elements: [],
      cake_messages: [],
      icing_design: {
        base: 'soft_icing',
        color_type: 'single',
        colors: { side: '#FFFFFF', top: '#FFFFFF' },
        drip: false,
        border_top: false,
        border_base: false,
        gumpasteBaseBoard: false,
      },
      keyword: '',
      alt_text: '',
      seo_title: '',
      seo_description: '',
      rejection: {
        isRejected: true,
        reason: 'not_a_cake',
        message: "This image doesn't appear to be a cake. Please upload a cake image.",
      },
    };
    mockRunActiveCakeAnalysis.mockResolvedValue({
      result: rejectedResult,
      promptVersion: '3.35',
    });

    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/ai/analyze-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://images.unsplash.com/cake.jpg' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      analysis_json: rejectedResult,
      image_url: 'https://images.unsplash.com/cake.jpg',
      cached: false,
    });
    expect(mockRunActiveCakeAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: 'image/webp',
      sourceContext: 'url-analysis:abcdef1234567890',
      sourceRoute: 'api/ai/analyze-url',
      persistRejectedUpload: false,
    }));
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockCacheAnalysisResult).not.toHaveBeenCalled();
  });
});
