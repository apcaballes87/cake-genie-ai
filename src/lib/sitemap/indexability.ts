import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { upgradeLegacySlug } from '@/lib/utils/urlHelpers'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/env'
import { selectCrawlerImage } from '@/lib/seo/crawlerImage'

export const SITEMAP_CHUNK_SIZE = 1000
export const CUSTOMIZING_SITEMAP_MIN_AGE_DAYS = 2
export const MIN_SITEMAP_TEXT_LENGTH = 18
export const MIN_SITEMAP_IMAGE_DIMENSION = 300

const SUPABASE_BATCH_SIZE = 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000
const LEGACY_ANALYSIS_SLUG_RE = /[a-f0-9]{16}$/i
const ADULT_SITEMAP_TERMS = [
  'adult',
  'cock',
  'penis',
  'vulva',
]

type ImageLikeRow = {
  original_image_url?: string | null
  studio_edited_image_url?: string | null
  customized_image_url?: string | null
  image_variants?: unknown
}

type RawCustomizedCakeRow = {
  slug: string | null
  created_at: string
  seo_title: string | null
  alt_text: string | null
  keywords: string | null
  original_image_url: string | null
  studio_edited_image_url: string | null
  image_variants?: unknown
  image_width?: number | null
  image_height?: number | null
}

type RawSharedDesignRow = {
  url_slug: string | null
  created_at: string
  title: string | null
  alt_text: string | null
  description: string | null
  original_image_url: string | null
  customized_image_url: string | null
  image_width?: number | null
  image_height?: number | null
}

export type IndexableCustomizedCakeRow = RawCustomizedCakeRow & {
  slug: string
  image_url: string
}

export type IndexableSharedDesignRow = RawSharedDesignRow & {
  url_slug: string
  image_url: string
}

export type SitemapChunkHints = {
  customizedChunkCount: number
  customizedLastMod: string
  sharedDesignChunkCount: number
  sharedDesignLastMod: string
}

export type SitemapInventory = {
  customizedCakes: IndexableCustomizedCakeRow[]
  sharedDesigns: IndexableSharedDesignRow[]
}

function getSupabaseClient() {
  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  )
}

function hasTextValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasUsefulTextValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length >= MIN_SITEMAP_TEXT_LENGTH
}

function hasGenericTextValue(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'custom cake'
    || normalized === 'custom cake design'
    || normalized === 'custom cake | genie.ph'
}

function containsBlockedAdultTerm(...values: Array<string | null | undefined>): boolean {
  const haystack = values
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()

  return ADULT_SITEMAP_TERMS.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(haystack))
}

function hasTinyMeasuredImage(row: { image_width?: number | null; image_height?: number | null }): boolean {
  if (!row.image_width || !row.image_height) {
    return false
  }

  return row.image_width < MIN_SITEMAP_IMAGE_DIMENSION || row.image_height < MIN_SITEMAP_IMAGE_DIMENSION
}

function passesCustomizedCakeQualityGate(row: RawCustomizedCakeRow, slug: string): boolean {
  if (containsBlockedAdultTerm(slug, row.seo_title, row.alt_text, row.keywords)) {
    return false
  }

  if (!row.image_width || !row.image_height) {
    return false
  }

  if (hasTinyMeasuredImage(row)) {
    return false
  }

  if (hasGenericTextValue(row.seo_title) || hasGenericTextValue(row.alt_text)) {
    return false
  }

  return hasUsefulTextValue(row.seo_title)
    || hasUsefulTextValue(row.alt_text)
    || hasUsefulTextValue(row.keywords)
}

function passesSharedDesignQualityGate(row: RawSharedDesignRow, slug: string): boolean {
  if (containsBlockedAdultTerm(slug, row.title, row.alt_text, row.description)) {
    return false
  }

  if (hasTinyMeasuredImage(row)) {
    return false
  }

  if (hasGenericTextValue(row.title) || hasGenericTextValue(row.alt_text)) {
    return false
  }

  return hasUsefulTextValue(row.title)
    || hasUsefulTextValue(row.alt_text)
    || hasUsefulTextValue(row.description)
}

export function getSitemapCutoffDate(now = new Date()): string {
  return new Date(now.getTime() - CUSTOMIZING_SITEMAP_MIN_AGE_DAYS * MS_PER_DAY).toISOString()
}

