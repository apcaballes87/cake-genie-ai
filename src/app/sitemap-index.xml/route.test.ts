import { describe, expect, it, vi } from 'vitest';

const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
const mockFrom = vi.fn((table: string) => {
  const filters: Array<[string, unknown]> = [];
  queries.push({ table, filters });
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };
  return query;
});

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: mockFrom })) }));
vi.mock('@/services/supabaseService', () => ({ getAllBlogs: vi.fn().mockResolvedValue({ data: [], error: null }) }));
vi.mock('@/lib/sitemap/indexability', () => ({
  getSitemapChunkHints: vi.fn().mockResolvedValue({
    customizedChunkCount: 1,
    customizedLastMod: null,
    sharedDesignChunkCount: 1,
    sharedDesignLastMod: '2026-05-23T00:00:00.000Z',
  }),
}));

describe('sitemap index', () => {
  it('omits unsupported lastmod dates and filters products to active merchants', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('<loc>https://genie.ph/sitemap-core.xml</loc>');
    expect(xml).toMatch(/<loc>https:\/\/genie\.ph\/sitemap-core\.xml<\/loc>\s*<\/sitemap>/);
    expect(xml).toContain('<lastmod>2026-05-23T00:00:00.000Z</lastmod>');
    expect(xml).not.toContain('undefined');
    expect(queries.find((query) => query.table === 'cakegenie_merchant_products')?.filters).toContainEqual(['cakegenie_merchants.is_active', true]);
  });
});
