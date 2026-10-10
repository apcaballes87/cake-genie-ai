import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllBlogsMock = vi.fn().mockResolvedValue({
  data: [{ slug: 'birthday-guide', keywords: 'birthday cake Cebu', date: '2026-05-01', updated_at: '2026-05-10' }],
  error: null,
});
const getAllBlogSlugsMock = vi.fn().mockResolvedValue({ data: [], error: null });
const getSitemapChunkHintsMock = vi.fn().mockResolvedValue({
  customizedChunkCount: 2,
  sharedDesignChunkCount: 1,
});

const mockRows: Record<string, unknown[]> = {
  cakegenie_collections: [
    { slug: 'surprise-collection', published_at: '2026-05-19T10:00:00.000Z', sample_image: 'https://example.com/surprise.webp', item_count: 8, publication_status: 'published', is_indexable: true },
    { slug: 'draft-collection', published_at: null, sample_image: null, item_count: 12, publication_status: 'draft', is_indexable: true },
    { slug: 'small-collection', published_at: null, sample_image: null, item_count: 4, publication_status: 'published', is_indexable: true },
  ],
  cakegenie_merchants: [],
  cakegenie_merchant_products: [],
};
const queryCalls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
const mockFrom = vi.fn((table: string) => {
  const filters: Array<[string, unknown]> = [];
  queryCalls.push({ table, filters });
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
    gte: vi.fn(() => query),
    returns: vi.fn(async () => ({ data: mockRows[table] || [], error: null })),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: mockRows[table] || [], error: null }).then(resolve),
  };
  return query;
});

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: mockFrom })) }));
vi.mock('@/services/supabaseService', () => ({ getAllBlogs: getAllBlogsMock, getAllBlogSlugs: getAllBlogSlugsMock }));
vi.mock('@/components/local-seo/cebuLandingData', () => ({ LOCAL_SEO_ROUTES: [] }));
vi.mock('@/lib/sitemap/indexability', () => ({ getSitemapChunkHints: getSitemapChunkHintsMock, SITEMAP_CHUNK_SIZE: 5000 }));

describe('sitemap publication rules', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    queryCalls.length = 0;
    mockRows.cakegenie_merchants = [];
    mockRows.cakegenie_merchant_products = [];
    getAllBlogsMock.mockClear();
    getAllBlogSlugsMock.mockClear();
    getSitemapChunkHintsMock.mockClear();
  });

  it('lists only published collections and populated blog categories', async () => {
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap({ id: 0 });
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://genie.ph/collections/surprise-collection');
    expect(urls).not.toContain('https://genie.ph/collections/draft-collection');
    expect(urls).not.toContain('https://genie.ph/collections/small-collection');
    expect(urls).toContain('https://genie.ph/blog/category/birthday-cakes');
    expect(urls).toContain('https://genie.ph/blog/category/cebu-cakes');
    expect(urls).not.toContain('https://genie.ph/blog/category/wedding-cakes');
    expect(urls.some((url) => url.includes('/customizing/category/'))).toBe(false);
    expect(entries.find((entry) => entry.url.endsWith('/collections/surprise-collection'))).toEqual(
      expect.objectContaining({ images: ['https://example.com/surprise.webp'], priority: 0.85 }),
    );
  });

  it('includes canonical public routes without invented static modification dates', async () => {
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap({ id: 0 });
    for (const path of ['/coldcaking', '/delivery-rates', '/payment-options', '/price-list', '/investors', '/compare/genie-ph-vs-caramia']) {
      expect(entries.some((entry) => entry.url === 'https://genie.ph' + path)).toBe(true);
    }
    expect(entries.find((entry) => entry.url === 'https://genie.ph')).not.toHaveProperty('lastModified');
    expect(entries.find((entry) => entry.url === 'https://genie.ph/blog/category/birthday-cakes')?.lastModified).toEqual(new Date('2026-05-10'));
  });

  it('filters product URLs to active merchants and omits missing modification dates', async () => {
    mockRows.cakegenie_merchant_products = [
      { slug: 'red-cake', updated_at: null, image_url: 'https://example.com/cake.webp', cakegenie_merchants: { slug: 'active-baker', is_active: true } },
    ];
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap({ id: 2 });
    expect(queryCalls.find((call) => call.table === 'cakegenie_merchant_products')?.filters).toContainEqual(['cakegenie_merchants.is_active', true]);
    expect(entries).toEqual([expect.objectContaining({ url: 'https://genie.ph/shop/active-baker/red-cake' })]);
    expect(entries[0]).not.toHaveProperty('lastModified');
  });

  it('derives dynamic sitemap chunk ids from lightweight chunk hints', async () => {
    const { generateSitemaps } = await import('./sitemap');
    const ids = await generateSitemaps();
    expect(getSitemapChunkHintsMock).toHaveBeenCalledTimes(1);
    expect(ids).toEqual(expect.arrayContaining([
      { id: 0 }, { id: 1 }, { id: 2 }, { id: 3 },
      { id: 'customized-cakes-0' }, { id: 'customized-cakes-1' }, { id: 'designs-0' },
    ]));
  });
});
