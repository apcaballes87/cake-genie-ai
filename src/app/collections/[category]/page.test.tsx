import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCollectionBySlug = vi.fn();
const getDesignCategories = vi.fn();
const getDesignsByKeyword = vi.fn();
const notFound = vi.fn();
const permanentRedirect = vi.fn(() => {
  throw new Error('NEXT_REDIRECT');
});

vi.mock('next/navigation', () => ({
  notFound,
  permanentRedirect,
}));

vi.mock('@/services/supabaseService', () => ({
  getCollectionBySlug,
  getDesignCategories,
  getDesignsByKeyword,
}));

vi.mock('@/app/collections/[category]/CategoryClient', () => ({
  default: () => <div data-testid="collection-client" />,
}));

describe('collections category metadata', () => {
  beforeEach(() => {
    getCollectionBySlug.mockReset();
    getDesignCategories.mockReset();
    getDesignsByKeyword.mockReset();
    notFound.mockReset();
    permanentRedirect.mockClear();

    getCollectionBySlug.mockResolvedValue({
      data: {
        slug: 'minimalist-cake',
        name: 'Minimalist Cake',
        description: 'Clean Korean-style cake looks with simple piping and a soft color palette.',
        tags: ['korean cake', 'pastel', 'elegant'],
        sample_image: 'https://example.com/minimalist-og.webp',
        item_count: 718,
      },
      error: null,
    });

    getDesignCategories.mockResolvedValue({
      data: [
        { slug: 'minimalist-cake', count: 718 },
        { slug: 'pickleball-cake', count: 12 },
      ],
      error: null,
    });

    getDesignsByKeyword.mockResolvedValue({
      data: [
        {
          slug: 'minimalist-heart-cake-a1a1',
          keywords: 'Minimalist Heart Cake',
          original_image_url: 'https://example.com/minimalist-result.webp',
          image_width: 1200,
          image_height: 1500,
        },
      ],
      error: null,
    });
  });

  it('uses the canonical collection slug and stronger metadata for alias routes', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({ category: 'minimalist-cakes' }),
    });

    expect(getCollectionBySlug).toHaveBeenCalledWith('minimalist-cakes');
    expect(getDesignsByKeyword).toHaveBeenCalledWith('minimalist-cake', 1);
    expect(metadata.title).toEqual({ absolute: 'Minimalist Cake Designs in Cebu | Genie.ph' });
    expect(metadata.description).toContain('Browse 718 minimalist cake designs on Genie.ph.');
    expect(metadata.alternates?.canonical).toBe('https://genie.ph/collections/minimalist-cake');
    expect(metadata.openGraph?.url).toBe('https://genie.ph/collections/minimalist-cake');
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: 'https://example.com/minimalist-og.webp' }),
    ]);
    expect(metadata.keywords).toContain('minimalist cake cebu');
  });

  it('redirects non-canonical collection aliases to the official slug', async () => {
    const { default: CategoryPage } = await import('./page');

    await expect(CategoryPage({
      params: Promise.resolve({ category: 'minimalist-cakes' }),
    })).rejects.toThrow('NEXT_REDIRECT');

    expect(permanentRedirect).toHaveBeenCalledWith('/collections/minimalist-cake');
  });

  it('returns all indexed collection params for static generation', async () => {
    const { generateStaticParams } = await import('./page');

    const params = await generateStaticParams();

    expect(params).toEqual([
      { category: 'minimalist-cake' },
      { category: 'pickleball-cake' },
    ]);
  });
});
