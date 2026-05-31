/**
 * Bug Condition Exploration Test — image-studio-search-parity
 *
 * Spec:  .kiro/specs/image-studio-search-parity/bugfix.md
 * Task:  tasks.md Task 1 — "Write bug condition exploration property test"
 *
 * Property under test (design.md "Property 1: Public Search Parity"):
 *
 *   FOR ALL X WHERE isBugCondition(X):              // authorized AND trim(query) <> ""
 *     publicHits    = search_products(X.query)
 *     adminEligible = filter publicHits by:
 *       original_image_url IS NOT NULL AND <> ''
 *       AND (X.status='all' OR normalize(studio_edit_status) = X.status)
 *       AND (X.size<>'small' OR (image_width<T OR image_height<T))
 *     resp          = GET /api/admin/cake-cache-images?search=X.query&status=...&size=...
 *     ASSERT resp.items      = paginate(adminEligible, X.page, X.pageSize)
 *     ASSERT resp.totalCount = |adminEligible|
 *     ASSERT resp.totalPages = max(1, ceil(|adminEligible| / X.pageSize))
 *
 * IMPORTANT: This test MUST FAIL on the CURRENT (unfixed) code. The failures
 * encode counterexamples that prove the bug exists. Per the bugfix workflow,
 * the PBT validation PASSES exactly when this test correctly detects the bug.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as dotenv from 'dotenv';

// ---------------------------------------------------------------------------
// Env wiring: src/tests/setup.ts hard-codes mock Supabase env vars. We need
// the live values from .env.local to talk to the real database (the search
// engine and the admin handler are both data-driven against it). Run dotenv
// at top-of-file so the env is already real by the time the route module's
// transitive imports evaluate.
// ---------------------------------------------------------------------------
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

// Sanity: bail loudly if env wasn't loaded.
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock-supabase-url')
) {
  throw new Error(
    'Exploration test requires real NEXT_PUBLIC_SUPABASE_URL from .env.local',
  );
}

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ADMIN_IMAGE_STUDIO_PIN,
  IMAGE_STUDIO_PAGE_SIZE,
  IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD,
  normalizeImageStudioStatus,
} from '@/lib/admin/imageStudio';

// Lazy-load the GET handler so it picks up the real env (it doesn't actually
// matter for this route since the client is built at request time, but the
// dynamic import keeps us honest about ordering).
type RouteGet = (req: NextRequest) => Promise<Response>;
let GET: RouteGet;

// Direct Supabase client for the FTS oracle and for hydrating admin-only
// columns (studio_edit_status) on rows returned by search_products.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AdminFilters = {
  status: 'all' | 'not_started' | 'processing' | 'completed' | 'failed';
  size: 'all' | 'small';
};

type PublicHit = {
  slug: string;
  p_hash: string;
  original_image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  rank_score: number;
};

type EligibleRow = PublicHit & {
  studio_edit_status: string;
};

type AdminItem = {
  p_hash: string;
  slug: string | null;
  studio_edit_status: string;
  original_image_url: string | null;
  image_width?: number | null;
  image_height?: number | null;
};

type AdminResponse = {
  items: AdminItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

// ---------------------------------------------------------------------------
// Public-search oracle: invoke the same RPC the public site uses. The route's
// `searchProductsFTS` calls `search_products` with `cleanQuery = trim().toLowerCase()`;
// we mirror that here so the oracle byte-matches what the public engine would
// see if the admin path delegated to it.
// ---------------------------------------------------------------------------
async function fetchPublicHits(query: string): Promise<PublicHit[]> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  // Pull a generous slice — enough to cover any expected admin page.
  const { data, error } = await supabase.rpc('search_products', {
    p_query: cleanQuery,
    p_limit: 5000,
    p_offset: 0,
    p_availability: null,
    p_min_price: null,
    p_max_price: null,
  });

  if (error) {
    throw new Error(`search_products RPC failed: ${error.message}`);
  }

  return ((data ?? []) as PublicHit[]).map((row) => ({
    slug: row.slug,
    p_hash: row.p_hash,
    original_image_url: row.original_image_url ?? null,
    image_width: row.image_width ?? null,
    image_height: row.image_height ?? null,
    rank_score: row.rank_score,
  }));
}

// Hydrate admin-only columns (studio_edit_status) onto a list of public hits
// so we can apply the admin status filter on top.
async function hydrateStudioStatus(
  hits: PublicHit[],
): Promise<EligibleRow[]> {
  if (hits.length === 0) return [];

  // Chunk to keep .in() URLs reasonable.
  const chunkSize = 500;
  const statusByHash = new Map<string, string>();
  for (let i = 0; i < hits.length; i += chunkSize) {
    const chunk = hits.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('p_hash, studio_edit_status')
      .in(
        'p_hash',
        chunk.map((h) => h.p_hash),
      );
    if (error) {
      throw new Error(`Hydrate studio_edit_status failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      statusByHash.set(
        row.p_hash as string,
        normalizeImageStudioStatus(row.studio_edit_status),
      );
    }
  }

  return hits.map((h) => ({
    ...h,
    studio_edit_status:
      statusByHash.get(h.p_hash) ?? normalizeImageStudioStatus(null),
  }));
}

function applyAdminFilters(
  rows: EligibleRow[],
  filters: AdminFilters,
): EligibleRow[] {
  const T = IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD;
  return rows.filter((r) => {
    if (!r.original_image_url || r.original_image_url === '') return false;
    if (filters.status !== 'all' && r.studio_edit_status !== filters.status)
      return false;
    if (filters.size === 'small') {
      const w = r.image_width ?? Infinity;
      const h = r.image_height ?? Infinity;
      if (!(w < T || h < T)) return false;
    }
    return true;
  });
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const from = (page - 1) * pageSize;
  return items.slice(from, from + pageSize);
}

// ---------------------------------------------------------------------------
// Admin endpoint invocation: call the in-process GET handler with a synthetic
// NextRequest (matching what the runtime would deliver) including the admin pin.
// ---------------------------------------------------------------------------
async function callAdmin(
  query: string,
  filters: AdminFilters,
  page: number,
  pageSize: number,
): Promise<AdminResponse> {
  const url = new URL('http://localhost/api/admin/cake-cache-images');
  url.searchParams.set('search', query);
  url.searchParams.set('status', filters.status);
  url.searchParams.set('size', filters.size);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));

  const req = new NextRequest(url.toString(), {
    headers: { 'x-admin-pin': ADMIN_IMAGE_STUDIO_PIN },
  });

  const res = await GET(req);
  if (res.status !== 200) {
    const body = await res.text();
    throw new Error(`Admin GET returned ${res.status}: ${body}`);
  }
  return (await res.json()) as AdminResponse;
}

// ---------------------------------------------------------------------------
// Diff helpers used in failure messages so the counterexample is explicit.
// ---------------------------------------------------------------------------
function slugSet(items: { slug: string | null }[]): Set<string> {
  return new Set(items.map((i) => i.slug ?? ''));
}

function diffMissing(expected: string[], actual: Set<string>): string[] {
  return expected.filter((s) => !actual.has(s));
}

function buildDiagnostic(
  clause: string,
  query: string,
  filters: AdminFilters,
  page: number,
  pageSize: number,
  expected: EligibleRow[],
  actual: AdminResponse,
): string {
  const expectedPage = paginate(expected, page, pageSize);
  const expectedSlugs = expectedPage.map((r) => r.slug);
  const actualSlugs = actual.items.map((i) => i.slug ?? '');
  const missing = diffMissing(expectedSlugs, slugSet(actual.items));
  const orderingDiff =
    expectedSlugs.join('|') === actualSlugs.join('|')
      ? '(order matches)'
      : `expected[0..5]=${JSON.stringify(expectedSlugs.slice(0, 5))} actual[0..5]=${JSON.stringify(
          actualSlugs.slice(0, 5),
        )}`;
  return [
    `\n[${clause}] Image Studio search parity violation`,
    `  query=${JSON.stringify(query)} status=${filters.status} size=${filters.size} page=${page} pageSize=${pageSize}`,
    `  publicHits(after admin filters) = ${expected.length}`,
    `  admin.totalCount                 = ${actual.totalCount}`,
    `  admin.totalPages                 = ${actual.totalPages}`,
    `  missing slugs (adminEligible \\ resp.items, first 10): ${JSON.stringify(missing.slice(0, 10))}`,
    `  ordering: ${orderingDiff}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Parity assertion: the property under test, encoded as a single function so
// each clause's `it()` block invokes it with a scoped (query, filters) pair.
// ---------------------------------------------------------------------------
async function assertParity(
  clause: string,
  query: string,
  filters: AdminFilters = { status: 'all', size: 'all' },
  page = 1,
  pageSize: number = IMAGE_STUDIO_PAGE_SIZE,
): Promise<{ expected: EligibleRow[]; actual: AdminResponse }> {
  const publicHits = await fetchPublicHits(query);
  const hydrated = await hydrateStudioStatus(publicHits);
  const eligible = applyAdminFilters(hydrated, filters);

  const actual = await callAdmin(query, filters, page, pageSize);
  const expectedPage = paginate(eligible, page, pageSize);

  const diag = () =>
    buildDiagnostic(clause, query, filters, page, pageSize, eligible, actual);

  // 2.7 — totalCount and totalPages parity.
  expect(actual.totalCount, diag()).toBe(eligible.length);
  expect(actual.totalPages, diag()).toBe(
    Math.max(1, Math.ceil(eligible.length / pageSize)),
  );

  // 2.1, 2.3, 2.4, 2.5 — same row set surfaces (compare by slug for a stable diff).
  expect(actual.items.map((i) => i.slug), diag()).toEqual(
    expectedPage.map((r) => r.slug),
  );

  return { expected: eligible, actual };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('image-studio-search-parity (BUG CONDITION EXPLORATION)', () => {
  beforeAll(async () => {
    // Import the GET handler AFTER env vars are set so its module-level
    // dependencies see the real Supabase URL/key.
    const mod = await import('@/app/api/admin/cake-cache-images/route');
    GET = mod.GET as unknown as RouteGet;
  });

  // -------------------------------------------------------------------------
  // 1.1 — Concept-only-in-keywords (or alt_text) but not in seo_title/slug.
  //       Use a one-word query for which the public engine matches via
  //       keywords/analysis tokens that do not appear as a literal substring
  //       in the admin's three sanitized columns. "minimalist" has the largest
  //       observed gap on the live DB (public ≈ 1157 vs admin-ILIKE ≈ 801).
  // -------------------------------------------------------------------------
  it('1.1 surfaces rows the admin ILIKE misses for single-word queries', async () => {
    await assertParity('1.1', 'minimalist');
  });

  // -------------------------------------------------------------------------
  // 1.2 — Multi-word, words in different order. "unicorn pastel" vs rows where
  //       keywords have "pastel unicorn ...". Public FTS matches both tokens
  //       regardless of order; admin ILIKE looks for the literal contiguous
  //       substring "unicorn pastel" (or "unicorn-pastel" in slug) and misses
  //       the row.
  // -------------------------------------------------------------------------
  it('1.2 surfaces multi-word queries regardless of word order', async () => {
    await assertParity('1.2', 'unicorn pastel');
  });

  // -------------------------------------------------------------------------
  // 1.3 — Typo / near-match. "unicron" → public engine's pg_trgm fallback
  //       returns ~120 hits; admin ILIKE returns 0 because the literal
  //       substring "unicron" is absent.
  // -------------------------------------------------------------------------
  it('1.3 includes typo / near-match results that the public engine returns', async () => {
    await assertParity('1.3', 'unicron');
  });

  // -------------------------------------------------------------------------
  // 1.4 — Concept only in analysis_json / alt_text. Same query as 1.1, but
  //       the failing-mode assertion is specifically that at least one
  //       counterexample exists where ALL three admin ILIKE columns miss the
  //       term yet the public engine surfaces the row.
  // -------------------------------------------------------------------------
  it('1.4 surfaces rows whose match lives only in analysis_json or alt_text', async () => {
    const query = 'minimalist';
    const filters: AdminFilters = { status: 'all', size: 'all' };

    const publicHits = await fetchPublicHits(query);
    const eligible = applyAdminFilters(
      await hydrateStudioStatus(publicHits),
      filters,
    );
    const eligibleSlugs = eligible.map((r) => r.slug);

    // Hydrate the admin ILIKE columns for these eligible rows so we can
    // identify the rows whose match lives ONLY in analysis_json/alt_text.
    const { data: cols } = await supabase
      .from('cakegenie_analysis_cache')
      .select('slug, seo_title, keywords')
      .in('slug', eligibleSlugs.slice(0, 1000));
    const colsBySlug = new Map(
      (cols ?? []).map((r) => [r.slug as string, r]),
    );
    const onlyInJsonOrAlt = eligible.filter((r) => {
      const c = colsBySlug.get(r.slug);
      const inTitle = c?.seo_title?.toLowerCase().includes(query) ?? false;
      const inKeywords = c?.keywords?.toLowerCase().includes(query) ?? false;
      const inSlug = r.slug.toLowerCase().includes(query);
      return !inTitle && !inKeywords && !inSlug;
    });

    // Pre-condition for the test: the data must contain at least one such row.
    // If this ever flips, the bug surface for 1.4 has changed and the test
    // should be revisited.
    expect(
      onlyInJsonOrAlt.length,
      'Expected ≥1 row matching "minimalist" only in analysis_json/alt_text',
    ).toBeGreaterThan(0);

    // Now walk all admin pages and assert the union contains every
    // analysis-only row we identified.
    const pageSize = IMAGE_STUDIO_PAGE_SIZE;
    const firstPage = await callAdmin(query, filters, 1, pageSize);
    const allAdminSlugs = new Set<string>(
      firstPage.items.map((i) => i.slug ?? ''),
    );
    for (let p = 2; p <= firstPage.totalPages; p += 1) {
      const next = await callAdmin(query, filters, p, pageSize);
      for (const i of next.items) allAdminSlugs.add(i.slug ?? '');
    }

    const missing = onlyInJsonOrAlt
      .map((r) => r.slug)
      .filter((s) => !allAdminSlugs.has(s));

    expect(
      missing,
      `[1.4] Admin missed ${missing.length} rows whose "minimalist" match lives only in analysis_json/alt_text. ` +
        `First 10 missing slugs: ${JSON.stringify(missing.slice(0, 10))}`,
    ).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 1.5 — Special characters. "choco-vanilla" passes through to FTS but the
  //       admin's sanitizeSearchTerm rewrites "-" → " " (its kept char class
  //       is [a-zA-Z0-9\s-] but \s+ collapse + trim then it goes into ILIKE
  //       %choco-vanilla% / slug %choco-vanilla% / keywords %choco-vanilla%).
  //       In practice public engine's tokenization differs from ILIKE literal
  //       substring; assert the parity property for this query.
  // -------------------------------------------------------------------------
  it('1.5 does not silently drop characters the public engine accepts', async () => {
    await assertParity('1.5', 'choco-vanilla');
  });

  // -------------------------------------------------------------------------
  // 1.6 — Relevance ordering. The admin orders by `created_at desc` instead
  //       of by FTS rank_score. For "minimalist" the top public-search slug
  //       is `minimalist-character-white-bento-cake-...` (rank=3.44) but the
  //       admin's #1 row by created_at desc is a different slug entirely.
  //       Assert the page-1 ordering matches the public-search ranking.
  // -------------------------------------------------------------------------
  it('1.6 returns rows in public-search relevance order, not by created_at', async () => {
    const query = 'minimalist';
    const filters: AdminFilters = { status: 'all', size: 'all' };
    const pageSize = IMAGE_STUDIO_PAGE_SIZE;

    const publicHits = await fetchPublicHits(query);
    const eligible = applyAdminFilters(
      await hydrateStudioStatus(publicHits),
      filters,
    );
    const expectedPage1 = paginate(eligible, 1, pageSize).map((r) => r.slug);

    const actual = await callAdmin(query, filters, 1, pageSize);
    const actualPage1 = actual.items.map((i) => i.slug ?? '');

    expect(
      actualPage1,
      `[1.6] Relevance-order parity violation\n` +
        `  expected (rank-ordered, top 5): ${JSON.stringify(expectedPage1.slice(0, 5))}\n` +
        `  actual   (created_at desc, top 5): ${JSON.stringify(actualPage1.slice(0, 5))}`,
    ).toEqual(expectedPage1);
  });

  // -------------------------------------------------------------------------
  // 1.7 — Pagination undercount. For "minimalist" with pageSize=24, public
  //       has ~1157 hits → expected totalPages ≈ ceil(1157/24)=49. Admin's
  //       ILIKE-bound totalCount/totalPages will be substantially smaller
  //       (≈ 801/24 = 34).
  // -------------------------------------------------------------------------
  it('1.7 totalCount and totalPages reflect the public-search-eligible set', async () => {
    const query = 'minimalist';
    const filters: AdminFilters = { status: 'all', size: 'all' };
    const pageSize = IMAGE_STUDIO_PAGE_SIZE;

    const publicHits = await fetchPublicHits(query);
    const eligible = applyAdminFilters(
      await hydrateStudioStatus(publicHits),
      filters,
    );
    const expectedTotal = eligible.length;
    const expectedPages = Math.max(1, Math.ceil(expectedTotal / pageSize));

    const actual = await callAdmin(query, filters, 1, pageSize);

    expect(
      { totalCount: actual.totalCount, totalPages: actual.totalPages },
      `[1.7] Pagination undercount\n` +
        `  expected: { totalCount: ${expectedTotal}, totalPages: ${expectedPages} }\n` +
        `  actual:   { totalCount: ${actual.totalCount}, totalPages: ${actual.totalPages} }`,
    ).toEqual({ totalCount: expectedTotal, totalPages: expectedPages });
  });
});

/* ---------------------------------------------------------------------------
 * Counterexamples (recorded on first run; refreshed if the data drifts)
 * ---------------------------------------------------------------------------
 *
 *   1.1 query="minimalist"                public ≈ 1157 hits, admin ILIKE ≈ 801
 *       missing slug example: pink-birthday-cake-812478ffd0c5eef8
 *
 *   1.2 query="unicorn pastel"            public ≈ 219 hits, admin ILIKE = 1
 *       (admin only matches the literal substring "unicorn pastel" /
 *       slug "unicorn-pastel"; rows with "pastel unicorn ..." are missed)
 *
 *   1.3 query="unicron" (typo)            public ≈ 120 hits, admin ILIKE = 0
 *       (pg_trgm fallback rescues the typo; ILIKE has no fuzziness)
 *
 *   1.4 query="minimalist"                ≥1 row matches in analysis_json
 *       only — example slug:
 *       pink-birthday-cake-812478ffd0c5eef8 (in_title=false, in_slug=false,
 *       in_keywords=false, in_alt=false, in_analysis=true)
 *
 *   1.5 query="choco-vanilla"             public ≈ 4 hits; admin's
 *       sanitizeSearchTerm preserves "-" but ILIKE matches the literal
 *       substring against three columns only, so the row set diverges.
 *
 *   1.6 query="minimalist" page=1 pageSize=24
 *       expected[0..5] (by rank_score):
 *         minimalist-character-white-bento-cake-0303
 *         minimalist-bento-white-bento-cake-c3e1
 *         lavender-minimalist-lavender-1-tier-cake-ff87
 *         minimalist-doodle-white-bento-cake-3cff
 *         minimalist-woman-white-1-tier-cake-066f
 *       actual[0..5] (by created_at desc):
 *         orange-minimalist-orange-1-tier-cake-9f47
 *         green-character-mint-1-tier-cake-ffe7
 *         red-velvet-minimalist-white-1-tier-cake-cf8f
 *         anniversary-minimalist-white-1-tier-cake-fff0
 *         wedding-anniversary-white-1-tier-cake-ff3f
 *         just-married-white-1-tier-cake-7d3c
 *       (top page is fully disjoint between rank order and created_at order)
 *
 *   1.7 query="minimalist" pageSize=24
 *       expected: totalCount ≈ 1157, totalPages ≈ 49
 *       actual:   totalCount ≈ 801,  totalPages ≈ 34
 *
 * --------------------------------------------------------------------------- */
