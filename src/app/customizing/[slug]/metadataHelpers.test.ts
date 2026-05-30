import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  truncateToWordBoundary,
  optimizeMetaDescription,
  resolveAggregateRating,
  resolveSkuMpn,
  FALLBACK_MIN_PRICE,
} from './metadataHelpers';

// ---------------------------------------------------------------------------
// truncateToWordBoundary
// ---------------------------------------------------------------------------

describe('truncateToWordBoundary', () => {
  it('does not append "..." or "…"', () => {
    const result = truncateToWordBoundary('hello world this is long', 12);
    expect(result.endsWith('...')).toBe(false);
    expect(result.endsWith('…')).toBe(false);
  });

  it('result.length <= maxLength', () => {
    for (const [input, max] of [
      ['hello world this is long', 12],
      ['short', 50],
      ['no spaces here', 5],
      ['a b c d e f g h i j', 10],
    ] as const) {
      const result = truncateToWordBoundary(input, max);
      expect(result.length).toBeLessThanOrEqual(max);
    }
  });

  it('truncates at last space <= maxLength when one exists', () => {
    expect(truncateToWordBoundary('hello world there', 12)).toBe('hello world');
  });

  it('falls back to substring(0, maxLength) when no space exists', () => {
    expect(truncateToWordBoundary('helloworldverylong', 5)).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// optimizeMetaDescription — R5
// ---------------------------------------------------------------------------

describe('optimizeMetaDescription — R5', () => {
  const SUFFIX_RE = / \| Price starts at ₱[\d,]+\. Customize now!$/;

  it('strips trailing "." then "…" then whitespace iteratively (R5.1)', () => {
    // Build a long input so truncation occurs and trailing punct/whitespace runs would stick
    const longPrefix = 'Beautiful custom cake design with intricate decorations and vibrant colors';
    const noisy = `${longPrefix} foo bar.   …. `;
    const out = optimizeMetaDescription(noisy, 1099);
    // The portion immediately preceding the suffix must NOT end in '.', '…', or whitespace
    const idx = out.lastIndexOf(' | Price starts at ');
    expect(idx).toBeGreaterThan(0);
    const head = out.slice(0, idx);
    expect(head).not.toMatch(/[.\u2026\s]$/);
  });

  it('does not contain "... |", "… |", or ".. |" (R5.2)', () => {
    const samples = [
      'Sample description ending in ellipsis…',
      'Sample description ending in dots...',
      'Sample description ending in two dots..',
      'A reasonably long description that should clearly fit within the budget without weirdness.',
      'Lots of trailing punct........',
      'Lots of unicode ellipsis ……',
    ];
    for (const s of samples) {
      const out = optimizeMetaDescription(s, 1099);
      expect(out).not.toContain('... |');
      expect(out).not.toContain('… |');
      expect(out).not.toContain('.. |');
    }
  });

  it('ends with " | Price starts at ₱X,XXX. Customize now!" preceded by non-punct char (R5.3)', () => {
    const out = optimizeMetaDescription('A perfectly normal description with text', 1099);
    expect(out).toMatch(SUFFIX_RE);
    const idx = out.lastIndexOf(' | Price starts at ');
    const charBefore = out.charAt(idx - 1);
    expect(charBefore).not.toBe('.');
    expect(charBefore).not.toBe('\u2026');
    expect(/\s/.test(charBefore)).toBe(false);
  });

  it('length ≤ 155 cp (R5.4)', () => {
    const long = 'lorem ipsum dolor sit amet '.repeat(40);
    const out = optimizeMetaDescription(long, 1099);
    expect([...out].length).toBeLessThanOrEqual(155);
  });

  it('length ≥ suffix length (R5.4 lower bound)', () => {
    const suffix = ' | Price starts at ₱1,099. Customize now!';
    const out = optimizeMetaDescription('hello', 1099);
    expect([...out].length).toBeGreaterThanOrEqual([...suffix].length);
  });

  it('input ending in "..." produces no ellipsis before " | " (R5.2 edge)', () => {
    const out = optimizeMetaDescription('Short description that ends...', 1099);
    expect(out).not.toContain('... |');
    expect(out).not.toContain('.. |');
  });

  it('input ending in "…" produces no ellipsis before " | " (R5.5 edge)', () => {
    const out = optimizeMetaDescription('Short description that ends…', 1099);
    expect(out).not.toContain('… |');
  });

  it('input ending in "." preserves a single "." when within budget (R5.5)', () => {
    const out = optimizeMetaDescription('Short text.', 1099);
    expect(out).toBe('Short text. | Price starts at ₱1,099. Customize now!');
  });

  it('already-fits input is returned with suffix appended, no truncation (R5.5)', () => {
    const input = 'A perfectly fine description';
    const out = optimizeMetaDescription(input, 1099);
    expect(out).toBe(`${input} | Price starts at ₱1,099. Customize now!`);
  });

  it('input "...." returns suffix-only beginning with "Price starts at ₱" (R5.6)', () => {
    const out = optimizeMetaDescription('....', 1099);
    expect(out).toBe('Price starts at ₱1,099. Customize now!');
  });

  it('input "    " (whitespace only) returns suffix-only (R5.6)', () => {
    const out = optimizeMetaDescription('    ', 1099);
    expect(out.startsWith('Price starts at ₱')).toBe(true);
    expect(out.endsWith('Customize now!')).toBe(true);
  });

  it('price === null uses FALLBACK_MIN_PRICE 1099', () => {
    const out = optimizeMetaDescription('Hello world', null);
    expect(FALLBACK_MIN_PRICE).toBe(1099);
    expect(out).toContain('₱1,099');
  });

  it('price === 0 uses FALLBACK_MIN_PRICE', () => {
    const out = optimizeMetaDescription('Hello world', 0);
    expect(out).toContain('₱1,099');
  });

  it('price === -50 uses FALLBACK_MIN_PRICE', () => {
    const out = optimizeMetaDescription('Hello world', -50);
    expect(out).toContain('₱1,099');
  });

  it('Property 4: output contract holds for arbitrary (desc, price)', () => {
    // Feature: customizing-pdp-seo-fixes, Property 4: optimizeMetaDescription output contract
    fc.assert(
      fc.property(
        fc.string({ unit: 'binary' }),
        fc.oneof(fc.constant(null), fc.constant(undefined), fc.double(), fc.integer()),
        (desc, price) => {
          const r = optimizeMetaDescription(desc, price as number | null);
          expect([...r].length).toBeLessThanOrEqual(155);
          expect(r).not.toContain('... |');
          expect(r).not.toContain('… |');
          expect(r).not.toContain('.. |');
          expect(r.endsWith('Customize now!')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// resolveAggregateRating — R1
// ---------------------------------------------------------------------------

describe('resolveAggregateRating — R1', () => {
  it('priority 1: perDesign wins when both qualify (R1.1, R1.3)', () => {
    const out = resolveAggregateRating({
      perDesign: { total: 10, averageRating: 4.5 },
      site: { total: 100, averageRating: 4.8 },
      isSiteFallback: false,
    });
    expect(out).not.toBeNull();
    expect(out!.ratingValue).toBe(4.5);
    expect(out!.reviewCount).toBe(10);
  });

  it('priority 2: site used when perDesign null and !isSiteFallback (R1.2)', () => {
    const out = resolveAggregateRating({
      perDesign: null,
      site: { total: 27, averageRating: 4.83 },
      isSiteFallback: false,
    });
    expect(out).not.toBeNull();
    expect(out!.ratingValue).toBe(4.83);
    expect(out!.reviewCount).toBe(27);
  });

  it('null when site is fallback (R1.9)', () => {
    const out = resolveAggregateRating({
      perDesign: null,
      site: { total: 6, averageRating: 4.8 },
      isSiteFallback: true,
    });
    expect(out).toBeNull();
  });

  it('null when neither qualifies (R1.4)', () => {
    const out = resolveAggregateRating({
      perDesign: null,
      site: { total: 0, averageRating: 0 },
      isSiteFallback: false,
    });
    expect(out).toBeNull();
  });

  it('null when perDesign has total=0', () => {
    const out = resolveAggregateRating({
      perDesign: { total: 0, averageRating: 4.5 },
      site: null as any,
      isSiteFallback: false,
    });
    expect(out).toBeNull();
  });

  it('null when perDesign averageRating < 1', () => {
    const out = resolveAggregateRating({
      perDesign: { total: 5, averageRating: 0.5 },
      site: null as any,
      isSiteFallback: false,
    });
    expect(out).toBeNull();
  });

  it('null when perDesign averageRating > 5', () => {
    const out = resolveAggregateRating({
      perDesign: { total: 5, averageRating: 5.5 },
      site: null as any,
      isSiteFallback: false,
    });
    expect(out).toBeNull();
  });

  it('null when site has total=0', () => {
    const out = resolveAggregateRating({
      perDesign: null,
      site: { total: 0, averageRating: 4.5 },
      isSiteFallback: false,
    });
    expect(out).toBeNull();
  });

  it('emits @type "AggregateRating" exactly (R1.6)', () => {
    const out = resolveAggregateRating({
      perDesign: { total: 10, averageRating: 4.5 },
      site: null as any,
      isSiteFallback: false,
    });
    expect(out!['@type']).toBe('AggregateRating');
  });

  it('emits bestRating 5 worstRating 1 as numbers (R1.5)', () => {
    const out = resolveAggregateRating({
      perDesign: { total: 10, averageRating: 4.5 },
      site: null as any,
      isSiteFallback: false,
    });
    expect(out!.bestRating).toBe(5);
    expect(out!.worstRating).toBe(1);
    expect(typeof out!.bestRating).toBe('number');
    expect(typeof out!.worstRating).toBe('number');
  });

  it('ratingValue rounded to ≤2 decimals (R1.7)', () => {
    const out = resolveAggregateRating({
      perDesign: { total: 10, averageRating: 4.876543 },
      site: null as any,
      isSiteFallback: false,
    });
    expect(out!.ratingValue).toBe(4.88);
  });

  it('reviewCount is JSON integer (R1.8)', () => {
    const out = resolveAggregateRating({
      perDesign: { total: 12, averageRating: 4.0 },
      site: null as any,
      isSiteFallback: false,
    });
    expect(typeof out!.reviewCount).toBe('number');
    expect(Number.isInteger(out!.reviewCount)).toBe(true);
    expect(out!.reviewCount).toBeGreaterThanOrEqual(1);
  });

  it('Property 1: priority resolver invariants', () => {
    // Feature: customizing-pdp-seo-fixes, Property 1: AggregateRating priority resolver
    const reviewStatsArb = fc.option(
      fc.record({
        total: fc.oneof(
          fc.integer({ min: -5, max: 50 }),
          fc.double({ min: -10, max: 50, noNaN: false }),
        ),
        averageRating: fc.oneof(
          fc.double({ min: 0, max: 6, noNaN: false }),
          fc.constant(Number.NaN),
          fc.constant(Number.POSITIVE_INFINITY),
        ),
      }),
      { nil: null },
    );

    fc.assert(
      fc.property(reviewStatsArb, reviewStatsArb, fc.boolean(), (perDesign, site, isSiteFallback) => {
        const out = resolveAggregateRating({
          perDesign: perDesign as any,
          site: site as any,
          isSiteFallback,
        });
        if (out === null) return;
        expect(out['@type']).toBe('AggregateRating');
        expect(out.bestRating).toBe(5);
        expect(out.worstRating).toBe(1);
        expect(typeof out.ratingValue).toBe('number');
        expect(Number.isFinite(out.ratingValue)).toBe(true);
        expect(out.ratingValue).toBeGreaterThanOrEqual(1);
        expect(out.ratingValue).toBeLessThanOrEqual(5);
        // ≤ 2 decimals
        const decimals = (String(out.ratingValue).split('.')[1] || '').length;
        expect(decimals).toBeLessThanOrEqual(2);
        expect(Number.isInteger(out.reviewCount)).toBe(true);
        expect(out.reviewCount).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// resolveSkuMpn — R4
// ---------------------------------------------------------------------------

describe('resolveSkuMpn — R4', () => {
  it('Case A: empty linkedMerchantProducts → sku=slug, mpn=p_hash', () => {
    const out = resolveSkuMpn({
      slug: 'kuromi-cake',
      p_hash: 'abc123',
      listings: [],
    });
    expect(out.sku).toBe('kuromi-cake');
    expect(out.mpn).toBe('abc123');
  });

  it('Case B: one listing → sku=product_id', () => {
    const out = resolveSkuMpn({
      slug: 'kuromi-cake',
      p_hash: 'abc123',
      listings: [{ product_id: 'PROD-42' }],
    });
    expect(out.sku).toBe('PROD-42');
    expect(out.mpn).toBe('abc123');
  });

  it('Case B (multi): sku = lex-min product_id', () => {
    const out = resolveSkuMpn({
      slug: 'kuromi-cake',
      p_hash: 'abc123',
      listings: [
        { product_id: 'PROD-99' },
        { product_id: 'PROD-10' },
        { product_id: 'PROD-50' },
      ],
    });
    expect(out.sku).toBe('PROD-10');
    expect(out.mpn).toBe('abc123');
  });

  it('Case C: collision → sku = slug + ":design" (R4.5)', () => {
    const out = resolveSkuMpn({
      slug: 'kuromi-cake',
      p_hash: 'abc123dehash',
      listings: [{ product_id: 'abc123dehash' }],
    });
    expect(out.mpn).toBe('abc123dehash');
    expect(out.sku).toBe('kuromi-cake:design');
    expect(out.sku).not.toBe(out.mpn);
  });

  it('mpn = slug when p_hash is null (R4.2)', () => {
    const out = resolveSkuMpn({
      slug: 'kuromi-cake',
      p_hash: null,
      listings: [],
    });
    expect(out.mpn).toBe('kuromi-cake');
  });

  it('mpn = slug when p_hash is undefined', () => {
    const out = resolveSkuMpn({
      slug: 'kuromi-cake',
      p_hash: undefined,
      listings: [],
    });
    expect(out.mpn).toBe('kuromi-cake');
  });

  it('mpn = slug when p_hash is empty string', () => {
    const out = resolveSkuMpn({
      slug: 'kuromi-cake',
      p_hash: '',
      listings: [],
    });
    expect(out.mpn).toBe('kuromi-cake');
  });

  it('result is invariant under permutations of listings (R4.6)', () => {
    const slug = 'kuromi-cake';
    const p_hash = 'abc123';
    const ids = ['PROD-99', 'PROD-10', 'PROD-50', 'PROD-25'];
    const baseline = resolveSkuMpn({
      slug,
      p_hash,
      listings: ids.map((product_id) => ({ product_id })),
    });
    const permutations = [
      ['PROD-10', 'PROD-25', 'PROD-50', 'PROD-99'],
      ['PROD-99', 'PROD-50', 'PROD-25', 'PROD-10'],
      ['PROD-50', 'PROD-99', 'PROD-10', 'PROD-25'],
    ];
    for (const perm of permutations) {
      const out = resolveSkuMpn({
        slug,
        p_hash,
        listings: perm.map((product_id) => ({ product_id })),
      });
      expect(out).toEqual(baseline);
    }
  });

  it('Property 3: SKU/MPN resolver invariants', () => {
    // Feature: customizing-pdp-seo-fixes, Property 3: SKU/MPN resolver invariants
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 64 }),
        ),
        fc.array(
          fc.record({ product_id: fc.string({ minLength: 1, maxLength: 32 }) }),
          { maxLength: 8 },
        ),
        (slug, p_hash, listings) => {
          const out = resolveSkuMpn({ slug, p_hash: p_hash as any, listings });
          // mpn rules
          if (typeof p_hash === 'string' && p_hash.length > 0) {
            // mpn is p_hash unless collision tiebreaker would swap sku
            expect(out.mpn).toBe(p_hash);
          } else {
            expect(out.mpn).toBe(slug);
          }
          // sku is non-empty
          expect(out.sku.length).toBeGreaterThan(0);
          // sku !== mpn whenever both non-empty
          expect(out.sku).not.toBe(out.mpn);
          // permutation invariance
          const reversed = [...listings].reverse();
          const out2 = resolveSkuMpn({ slug, p_hash: p_hash as any, listings: reversed });
          expect(out2).toEqual(out);
        },
      ),
      { numRuns: 100 },
    );
  });
});
