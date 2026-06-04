import { describe, expect, it } from 'vitest';
import {
  buildPinterestCatalogItem,
  buildPinterestCatalogItems,
  generatePinterestCatalogXml,
  sanitizePinterestCatalogImageUrl,
} from './catalog';

describe('Pinterest catalog feed helpers', () => {
  it('builds Pinterest catalog items with required product fields', () => {
    const item = buildPinterestCatalogItem({
      slug: 'kuromi-purple-birthday-cake-abcdef123456',
      seo_title: 'Kuromi Purple Birthday Cake',
      seo_description: 'A purple Kuromi birthday cake for custom celebrations.',
      studio_edited_image_url: 'https://example.com/studio.webp',
      price: 1299,
    });

    expect(item).toMatchObject({
      title: 'Kuromi Purple Birthday Cake',
      description: 'A purple Kuromi birthday cake for custom celebrations.',
      link: 'https://genie.ph/customizing/kuromi-purple-birthday-cake-abcdef123456',
      imageLink: 'https://example.com/studio.webp',
      price: 1299,
      availability: 'in stock',
    });
    expect(item?.id).toBeTruthy();
  });

  it('does not include rows without studio edited images', () => {
    expect(buildPinterestCatalogItem({
      slug: 'raw-upload-cake-abcdef123456',
      price: 1299,
    })).toBeNull();
  });

  it('sanitizes Supabase image URLs for public catalog ingestion', () => {
    expect(sanitizePinterestCatalogImageUrl('https://abc.supabase.co/storage/v1/object/public/cakes/a.webp?token=secret'))
      .toBe('https://abc.supabase.co/storage/v1/object/public/cakes/a.webp');
  });

  it('deduplicates products and generates RSS 2.0 catalog XML', () => {
    const items = buildPinterestCatalogItems([
      {
        slug: 'minimalist-heart-cake-abcdef123456',
        keywords: 'minimalist cake, heart cake',
        studio_edited_image_url: 'https://example.com/studio-heart.webp',
        price: 1599,
      },
      {
        slug: 'minimalist-heart-cake-abcdef123456',
        studio_edited_image_url: 'https://example.com/duplicate.webp',
        price: 1599,
      },
    ]);

    const xml = generatePinterestCatalogXml('https://genie.ph', items);

    expect(items).toHaveLength(1);
    expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
    expect(xml).toContain('<g:image_link>https://example.com/studio-heart.webp</g:image_link>');
    expect(xml).toContain('<g:price>1599 PHP</g:price>');
    expect(xml).toContain('<g:availability>in stock</g:availability>');
    expect(xml).toContain('<g:adult>false</g:adult>');
  });
});
