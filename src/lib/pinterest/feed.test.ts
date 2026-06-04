import { describe, expect, it } from 'vitest';
import {
  buildPinterestFeedItems,
  isPinterestCollectionFeedReady,
  normalizePinterestFeedLimit,
  sanitizePinterestImageUrl,
} from './feed';

describe('Pinterest RSS feed helpers', () => {
  it('only treats published indexable stocked collections as Pinterest-ready', () => {
    expect(isPinterestCollectionFeedReady({
      name: 'Kuromi Cakes',
      slug: 'kuromi-cake',
      publication_status: 'published',
      is_indexable: true,
      item_count: 8,
    })).toBe(true);

    expect(isPinterestCollectionFeedReady({
      name: 'Thin Cakes',
      slug: 'thin-cake',
      publication_status: 'stocking',
      is_indexable: false,
      item_count: 20,
    })).toBe(false);

    expect(isPinterestCollectionFeedReady({
      name: 'Almost Ready Cakes',
      slug: 'almost-ready-cake',
      publication_status: 'published',
      is_indexable: true,
      item_count: 7,
    })).toBe(false);
  });

  it('caps requested RSS limits at Pinterest feed maximum', () => {
    expect(normalizePinterestFeedLimit('500')).toBe(200);
    expect(normalizePinterestFeedLimit('25')).toBe(25);
    expect(normalizePinterestFeedLimit('not-a-number')).toBe(200);
  });

  it('strips Supabase query tokens and rejects non-public image URLs', () => {
    expect(sanitizePinterestImageUrl('https://abc.supabase.co/storage/v1/object/public/cakes/a.webp?token=secret'))
      .toBe('https://abc.supabase.co/storage/v1/object/public/cakes/a.webp');

    expect(sanitizePinterestImageUrl('data:image/png;base64,abc')).toBe('');
    expect(sanitizePinterestImageUrl('file:///tmp/cake.webp')).toBe('');
  });

  it('builds valid unique feed items and prefers studio edited images', () => {
    const items = buildPinterestFeedItems([
      {
        slug: 'kuromi-purple-birthday-cake-abcdef123456',
        keywords: ['kuromi cake', 'purple cake'],
        original_image_url: 'https://example.com/original.webp',
        studio_edited_image_url: 'https://example.com/studio.webp',
        alt_text: 'Kuromi purple birthday cake',
        price: 1299,
        created_at: '2026-06-01T00:00:00.000Z',
      },
      {
        slug: 'kuromi-purple-birthday-cake-abcdef123456',
        original_image_url: 'https://example.com/duplicate.webp',
      },
      {
        slug: 'missing-image-cake',
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Kuromi Purple Birthday Cake',
      link: 'https://genie.ph/customizing/kuromi-purple-birthday-cake-abcdef123456',
      imageUrl: 'https://example.com/studio.webp',
      pubDate: 'Mon, 01 Jun 2026 00:00:00 GMT',
    });
    expect(items[0].description).toContain('Starting at PHP 1299.');
    expect(items[0].description).toContain('#kuromicake');
  });

  it('accepts comma-delimited keyword strings from older cache rows', () => {
    const items = buildPinterestFeedItems([
      {
        slug: 'minimalist-heart-cake-abcdef123456',
        keywords: 'minimalist cake, heart cake',
        original_image_url: 'https://example.com/cake.webp',
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].description).toContain('#minimalistcake');
    expect(items[0].description).toContain('#heartcake');
  });
});
