import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  buildAdjustedIcingLayer,
  getLayerColorAdjustments,
  getNonBlackAlpha,
} from './icingLayerComposite';

/**
 * Property-based tests for the deterministic core of the icing compositor.
 *
 * These live in a separate file from `icingLayerComposite.test.ts` (the
 * example-based unit tests) so the property suites do not collide with the
 * existing hand-written cases.
 */

// A single RGBA pixel: four channel bytes in [0, 255].
const channelByteArb = fc.integer({ min: 0, max: 255 });
const pixelArb = fc.tuple(channelByteArb, channelByteArb, channelByteArb, channelByteArb);

/**
 * Builds a random `Uint8ClampedArray` whose length is always a multiple of 4
 * (one entry per RGBA pixel), matching the layout `buildAdjustedIcingLayer`
 * expects.
 */
const maskBufferArb = fc
  .array(pixelArb, { minLength: 0, maxLength: 64 })
  .map((pixels) => {
    const buffer = new Uint8ClampedArray(pixels.length * 4);
    pixels.forEach((pixel, pixelIndex) => buffer.set(pixel, pixelIndex * 4));
    return buffer;
  });

// Random HSL adjustment vector spanning the realistic shift ranges.
const adjustmentsArb = fc.record({
  hueShift: fc.integer({ min: -360, max: 360 }),
  saturationShift: fc.integer({ min: -100, max: 100 }),
  lightnessShift: fc.integer({ min: -100, max: 100 }),
});

// Random target color expressed as a valid 6-digit hex string.
const targetHexArb = fc
  .tuple(channelByteArb, channelByteArb, channelByteArb)
  .map(
    ([r, g, b]) =>
      `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
  );

describe('icingLayerComposite — property tests', () => {
  /**
   * Task 5.2 — Property 3: Recolor preserves geometry.
   * Validates: Requirements 8.3, 9.4.
   *
   * The layer builder must never mutate the caller's input buffer and must
   * always return a buffer of equal length, so the composited output keeps the
   * base image's pixel dimensions and framing.
   */
  it('buildAdjustedIcingLayer never mutates the input and preserves length (Property 3)', () => {
    fc.assert(
      fc.property(maskBufferArb, adjustmentsArb, (maskBuffer, adjustments) => {
        const inputClone = Uint8ClampedArray.from(maskBuffer);

        const output = buildAdjustedIcingLayer(maskBuffer, adjustments);

        // The input buffer is left exactly as it was passed in.
        expect(Array.from(maskBuffer)).toEqual(Array.from(inputClone));
        // The output is a fresh buffer of the same length (same geometry).
        expect(output.length).toBe(maskBuffer.length);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Task 5.3 — Property 7: Keyed-out pixels are untouched.
   * Validates: Requirements 9.2.
   *
   * Property 7 is ultimately about the COMPOSITOR result: for every mask pixel
   * whose `getNonBlackAlpha(r, g, b) == 0`, the composited output pixel must
   * equal the base pixel for all target hexes. Because the full canvas
   * composite (`recolorWithMask`) needs a real browser canvas, we assert the
   * deterministic guarantee that backs it at the layer-builder level instead:
   * for a pure-black / near-black mask pixel (max(r, g, b) <= blackThreshold,
   * default 14), `getNonBlackAlpha` returns 0 and `buildAdjustedIcingLayer`
   * leaves that output pixel fully transparent (alpha 0). The composite simply
   * `drawImage`s this transparent-alpha layer over the base, so transparent
   * layer pixels => the base pixel shows through unchanged.
   */
  it('leaves keyed-out (near-black) mask pixels fully transparent for all target hexes (Property 7)', () => {
    // A near-black, fully opaque pixel: each channel within the default black
    // threshold (14) so getNonBlackAlpha keys it out. Alpha is 255 to prove the
    // keying — not a zero input alpha — is what drives the transparent output.
    const nearBlackByteArb = fc.integer({ min: 0, max: 14 });
    const nearBlackMaskArb = fc
      .array(fc.tuple(nearBlackByteArb, nearBlackByteArb, nearBlackByteArb), {
        minLength: 1,
        maxLength: 64,
      })
      .map((pixels) => {
        const buffer = new Uint8ClampedArray(pixels.length * 4);
        pixels.forEach(([r, g, b], pixelIndex) => {
          buffer.set([r, g, b, 255], pixelIndex * 4);
        });
        return buffer;
      });

    fc.assert(
      fc.property(targetHexArb, nearBlackMaskArb, (targetHex, maskBuffer) => {
        const adjustments = getLayerColorAdjustments(targetHex);
        const output = buildAdjustedIcingLayer(maskBuffer, adjustments);

        for (let index = 0; index < output.length; index += 4) {
          // Precondition: this pixel is genuinely keyed out by the mask.
          expect(
            getNonBlackAlpha(maskBuffer[index], maskBuffer[index + 1], maskBuffer[index + 2])
          ).toBe(0);
          // The adjusted layer never paints over a keyed-out pixel, so the base
          // shows through unchanged when composited.
          expect(output[index + 3]).toBe(0);
        }
      }),
      { numRuns: 200 }
    );
  });
});
