import { describe, expect, it } from 'vitest'
import {
  buildRetryUploadUrl,
  buildRelatedCollectionsRequestKey,
  getAutoRelatedDesignRequest,
  shouldLoadPropDesign,
  shouldHydrateImageFromExistingAnalysis,
  shouldLogShopifyCseMount,
} from './customizingClientGuards'

describe('customizingClientGuards', () => {
  it('skips prop loading during Shopify handoff, reset, or an active load', () => {
    expect(shouldLoadPropDesign({
      sourceParam: 'shopify_cse',
      isResetting: false,
      targetImageUrl: 'https://example.com/cake.jpg',
      targetSlug: 'cake-a',
      persistedSlug: 'cake-a',
      hasLoadedImage: false,
      isLoadingDesign: false,
    })).toBe(false)

    expect(shouldLoadPropDesign({
      sourceParam: null,
      isResetting: true,
      targetImageUrl: 'https://example.com/cake.jpg',
      targetSlug: 'cake-a',
      persistedSlug: 'cake-a',
      hasLoadedImage: false,
      isLoadingDesign: false,
    })).toBe(false)

    expect(shouldLoadPropDesign({
      sourceParam: null,
      isResetting: false,
      targetImageUrl: 'https://example.com/cake.jpg',
      targetSlug: 'cake-a',
      persistedSlug: 'cake-b',
      hasLoadedImage: false,
      isLoadingDesign: true,
    })).toBe(false)
  })

  it('skips prop loading when the current design is already loaded', () => {
    expect(shouldLoadPropDesign({
      sourceParam: null,
      isResetting: false,
      targetImageUrl: 'https://example.com/cake.jpg',
      targetSlug: 'cake-a',
      persistedSlug: 'cake-a',
      hasLoadedImage: true,
      isLoadingDesign: false,
    })).toBe(false)
  })

  it('allows prop loading for a new or unloaded design with an image URL', () => {
    expect(shouldLoadPropDesign({
      sourceParam: null,
      isResetting: false,
      targetImageUrl: 'https://example.com/cake.jpg',
      targetSlug: 'cake-a',
      persistedSlug: 'cake-a',
      hasLoadedImage: false,
      isLoadingDesign: false,
    })).toBe(true)

    expect(shouldLoadPropDesign({
      sourceParam: null,
      isResetting: false,
      targetImageUrl: 'https://example.com/cake.jpg',
      targetSlug: 'cake-b',
      persistedSlug: 'cake-a',
      hasLoadedImage: true,
      isLoadingDesign: false,
    })).toBe(true)
  })

  it('only logs Shopify effect mounts when there is Shopify handoff data', () => {
    expect(shouldLogShopifyCseMount(null, null)).toBe(false)
    expect(shouldLogShopifyCseMount('shopify_cse', null)).toBe(true)
    expect(shouldLogShopifyCseMount(null, 'https://example.com/cake.jpg')).toBe(true)
  })

  it('reuses existing analysis only when SSR or cached analysis is already available', () => {
    expect(shouldHydrateImageFromExistingAnalysis({
      hasSsrData: true,
      hasCachedAnalysis: false,
    })).toBe(true)

    expect(shouldHydrateImageFromExistingAnalysis({
      hasSsrData: false,
      hasCachedAnalysis: true,
    })).toBe(true)

    expect(shouldHydrateImageFromExistingAnalysis({
      hasSsrData: false,
      hasCachedAnalysis: false,
    })).toBe(false)
  })

  it('builds a stable related-design request using the strongest available keyword and slug', () => {
    expect(getAutoRelatedDesignRequest({
      currentKeywords: ' Floral Cake ',
      recentSearchKeywords: 'birthday cake',
      analysisKeyword: 'rose cake',
      currentSlug: null,
      persistedSlug: 'pretty-cake',
      recentSearchSlug: 'search-cake',
    })).toEqual({
      keyword: ' Floral Cake ',
      slug: 'pretty-cake',
      key: 'floral cake::pretty-cake',
    })

    expect(getAutoRelatedDesignRequest({
      currentKeywords: null,
      recentSearchKeywords: null,
      analysisKeyword: null,
      currentSlug: null,
      persistedSlug: null,
      recentSearchSlug: null,
    })).toBeNull()
  })

  it('normalizes related-collection inputs into a reusable request key', () => {
    expect(buildRelatedCollectionsRequestKey([' Floral ', 'PASTEL'], '  Korean Bento  ')).toBe(
      JSON.stringify({
        tags: ['floral', 'pastel'],
        keyword: 'korean bento',
      })
    )

    expect(buildRelatedCollectionsRequestKey([], '')).toBeNull()
  })

  it('removes stale handoff params before opening the retry uploader', () => {
    expect(buildRetryUploadUrl(
      '/customizing',
      '?ref=https%3A%2F%2Fold.example%2Fcake.jpg&source=shopify_cse&image_url=https%3A%2F%2Fold.example%2Fcake.jpg&keep=1&fromSaved=true'
    )).toBe('/customizing?keep=1')

    expect(buildRetryUploadUrl('/customizing', '')).toBe('/customizing')
  })
})
