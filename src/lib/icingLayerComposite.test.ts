import { buildAdjustedIcingLayer, getNonBlackAlpha } from './icingLayerComposite';

describe('icingLayerComposite', () => {
  it('treats pure black as fully transparent', () => {
    expect(getNonBlackAlpha(0, 0, 0)).toBe(0);
    expect(getNonBlackAlpha(8, 8, 8)).toBe(0);
  });

  it('keeps bright non-black pixels visible', () => {
    expect(getNonBlackAlpha(255, 20, 20)).toBe(1);
  });

  it('removes black pixels and keeps colored pixels in the adjusted layer', () => {
    const adjusted = buildAdjustedIcingLayer(
      new Uint8ClampedArray([
        0, 0, 0, 255,
        220, 40, 40, 255,
      ]),
      {
        hueShift: 0,
        saturationShift: 0,
        lightnessShift: 0,
      }
    );

    expect(Array.from(adjusted.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(adjusted[7]).toBe(255);
  });

  it('applies hue changes only to the visible layer pixels', () => {
    const adjusted = buildAdjustedIcingLayer(
      new Uint8ClampedArray([
        220, 40, 40, 255,
      ]),
      {
        hueShift: 120,
        saturationShift: 0,
        lightnessShift: 0,
      }
    );

    expect(adjusted[1]).toBeGreaterThan(adjusted[0]);
    expect(adjusted[1]).toBeGreaterThan(adjusted[2]);
    expect(adjusted[3]).toBe(255);
  });
});
