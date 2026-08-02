import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockSearchCakeAnalysisResults = vi.fn();
const mockReplaceCakeAnalysisByHash = vi.fn();
const mockRequireChatbotStaff = vi.fn();

vi.mock('@/lib/chatbot/adminAuth', () => ({
  requireChatbotStaff: (...args: unknown[]) => mockRequireChatbotStaff(...args),
  adminCorsHeaders: (_request: NextRequest, methods: string[]) => ({
    'Access-Control-Allow-Origin': 'http://localhost',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': [...methods, 'OPTIONS'].join(', '),
  }),
}));

vi.mock('@/lib/admin/cakeAnalysisSearch', () => ({
  CakeAnalysisSearchError: class CakeAnalysisSearchError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  searchCakeAnalysisResults: (...args: unknown[]) => mockSearchCakeAnalysisResults(...args),
  replaceCakeAnalysisByHash: (...args: unknown[]) => mockReplaceCakeAnalysisByHash(...args),
}));

describe('/api/admin/cake-analysis-search', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSearchCakeAnalysisResults.mockReset();
    mockReplaceCakeAnalysisByHash.mockReset();
    mockRequireChatbotStaff.mockReset();
    mockRequireChatbotStaff.mockResolvedValue({
      staff: { role: 'admin', user: { id: 'staff-id' }, database: {} },
      error: null,
      status: 200,
    });
  });

  it('rejects requests without an authenticated staff session', async () => {
    mockRequireChatbotStaff.mockResolvedValue({ staff: null, error: 'Authentication required', status: 401 });
    const { GET } = await import('./route');
    const response = await GET(new NextRequest('http://localhost/api/admin/cake-analysis-search?q=birthday'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required' });
    expect(mockSearchCakeAnalysisResults).not.toHaveBeenCalled();
  });

  it('returns the ranked search contract with bounded pagination', async () => {
    mockSearchCakeAnalysisResults.mockResolvedValue({ data: [{ p_hash: 'abc' }], total: 31 });
    const { GET } = await import('./route');
    const request = new NextRequest('http://localhost/api/admin/cake-analysis-search?q=birthday&limit=100&offset=30', {
      headers: { authorization: 'Bearer staff-token' },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ p_hash: 'abc' }],
      total: 31,
      query: 'birthday',
      limit: 30,
      offset: 30,
    });
    expect(mockSearchCakeAnalysisResults).toHaveBeenCalledWith('birthday', 30, 30);
  });

  it('requires a pHash for analysis replacement', async () => {
    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/admin/cake-analysis-search', {
      method: 'POST',
      headers: { authorization: 'Bearer staff-token', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Missing required field: pHash' });
    expect(mockReplaceCakeAnalysisByHash).not.toHaveBeenCalled();
  });

  it('returns the updated item and forwards the request context', async () => {
    mockReplaceCakeAnalysisByHash.mockResolvedValue({
      p_hash: 'abc',
      slug: 'birthday-cake',
      price: 1299,
      analysis_json: { cakeType: '1 Tier' },
      promptVersion: '3.32',
    });
    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/admin/cake-analysis-search', {
      method: 'POST',
      headers: { authorization: 'Bearer staff-token', 'content-type': 'application/json' },
      body: JSON.stringify({ pHash: 'abc' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      updated: true,
      item: {
        p_hash: 'abc',
        slug: 'birthday-cake',
        price: 1299,
        analysis_json: { cakeType: '1 Tier' },
        promptVersion: '3.32',
      },
    });
    expect(mockReplaceCakeAnalysisByHash).toHaveBeenCalledWith('abc', request);
  });

  it('allows Authorization in CORS preflight responses', async () => {
    const { OPTIONS } = await import('./route');
    const response = await OPTIONS(new NextRequest('http://localhost/api/admin/cake-analysis-search', { method: 'OPTIONS' }));

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toBe('Authorization, Content-Type');
  });
});
