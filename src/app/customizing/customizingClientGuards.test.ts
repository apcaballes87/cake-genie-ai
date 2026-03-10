import { describe, expect, it } from 'vitest'
import { shouldLoadPropDesign, shouldLogShopifyCseMount } from './customizingClientGuards'

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
})