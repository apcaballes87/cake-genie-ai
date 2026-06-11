import type { CakeGenieReview } from './database.types';
import { createPublicServerSupabaseClient } from './supabase/publicServer';

export const REVIEW_SELECT = `
  review_id,
  order_id,
  order_item_id,
  user_id,
  merchant_id,
  product_id,
  rating,
  title:review_title,
  comment:review_text,
  photos:review_photos,
  reviewer_name,
  is_verified,
  is_approved,
  is_visible,
  is_published,
  original_image_url,
  finished_image_url,
  merchant_response,
  merchant_response_at,
  created_at,
  updated_at,
  merchant:cakegenie_merchants(business_name),
  user:cakegenie_users(first_name, last_name),
  order_item:cakegenie_order_items!order_item_id(cake_type, cake_size, customized_image_url, customization_details),
  cakegenie_analysis_cache!product_id(slug)
`;

/**
 * Like REVIEW_SELECT, but also pulls `keywords` from the joined
 * `cakegenie_analysis_cache` row. Required by the themed-pool helper so
 * tier-2 can match `keywords ILIKE 'pokemon%'`.
 */
export const REVIEW_SELECT_WITH_KEYWORDS = `
  review_id,
  order_id,
  order_item_id,
  user_id,
  merchant_id,
  product_id,
  rating,
  title:review_title,
  comment:review_text,
  photos:review_photos,
  reviewer_name,
  is_verified,
  is_approved,
  is_visible,
  is_published,
  original_image_url,
  finished_image_url,
  merchant_response,
  merchant_response_at,
  created_at,
  updated_at,
  merchant:cakegenie_merchants(business_name),
  user:cakegenie_users(first_name, last_name),
  order_item:cakegenie_order_items!order_item_id(cake_type, cake_size, customized_image_url, customization_details),
  cakegenie_analysis_cache!product_id(slug, keywords)
`;

export const REVIEW_SELECT_WITH_ORDER_NUMBER = `
  ${REVIEW_SELECT},
  cakegenie_orders(order_number)
`;

/**
 * Generic cake-descriptor keywords that should NEVER match tier-2.
 * Including any of these would let "custom cake" reviews show up on every
 * custom-cake page, defeating the purpose of a themed pool.
 *
 * Maintenance plan (per plan §4 Step 1): this is a starter list. After
 * launch, derive from frequency analysis (any keyword appearing in >5% of
 * products auto-blocks). Review quarterly.
 */
export const GENERIC_KEYWORD_BLOCKLIST: ReadonlySet<string> = new Set([
  // cake descriptors
  'cake', 'cakes', 'custom', 'fondant', 'buttercream', 'icing',
  // size/tier
  '1-tier', '2-tier', '3-tier', 'mini', 'small', 'medium', 'large',
  // occasion
  'birthday', 'wedding', 'anniversary', 'baby', 'kids', 'adult',
  // filler
  'design', 'theme', 'themed',
]);

type MaybeArray<T> = T | T[] | null | undefined;
type RatingOnlyReview = { rating: number };

export type ReviewSummary = {
  total: number;
  averageRating: number;
};

type ReviewNameSource = Pick<CakeGenieReview, 'reviewer_name' | 'user'>;

type RawReviewRecord = Omit<CakeGenieReview, 'user' | 'merchant' | 'order_item' | 'cakegenie_orders' | 'cakegenie_analysis_cache'> & {
  user?: MaybeArray<CakeGenieReview['user']>;
  merchant?: MaybeArray<CakeGenieReview['merchant']>;
  order_item?: MaybeArray<CakeGenieReview['order_item']>;
  cakegenie_orders?: MaybeArray<CakeGenieReview['cakegenie_orders']>;
  cakegenie_analysis_cache?: MaybeArray<CakeGenieReview['cakegenie_analysis_cache']>;
};

function pickFirst<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function normalizePublicReviewRecord(review: RawReviewRecord): CakeGenieReview {
  return {
    ...review,
    user: pickFirst(review.user),
    merchant: pickFirst(review.merchant),
    order_item: pickFirst(review.order_item),
    cakegenie_orders: pickFirst(review.cakegenie_orders),
    cakegenie_analysis_cache: pickFirst(review.cakegenie_analysis_cache),
  };
}

export function normalizePublicReviews(reviews: RawReviewRecord[] | null | undefined): CakeGenieReview[] {
  return (reviews || []).map(normalizePublicReviewRecord);
}

export function buildReviewSummary(ratingRows: RatingOnlyReview[] | null | undefined): ReviewSummary {
  const total = ratingRows?.length || 0;
  const averageRating = total > 0
    ? ratingRows!.reduce((sum, review) => sum + review.rating, 0) / total
    : 0;

  return { total, averageRating };
}

export function hasReviewSummary(reviewSummary: ReviewSummary | null | undefined): reviewSummary is ReviewSummary {
  return Boolean(reviewSummary && reviewSummary.total > 0 && reviewSummary.averageRating > 0);
}

function cleanNamePart(value: string | null | undefined): string {
  return value?.trim() || '';
}

export function getReviewDisplayName(review: ReviewNameSource): string {
  const reviewerName = cleanNamePart(review.reviewer_name);
  if (reviewerName) return reviewerName;

  const firstName = cleanNamePart(review.user?.first_name);
  const lastName = cleanNamePart(review.user?.last_name);

  if (firstName && lastName) return `${firstName} ${lastName}`.trim();
  if (firstName) return firstName;
  if (lastName) return lastName;

  return 'Customer';
}

export function getReviewAvatarInitial(review: ReviewNameSource): string {
  return getReviewDisplayName(review).charAt(0).toUpperCase() || 'C';
}

