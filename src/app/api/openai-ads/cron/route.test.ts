import { beforeEach, describe, expect, it, vi } from 'vitest';

const { syncCatalog } = vi.hoisted(() => ({ syncCatalog: vi.fn() }));

vi.mock('@/lib/openaiAds/feedSync', () => ({
  syncOpenAIAdsCatalog: syncCatalog,
}));

import { GET } from './route';

describe('GET /api/openai-ads/cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
    syncCatalog.mockResolvedValue({ status: 'disabled' });
  });

  it('rejects requests without the cron secret', async () => {
    const response = await GET(new Request('https://genie.ph/api/openai-ads/cron'));

    expect(response.status).toBe(401);
    expect(syncCatalog).not.toHaveBeenCalled();
  });

  it('runs the catalog sync for an authorized cron request', async () => {
    syncCatalog.mockResolvedValue({
      status: 'uploaded',
      eligibleProducts: 12,
      latestIngestion: {
        status: 'completed',
        rowsAccepted: 12,
        rowsRejected: 0,
        rowsAdsEligible: 12,
        diagnostics: [],
      },
      ingestionCheck: 'available',
    });

    const response = await GET(new Request('https://genie.ph/api/openai-ads/cron', {
      headers: { authorization: 'Bearer test-secret' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'uploaded',
      eligibleProducts: 12,
      latestIngestion: { rowsAccepted: 12, rowsRejected: 0 },
    });
    expect(syncCatalog).toHaveBeenCalledOnce();
  });

  it('returns an operational error when the enabled sync fails', async () => {
    syncCatalog.mockRejectedValue(new Error('missing configuration'));

    const response = await GET(new Request('https://genie.ph/api/openai-ads/cron', {
      headers: { authorization: 'Bearer test-secret' },
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'OpenAI Ads catalog sync failed; check server configuration and logs.',
    });
  });
});
