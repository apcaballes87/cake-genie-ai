/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPerDesignReviewSummary,
  buildReviewSummary,
  GENERIC_KEYWORD_BLOCKLIST,
  getExactReviewsForSchema,
  getSourceSubtitle,
  getThemedReviewsForSlug,
  hasReviewSummary,
  type ThemedReview,
} from './reviews';

// ---------------------------------------------------------------------------
// Pure-helper tests
// ---------------------------------------------------------------------------

describe('reviews helpers', () => {
  it('builds an aggregate summary from public review ratings', () => {
    expect(buildReviewSummary([
      { rating: 5 },
      { rating: 4 },
      { rating: 5 },
    ])).toEqual({
      total: 3,
      averageRating: 14 / 3,
    });
  });

  it('treats empty or missing ratings as no live summary', () => {
    expect(buildReviewSummary(null)).toEqual({
      total: 0,
      averageRating: 0,
    });

    expect(hasReviewSummary(null)).toBe(false);
    expect(hasReviewSummary({ total: 0, averageRating: 0 })).toBe(false);
    expect(hasReviewSummary({ total: 9, averageRating: 4.9 })).toBe(true);
  });
});

describe('GENERIC_KEYWORD_BLOCKLIST', () => {
  it('blocks common cake descriptors and size/occasion fillers', () => {
    for (const generic of [
      'cake', 'cakes', 'custom', 'fondant', 'buttercream', 'icing',
      '1-tier', '2-tier', '3-tier', 'mini', 'small', 'medium', 'large',
      'birthday', 'wedding', 'anniversary', 'baby', 'kids', 'adult',
      'design', 'theme', 'themed',
    ]) {
      expect(GENERIC_KEYWORD_BLOCKLIST.has(generic), generic).toBe(true);
    }
  });

  it('does NOT block specific themes like pokemon, kuromi, anime', () => {
    for (const specific of ['pokemon', 'pikachu', 'kuromi', 'anime', 'spiderman', 'moana']) {
      expect(GENERIC_KEYWORD_BLOCKLIST.has(specific), specific).toBe(false);
    }
  });
});

describe('getSourceSubtitle', () => {
  // Fixture helper — review_id only matters for tier assertions in other suites.
  const mk = (id: string, source: ThemedReview['_source']): ThemedReview =>
    ({ review_id: id, _source: source } as ThemedReview);

  it('returns "Customer reviews" for empty input', () => {
    expect(getSourceSubtitle([])).toBe('Customer reviews');
  });

  it('handles tier-1 only (all reviews of this exact design)', () => {
    expect(getSourceSubtitle([mk('a', 'exact'), mk('b', 'exact')]))
      .toBe('Reviews for this design');
  });

  it('handles tier-1 + tier-2 (this design + similar themed)', () => {
    expect(getSourceSubtitle([mk('a', 'exact'), mk('b', 'themed')]))
      .toBe('Reviews for this design and similar cakes customers loved');
  });

  it('handles tier-1 + tier-3 (this design + recent fallback)', () => {
    expect(getSourceSubtitle([mk('a', 'exact'), mk('b', 'recent')]))
      .toBe('Reviews for this design and recent customer reviews');
  });

  it('handles tier-1 + tier-2 + tier-3 — collapses to the themed subtitle', () => {
    expect(getSourceSubtitle([mk('a', 'exact'), mk('b', 'themed'), mk('c', 'recent')]))
      .toBe('Reviews for this design and similar cakes customers loved');
  });

  it('handles tier-2 only (themed pool, no exact match)', () => {
    expect(getSourceSubtitle([mk('a', 'themed'), mk('b', 'themed')]))
      .toBe('Reviews from similar cake designs customers loved');
  });

  it('handles tier-2 + tier-3 — still uses the themed subtitle', () => {
    expect(getSourceSubtitle([mk('a', 'themed'), mk('b', 'recent')]))
      .toBe('Reviews from similar cake designs customers loved');
  });

  it('handles tier-3 only (most recent fallback when no theme match)', () => {
    expect(getSourceSubtitle([mk('a', 'recent'), mk('b', 'recent')]))
      .toBe('Recent reviews from Genie.ph customers');
  });
});