export function isPastSitemapCutoff(createdAt: string, now = new Date()): boolean {
  const createdAtMs = Date.parse(createdAt)

  if (Number.isNaN(createdAtMs)) {
    return false
  }

  return createdAtMs <= now.getTime() - CUSTOMIZING_SITEMAP_MIN_AGE_DAYS * MS_PER_DAY
}

export function getPreferredSitemapImage(row: ImageLikeRow): string | null {
  return selectCrawlerImage(row).url
}

export function buildSitemapChunkHints(
  customizedCakes: IndexableCustomizedCakeRow[],
  sharedDesigns: IndexableSharedDesignRow[],
  now = new Date(),
): SitemapChunkHints {
  const fallbackLastMod = now.toISOString()

  return {
    customizedChunkCount: Math.ceil(customizedCakes.length / SITEMAP_CHUNK_SIZE),
    customizedLastMod: customizedCakes[0]?.created_at || fallbackLastMod,
    sharedDesignChunkCount: Math.ceil(sharedDesigns.length / SITEMAP_CHUNK_SIZE),
    sharedDesignLastMod: sharedDesigns[0]?.created_at || fallbackLastMod,
  }
}

export async function getSitemapChunkHints(now = new Date()): Promise<SitemapChunkHints> {
  const { customizedCakes, sharedDesigns } = await getSitemapInventory()
  return buildSitemapChunkHints(customizedCakes, sharedDesigns, now)
}

export function toIndexableCustomizedCakeRow(
  row: RawCustomizedCakeRow,
  now = new Date(),
): IndexableCustomizedCakeRow | null {
  const slug = row.slug?.trim()
  if (!slug) {
    return null
  }

  if (!isPastSitemapCutoff(row.created_at, now)) {
    return null
  }

  const canonicalSlug = upgradeLegacySlug(slug)
  if (canonicalSlug !== slug || LEGACY_ANALYSIS_SLUG_RE.test(slug)) {
    return null
  }

  const imageUrl = getPreferredSitemapImage(row)
  if (!imageUrl) {
    return null
  }

  if (!hasTextValue(row.seo_title) && !hasTextValue(row.alt_text) && !hasTextValue(row.keywords)) {
    return null
  }

  if (!passesCustomizedCakeQualityGate(row, slug)) {
    return null
  }

  return {
    ...row,
    slug,
    image_url: imageUrl,
  }
}

export function toIndexableSharedDesignRow(
  row: RawSharedDesignRow,
  now = new Date(),
): IndexableSharedDesignRow | null {
  const urlSlug = row.url_slug?.trim()
  if (!urlSlug) {
    return null
  }

  if (!isPastSitemapCutoff(row.created_at, now)) {
    return null
  }

  const canonicalSlug = upgradeLegacySlug(urlSlug)
  if (canonicalSlug !== urlSlug) {
    return null
  }

  const imageUrl = getPreferredSitemapImage(row)
  if (!imageUrl) {
    return null
  }

  if (!hasTextValue(row.title) && !hasTextValue(row.alt_text) && !hasTextValue(row.description)) {
    return null
  }

  if (!passesSharedDesignQualityGate(row, urlSlug)) {
    return null
  }

  return {
    ...row,
    url_slug: urlSlug,
    image_url: imageUrl,
  }
}

async function fetchCustomizedCakePage(offset: number): Promise<RawCustomizedCakeRow[]> {
  const supabase = getSupabaseClient()
  const cutoffDate = getSitemapCutoffDate()
  const { data, error } = await supabase
    .from('cakegenie_analysis_cache')
    .select('slug, created_at, seo_title, alt_text, keywords, original_image_url, studio_edited_image_url, image_variants, image_width, image_height')
    .not('slug', 'is', null)
    .lte('created_at', cutoffDate)
    .order('created_at', { ascending: false })
    .range(offset, offset + SUPABASE_BATCH_SIZE - 1)
    .returns<RawCustomizedCakeRow[]>()

  if (error) {
    throw new Error(`Failed to fetch sitemap-ready customized cakes: ${error.message}`)
  }

  return data || []
}

