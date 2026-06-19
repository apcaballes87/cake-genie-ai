interface PropDesignLoadGuardArgs {
  sourceParam: string | null
  isResetting: boolean
  targetImageUrl: string | null | undefined
  targetSlug: string | null | undefined
  persistedSlug: string | null | undefined
  hasLoadedImage: boolean
  isLoadingDesign: boolean
  loadedImageUrl?: string | null | undefined
}

interface AutoRelatedDesignRequestArgs {
  currentKeywords?: string | null
  recentSearchKeywords?: string | null
  analysisKeyword?: string | null
  currentSlug?: string | null
  persistedSlug?: string | null
  recentSearchSlug?: string | null
}

interface ExistingAnalysisHydrationArgs {
  hasSsrData?: boolean
  hasCachedAnalysis?: boolean
}

const RETRY_UPLOAD_QUERY_PARAMS = [
  'ref',
  'source',
  'image_url',
  'image_name',
  'image_type',
  'fromSaved',
  'fromMerchant',
] as const

export function shouldLoadPropDesign({
  sourceParam,
  isResetting,
  targetImageUrl,
  targetSlug,
  persistedSlug,
  hasLoadedImage,
  isLoadingDesign,
  loadedImageUrl,
}: PropDesignLoadGuardArgs): boolean {
  if (sourceParam === 'shopify_cse' || sourceParam === 'chrome_extension') return false
  if (isResetting) return false
  if (!targetImageUrl) return false

  const isNewItem = targetSlug !== persistedSlug
  const isImageUrlChanged = targetImageUrl !== loadedImageUrl

  if (!isNewItem && hasLoadedImage && !isImageUrlChanged) return false
  if (isLoadingDesign) return false

  return true
}

export function shouldLogShopifyCseMount(sourceParam: string | null, imageUrlParam: string | null): boolean {
  return sourceParam === 'shopify_cse' || !!imageUrlParam
}

export function shouldHydrateImageFromExistingAnalysis({
  hasSsrData = false,
  hasCachedAnalysis = false,
}: ExistingAnalysisHydrationArgs): boolean {
  return hasSsrData || hasCachedAnalysis
}

export function getAutoRelatedDesignRequest({
  currentKeywords,
  recentSearchKeywords,
  analysisKeyword,
  currentSlug,
  persistedSlug,
  recentSearchSlug,
}: AutoRelatedDesignRequestArgs): { keyword: string; slug: string | null; key: string } | null {
  const keyword = currentKeywords || recentSearchKeywords || analysisKeyword || null
  if (!keyword) return null

  const slug = currentSlug || persistedSlug || recentSearchSlug || null
  const normalizedKeyword = keyword.trim().toLowerCase()
  const normalizedSlug = slug?.trim().toLowerCase() || ''

  return {
    keyword,
    slug,
    key: `${normalizedKeyword}::${normalizedSlug}`,
  }
}

export function buildRelatedCollectionsRequestKey(tags: string[] | null | undefined, keyword?: string | null): string | null {
  const normalizedTags = (tags || [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
  const normalizedKeyword = keyword?.trim().toLowerCase() || ''

  if (normalizedTags.length === 0 && !normalizedKeyword) {
    return null
  }

  return JSON.stringify({
    tags: normalizedTags,
    keyword: normalizedKeyword,
  })
}

export function buildRetryUploadUrl(pathname: string, search: string): string {
  const params = new URLSearchParams(search)

  for (const key of RETRY_UPLOAD_QUERY_PARAMS) {
    params.delete(key)
  }

  const nextSearch = params.toString()
  return nextSearch ? `${pathname}?${nextSearch}` : pathname
}
