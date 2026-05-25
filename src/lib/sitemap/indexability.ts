import { createClient } from '@supabase/supabase-js'
import { upgradeLegacySlug } from '@/lib/utils/urlHelpers'

export const SITEMAP_CHUNK_SIZE = 1000
export const CUSTOMIZING_SITEMAP_MIN_AGE_DAYS = 7
export const MIN_SITEMAP_TEXT_LENGTH = 18
export const MIN_SITEMAP_IMAGE_DIMENSION = 300

const SUPABASE_BATCH_SIZE = 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000
const LEGACY_ANALYSIS_SLUG_RE = /[a-f0-9]{16}$/i
const ADULT_SITEMAP_TERMS = [
  'adult',
  'bachelorette',
  'cock',
  'penis',
  'vulva',
]

type ImageLikeRow = {
  original_image_url?: string | null
  studio_edited_image_url?: string | null
  customized_image_url?: string | null
}

type RawCustomizedCakeRow = {
  slug: string | null
  created_at: string
  seo_title: string | null
  alt_text: string | null
  keywords: string | null
  original_image_url: string | null
  studio_edited_image_url: string | null
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

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  const candidates = [
    row.studio_edited_image_url,
    row.original_image_url,
    row.customized_image_url,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

export async function getSitemapChunkHints(now = new Date()): Promise<SitemapChunkHints> {
  const supabase = getSupabaseClient()
  const cutoffDate = getSitemapCutoffDate(now)
  const fallbackLastMod = now.toISOString()

  const [
    { count: customizedCount, error: customizedCountError },
    { data: latestCustomizedRows, error: latestCustomizedError },
    { count: sharedDesignCount, error: sharedDesignCountError },
    { data: latestSharedRows, error: latestSharedError },
  ] = await Promise.all([
    supabase
      .from('cakegenie_analysis_cache')
      .select('slug', { count: 'exact', head: true })
      .not('slug', 'is', null)
      .not('image_width', 'is', null)
      .not('image_height', 'is', null)
      .or('seo_title.not.is.null,alt_text.not.is.null,keywords.not.is.null')
      .lte('created_at', cutoffDate),
    supabase
      .from('cakegenie_analysis_cache')
      .select('created_at')
      .not('slug', 'is', null)
      .not('image_width', 'is', null)
      .not('image_height', 'is', null)
      .or('seo_title.not.is.null,alt_text.not.is.null,keywords.not.is.null')
      .lte('created_at', cutoffDate)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('cakegenie_shared_designs')
      .select('url_slug', { count: 'exact', head: true })
      .not('url_slug', 'is', null)
      .or('title.not.is.null,alt_text.not.is.null,description.not.is.null')
      .lte('created_at', cutoffDate),
    supabase
      .from('cakegenie_shared_designs')
      .select('created_at')
      .not('url_slug', 'is', null)
      .or('title.not.is.null,alt_text.not.is.null,description.not.is.null')
      .lte('created_at', cutoffDate)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (customizedCountError) {
    throw new Error(`Failed to count sitemap-ready customized cakes: ${customizedCountError.message}`)
  }

  if (latestCustomizedError) {
    throw new Error(`Failed to fetch latest customized-cake sitemap date: ${latestCustomizedError.message}`)
  }

  if (sharedDesignCountError) {
    throw new Error(`Failed to count sitemap-ready shared designs: ${sharedDesignCountError.message}`)
  }

  if (latestSharedError) {
    throw new Error(`Failed to fetch latest shared-design sitemap date: ${latestSharedError.message}`)
  }

  return {
    customizedChunkCount: Math.ceil((customizedCount || 0) / SITEMAP_CHUNK_SIZE),
    customizedLastMod: latestCustomizedRows?.[0]?.created_at || fallbackLastMod,
    sharedDesignChunkCount: Math.ceil((sharedDesignCount || 0) / SITEMAP_CHUNK_SIZE),
    sharedDesignLastMod: latestSharedRows?.[0]?.created_at || fallbackLastMod,
  }
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

async function fetchAllCustomizedCakeRows(): Promise<RawCustomizedCakeRow[]> {
  const supabase = getSupabaseClient()
  const rows: RawCustomizedCakeRow[] = []
  const cutoffDate = getSitemapCutoffDate()
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('slug, created_at, seo_title, alt_text, keywords, original_image_url, studio_edited_image_url, image_width, image_height')
      .not('slug', 'is', null)
      .lte('created_at', cutoffDate)
      .order('created_at', { ascending: false })
      .range(offset, offset + SUPABASE_BATCH_SIZE - 1)
      .returns<RawCustomizedCakeRow[]>()

    if (error) {
      throw new Error(`Failed to fetch sitemap-ready customized cakes: ${error.message}`)
    }

    if (!data?.length) {
      break
    }

    rows.push(...data)

    if (data.length < SUPABASE_BATCH_SIZE) {
      break
    }

    offset += SUPABASE_BATCH_SIZE
  }

  return rows
}

async function fetchAllSharedDesignRows(): Promise<RawSharedDesignRow[]> {
  const supabase = getSupabaseClient()
  const cutoffDate = getSitemapCutoffDate()
  const { data, error } = await supabase
    .from('cakegenie_shared_designs')
    // The live shared-design table does not consistently expose measured image
    // dimensions, so keep sitemap generation on the stable common columns.
    .select('url_slug, created_at, title, alt_text, description, original_image_url, customized_image_url')
    .not('url_slug', 'is', null)
    .lte('created_at', cutoffDate)
    .order('created_at', { ascending: false })
    .returns<RawSharedDesignRow[]>()

  if (error) {
    throw new Error(`Failed to fetch sitemap-ready shared designs: ${error.message}`)
  }

  return data || []
}

export async function getIndexableCustomizedCakeRows(): Promise<IndexableCustomizedCakeRow[]> {
  const seenSlugs = new Set<string>()
  const rows = await fetchAllCustomizedCakeRows()
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

export async function getIndexableSharedDesignRows(): Promise<IndexableSharedDesignRow[]> {
  const seenSlugs = new Set<string>()
  const rows = await fetchAllSharedDesignRows()
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
