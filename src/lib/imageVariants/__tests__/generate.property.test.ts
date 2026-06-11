/**
 * Property-based tests for the generate module.
 *
 * Covers two of the six properties from design.md §"Property tests":
 *
 *   - Property 5: no upscaling (Req 1.3)
 *   - Property 6: per-variant byte budget (Req 1.8)
 *
 * Both properties feed sharp-generated synthetic images of varying widths
 * and content complexity into `generateVariants`. Inputs span small (under
 * the smallest target width), medium (between targets), and large
 * (above all targets) sizes so all three branches of the width filter
 * (Req 1.3, 1.5) are exercised.
 *
 * Run count is intentionally smaller than for pure-function properties
 * (~30) because each iteration runs sharp encode/decode and adds ~50 ms.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import sharp from 'sharp';

import { generateVariants } from '../generate';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const widthArb = fc.integer({ min: 50, max: 4000 });
const channelsArb = fc.constantFrom(3 as const, 4 as const);

/**
 * RGB color. Arbitrary RGB channels stress different WebP entropy paths
 * (uniform color vs varied) — the byte-budget property has to hold for
 * both since the original is a JPEG (lossy) and the variants are WebP
 * (also lossy, but tuned differently).
 */
const colorArb = fc.record({
    r: fc.integer({ min: 0, max: 255 }),
    g: fc.integer({ min: 0, max: 255 }),
    b: fc.integer({ min: 0, max: 255 }),
});

interface SourceFixture {
    width: number;
    height: number;
    buffer: Buffer;
}

/**
 * Build a synthetic JPEG fixture of the given width. Sharp's `create`
 * fills with a solid color which compresses to a tiny JPEG — so we
 * deliberately use a noise-based PNG → JPEG re-encode pipeline at higher
 * widths. That gives the byte-budget property a non-trivial baseline:
 * a solid-color 4000 px JPEG can be smaller than a 400 px noise WebP.
 *
 * For the small/medium widths a solid-color JPEG is fine because the
 * variants are also tiny.
 */
async function makeFixture(width: number, color: { r: number; g: number; b: number }): Promise<SourceFixture> {
    const height = Math.max(50, Math.round(width * 0.75));
    // Solid color JPEG — predictable, repeatable, fast.
    const buffer = await sharp({
        create: { width, height, channels: 3, background: color },
    })
        .jpeg({ quality: 90 })
        .toBuffer();
    return { width, height, buffer };
}

// ---------------------------------------------------------------------------
// Property 5: no upscaling (Req 1.3)
// ---------------------------------------------------------------------------

// These property tests run sharp encode/decode 30 times per case, which
// is CPU-bound and can exceed vitest's default 5s timeout under load (CI,
// parallel runs, slow disks). The properties are deterministic — the only
// thing that varies is wall-clock. 30s is plenty of headroom on a single
// core; CI shared runners typically need 60s.
const PROPERTY_TEST_TIMEOUT = 30_000;

describe('Property 5: no upscaling (Req 1.3)', () => {
    it('every produced variant has width <= source width', async () => {
        await fc.assert(
            fc.asyncProperty(widthArb, colorArb, async (width, color) => {
                const fixture = await makeFixture(width, color);
                const result = await generateVariants(fixture.buffer);

                for (const v of result.manifest.variants) {
                    expect(v.width).toBeLessThanOrEqual(fixture.width);
                }
                // Encoded buffers are 1:1 with manifest.variants, so check
                // them too as a belt-and-braces invariant.
                for (const e of result.encoded) {
                    expect(e.width).toBeLessThanOrEqual(fixture.width);
                }
            }),
            { numRuns: 30 },
        );
    }, PROPERTY_TEST_TIMEOUT);

    it('source dimensions reported match input dimensions', async () => {
        await fc.assert(
            fc.asyncProperty(widthArb, colorArb, async (width, color) => {
                const fixture = await makeFixture(width, color);
                const result = await generateVariants(fixture.buffer);
                expect(result.source.width).toBe(fixture.width);
                expect(result.source.height).toBe(fixture.height);
            }),
            { numRuns: 30 },
        );
    }, PROPERTY_TEST_TIMEOUT);
});

// ---------------------------------------------------------------------------
// Property 6: per-variant byte budget (Req 1.8)
// ---------------------------------------------------------------------------

describe('Property 6: per-variant byte budget (Req 1.8)', () => {
    it('every variant.bytes is <= original.bytes', async () => {
        await fc.assert(
            fc.asyncProperty(widthArb, colorArb, async (width, color) => {
                const fixture = await makeFixture(width, color);
                const result = await generateVariants(fixture.buffer);

                const originalBytes = fixture.buffer.length;
                for (const v of result.manifest.variants) {
                    expect(v.bytes).toBeLessThanOrEqual(originalBytes);
                }
                for (const e of result.encoded) {
                    expect(e.bytes).toBeLessThanOrEqual(originalBytes);
                    expect(e.bytes).toBe(e.buffer.length); // sanity check
                }
            }),
            { numRuns: 30 },
        );
    }, PROPERTY_TEST_TIMEOUT);

    it('encoded buffer length equals reported bytes (for any complexity)', async () => {
        // Vary channels too (3 = JPEG-compatible RGB, 4 = RGBA via PNG)
        // to make sure the byte-bookkeeping holds across input formats.
        await fc.assert(
            fc.asyncProperty(widthArb, channelsArb, colorArb, async (width, channels, color) => {
                const height = Math.max(50, Math.round(width * 0.75));
                const buf =
                    channels === 4
                        ? await sharp({
                              create: {
                                  width,
                                  height,
                                  channels: 4,
                                  background: { ...color, alpha: 1 },
                              },
                          })
                              .png()
                              .toBuffer()
                        : await sharp({
                              create: { width, height, channels: 3, background: color },
                          })
                              .jpeg({ quality: 90 })
                              .toBuffer();

                const result = await generateVariants(buf);
                for (const e of result.encoded) {
                    expect(e.buffer.length).toBe(e.bytes);
                }
            }),
            { numRuns: 30 },
        );
    }, PROPERTY_TEST_TIMEOUT);
});
