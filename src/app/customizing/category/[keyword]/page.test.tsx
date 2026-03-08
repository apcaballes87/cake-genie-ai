import { describe, expect, it, vi, beforeEach } from 'vitest';

const getDesignsByKeyword = vi.fn();

vi.mock('@/services/supabaseService', () => ({
  getDesignsByKeyword,
  getDesignCategories: vi.fn(),
}));

vi.mock('@/components/collections/DesignGridWithLoadMore', () => ({
  DesignGridWithLoadMore: () => <div data-testid="design-grid" />,
}));

describe('customizing category metadata', () => {
  beforeEach(() => {
    getDesignsByKeyword.mockReset();
    getDesignsByKeyword.mockResolvedValue({
      data: [
        {
          slug: 'lavender-korean-minimalist-bento-cake-abc123',
          original_image_url: 'https://example.com/lavender.webp',
          alt_text: 'Lavender cake design',
        },
      ],
    });
  });

  it('uses the same 30-item category query for metadata images', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({ keyword: 'lavender-korean' }),
    });

    expect(getDesignsByKeyword).toHaveBeenCalledWith('lavender korean', 30);
    expect(getDesignsByKeyword).not.toHaveBeenCalledWith('lavender korean', 1);
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: 'https://example.com/lavender.webp' }),
    ]);
  });
});