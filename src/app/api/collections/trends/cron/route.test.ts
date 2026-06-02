import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: vi.fn(),
}));

describe('collection trend cron', () => {
  it('rejects requests without the cron secret', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    const { GET } = await import('./route');

    const response = await GET(new Request('https://genie.ph/api/collections/trends/cron'));

    expect(response.status).toBe(401);
  });
});
