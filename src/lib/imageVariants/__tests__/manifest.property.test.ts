/**
 * Property-based tests for the manifest module.
 *
 * Covers three of the six properties listed in design.md §"Property tests":
 *
 *   - Property 1: serialize/parse round-trip is stable (Req 11.3)
 *   - Property 2: srcset widths strictly ascending (Req 6.2, 11.4)
 *   - Property 4: pickFallbackSrc respects the width bound (Req 6.5)
 *
 * Each property runs ≥100 randomized cases by default. The arbitraries
 * are constrained to the shape the worker actually produces — positive
 * integer widths, non-empty URL strings, non-negative byte counts — so
 * the tests don't degenerate into the parser's null-rejection branches
 * (which are already covered by manifest.test.ts).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
    parseManifest,
    serializeManifest,
    buildSrcSet,
    pickFallbackSrc,
} from '../manifest';
import type { Variant, VariantManifest } from '../types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * A single Variant. Width is a small positive integer (image widths in
 * pixels never realistically exceed 8192). URL is constrained to URL-
 * safe characters because the production worker only ever produces
 * Supabase storage URLs — paths like `https://.../variants/<phash>/<w>.webp`
 * which never contain spaces, commas, or `w` adjacent to digits. Using
 * an unconstrained string here would let fast-check produce inputs that
 * collide with the srcset format itself (e.g. URL containing `, ` or
 * `<n>w`), masking the actual `buildSrcSet` invariant under parser noise.
 */
const variantArb: fc.Arbitrary<Variant> = fc.record({
    width: fc.integer({ min: 1, max: 8192 }),
    url: fc.stringMatching(/^[A-Za-z0-9\-_./:?=&]+$/, { minLength: 5, maxLength: 80 }),
    bytes: fc.integer({ min: 0, max: 5_000_000 }),
});

/**
 * A VariantManifest with at least one variant. We constrain widths to be
 * unique within a manifest so the post-sort order is deterministic — the
 * `serializeManifest` contract sorts ascending but doesn't promise any
 * particular order for duplicate widths (which would only ever come from
 * a buggy pipeline anyway).
 */
const manifestArb: fc.Arbitrary<VariantManifest> = fc
    .record({
        format: fc.constant('webp' as const),
        source: fc.constantFrom(
            'studio_edited_image_url' as const,
            'original_image_url' as const,
        ),
        variants: fc
            .uniqueArray(variantArb, {
                minLength: 1,
                maxLength: 8,
                selector: (v) => v.width,
            }),
    });

// ---------------------------------------------------------------------------
// Property 1: serialize/parse round-trip (Req 11.3)
// ---------------------------------------------------------------------------

describe('Property 1: manifest serialize/parse round-trip (Req 11.3)', () => {
    it('parseManifest(serializeManifest(m)) is deeply equal to a width-sorted m', () => {
        fc.assert(
            fc.property(manifestArb, (m) => {
                const sortedExpected: VariantManifest = {
                    ...m,
                    variants: [...m.variants].sort((a, b) => a.width - b.width),
                };
                const round1 = parseManifest(serializeManifest(m));
                expect(round1).toEqual(sortedExpected);
            }),
            { numRuns: 100 },
        );
    });

    it('two round-trips produce structurally equal output', () => {
        // Property in spec: parseManifest(serializeManifest(parseManifest(serializeManifest(m))))
        // === parseManifest(serializeManifest(m)). Idempotency.
        fc.assert(
            fc.property(manifestArb, (m) => {
                const once = parseManifest(serializeManifest(m));
                expect(once).not.toBeNull();
                const twice = parseManifest(serializeManifest(once!));
                expect(twice).toEqual(once);
            }),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 2: srcset widths strictly ascending (Req 6.2, 11.4)
// ---------------------------------------------------------------------------

describe('Property 2: srcset widths strictly ascending (Req 6.2, 11.4)', () => {
    it('emitted widths in buildSrcSet are strictly ascending regardless of input order', () => {
        fc.assert(
            fc.property(manifestArb, (m) => {
                // Shuffle the input variants to exercise the internal sort.
                const shuffled: VariantManifest = {
                    ...m,
                    variants: [...m.variants].reverse(),
                };
                const srcset = buildSrcSet(shuffled);
                if (m.variants.length === 0) {
                    expect(srcset).toBe('');
                    return;
                }
                // Split on the standard srcset separator (`, `) and pull
                // the trailing `<num>w` descriptor from each entry. Using
                // a global regex on the whole string would also match
                // `<num>w` substrings embedded inside variant URLs (URLs
                // are arbitrary strings in the arbitrary), giving a false
                // positive on the ordering check.
                const entries = srcset.split(', ');
                expect(entries).toHaveLength(m.variants.length);
                const widths = entries.map((entry) => {
                    const match = entry.match(/ (\d+)w$/);
                    expect(match).not.toBeNull();
                    return Number(match![1]);
                });
                for (let i = 1; i < widths.length; i++) {
                    expect(widths[i]).toBeGreaterThan(widths[i - 1]);
                }
            }),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 4: pickFallbackSrc respects the width bound (Req 6.5)
// ---------------------------------------------------------------------------

describe('Property 4: pickFallbackSrc respects the width bound (Req 6.5)', () => {
    it('returns a variant with width <= maxWidth when at least one such variant exists', () => {
        fc.assert(
            fc.property(
                manifestArb,
                fc.integer({ min: 1, max: 8192 }),
                (m, maxWidth) => {
                    // Only run the assertion when the precondition holds: at
                    // least one variant has width ≤ maxWidth.
                    const hasFitting = m.variants.some((v) => v.width <= maxWidth);
                    fc.pre(hasFitting);

                    const url = pickFallbackSrc(m, maxWidth);
                    expect(url).not.toBeNull();
                    // Find the variant matching the returned URL and verify
                    // its width is within the bound.
                    const chosen = m.variants.find((v) => v.url === url);
                    expect(chosen).toBeDefined();
                    expect(chosen!.width).toBeLessThanOrEqual(maxWidth);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('returns the smallest variant when every variant exceeds maxWidth', () => {
        fc.assert(
            fc.property(manifestArb, (m) => {
                // Pick a maxWidth strictly less than the smallest variant.
                const minWidth = Math.min(...m.variants.map((v) => v.width));
                const maxWidth = minWidth - 1;
                fc.pre(maxWidth >= 1);

                const url = pickFallbackSrc(m, maxWidth);
                expect(url).not.toBeNull();
                const chosen = m.variants.find((v) => v.url === url);
                expect(chosen!.width).toBe(minWidth);
            }),
            { numRuns: 100 },
        );
    });
});
