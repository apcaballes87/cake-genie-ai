interface PropDesignLoadGuardArgs {
  sourceParam: string | null
  isResetting: boolean
  targetImageUrl: string | null | undefined
  targetSlug: string | null | undefined
  persistedSlug: string | null | undefined
  hasLoadedImage: boolean
  isLoadingDesign: boolean
}

export function shouldLoadPropDesign({
  sourceParam,
  isResetting,
  targetImageUrl,
  targetSlug,
  persistedSlug,
  hasLoadedImage,
  isLoadingDesign,
}: PropDesignLoadGuardArgs): boolean {
  if (sourceParam === 'shopify_cse') return false
  if (isResetting) return false
  if (!targetImageUrl) return false

  const isNewItem = targetSlug !== persistedSlug

  if (!isNewItem && hasLoadedImage) return false
  if (isLoadingDesign) return false

  return true
}

export function shouldLogShopifyCseMount(sourceParam: string | null, imageUrlParam: string | null): boolean {
  return sourceParam === 'shopify_cse' || !!imageUrlParam
}