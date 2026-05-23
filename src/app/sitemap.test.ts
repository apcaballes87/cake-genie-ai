import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCollections = [
  {
    slug: 'surprise-collection',
    created_at: '2026-05-19T10:00:00.000Z',
    sample_image: 'https://example.com/surprise.webp',
    item_count: 4,
  },
];

const mockFrom = vi.fn((table: string) => {
  if (table === 'cakegenie_collections') {
    return {
      select: vi.fn(() => ({
        gt: vi.fn(() => ({
          returns: vi.fn().mockResolvedValue({
            data: mockCollections,
            error: null,
          }),
        })),
      })),
    };
  }

  throw new Error(`Unexpected table: ${table}`);
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/services/supabaseService', () => ({
  getAllBlogSlugs: vi.fn(),
}));

vi.mock('@/components/local-seo/cebuLandingData', () => ({
  LOCAL_SEO_ROUTES: [],
}));

vi.mock('@/lib/sitemap/indexability', () => ({
  getIndexableCustomizedCakeRows: vi.fn(),
  getIndexableSharedDesignRows: vi.fn(),
  SITEMAP_CHUNK_SIZE: 5000,
}));

describe('sitemap collections routes', () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it('builds collection sitemap entries from the collections table automatically', async () => {
    const { default: sitemap } = await import('./sitemap');

    const entries = await sitemap({ id: 0 });

    expect(mockFrom).toHaveBeenCalledWith('cakegenie_collections');
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://genie.ph/services',
        }),
        expect.objectContaining({
          url: 'https://genie.ph/reviews',
        }),
        expect.objectContaining({
          url: 'https://genie.ph/collections/surprise-collection',
          images: ['https://example.com/surprise.webp'],
          priority: 0.85,
        }),
      ]),
    );
  });
});
