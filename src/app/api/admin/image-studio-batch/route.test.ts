import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const submitNextImageStudioBatch = vi.fn();
const reconcileImageStudioBatch = vi.fn();
const mockRequireChatbotStaff = vi.fn();

vi.mock('@/lib/chatbot/adminAuth', () => ({
  requireChatbotStaff: (...args: unknown[]) => mockRequireChatbotStaff(...args),
  forwardStaffAuthHeaders: (request: NextRequest) => ({
    Authorization: request.headers.get('authorization') || '',
  }),
}));

vi.mock('@/lib/admin/imageStudioBatch', () => ({
  getLatestImageStudioBatch: vi.fn(),
  getImageStudioBatchHistory: vi.fn(),
  submitNextImageStudioBatch,
  reconcileImageStudioBatch,
}));

describe('/api/admin/image-studio-batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireChatbotStaff.mockResolvedValue({
      staff: { role: 'admin', user: { id: 'staff-id' }, database: {} },
      error: null,
      status: 200,
    });
  });

  it('rejects an unauthenticated batch request', async () => {
    mockRequireChatbotStaff.mockResolvedValue({ staff: null, error: 'Authentication required', status: 401 });
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/admin/image-studio-batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 12 }),
    });

    const response = await POST(req);

    expect(response.status).toBe(401);
    expect(submitNextImageStudioBatch).not.toHaveBeenCalled();
  });

  it('forwards the Vercel request context when submitting a batch', async () => {
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/admin/image-studio-batch', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer staff-token',
        'x-vercel-oidc-token': 'runtime-token',
      },
      body: JSON.stringify({ limit: 12 }),
    });
    submitNextImageStudioBatch.mockResolvedValue({ id: 'run-id' });

    await POST(req);

    expect(submitNextImageStudioBatch).toHaveBeenCalledWith(12, req, {
      selectionMode: 'pending',
      offset: 0,
    });
  });

  it('forwards the Vercel request context when refreshing a batch', async () => {
    const { PATCH } = await import('./route');
    const req = new NextRequest('http://localhost/api/admin/image-studio-batch', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer staff-token',
        'x-vercel-oidc-token': 'runtime-token',
      },
      body: JSON.stringify({ runId: 'run-id' }),
    });
    reconcileImageStudioBatch.mockResolvedValue({ run: { id: 'run-id' } });

    await PATCH(req);

    expect(reconcileImageStudioBatch).toHaveBeenCalledWith('run-id', req);
  });
});
