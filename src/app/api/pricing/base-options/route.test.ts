import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const from = vi.fn();

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: () => ({ from }),
}));

function setPriceQueryResult(rows: Array<{ cakesize: string; price: number; display_order: number }>) {
  const query = {
    eq: vi.fn(),
    order: vi.fn(),
  };
  query.eq.mockReturnValue(query);
  query.order
    .mockReturnValueOnce(query)
    .mockResolvedValueOnce({ data: rows, error: null });
  from.mockReturnValue({ select: vi.fn(() => query) });
}

describe('GET /api/pricing/base-options', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('CAKES_AND_MEMORIES_PRICING_ENABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses Genie pricing while the C&M toggle is off', async () => {
    setPriceQueryResult([{ cakesize: '6" Round', price: 1199, display_order: 1 }]);
    const { GET } = await import('./route');

    const response = await GET(new NextRequest(
      'http://localhost/api/pricing/base-options?catalog=cakes_and_memories&type=1%20Tier&thickness=3%20in',
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      catalog: 'genie',
      options: [{ size: '6" Round', price: 1199 }],
    });
    expect(from).toHaveBeenCalledWith('productsizes_cakegenie');
  });

  it('uses the separate catalog only when the server toggle is true', async () => {
    vi.stubEnv('CAKES_AND_MEMORIES_PRICING_ENABLED', 'true');
    setPriceQueryResult([{ cakesize: '6" Round', price: 1299, display_order: 1 }]);
    const { GET } = await import('./route');

    const response = await GET(new NextRequest(
      'http://localhost/api/pricing/base-options?catalog=cakes_and_memories&type=1%20Tier&thickness=3%20in',
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      catalog: 'cakes_and_memories',
      options: [{ size: '6" Round', price: 1299 }],
    });
    expect(from).toHaveBeenCalledWith('productsizes_cakesandmemories');
  });

  it('rejects incomplete lookup parameters before querying Supabase', async () => {
    const { GET } = await import('./route');

    const response = await GET(new NextRequest(
      'http://localhost/api/pricing/base-options?catalog=cakes_and_memories&type=1%20Tier',
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'type and thickness are required.' });
    expect(from).not.toHaveBeenCalled();
  });
});
