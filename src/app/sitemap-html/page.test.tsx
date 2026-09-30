import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const createClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createClient }));

describe('HTML sitemap', () => {
  it('lists only collections meeting the XML publication rule', async () => {
    const collectionRows = [
      { name: 'Published Cake', slug: 'published-cake', publication_status: 'published', is_indexable: true, item_count: 8 },
      { name: 'Small Cake', slug: 'small-cake', publication_status: 'published', is_indexable: true, item_count: 7 },
      { name: 'Draft Cake', slug: 'draft-cake', publication_status: 'draft', is_indexable: true, item_count: 20 },
    ];
    const collectionsQuery = {
      select: vi.fn(), eq: vi.fn(), gte: vi.fn(), order: vi.fn(),
    };
    collectionsQuery.select.mockReturnValue(collectionsQuery);
    collectionsQuery.eq.mockReturnValue(collectionsQuery);
    collectionsQuery.gte.mockReturnValue(collectionsQuery);
    collectionsQuery.order.mockResolvedValue({ data: collectionRows, error: null });
    const designsQuery = {
      select: vi.fn(), eq: vi.fn(), not: vi.fn(), order: vi.fn(), limit: vi.fn(),
    };
    designsQuery.select.mockReturnValue(designsQuery);
    designsQuery.eq.mockReturnValue(designsQuery);
    designsQuery.not.mockReturnValue(designsQuery);
    designsQuery.order.mockReturnValue(designsQuery);
    designsQuery.limit.mockResolvedValue({ data: [
      {
        slug: 'sunset-bento-purple-bento-cake-0303',
        created_at: '2026-05-01T00:00:00.000Z',
        seo_title: 'Sunset Bento Birthday Cake',
        alt_text: 'Sunset bento cake design',
        keywords: 'sunset bento cake',
        original_image_url: 'https://example.com/sunset.jpg',
        studio_edited_image_url: null,
        image_width: 800,
        image_height: 800,
      },
      {
        slug: 'generic-cake-white-1-tier-cake-0000',
        created_at: '2026-05-01T00:00:00.000Z',
        seo_title: 'Custom Cake',
        alt_text: 'Custom cake design',
        keywords: 'custom cake',
        original_image_url: 'https://example.com/generic.jpg',
        studio_edited_image_url: null,
        image_width: 800,
        image_height: 800,
      },
    ], error: null });
    createClient.mockResolvedValue({
      from: (table: string) => table === 'cakegenie_collections' ? collectionsQuery : designsQuery,
    });

    const { default: SitemapHtmlPage } = await import('./page');
    const html = renderToStaticMarkup(await SitemapHtmlPage());
    expect(html).toContain('href="/collections/published-cake"');
    expect(html).not.toContain('href="/collections/small-cake"');
    expect(html).not.toContain('href="/collections/draft-cake"');
    expect(html).toContain('href="/customizing/sunset-bento-purple-bento-cake-0303"');
    expect(html).not.toContain('href="/customizing/generic-cake-white-1-tier-cake-0000"');
    expect(collectionsQuery.gte).toHaveBeenCalledWith('item_count', 8);
  });
});