describe('getExactReviewsForSchema', () => {
  const mk = (
    id: string,
    source: ThemedReview['_source'],
    extras: Record<string, unknown> = {}
  ): ThemedReview => ({ review_id: id, _source: source, ...extras } as ThemedReview);

  it('returns empty array for null/undefined input', () => {
    expect(getExactReviewsForSchema(null)).toEqual([]);
    expect(getExactReviewsForSchema(undefined)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(getExactReviewsForSchema([])).toEqual([]);
  });

  it('keeps only tier-1 ("exact") reviews and strips the _source discriminator', () => {
    const reviews = [
      mk('a', 'exact', { rating: 5, comment: 'loved it' }),
      mk('b', 'themed', { rating: 4, comment: 'different product' }),
      mk('c', 'recent', { rating: 3, comment: 'recent' }),
      mk('d', 'exact', { rating: 5, comment: 'great again' }),
    ];

    const result = getExactReviewsForSchema(reviews);

    expect(result).toHaveLength(2);
    expect(result[0].review_id).toBe('a');
    expect(result[0].rating).toBe(5);
    expect(result[0].comment).toBe('loved it');
    expect(result[1].review_id).toBe('d');
    // _source is stripped from the returned objects — must never leak
    // into JSON-LD or any other serialisation downstream.
    expect((result[0] as unknown as { _source?: string })._source).toBeUndefined();
    expect((result[1] as unknown as { _source?: string })._source).toBeUndefined();
  });

  it('returns empty array when no exact-tier reviews exist (themed/recent only)', () => {
    const reviews = [
      mk('a', 'themed'),
      mk('b', 'recent'),
    ];
    // Critical: themed/recent reviews are filtered out, not just labelled.
    // Marking up a themed review as Product.review for the current product
    // would be a structured-data lie.
    expect(getExactReviewsForSchema(reviews)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const reviews = [mk('a', 'exact'), mk('b', 'themed')];
    const snapshot = reviews.map((r) => ({ ...r }));
    getExactReviewsForSchema(reviews);
    expect(reviews).toEqual(snapshot);
  });
});

describe('buildPerDesignReviewSummary', () => {
  const mk = (
    id: string,
    source: ThemedReview['_source'],
    rating: number,
  ): ThemedReview => ({ review_id: id, _source: source, rating } as ThemedReview);

  it('returns null for null/undefined/empty input', () => {
    expect(buildPerDesignReviewSummary(null)).toBeNull();
    expect(buildPerDesignReviewSummary(undefined)).toBeNull();
    expect(buildPerDesignReviewSummary([])).toBeNull();
  });

  it('returns null when no exact-tier reviews exist (themed/recent only)', () => {
    // Plan §12 Rule 2: themed/recent reviews are about other products
    // and must not contribute to this product's star average.
    expect(buildPerDesignReviewSummary([
      mk('t1', 'themed', 5),
      mk('r1', 'recent', 4),
    ])).toBeNull();
  });

  it('computes total + averageRating from exact-tier reviews only', () => {
    const result = buildPerDesignReviewSummary([
      mk('e1', 'exact', 5),
      mk('t1', 'themed', 1),  // excluded — different product
      mk('e2', 'exact', 3),
      mk('e3', 'exact', 4),
      mk('r1', 'recent', 5),  // excluded — different product
    ]);
    expect(result).toEqual({ total: 3, averageRating: 4 });
  });

  it('returns 0 averageRating for a single 0-rating exact review (defensive)', () => {
    // Edge case — shouldn't happen in production (the review pool
    // filters on is_visible + is_approved), but the helper should
    // not divide by zero.
    const result = buildPerDesignReviewSummary([mk('e1', 'exact', 0)]);
    expect(result).toEqual({ total: 1, averageRating: 0 });
  });

  it('does not mutate the input array', () => {
    const reviews = [mk('e1', 'exact', 5), mk('t1', 'themed', 1)];
    const snapshot = reviews.map((r) => ({ ...r }));
    buildPerDesignReviewSummary(reviews);
    expect(reviews).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// getThemedReviewsForSlug — integration tests with a mocked supabase client
//
// These tests assert the *query chain* (filters, ordering, limits) and the
// dedup / tier-priority / blocklist-skip behavior. The hard schema rule
// ("tier-1 only in JSON-LD") is enforced at the call site, but the
// `_source` discriminator these tests rely on is the same one the call site
// will filter on. See plan §12 Rule 3.
// ---------------------------------------------------------------------------

// Build a fluent supabase query chain. Each method returns the chain itself,
// matching the real supabase-js client. `terminal` is the value returned
// when the chain is awaited — by default it's the table default.
const makeChain = (tableDefault: any = { data: [], error: null }): any => {
  const chain: any = {};
  for (const m of [
    'select', 'eq', 'neq', 'ilike', 'in', 'gt', 'gte', 'lt', 'lte',
    'order', 'limit', 'range', 'match', 'filter', 'not', 'or', 'and',
  ]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: any) => resolve(tableDefault);
  return chain;
};

const mockSupabase = { from: vi.fn() };

vi.mock('@/lib/supabase/publicServer', () => ({
  createPublicServerSupabaseClient: vi.fn(() => mockSupabase),
}));

// Minimal raw review shape (only fields used by normalize + helper).
const mkRaw = (overrides: Record<string, any> = {}) => ({
  review_id: 'r-default',
  product_id: 'p-default',
  rating: 5,
  created_at: '2026-01-01T00:00:00Z',
  is_visible: true,
  is_approved: true,
  is_published: true,
  ...overrides,
});

describe('getThemedReviewsForSlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tier-1 (exact) reviews first and stamps `_source: "exact"`', async () => {
    // Return 3 exact rows so tier-1 fills the limit and tier-2 is skipped.
    const exactRows = [
      mkRaw({ review_id: 'r1' }),
      mkRaw({ review_id: 'r2' }),
      mkRaw({ review_id: 'r3' }),
    ];
    const chain = makeChain({ data: exactRows, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const result = await getThemedReviewsForSlug('prod-123', 'pokemon', 3);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r._source)).toEqual(['exact', 'exact', 'exact']);
    expect(result.map((r) => r.review_id)).toEqual(['r1', 'r2', 'r3']);

    // Public-read filters must be applied
    expect(chain.eq).toHaveBeenCalledWith('is_visible', true);
    expect(chain.eq).toHaveBeenCalledWith('is_approved', true);
    expect(chain.eq).toHaveBeenCalledWith('is_published', true);
    // Exact match uses the current design's image URL
    expect(chain.eq).toHaveBeenCalledWith('original_image_url', 'prod-123');
    // Tier 1 filled the limit — no themed query should be issued
    expect(chain.ilike).not.toHaveBeenCalled();
  });

  it('falls back to tier-2 (themed) when tier-1 returns empty', async () => {
    // Tier-2 returns 3 rows (the limit) so tier-3 is never queried.
    const tier2Rows = [
      mkRaw({ review_id: 't1' }),
      mkRaw({ review_id: 't2' }),
      mkRaw({ review_id: 't3' }),
    ];
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) return makeChain({ data: [], error: null }); // tier 1
      return makeChain({ data: tier2Rows, error: null });          // tier 2
    });

    const result = await getThemedReviewsForSlug('prod-123', 'pokemon', 3);

    expect(result.map((r) => r._source)).toEqual(['themed', 'themed', 'themed']);
    expect(result.map((r) => r.review_id)).toEqual(['t1', 't2', 't3']);
    // Tier 2 filled the limit — no tier 3 query was issued
    expect(call).toBe(2);
  });

  it('SKIPS tier-2 entirely when the primary keyword is in the blocklist', async () => {
    const tier1 = makeChain({ data: [], error: null });
    mockSupabase.from.mockReturnValue(tier1);

    // After tier-1 and tier-3 (both empty) we never call ilike.
    // Provide tier-3 data so the helper returns and the test is meaningful.
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) return makeChain({ data: [], error: null }); // tier 1
      return makeChain({ data: [mkRaw({ review_id: 'rc1' })], error: null }); // tier 3
    });

    const result = await getThemedReviewsForSlug('prod-123', 'cake', 3);

    expect(result.map((r) => r._source)).toEqual(['recent']);
    expect(tier1.ilike).not.toHaveBeenCalled();
  });

  it('SKIPS tier-2 when primary keyword is null or empty', async () => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) return makeChain({ data: [], error: null });
      return makeChain({ data: [mkRaw({ review_id: 'rc1' })], error: null });
    });

    for (const kw of [null, undefined, '', '   ']) {
      call = 0;
      const result = await getThemedReviewsForSlug('prod-123', kw as any, 3);
      expect(result.map((r) => r._source)).toEqual(['recent']);
    }
  });

  it('fills remaining slots with tier-3 (most recent) when tier-1 + tier-2 < limit', async () => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) return makeChain({ data: [mkRaw({ review_id: 'e1' })], error: null }); // tier 1: 1
      if (call === 2) return makeChain({ data: [mkRaw({ review_id: 't1' })], error: null }); // tier 2: 1
      return makeChain({                                                                    // tier 3: 1
        data: [mkRaw({ review_id: 'rc1' })],
        error: null,
      });
    });

    const result = await getThemedReviewsForSlug('prod-123', 'pokemon', 3);

    expect(result.map((r) => r._source)).toEqual(['exact', 'themed', 'recent']);
    expect(result.map((r) => r.review_id)).toEqual(['e1', 't1', 'rc1']);
  });

  it('deduplicates: a review returned by both tier-1 and tier-2 appears only once (as exact)', async () => {
    const shared = mkRaw({ review_id: 'shared' });
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call += 1;
      if (call === 1) return makeChain({ data: [shared], error: null });                       // tier 1
      return makeChain({ data: [shared, mkRaw({ review_id: 't2' })], error: null });            // tier 2
    });

    const result = await getThemedReviewsForSlug('prod-123', 'pokemon', 3);

    // shared should appear once as 'exact'; t2 should fill in as 'themed'
    expect(result.map((r) => r.review_id)).toEqual(['shared', 't2']);
    expect(result.map((r) => r._source)).toEqual(['exact', 'themed']);
  });

  it('returns an empty array when no reviews exist anywhere (all tiers empty)', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: [], error: null }));

    const result = await getThemedReviewsForSlug('prod-123', 'pokemon', 3);

    expect(result).toEqual([]);
  });

  it('propagates supabase errors from the tier-1 query', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: null, error: { message: 'boom' } }));

    await expect(getThemedReviewsForSlug('prod-123', 'pokemon', 3))
      .rejects.toEqual({ message: 'boom' });
  });

  it('respects the limit parameter (never returns more than `limit` reviews)', async () => {
    const fiveRows = [
      mkRaw({ review_id: 'a' }),
      mkRaw({ review_id: 'b' }),
      mkRaw({ review_id: 'c' }),
      mkRaw({ review_id: 'd' }),
      mkRaw({ review_id: 'e' }),
    ];
    mockSupabase.from.mockReturnValue(makeChain({ data: fiveRows, error: null }));

    const result = await getThemedReviewsForSlug('prod-123', 'pokemon', 2);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.review_id)).toEqual(['a', 'b']);
  });
});