async function fetchSharedDesignPage(
  offset: number,
  imageSource: 'customized' | 'original',
): Promise<RawSharedDesignRow[]> {
  const supabase = getSupabaseClient()
  const cutoffDate = getSitemapCutoffDate()
  const commonQuery = supabase
    .from('cakegenie_shared_designs')
    .select(imageSource === 'customized'
      ? 'url_slug, created_at, title, alt_text, description, original_image_url, customized_image_url'
      : 'url_slug, created_at, title, alt_text, description, original_image_url')
    .not('url_slug', 'is', null)
    .lte('created_at', cutoffDate)
    .order('created_at', { ascending: false })
    .range(offset, offset + SUPABASE_BATCH_SIZE - 1)

  // Some legacy shared rows store multi-megabyte data URLs. Filter them in
  // PostgREST before selecting the image field so they never enter crawler
  // output or breach Next.js's per-entry cache limit. The original-image pass
  // provides the fallback inventory; duplicate slugs are removed downstream.
  const { data, error } = imageSource === 'customized'
    ? await commonQuery.like('customized_image_url', 'http%')
    : await commonQuery.like('original_image_url', 'http%')

  if (error) {
    throw new Error(`Failed to fetch sitemap-ready shared designs: ${error.message}`)
  }

  const rows = (data || []) as unknown as Array<
    Omit<RawSharedDesignRow, 'customized_image_url'> & {
      customized_image_url?: string | null
    }
  >

  return rows.map((row) => ({
    ...row,
    customized_image_url: imageSource === 'customized'
      ? (row.customized_image_url ?? null)
      : null,
  }))
}

// A full inventory is currently well above Next.js's 2 MB per-entry data-cache
// limit. Cache deterministic database pages instead, then assemble the exact
// filtered inventory in memory. This preserves the 30-minute refresh behavior
// without silently falling back to an uncached multi-megabyte query.
const getCachedCustomizedCakePage = unstable_cache(
  fetchCustomizedCakePage,
  ['sitemap-customized-cake-page-v3'],
  { revalidate: 1800 },
)

const getCachedSharedDesignPage = unstable_cache(
  fetchSharedDesignPage,
  ['sitemap-shared-design-page-v3'],
  { revalidate: 1800 },
)

async function fetchAllPages<T>(
  fetchPage: (offset: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = []
  let offset = 0

  while (true) {
    const page = await fetchPage(offset)
    rows.push(...page)

    if (page.length < SUPABASE_BATCH_SIZE) {
      return rows
    }

    offset += SUPABASE_BATCH_SIZE
  }
}

async function buildIndexableCustomizedCakeRows(): Promise<IndexableCustomizedCakeRow[]> {
  const seenSlugs = new Set<string>()
  const rows = await fetchAllPages(getCachedCustomizedCakePage)
  const results: IndexableCustomizedCakeRow[] = []

  for (const row of rows) {
    const candidate = toIndexableCustomizedCakeRow(row)
    if (!candidate || seenSlugs.has(candidate.slug)) {
      continue
    }

    seenSlugs.add(candidate.slug)
    results.push(candidate)
  }

  return results
}

async function buildIndexableSharedDesignRows(): Promise<IndexableSharedDesignRow[]> {
  const seenSlugs = new Set<string>()
  const [customizedImageRows, originalImageRows] = await Promise.all([
    fetchAllPages((offset) => getCachedSharedDesignPage(offset, 'customized')),
    fetchAllPages((offset) => getCachedSharedDesignPage(offset, 'original')),
  ])
  const rows = [...customizedImageRows, ...originalImageRows]
  const results: IndexableSharedDesignRow[] = []

  for (const row of rows) {
    const candidate = toIndexableSharedDesignRow(row)
    if (!candidate || seenSlugs.has(candidate.url_slug)) {
      continue
    }

    seenSlugs.add(candidate.url_slug)
    results.push(candidate)
  }

  return results
}

export async function getIndexableCustomizedCakeRows(): Promise<IndexableCustomizedCakeRow[]> {
  return buildIndexableCustomizedCakeRows()
}

export async function getIndexableSharedDesignRows(): Promise<IndexableSharedDesignRow[]> {
  return buildIndexableSharedDesignRows()
}

export async function getSitemapInventory(): Promise<SitemapInventory> {
  const [customizedCakes, allSharedDesigns] = await Promise.all([
    getIndexableCustomizedCakeRows(),
    getIndexableSharedDesignRows(),
  ])
  const customizedSlugs = new Set(customizedCakes.map((cake) => cake.slug))

  return {
    customizedCakes,
    sharedDesigns: allSharedDesigns.filter((design) => !customizedSlugs.has(design.url_slug)),
  }
}
