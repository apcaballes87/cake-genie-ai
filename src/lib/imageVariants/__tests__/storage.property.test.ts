/**
 * Property-based tests for the storage module.
 *
 * Covers Property 3 from design.md §"Property tests":
 *
 *   - Property 3: variant URL determinism (Req 12.1, 12.2)
 *
 * For any (p_hash, width) pair, repeated calls to `variantPath` and
 * `publicVariantUrl` must produce byte-identical outputs containing no
 * random / time-scoped / run-scoped segment. This guarantees the URL can
 * be safely cached forever (Req 9.4) and that the backfill is idempotent
 * (Req 9.2).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { SupabaseClient } from '@supabase/supabase-js';

import { variantPath, publicVariantUrl } from '../storage';

const fakeClient = {} as unknown as SupabaseClient;

// p_hash is a perceptual hash. In production it's always alphanumeric
// (with underscore/hyphen permitted by the column type but not produced
// by the hashing routine). The storage helpers don't validate the input,
// so we constrain the arbitrary to the realistic alphabet — a `?` or `#`
// in the input would create a URL with an unintended query/fragment, but
// the worker never feeds those characters to `variantPath`.
const pHashArb = fc.stringMatching(/^[A-Za-z0-9_-]+$/, { minLength: 1, maxLength: 32 });
const widthArb = fc.integer({ min: 1, max: 8192 });

describe('Property 3: variant URL determinism (Req 12.1, 12.2)', () => {
    it('variantPath is a pure function of (p_hash, width)', () => {
        fc.assert(
            fc.property(pHashArb, widthArb, (pHash, width) => {
                const a = variantPath(pHash, width);
                const b = variantPath(pHash, width);
                expect(a).toBe(b);
            }),
            { numRuns: 200 },
        );
    });

    it('variantPath output contains no random or time-scoped segments', () => {
        // The fingerprint must be exactly `variants/{pHash}/{width}.webp`
        // — no version suffix, no timestamp, no UUID.
        fc.assert(
            fc.property(pHashArb, widthArb, (pHash, width) => {
                const path = variantPath(pHash, width);
                expect(path).toBe(`variants/${pHash}/${Math.trunc(width)}.webp`);
                // No timestamp-like digit sequences (10+ digits suggests epoch ms).
                expect(path).not.toMatch(/\b\d{10,}\b/);
                // No UUID-like patterns.
                expect(path).not.toMatch(
                    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
                );
            }),
            { numRuns: 200 },
        );
    });

    it('publicVariantUrl is a pure function of (p_hash, width)', () => {
        fc.assert(
            fc.property(pHashArb, widthArb, (pHash, width) => {
                const a = publicVariantUrl(fakeClient, pHash, width);
                const b = publicVariantUrl(fakeClient, pHash, width);
                expect(a).toBe(b);
            }),
            { numRuns: 200 },
        );
    });

    it('publicVariantUrl never includes a query string or cache-busting token', () => {
        fc.assert(
            fc.property(pHashArb, widthArb, (pHash, width) => {
                const url = publicVariantUrl(fakeClient, pHash, width);
                expect(url).not.toContain('?');
                expect(url).not.toMatch(/[?&]t=/);
                expect(url).not.toMatch(/[?&]v=/);
                expect(url).not.toMatch(/[?&]token=/);
            }),
            { numRuns: 200 },
        );
    });

    it('publicVariantUrl is stable across a small time delta', async () => {
        // Time-scoped URL bugs (e.g. accidentally including `Date.now()`)
        // would surface here when we compute the URL on either side of a
        // setTimeout. 50 ms is enough to cross any millisecond boundary.
        await fc.assert(
            fc.asyncProperty(pHashArb, widthArb, async (pHash, width) => {
                const a = publicVariantUrl(fakeClient, pHash, width);
                await new Promise((r) => setTimeout(r, 5));
                const b = publicVariantUrl(fakeClient, pHash, width);
                expect(a).toBe(b);
            }),
            { numRuns: 30 }, // fewer runs because each waits 5 ms
        );
    });
});
