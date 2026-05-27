import {
  applyMaskedHslRecolor,
  buildMaskOverlayData,
  constrainDimensions,
  getMaskStrength,
  hexToRgb,
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
