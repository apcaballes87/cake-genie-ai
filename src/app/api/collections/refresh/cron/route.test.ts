import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdminServerSupabaseClient = vi.fn();
const getCollectionSearchMetadata = vi.fn();

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient,
}));

vi.mock('@/lib/collections/searchMetadata', () => ({
  getCollectionSearchMetadata,
}));

describe('collection metadata refresh cron', () => {
  beforeEach(() => {
    vi.resetModules();
    createAdminServerSupabaseClient.mockReset();
    getCollectionSearchMetadata.mockReset();
    process.env.CRON_SECRET = 'expected-secret';
  });

  it('rejects requests without the cron secret', async () => {
    const { GET } = await import('./route');

    const response = await GET(new Request('https://genie.ph/api/collections/refresh/cron'));

    expect(response.status).toBe(401);
    expect(createAdminServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('updates stored counts and thumbnails from the accurate collection matcher', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: 'collection-1',
        name: 'Boss Baby Cake',
        slug: 'boss-baby-cake',
        item_count: 85,
        matched_design_count: 85,
        studio_image_count: 0,
        sample_image: 'https://example.com/baby-shower.webp',
        publication_status: 'published',
      }],
      error: null,
    });
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select, update }));
    createAdminServerSupabaseClient.mockReturnValue({ from });
    getCollectionSearchMetadata.mockResolvedValue({
      matchedDesignCount: 48,
      studioImageCount: 3,
      sampleImage: 'https://example.com/boss-baby.webp',
      sampleSlug: 'boss-baby-sky-blue-1-tier-cake-b88e',
      sampleKeywords: 'Boss Baby',
      searchQuery: 'Boss Baby',
      matchKind: 'text',
    });

    const { GET } = await import('./route');
    const response = await GET(new Request('https://genie.ph/api/collections/refresh/cron', {
      headers: { authorization: 'Bearer expected-secret' },
    }));

    expect(response.status).toBe(200);
    expect(getCollectionSearchMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ from }),
      'Boss Baby Cake',
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      item_count: 48,
      matched_design_count: 48,
      studio_image_count: 3,
      sample_image: 'https://example.com/boss-baby.webp',
    }));
    expect(updateEq).toHaveBeenCalledWith('id', 'collection-1');
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      processed: 1,
      changed: 1,
      failed: 0,
    }));
  });
});
