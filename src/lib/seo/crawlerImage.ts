import { parseManifest, pickFallbackSrc } from '@/lib/imageVariants/manifest'
import type { VariantManifest } from '@/lib/imageVariants/types'

export const GENIE_IMAGE_LICENSE_URL = 'https://genie.ph/terms'
export const GENIE_IMAGE_ACQUIRE_LICENSE_URL = 'https://genie.ph/contact'
export const GENIE_IMAGE_CREATOR_NAME = 'Genie.ph'

export type CrawlerImageInput = {
  image_variants?: unknown
  studio_edited_image_url?: string | null
  original_image_url?: string | null
  customized_image_url?: string | null
  image_width?: number | null
  image_height?: number | null
}

export type CrawlerImageSelection = {
  url: string | null
  width: number | null
  height: number | null
}

export function isPublicHttpImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false

  try {
    const parsed = new URL(value.trim())
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password
  } catch {
    return false
  }
}

export function selectCrawlerImage(
  input: CrawlerImageInput,
  maxWidth = 1200,
): CrawlerImageSelection {
  const manifest = getPublicCrawlerImageManifest(input.image_variants)
  const variantUrl = pickFallbackSrc(manifest, maxWidth)
  const selectedVariant = variantUrl && isPublicHttpImageUrl(variantUrl) && manifest
    ? manifest.variants.find((variant) => variant.url.trim() === variantUrl.trim()) ?? null
    : null

  const candidates = [
    selectedVariant ? selectedVariant.url : null,
    input.studio_edited_image_url,
    input.original_image_url,
    input.customized_image_url,
  ]

  const imageUrl = candidates.find(isPublicHttpImageUrl)?.trim() ?? null
  if (!imageUrl) {
    return { url: null, width: null, height: null }
  }

  if (selectedVariant?.url.trim() === imageUrl && input.image_width && input.image_height) {
    return {
      url: imageUrl,
      width: selectedVariant.width,
      height: Math.round(selectedVariant.width * (input.image_height / input.image_width)),
    }
  }

  return {
    url: imageUrl,
    width: input.image_width ?? null,
    height: input.image_height ?? null,
  }
}

export function getPublicCrawlerImageManifest(value: unknown): VariantManifest | null {
  const manifest = parseManifest(value)
  if (!manifest) return null

  const publicVariants = manifest.variants.filter((variant) => isPublicHttpImageUrl(variant.url))
  if (publicVariants.length === 0) return null

  return {
    ...manifest,
    variants: publicVariants,
  }
}

export function buildLicensedImageObject({
  url,
  name,
  caption,
  width,
  height,
  representativeOfPage,
  creatorName = GENIE_IMAGE_CREATOR_NAME,
}: {
  url: string
  name: string
  caption?: string | null
  width?: number | null
  height?: number | null
  representativeOfPage?: boolean
  creatorName?: string
}) {
  if (!isPublicHttpImageUrl(url)) return null

  return {
    '@type': 'ImageObject',
    contentUrl: url.trim(),
    url: url.trim(),
    name,
    ...(caption ? { caption } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(representativeOfPage !== undefined ? { representativeOfPage } : {}),
    creator: {
      '@type': 'Organization',
      name: creatorName,
      ...(creatorName === GENIE_IMAGE_CREATOR_NAME ? { url: 'https://genie.ph' } : {}),
    },
    creditText: creatorName,
    copyrightNotice: `© ${new Date().getFullYear()} ${creatorName}`,
    license: GENIE_IMAGE_LICENSE_URL,
    acquireLicensePage: GENIE_IMAGE_ACQUIRE_LICENSE_URL,
  }
}
