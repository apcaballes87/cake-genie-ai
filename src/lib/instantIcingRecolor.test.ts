import fc from 'fast-check';

import {
  applyMaskedHslRecolor,
  buildMaskOverlayData,
  constrainDimensions,
  getMaskStrength,
  hexToRgb,
  hslToRgb,
  rgbToHsl,
} from './instantIcingRecolor';

describe('instantIcingRecolor', () => {
  it('parses hex colors into rgb channels', () => {
    expect(hexToRgb('#98FF98')).toEqual({ r: 152, g: 255, b: 152 });
    expect(hexToRgb('fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('computes mask strength from luminance and alpha', () => {
    expect(getMaskStrength(255, 255, 255, 255)).toBeCloseTo(1, 5);
    expect(getMaskStrength(0, 0, 0, 255)).toBe(0);
    expect(getMaskStrength(255, 255, 255, 128)).toBeCloseTo(0.5019, 3);
  });

  it('does not change pixels outside the mask', () => {
    const baseData = new Uint8ClampedArray([
      200, 160, 160, 255,
      210, 170, 170, 255,
    ]);
    const original = new Uint8ClampedArray(baseData);
    const maskData = new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 0,
    ]);

    applyMaskedHslRecolor({
      baseData,
      maskData,
      targetHex: '#0000FF',
      intensity: 1,
    });

    expect(baseData.slice(4, 8)).toEqual(original.slice(4, 8));
    expect(baseData[2]).toBeGreaterThan(baseData[0]);
  });

  it('builds a translucent overlay only where the mask exists', () => {
    const overlay = buildMaskOverlayData(
      new Uint8ClampedArray([
        255, 255, 255, 255,
        0, 0, 0, 0,
      ]),
      '#00FFFF',
      1
    );

    expect(Array.from(overlay.slice(0, 4))).toEqual([0, 255, 255, 255]);
    expect(Array.from(overlay.slice(4, 8))).toEqual([0, 0, 0, 0]);
  });

  it('constrains large dimensions to a max side', () => {
    expect(constrainDimensions(2000, 1000, 1000)).toEqual({
      width: 1000,
      height: 500,
      scale: 0.5,
    });
  });
});

/**
 * Property 4: HSL round-trip stability
 * Validates: Requirements 9.3
 *
 * The mask-based recolor pipeline depends on the shared color math
 * (`hexToRgb` -> `rgbToHsl` -> `hslToRgb`) being a stable round-trip so a
 * recolor to the mask base color (#FF0000) reproduces the original red layer
 * with no drift. This asserts that for any rgb color in the full cube, the
 * hex -> rgb -> hsl -> rgb round-trip returns each channel within ±1.
 *
 * Pure black / grayscale has an undefined hue, but that is fine: rgbToHsl
 * returns hue=0, sat=0 for those, and hslToRgb reproduces the same rgb.
 */
describe('instantIcingRecolor color-math properties', () => {
  const channelArb = fc.integer({ min: 0, max: 255 });

  const toHex = (r: number, g: number, b: number): string => {
    const part = (value: number) => value.toString(16).padStart(2, '0');
    return `#${part(r)}${part(g)}${part(b)}`;
  };

  it('round-trips hex -> rgb -> hsl -> rgb within ±1 per channel', () => {
    fc.assert(
      fc.property(channelArb, channelArb, channelArb, (r, g, b) => {
        const hex = toHex(r, g, b);
        const rgb = hexToRgb(hex);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const roundTripped = hslToRgb(hsl.h, hsl.s, hsl.l);

        expect(Math.abs(roundTripped.r - rgb.r)).toBeLessThanOrEqual(1);
        expect(Math.abs(roundTripped.g - rgb.g)).toBeLessThanOrEqual(1);
        expect(Math.abs(roundTripped.b - rgb.b)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 500 }
    );
  });
});
