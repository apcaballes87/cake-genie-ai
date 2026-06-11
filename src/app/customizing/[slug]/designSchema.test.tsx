/**
 * Component-level tests for the `<DesignSchema>` JSON-LD emitter exported from
 * `src/app/customizing/[slug]/page.tsx`.
 *
 * Validates:
 *  - R1.1–R1.9 (AggregateRating priority/shape/omission)
 *  - R4.1–R4.7 (SKU/MPN resolution + offers mirror + permutation invariance)
 *  - R9.1, R9.2 (JSON-LD safety: sanitizer + JSON.parse round-trip)
 *
 * Property 6 (JSON-LD safety) PBT runs at numRuns: 100 over arbitrary props.
 */

/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- Test fixtures render to JSDOM, not Next.js; raw <img> is intentional. */

import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';

// --- Mocks for server-only / framework modules pulled in by page.tsx -------
// `<DesignSchema>` itself does not touch any of these, but importing it via
// `./page` evaluates the entire module graph, so we have to neuter the
// server-only imports up front.
vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));
vi.mock('../CustomizingClient', () => ({ default: () => null }));
vi.mock('@/components/LoadingSpinner', () => ({ LoadingSpinner: () => null }));
vi.mock('@/components/DesignAboutSection', () => ({
  DesignAboutSection: () => null,
}));
vi.mock('@/components/landing/LandingFooter', () => ({
  LandingFooter: () => null,
}));
vi.mock('@/components/LazyImage', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img data-testid="lazy-image" alt={alt} src={src} />
  ),
}));
vi.mock('@/contexts/CustomizationContext', () => ({
  CustomizationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/services/supabaseService', () => ({
  getCakeBasePriceOptions: vi.fn(),
  getRelatedProductsByKeywords: vi.fn(),
  getCollectionForDesignKeyword: vi.fn(),
}));

import { DesignSchema } from './page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyJson = Record<string, any>;

function getAllLdScripts(container: HTMLElement): HTMLScriptElement[] {
  return Array.from(
    container.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
  );
}

function unescapeAndParse(innerHtml: string): AnyJson {
  const html = innerHtml.replace(/\\u003c/g, '<');
  return JSON.parse(html);
}

function getProductGraph(container: HTMLElement): AnyJson | null {
  for (const s of getAllLdScripts(container)) {
    try {
      const obj = unescapeAndParse(s.innerHTML);
      if (obj && obj['@type'] === 'Product') return obj;
    } catch {
      // skip
    }
  }
  return null;
}

