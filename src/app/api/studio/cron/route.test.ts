import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runWorker } = vi.hoisted(() => ({ runWorker: vi.fn() }));

vi.mock('@/lib/admin/delayedImageStudio', () => ({
  runDelayedImageStudioWorker: runWorker,
}));

import { GET } from './route';

describe('GET /api/studio/cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
    runWorker.mockResolvedValue({
      status: 'idle',
      runId: 'run-1',
      claimed: 0,
      completed: 0,
      retryable: 0,
      failed: 0,
      skipped: 0,
    });
  });

  it('rejects requests without the cron secret', async () => {
    const response = await GET(new Request('http://localhost/api/studio/cron'));
    expect(response.status).toBe(401);
    expect(runWorker).not.toHaveBeenCalled();
  });

  it('runs the delayed worker with the configured batch limit', async () => {
    vi.stubEnv('DELAYED_STUDIO_BATCH_LIMIT', '3');
    const response = await GET(new Request('http://localhost/api/studio/cron', {
      headers: { authorization: 'Bearer test-secret' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'idle' });
    expect(runWorker).toHaveBeenCalledWith(expect.any(Request), { limit: 3 });
  });
});
