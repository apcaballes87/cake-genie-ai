import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCollectionBySlug = vi.fn();
const getDesignCategories = vi.fn();
const getDesignsByKeyword = vi.fn();

vi.mock('@/services/supabaseService', () => ({
  getCollectionBySlug,
  getDesignCategories,
  getDesignsByKeyword,
}));

vi.mock('./CategoryClient', () => ({
  default: () => <div data-testid="collection-client" />,
}));

describe('collections category metadata', () => {
  beforeEach(() => {
    getCollectionBySlug.mockReset();
    getDesignCategories.mockReset();
    getDesignsByKeyword.mockReset();

    getCollectionBySlug.mockResolvedValue({
      data: {
        name: 'Pickleball Cake',
        description: 'Browse pickleball cake designs with paddles, courts, balls, and personalized toppers. Get instant pricing and order custom pickleball cakes on Genie.ph.',
        tags: ['pickleball', 'sports cake'],
        sample_image: 'https://example.com/pickleball-og.webp',
      },
      error: null,
    });

    getDesignCategories.mockResolvedValue({ data: [], error: null });
    getDesignsByKeyword.mockResolvedValue({
      data: [
        {
          slug: 'pickleball-white-1-tier-cake-c1c1',
          keywords: 'Pickleball',
          original_image_url: 'https://example.com/pickleball-result.webp',
        },
      ],
      error: null,
    });
  });

  it('uses collection metadata and sample image for pickleball SEO tags', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({ category: 'pickleball-cake' }),
    });

    expect(getCollectionBySlug).toHaveBeenCalledWith('pickleball-cake');
    expect(getDesignsByKeyword).toHaveBeenCalledWith('pickleball-cake', 1);
    expect(metadata.title).toEqual({ absolute: 'Pickleball Cake Ideas & Designs | Genie.ph' });
    expect(metadata.description).toBe('Browse pickleball cake designs with paddles, courts, balls, and personalized toppers. Get instant pricing and order custom pickleball cakes on Genie.ph.');
    expect(metadata.keywords).toContain('pickleball cake');
    expect(metadata.alternates?.canonical).toBe('https://genie.ph/collections/pickleball-cake');
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: 'https://example.com/pickleball-og.webp' }),
    ]);
    expect(metadata.twitter?.images).toEqual([
      expect.objectContaining({ url: 'https://example.com/pickleball-og.webp' }),
    ]);
  });

  it('always includes pickleball in generated collection params', async () => {
    const { generateStaticParams } = await import('./page');

    const params = await generateStaticParams();

    expect(params).toContainEqual({ category: 'pickleball-cake' });
  });
});
