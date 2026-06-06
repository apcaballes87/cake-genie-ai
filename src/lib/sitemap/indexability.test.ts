import { describe, expect, it } from 'vitest'
import {
  getPreferredSitemapImage,
  isPastSitemapCutoff,
  toIndexableCustomizedCakeRow,
  toIndexableSharedDesignRow,
} from './indexability'

const NOW = new Date('2026-05-09T00:00:00.000Z')

describe('sitemap indexability helpers', () => {
  it('prefers the studio-edited image when it exists', () => {
    expect(getPreferredSitemapImage({
      original_image_url: 'https://example.com/original.jpg',
      studio_edited_image_url: 'https://example.com/edited.webp',
    })).toBe('https://example.com/edited.webp')
  })

  it('applies the sitemap age cutoff', () => {
    expect(isPastSitemapCutoff('2026-05-05T00:00:00.000Z', NOW)).toBe(true)
    expect(isPastSitemapCutoff('2026-05-08T00:00:00.000Z', NOW)).toBe(false)
  })

  it('keeps only canonical, mature customized cake rows', () => {
    expect(toIndexableCustomizedCakeRow({
      slug: 'sunset-bento-purple-bento-cake-0303',
      created_at: '2026-05-01T00:00:00.000Z',
      seo_title: 'Sunset Bento Birthday Cake | Genie.ph',
      alt_text: 'A sunset bento cake',
      keywords: 'sunset bento cake',
      original_image_url: 'https://example.com/original.jpg',
      studio_edited_image_url: null,
      image_width: 800,
      image_height: 1000,
    }, NOW)).toMatchObject({
      slug: 'sunset-bento-purple-bento-cake-0303',
      image_url: 'https://example.com/original.jpg',
    })

    expect(toIndexableCustomizedCakeRow({
      slug: 'pink-bow-white-1-tier-18ff',
      created_at: '2026-05-01T00:00:00.000Z',
      seo_title: 'Pink Bow Cake',
      alt_text: 'Pink bow cake',
      keywords: 'pink bow cake',
      original_image_url: 'https://example.com/original.jpg',
      studio_edited_image_url: null,
      image_width: 800,
      image_height: 1000,
    }, NOW)).toBeNull()

    expect(toIndexableCustomizedCakeRow({
      slug: 'new-cake-design-cake-1234',
      created_at: '2026-05-07T00:00:00.000Z',
      seo_title: 'New cake design',
      alt_text: 'New cake design',
      keywords: 'new cake design',
      original_image_url: 'https://example.com/original.jpg',
      studio_edited_image_url: null,
      image_width: 800,
      image_height: 1000,
    }, NOW)).toBeNull()
  })

  it('filters low-quality customized cake rows from sitemaps', () => {
    expect(toIndexableCustomizedCakeRow({
      slug: 'custom-cake-white-2-tier-fondant-cake-0000',
      created_at: '2026-05-01T00:00:00.000Z',
      seo_title: 'Custom Cake | Genie.ph',
      alt_text: 'Custom cake design',
      keywords: 'custom cake',
      original_image_url: 'https://example.com/original.jpg',
      studio_edited_image_url: null,
      image_width: 800,
      image_height: 1000,
    }, NOW)).toBeNull()

    expect(toIndexableCustomizedCakeRow({
      slug: 'penis-cake-pink-1-tier-cake-0501',
      created_at: '2026-05-01T00:00:00.000Z',
      seo_title: 'Pink Adult Cake Design',
      alt_text: 'Pink adult themed cake design',
      keywords: 'adult cake',
      original_image_url: 'https://example.com/original.jpg',
      studio_edited_image_url: null,
      image_width: 800,
      image_height: 1000,
    }, NOW)).toBeNull()

    expect(toIndexableCustomizedCakeRow({
      slug: 'tiny-image-blue-bento-cake-0303',
      created_at: '2026-05-01T00:00:00.000Z',
      seo_title: 'Blue Bento Cake Design',
      alt_text: 'Blue bento cake with flowers',
      keywords: 'blue bento cake',
      original_image_url: 'https://example.com/original.jpg',
      studio_edited_image_url: null,
      image_width: 250,
      image_height: 500,
    }, NOW)).toBeNull()

    expect(toIndexableCustomizedCakeRow({
      slug: 'missing-dimensions-blue-bento-cake-0303',
      created_at: '2026-05-01T00:00:00.000Z',
      seo_title: 'Blue Bento Cake Design',
      alt_text: 'Blue bento cake with flowers',
      keywords: 'blue bento cake',
      original_image_url: 'https://example.com/original.jpg',
      studio_edited_image_url: null,
      image_width: null,
      image_height: 500,
    }, NOW)).toBeNull()
  })

  it('filters shared designs that would redirect to a different canonical slug', () => {
    expect(toIndexableSharedDesignRow({
      url_slug: 'pink-bow-white-1-tier-18ff',
      created_at: '2026-05-01T00:00:00.000Z',
      title: 'Pink Bow Cake',
      alt_text: 'Pink bow cake',
      description: 'A pink bow cake',
      original_image_url: null,
      customized_image_url: 'https://example.com/customized.jpg',
    }, NOW)).toBeNull()

    expect(toIndexableSharedDesignRow({
      url_slug: 'sunset-bento-purple-bento-cake-0303',
      created_at: '2026-05-01T00:00:00.000Z',
      title: 'Sunset Bento Cake',
      alt_text: 'Sunset bento cake',
      description: 'A sunset bento cake',
      original_image_url: null,
      customized_image_url: 'https://example.com/customized.jpg',
    }, NOW)).toMatchObject({
      url_slug: 'sunset-bento-purple-bento-cake-0303',
      image_url: 'https://example.com/customized.jpg',
    })
  })
})
