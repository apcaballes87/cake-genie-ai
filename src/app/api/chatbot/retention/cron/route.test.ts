import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: 4, error: null }),
  }),
}));

import { GET } from './route';

describe('chatbot retention cron', () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('rejects requests without the cron secret', async () => {
    process.env.CRON_SECRET = 'expected';
    const response = await GET(new Request('https://genie.ph/api/chatbot/retention/cron'));
    expect(response.status).toBe(401);
  });

  it('minimizes expired run payloads', async () => {
    process.env.CRON_SECRET = 'expected';
    const response = await GET(new Request('https://genie.ph/api/chatbot/retention/cron', {
      headers: { authorization: 'Bearer expected' },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ minimized: 4 });
  });
});
