import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';

const submitNextImageStudioBatch = vi.fn();
const reconcileImageStudioBatch = vi.fn();

vi.mock('@/lib/admin/imageStudioBatch', () => ({
  getLatestImageStudioBatch: vi.fn(),
  getImageStudioBatchHistory: vi.fn(),
  submitNextImageStudioBatch,
  reconcileImageStudioBatch,
}));

describe('/api/admin/image-studio-batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the Vercel request context when submitting a batch', async () => {
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/admin/image-studio-batch', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-pin': ADMIN_IMAGE_STUDIO_PIN,
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
        'x-admin-pin': ADMIN_IMAGE_STUDIO_PIN,
        'x-vercel-oidc-token': 'runtime-token',
      },
      body: JSON.stringify({ runId: 'run-id' }),
    });
    reconcileImageStudioBatch.mockResolvedValue({ run: { id: 'run-id' } });

    await PATCH(req);

    expect(reconcileImageStudioBatch).toHaveBeenCalledWith('run-id', req);
  });
});