function baseDesign(overrides: Partial<AnyJson> = {}): AnyJson {
  return {
    slug: 'kuromi-cake',
    p_hash: 'abc123dehash',
    seo_title: 'Kuromi Cake Design',
    keywords: 'Kuromi',
    tags: ['light', 'purple'],
    price: 1299,
    original_image_url: 'https://example.com/img.webp',
    image_width: 1200,
    image_height: 1200,
    availability: 'preorder',
    alt_text: 'Kuromi cake alt',
    analysis_json: { cakeType: '1 Tier' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// R1 — AggregateRating
// ---------------------------------------------------------------------------

describe('DesignSchema — R1 aggregateRating', () => {
  it('emits aggregateRating from perDesignReviewStats when both qualify', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 100, averageRating: 4.8 }}
        isSiteReviewSummaryFallback={false}
        perDesignReviewStats={{ total: 5, averageRating: 4.5 }}
        linkedMerchantProducts={[]}
      />,
    );
    const product = getProductGraph(container);
    expect(product).not.toBeNull();
    expect(product!.aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: 4.5,
      reviewCount: 5,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it('emits aggregateRating from siteReviewSummary when perDesign null and !isFallback', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 27, averageRating: 4.83 }}
        isSiteReviewSummaryFallback={false}
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
      />,
    );
    const product = getProductGraph(container);
    expect(product!.aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: 4.83,
      reviewCount: 27,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it('omits aggregateRating when site is constant fallback {6, 4.8}', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 6, averageRating: 4.8 }}
        isSiteReviewSummaryFallback={true}
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
      />,
    );
    const product = getProductGraph(container);
    expect(product).not.toBeNull();
    expect(product!).not.toHaveProperty('aggregateRating');
  });

  it('omits aggregateRating when neither qualifies (site total === 0)', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 0, averageRating: 0 }}
        isSiteReviewSummaryFallback={false}
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
      />,
    );
    const product = getProductGraph(container);
    expect(product).not.toBeNull();
    expect(product!).not.toHaveProperty('aggregateRating');
  });

  it('emits ratingValue as JSON number ≤ 2 decimals and reviewCount as JSON integer', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 27, averageRating: 4.876543 }}
        isSiteReviewSummaryFallback={false}
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
      />,
    );
    const product = getProductGraph(container);
    const rv = product!.aggregateRating.ratingValue;
    const rc = product!.aggregateRating.reviewCount;
    expect(typeof rv).toBe('number');
    expect(rv).toBe(4.88);
    expect(typeof rc).toBe('number');
    expect(Number.isInteger(rc)).toBe(true);
    expect(rc).toBe(27);
  });

  it('emits bestRating: 5 and worstRating: 1 as numbers', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 12, averageRating: 4.2 }}
        isSiteReviewSummaryFallback={false}
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
      />,
    );
    const product = getProductGraph(container);
    expect(typeof product!.aggregateRating.bestRating).toBe('number');
    expect(typeof product!.aggregateRating.worstRating).toBe('number');
    expect(product!.aggregateRating.bestRating).toBe(5);
    expect(product!.aggregateRating.worstRating).toBe(1);
  });

  it('emits @type: "AggregateRating"', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 12, averageRating: 4.2 }}
        isSiteReviewSummaryFallback={false}
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
      />,
    );
    const product = getProductGraph(container);
    expect(product!.aggregateRating['@type']).toBe('AggregateRating');
  });

  it('omits aggregateRating when perDesign.total === 0', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 6, averageRating: 4.8 }}
        isSiteReviewSummaryFallback={true}
        perDesignReviewStats={{ total: 0, averageRating: 4.5 }}
        linkedMerchantProducts={[]}
      />,
    );
    const product = getProductGraph(container);
    expect(product!).not.toHaveProperty('aggregateRating');
  });
});

// ---------------------------------------------------------------------------
// R4 — SKU/MPN resolution
// ---------------------------------------------------------------------------

describe('DesignSchema — R4 SKU/MPN resolution', () => {
  const renderWith = (overrides: {
    design?: Partial<AnyJson>;
    listings?: { product_id: string }[];
  }) => {
    const { container } = render(
      <DesignSchema
        design={baseDesign(overrides.design)}
        siteReviewSummary={{ total: 6, averageRating: 4.8 }}
        isSiteReviewSummaryFallback={true}
        perDesignReviewStats={null}
        linkedMerchantProducts={overrides.listings ?? []}
      />,
    );
    return getProductGraph(container)!;
  };

  it('Case A: empty linkedMerchantProducts → sku=slug, mpn=p_hash', () => {
    const product = renderWith({ listings: [] });
    expect(product.sku).toBe('kuromi-cake');
    expect(product.mpn).toBe('abc123dehash');
    expect(product.offers.sku).toBe(product.sku);
    expect(product.offers.mpn).toBe(product.mpn);
  });

  it('Case B: one listing → sku=product_id', () => {
    const product = renderWith({ listings: [{ product_id: 'PROD-42' }] });
    expect(product.sku).toBe('PROD-42');
    expect(product.mpn).toBe('abc123dehash');
  });

  it('Case B (multi): sku = lex-min product_id', () => {
    const product = renderWith({
      listings: [
        { product_id: 'PROD-42' },
        { product_id: 'PROD-07' },
        { product_id: 'PROD-99' },
      ],
    });
    expect(product.sku).toBe('PROD-07');
  });

  it('Case C: collision (product_id === p_hash) → sku = slug + ":design" (R4.5)', () => {
    const product = renderWith({
      listings: [{ product_id: 'abc123dehash' }],
    });
    expect(product.mpn).toBe('abc123dehash');
    expect(product.sku).toBe('kuromi-cake:design');
    expect(product.sku).not.toBe(product.mpn);
  });

  it('mpn = slug when p_hash is null/undefined/empty (R4.2)', () => {
    for (const p_hash of [null, undefined, '']) {
      const product = renderWith({
        design: { p_hash },
        listings: [],
      });
      // sku and mpn would both be slug → collision tiebreaker fires
      expect(product.mpn).toBe('kuromi-cake');
      expect(product.sku).toBe('kuromi-cake:design');
    }
  });

  it('Product.sku === offers.sku and Product.mpn === offers.mpn (R4.7)', () => {
    const product = renderWith({
      listings: [{ product_id: 'XZ-1' }, { product_id: 'AA-2' }],
    });
    expect(product.sku).toBe(product.offers.sku);
    expect(product.mpn).toBe(product.offers.mpn);
  });

  it('result is invariant under permutations of linkedMerchantProducts (R4.6)', () => {
    const orderings: { product_id: string }[][] = [
      [{ product_id: 'PROD-42' }, { product_id: 'PROD-07' }, { product_id: 'PROD-99' }],
      [{ product_id: 'PROD-07' }, { product_id: 'PROD-99' }, { product_id: 'PROD-42' }],
      [{ product_id: 'PROD-99' }, { product_id: 'PROD-42' }, { product_id: 'PROD-07' }],
    ];
    const results = orderings.map((listings) => {
      const product = renderWith({ listings });
      return { sku: product.sku, mpn: product.mpn };
    });
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i]).toEqual(results[0]);
    }
  });
});

