import { describe, expect, it } from 'vitest'
import {
  buildLicensedImageObject,
  getPublicCrawlerImageManifest,
  isPublicHttpImageUrl,
  selectCrawlerImage,
} from './crawlerImage'

describe('crawler image selection', () => {
  it('accepts only absolute public HTTP(S) image URLs', () => {
    expect(isPublicHttpImageUrl('https://cdn.example.com/cake.webp')).toBe(true)
    expect(isPublicHttpImageUrl('http://cdn.example.com/cake.jpg')).toBe(true)
    expect(isPublicHttpImageUrl('data:image/webp;base64,abc')).toBe(false)
    expect(isPublicHttpImageUrl('blob:https://genie.ph/abc')).toBe(false)
    expect(isPublicHttpImageUrl('/images/cake.webp')).toBe(false)
    expect(isPublicHttpImageUrl('not a url')).toBe(false)
  })

  it('skips invalid candidates while preserving crawler image priority', () => {
    expect(selectCrawlerImage({
      image_variants: {
        format: 'webp',
        source: 'original_image_url',
        variants: [{ width: 1200, url: 'data:image/webp;base64,abc', bytes: 100 }],
      },
      studio_edited_image_url: 'blob:https://genie.ph/abc',
      original_image_url: 'data:image/png;base64,abc',
      customized_image_url: 'https://cdn.example.com/customized.webp',
      image_width: 800,
      image_height: 1000,
    })).toEqual({
      url: 'https://cdn.example.com/customized.webp',
      width: 800,
      height: 1000,
    })
  })

  it('keeps a public variant when another manifest candidate is invalid', () => {
    expect(getPublicCrawlerImageManifest({
      format: 'webp',
      source: 'original_image_url',
      variants: [
        { width: 400, url: 'https://cdn.example.com/cake-400.webp', bytes: 100 },
        { width: 1200, url: 'data:image/webp;base64,abc', bytes: 200 },
      ],
    })?.variants).toHaveLength(1)
    expect(selectCrawlerImage({
      image_variants: {
        format: 'webp',
        source: 'original_image_url',
        variants: [
          { width: 400, url: 'https://cdn.example.com/cake-400.webp', bytes: 100 },
          { width: 1200, url: 'data:image/webp;base64,abc', bytes: 200 },
        ],
      },
      original_image_url: 'https://cdn.example.com/original.webp',
      image_width: 1200,
      image_height: 1500,
    }).url).toBe('https://cdn.example.com/cake-400.webp')
  })

  it('uses selected variant dimensions when a public variant wins', () => {
    expect(selectCrawlerImage({
      image_variants: {
        format: 'webp',
        source: 'studio_edited_image_url',
        variants: [{ width: 600, url: 'https://cdn.example.com/cake-600.webp', bytes: 100 }],
      },
      studio_edited_image_url: 'https://cdn.example.com/studio.webp',
      image_width: 1200,
      image_height: 1500,
    })).toEqual({
      url: 'https://cdn.example.com/cake-600.webp',
      width: 600,
      height: 750,
    })
  })

  it('omits invalid licensed image objects', () => {
    expect(buildLicensedImageObject({ url: 'data:image/png;base64,abc', name: 'Cake' })).toBeNull()
    expect(buildLicensedImageObject({
      url: 'https://cdn.example.com/cake.webp',
      name: 'Bento cake design',
    })).toMatchObject({
      '@type': 'ImageObject',
      contentUrl: 'https://cdn.example.com/cake.webp',
      creditText: 'Genie.ph',
      license: 'https://genie.ph/terms',
    })
  })
})
