import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCollections = [
  {
    slug: 'surprise-collection',
    created_at: '2026-05-19T10:00:00.000Z',
    sample_image: 'https://example.com/surprise.webp',
    item_count: 8,
    publication_status: 'published',
    is_indexable: true,
  },
];

const getIndexableCustomizedCakeRowsMock = vi.fn();
const getIndexableSharedDesignRowsMock = vi.fn();
const getSitemapChunkHintsMock = vi.fn().mockResolvedValue({
  customizedChunkCount: 2,
  customizedLastMod: '2026-05-24T00:00:00.000Z',
  sharedDesignChunkCount: 1,
  sharedDesignLastMod: '2026-05-23T00:00:00.000Z',
});

const mockFrom = vi.fn((table: string) => {
  if (table === 'cakegenie_collections') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              returns: vi.fn().mockResolvedValue({
                data: mockCollections,
                error: null,
              }),
            })),
          })),
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
  getIndexableCustomizedCakeRows: getIndexableCustomizedCakeRowsMock,
  getIndexableSharedDesignRows: getIndexableSharedDesignRowsMock,
  getSitemapChunkHints: getSitemapChunkHintsMock,
  SITEMAP_CHUNK_SIZE: 5000,
}));

describe('sitemap collections routes', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    getIndexableCustomizedCakeRowsMock.mockClear();
    getIndexableSharedDesignRowsMock.mockClear();
    getSitemapChunkHintsMock.mockClear();
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

  it('derives dynamic sitemap chunk ids from lightweight chunk hints', async () => {
    const { generateSitemaps } = await import('./sitemap');

    const ids = await generateSitemaps();

    expect(getSitemapChunkHintsMock).toHaveBeenCalledTimes(1);
    expect(getIndexableCustomizedCakeRowsMock).not.toHaveBeenCalled();
    expect(getIndexableSharedDesignRowsMock).not.toHaveBeenCalled();
    expect(ids).toEqual(
      expect.arrayContaining([
        { id: 0 },
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 'customized-cakes-0' },
        { id: 'customized-cakes-1' },
        { id: 'designs-0' },
      ]),
    );
  });
});