// ---------------------------------------------------------------------------
// R9 — JSON-LD safety
// ---------------------------------------------------------------------------

describe('DesignSchema — R9 JSON-LD safety', () => {
  it('every emitted script[type="application/ld+json"] parses with JSON.parse', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 27, averageRating: 4.83 }}
        isSiteReviewSummaryFallback={false}
        perDesignReviewStats={null}
        linkedMerchantProducts={[{ product_id: 'PROD-42' }]}
      />,
    );
    const scripts = getAllLdScripts(container);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) {
      expect(() => unescapeAndParse(s.innerHTML)).not.toThrow();
    }
  });

  it('escapes "</script" via the existing sanitizer', () => {
    const design = baseDesign({
      seo_title: 'Foo </script>bar',
      alt_text: 'Hostile </script> alt text',
    });
    const { container } = render(
      <DesignSchema
        design={design}
        siteReviewSummary={{ total: 6, averageRating: 4.8 }}
        isSiteReviewSummaryFallback={true}
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
      />,
    );
    const scripts = getAllLdScripts(container);
    for (const s of scripts) {
      // After the `<` → \u003c escape applied by the component, the literal
      // substring `</script` must never appear in the emitted innerHTML.
      expect(s.innerHTML).not.toContain('</script');
    }
  });

  it('every emitted JSON-LD has @type set to one of: Product, ItemPage, BreadcrumbList, DefinedTermSet', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 6, averageRating: 4.8 }}
        isSiteReviewSummaryFallback={true}
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
      />,
    );
    const allowed = new Set(['Product', 'ItemPage', 'BreadcrumbList', 'DefinedTermSet']);
    const scripts = getAllLdScripts(container);
    expect(scripts.length).toBe(4);
    for (const s of scripts) {
      const obj = unescapeAndParse(s.innerHTML);
      expect(allowed.has(obj['@type'])).toBe(true);
    }
  });

  // Feature: customizing-pdp-seo-fixes, Property 6: JSON-LD safety
  // Validates: Requirements 9.1, 9.2
  it('Property 6: JSON-LD safety invariants', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'binary' }), // arbitrary seo_title
        fc.option(fc.string({ unit: 'binary' }), { nil: null }), // arbitrary alt_text
        fc.array(
          fc.record({ product_id: fc.string({ minLength: 1, maxLength: 32 }) }),
          { maxLength: 5 },
        ),
        fc.boolean(),
        (seoTitle, altText, listings, isFallback) => {
          const design = baseDesign({
            seo_title: seoTitle,
            alt_text: altText,
          });
          const { container, unmount } = render(
            <DesignSchema
              design={design}
              siteReviewSummary={{ total: 27, averageRating: 4.83 }}
              isSiteReviewSummaryFallback={isFallback}
              perDesignReviewStats={null}
              linkedMerchantProducts={listings}
            />,
          );
          try {
            const scripts = getAllLdScripts(container);
            expect(scripts.length).toBeGreaterThan(0);
            for (const s of scripts) {
              const innerHtml = s.innerHTML;
              // No raw '</script' should appear
              expect(innerHtml).not.toContain('</script');
              // After unescaping, JSON.parse must succeed
              expect(() => unescapeAndParse(innerHtml)).not.toThrow();
            }
          } finally {
            unmount();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('DesignSchema — R10 Product.review (themed-pool JSON-LD safety)', () => {
  // Mock-themed-review factory — only review_id, _source, and the
  // schema-relevant fields matter for these tests.
  const mkThemedReview = (id: string, source: 'exact' | 'themed' | 'recent') =>
    ({
      review_id: id,
      _source: source,
      rating: 5,
      title: `Great cake ${id}`,
      comment: `Loved it — review ${id}`,
      created_at: '2026-05-01T00:00:00Z',
    } as unknown as import('@/lib/reviews').ThemedReview);

  it('emits a Product.review array with only the exact-tier reviews', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 0, averageRating: 0 }}
        isSiteReviewSummaryFallback
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
        themedReviews={[
          mkThemedReview('e1', 'exact'),
          mkThemedReview('t1', 'themed'),
          mkThemedReview('r1', 'recent'),
          mkThemedReview('e2', 'exact'),
        ]}
      />,
    );
    const product = getProductGraph(container);
    expect(product).not.toBeNull();
    expect(Array.isArray(product!.review)).toBe(true);
    expect(product!.review).toHaveLength(2);
    // Themed and recent reviews must NOT appear — they're about other
    // products, and marking them up for this Product would be a
    // structured-data lie.
    const reviewIds = product!.review.map((r: { name?: string }) => r.name);
    expect(reviewIds).toEqual(['Great cake e1', 'Great cake e2']);
  });

  it('strips the _source discriminator from emitted review items', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 0, averageRating: 0 }}
        isSiteReviewSummaryFallback
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
        themedReviews={[mkThemedReview('e1', 'exact')]}
      />,
    );
    const product = getProductGraph(container);
    const reviewJson = JSON.stringify(product!.review);
    // _source is a UI-only field; it must never leak into JSON-LD.
    expect(reviewJson).not.toContain('_source');
  });

  it('omits the review field entirely when no exact-tier reviews exist', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 0, averageRating: 0 }}
        isSiteReviewSummaryFallback
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
        themedReviews={[
          mkThemedReview('t1', 'themed'),
          mkThemedReview('r1', 'recent'),
        ]}
      />,
    );
    const product = getProductGraph(container);
    expect(product!.review).toBeUndefined();
  });

  it('omits the review field when themedReviews prop is not passed', () => {
    // Backwards compatibility — the prop is optional, and pre-Step-C
    // callers don't supply it. The schema should still validate.
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 0, averageRating: 0 }}
        isSiteReviewSummaryFallback
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
      />,
    );
    const product = getProductGraph(container);
    expect(product!.review).toBeUndefined();
  });

  it('emits a valid schema.org/Review shape for each exact-tier review', () => {
    const { container } = render(
      <DesignSchema
        design={baseDesign()}
        siteReviewSummary={{ total: 0, averageRating: 0 }}
        isSiteReviewSummaryFallback
        perDesignReviewStats={null}
        linkedMerchantProducts={[]}
        themedReviews={[mkThemedReview('e1', 'exact')]}
      />,
    );
    const product = getProductGraph(container);
    const review = product!.review[0];
    expect(review['@type']).toBe('Review');
    expect(review.author).toMatchObject({ '@type': 'Person' });
    expect(typeof review.author.name).toBe('string');
    expect(review.datePublished).toBe('2026-05-01T00:00:00Z');
    expect(review.reviewBody).toBe('Loved it — review e1');
    expect(review.name).toBe('Great cake e1');
    expect(review.reviewRating).toMatchObject({
      '@type': 'Rating',
      ratingValue: 5,
      bestRating: 5,
      worstRating: 1,
    });
  });
});
