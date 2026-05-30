import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  getLayerColorAdjustments,
  MASK_LAYER_BASE_COLOR,
} from './icingLayerComposite';

/**
 * Property 4 (related): zero-shift at the mask base color
 * Validates: Requirements 9.3
 *
 * The icing mask paints the icing body in a fixed red base color
 * (`MASK_LAYER_BASE_COLOR` = #FF0000). When a customer selects a color equal
 * to that base color, the HSL recolor must apply zero hue, saturation, and
 * lightness shift so the composited output reproduces the mask's base red
 * layer with no drift.
 */
describe('getLayerColorAdjustments — zero-shift at the mask base color', () => {
  it('returns zero hue/saturation/lightness shift for #FF0000', () => {
    expect(getLayerColorAdjustments('#FF0000')).toEqual({
      hueShift: 0,
      saturationShift: 0,
      lightnessShift: 0,
    });
  });

  it('returns zero shift for the exported MASK_LAYER_BASE_COLOR constant', () => {
    expect(getLayerColorAdjustments(MASK_LAYER_BASE_COLOR)).toEqual({
      hueShift: 0,
      saturationShift: 0,
      lightnessShift: 0,
    });
  });

  it('returns zero shift regardless of the base-color hex casing or # prefix', () => {
    // The mask base color is always #FF0000; recoloring back to it from any
    // equivalent representation must still produce a no-op shift.
    const baseColorVariantArb = fc.constantFrom(
      '#FF0000',
      '#ff0000',
      'FF0000',
      'ff0000',
      '#F00',
      'f00'
    );

    fc.assert(
      fc.property(baseColorVariantArb, (hex) => {
        expect(getLayerColorAdjustments(hex)).toEqual({
          hueShift: 0,
          saturationShift: 0,
          lightnessShift: 0,
        });
      }),
      { numRuns: 100 }
    );
  });
});
