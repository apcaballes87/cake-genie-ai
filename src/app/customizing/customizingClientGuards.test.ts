import { describe, expect, it } from 'vitest'
import {
  buildRetryUploadUrl,
  buildRelatedCollectionsRequestKey,
  clearExternalImageHandoffParams,
  EDIBLE_PHOTO_AI_CHAT_DEFAULT_PROMPT,
  getAutoRelatedDesignRequest,
  getNextEdiblePhotoAiChatInput,
  persistAnalysisImageRef,
  resolveEntrySourceParam,
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
      loadedImageUrl: 'https://example.com/cake.jpg',
    })).toBe(false)
  })

  it('allows prop loading when the design has been updated with a new image URL', () => {
    expect(shouldLoadPropDesign({
      sourceParam: null,
      isResetting: false,
      targetImageUrl: 'https://example.com/studio-edited-cake.jpg',
      targetSlug: 'cake-a',
      persistedSlug: 'cake-a',
      hasLoadedImage: true,
      isLoadingDesign: false,
      loadedImageUrl: 'https://example.com/cake.jpg',
    })).toBe(true)
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
      loadedImageUrl: null,
    })).toBe(true)

    expect(shouldLoadPropDesign({
      sourceParam: null,
      isResetting: false,
      targetImageUrl: 'https://example.com/cake.jpg',
      targetSlug: 'cake-b',
      persistedSlug: 'cake-a',
      hasLoadedImage: true,
      isLoadingDesign: false,
      loadedImageUrl: 'https://example.com/cake.jpg',
    })).toBe(true)
  })

  it('only logs Shopify effect mounts when there is Shopify handoff data', () => {
    expect(shouldLogShopifyCseMount(null, null)).toBe(false)
    expect(shouldLogShopifyCseMount('shopify_cse', null)).toBe(true)
    expect(shouldLogShopifyCseMount(null, 'https://example.com/cake.jpg')).toBe(true)
  })

  it('prefers entry_source while remaining backward-compatible with legacy source params', () => {
    expect(resolveEntrySourceParam(new URLSearchParams('entry_source=landing&source=blog'))).toBe('landing')
    expect(resolveEntrySourceParam(new URLSearchParams('source=blog'))).toBe('blog')
    expect(resolveEntrySourceParam(new URLSearchParams(''))).toBeNull()
  })

  it('clears stale cake selections with an external image handoff while preserving unrelated params', () => {
    const params = new URLSearchParams(
      'source=chrome_extension&image_url=https%3A%2F%2Fimages.example%2Fnew-cake.jpg&image_name=new-cake.jpg&image_type=image%2Fjpeg&caketype=Cupcake&size=2oz+-+12+pieces&height=2+in&keep=1'
    )

    clearExternalImageHandoffParams(params)

    expect(params.toString()).toBe('keep=1')
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

  it('removes stale handoff and customization params before opening the retry uploader', () => {
    expect(buildRetryUploadUrl(
      '/customizing',
      '?ref=https%3A%2F%2Fold.example%2Fcake.jpg&source=shopify_cse&entry_source=landing&image_url=https%3A%2F%2Fold.example%2Fcake.jpg&keep=1&fromSaved=true&caketype=2+Tier&size=6%22%2F8%22+Round&height=4+in&thickness=4+in&type=Bento'
    )).toBe('/customizing?keep=1')

    expect(buildRetryUploadUrl('/customizing', '')).toBe('/customizing')
  })

  it('stores only the image ref for analysis handoff persistence', () => {
    const writes: Record<string, string> = {}
    const storage = {
      setItem: (key: string, value: string) => {
        writes[key] = value
      },
    }

    expect(persistAnalysisImageRef(
      storage,
      'cakegenie_analysis',
      'https://example.com/fresh-cake.jpg'
    )).toBe(true)

    expect(JSON.parse(writes.cakegenie_analysis)).toEqual({
      imageRef: 'https://example.com/fresh-cake.jpg',
    })
    expect(writes.cakegenie_analysis).not.toContain('result')
    expect(writes.cakegenie_analysis).not.toContain('data:image')
  })

  it('treats quota-exceeded storage writes as non-fatal', () => {
    const storage = {
      setItem: () => {
        throw new DOMException(
          "Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.",
          'QuotaExceededError'
        )
      },
    }

    expect(persistAnalysisImageRef(
      storage,
      'cakegenie_analysis',
      'https://example.com/fresh-cake.jpg'
    )).toBe(false)
  })

  it('prefills edible-photo AI chat without overwriting user text', () => {
    expect(getNextEdiblePhotoAiChatInput('', true)).toBe(EDIBLE_PHOTO_AI_CHAT_DEFAULT_PROMPT)
    expect(getNextEdiblePhotoAiChatInput('   ', true)).toBe(EDIBLE_PHOTO_AI_CHAT_DEFAULT_PROMPT)
    expect(getNextEdiblePhotoAiChatInput(EDIBLE_PHOTO_AI_CHAT_DEFAULT_PROMPT, true)).toBe(EDIBLE_PHOTO_AI_CHAT_DEFAULT_PROMPT)
    expect(getNextEdiblePhotoAiChatInput('make the border blue', true)).toBe('make the border blue')
    expect(getNextEdiblePhotoAiChatInput(EDIBLE_PHOTO_AI_CHAT_DEFAULT_PROMPT, false)).toBe('')
    expect(getNextEdiblePhotoAiChatInput('make the border blue', false)).toBe('make the border blue')
  })
})