// ---------------------------------------------------------------------------
// Themed review pool (Step A of /tmp/themed-review-pool-plan.md)
//
// 4-tier fallback for the "Customer Reviews" section on /customizing/[slug]:
//   1. exact product (reviews.product_id = current slug's product_id)
//   2. same primary keyword (cakegenie_analysis_cache.keywords starts with
//      the same first token, e.g. "pokemon") — subject to the blocklist
//   3. most recent across the whole catalog
//   4. empty (section hidden)
//
// `_source` is a UI discriminator only. It must be stripped from any review
// that is sent to JSON-LD (see plan §12 Rule 3: only tier-1 in Product.review).
// ---------------------------------------------------------------------------

export type ReviewSource = 'exact' | 'themed' | 'recent';

export type ThemedReview = CakeGenieReview & { _source: ReviewSource };

/**
 * Returns a section-subtitle that honestly describes the source mix of the
 * reviews actually rendered. This is the user-facing signal that a Charizard
 * review on a Pikachu page is a *themed* review, not a fake Pikachu review.
 *
 * Plan reference: §12 Rule 1.
 */
export function getSourceSubtitle(reviews: ReadonlyArray<ThemedReview>): string {
  if (reviews.length === 0) return 'Customer reviews';

  const sources = new Set(reviews.map((r) => r._source));
  const hasExact = sources.has('exact');
  const hasThemed = sources.has('themed');
  const hasRecent = sources.has('recent');

  if (hasExact && !hasThemed && !hasRecent) return 'Reviews for this design';
  if (hasExact && hasThemed && !hasRecent) {
    return 'Reviews for this design and similar cakes customers loved';
  }
  if (hasExact && hasRecent && !hasThemed) {
    return 'Reviews for this design and recent customer reviews';
  }
  if (hasExact && hasThemed && hasRecent) {
    return 'Reviews for this design and similar cakes customers loved';
  }
  if (!hasExact && hasThemed && !hasRecent) {
    return 'Reviews from similar cake designs customers loved';
  }
  if (!hasExact && hasThemed && hasRecent) {
    return 'Reviews from similar cake designs customers loved';
  }
  if (!hasExact && !hasThemed && hasRecent) {
    return 'Recent reviews from Genie.ph customers';
  }
  return 'Customer reviews';
}

/**
 * Fetches up to `limit` reviews for the given product using the 4-tier
 * fallback. Each returned review has a `_source` discriminator
 * ('exact' | 'themed' | 'recent') so the UI can label it honestly.
 *
 * Tier 2 is skipped if `primaryKeyword` is null, empty, or in the
 * GENERIC_KEYWORD_BLOCKLIST.
 *
 * Cross-tier deduplication: a review that somehow matches multiple tiers
 * (e.g. an "exact" review also matches the same-keyword pool) only appears
 * in the result once, in the highest-priority tier that matched.
 *
 * Caller is responsible for stripping `_source` before sending reviews to
 * JSON-LD (only `_source === 'exact'` is safe to mark up — plan §12 Rule 3).
 */
export async function getThemedReviewsForSlug(
  productId: string,
  primaryKeyword: string | null | undefined,
  limit = 3
): Promise<ThemedReview[]> {
  const supabase = createPublicServerSupabaseClient();
  const seenIds = new Set<string>();
  const result: ThemedReview[] = [];

  // ── Tier 1: exact product match ──
  const { data: exact, error: exactErr } = await supabase
    .from('cakegenie_reviews')
    .select(REVIEW_SELECT_WITH_KEYWORDS)
    .eq('is_visible', true)
    .eq('is_approved', true)
    .eq('is_published', true)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (exactErr) throw exactErr;

  for (const r of exact ?? []) {
    const normalized = normalizePublicReviews([r])[0];
    result.push({ ...normalized, _source: 'exact' });
    seenIds.add(r.review_id);
    if (result.length >= limit) return result;
  }

  // ── Tier 2: same primary keyword (themed pool) ──
  const keyword = (primaryKeyword || '').toLowerCase().trim();
  if (keyword && !GENERIC_KEYWORD_BLOCKLIST.has(keyword)) {
    const remaining = limit - result.length;
    const { data: themed, error: themedErr } = await supabase
      .from('cakegenie_reviews')
      .select(REVIEW_SELECT_WITH_KEYWORDS)
      .eq('is_visible', true)
      .eq('is_approved', true)
      .eq('is_published', true)
      .ilike('cakegenie_analysis_cache.keywords', `${keyword}%`)
      .order('created_at', { ascending: false })
      // fetch 2× so we have headroom to filter out already-seen ids
      .limit(Math.max(remaining * 2, remaining));

    if (themedErr) throw themedErr;

    for (const r of themed ?? []) {
      if (seenIds.has(r.review_id)) continue;
      const normalized = normalizePublicReviews([r])[0];
      result.push({ ...normalized, _source: 'themed' });
      seenIds.add(r.review_id);
      if (result.length >= limit) return result;
    }
  }

  // ── Tier 3: most recent, no theme filter ──
  const remaining = limit - result.length;
  if (remaining > 0) {
    const { data: recent, error: recentErr } = await supabase
      .from('cakegenie_reviews')
      .select(REVIEW_SELECT_WITH_KEYWORDS)
      .eq('is_visible', true)
      .eq('is_approved', true)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(Math.max(remaining * 2, remaining));

    if (recentErr) throw recentErr;

    for (const r of recent ?? []) {
      if (seenIds.has(r.review_id)) continue;
      const normalized = normalizePublicReviews([r])[0];
      result.push({ ...normalized, _source: 'recent' });
      seenIds.add(r.review_id);
      if (result.length >= limit) return result;
    }
  }

  return result;
}
