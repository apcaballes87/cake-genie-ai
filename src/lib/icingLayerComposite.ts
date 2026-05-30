import { hexToRgb, hslToRgb, rgbToHsl } from '@/lib/instantIcingRecolor';

export interface IcingLayerAdjustments {
  hueShift: number;
  saturationShift: number;
  lightnessShift: number;
  blackThreshold?: number;
  blackSoftness?: number;
}

const DEFAULT_BLACK_THRESHOLD = 14;
const DEFAULT_BLACK_SOFTNESS = 28;

/**
 * The fixed red base color the Gemini icing mask paints the icing body in.
 * All HSL recolor shifts are computed relative to this color.
 */
export const MASK_LAYER_BASE_COLOR = '#FF0000';

/**
 * Computes the HSL delta from the mask base color (#FF0000) to a target color.
 * Shared by the icing recolor lab and the customizer so both use one implementation.
 *
 * Reuses `hexToRgb` from `@/lib/instantIcingRecolor` (which throws on invalid hex).
 * Callers pass known-valid palette hexes (and #FF0000), so this is safe.
 */
export function getLayerColorAdjustments(targetHex: string): {
  hueShift: number;
  saturationShift: number;
  lightnessShift: number;
} {
  const baseRgb = hexToRgb(MASK_LAYER_BASE_COLOR);
  const targetRgb = hexToRgb(targetHex);
  const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
  const targetHsl = rgbToHsl(targetRgb.r, targetRgb.g, targetRgb.b);

  return {
    hueShift: targetHsl.h - baseHsl.h,
    saturationShift: Math.round((targetHsl.s - baseHsl.s) * 100),
    lightnessShift: Math.round((targetHsl.l - baseHsl.l) * 100),
  };
}

export function getNonBlackAlpha(
  r: number,
  g: number,
  b: number,
  threshold = DEFAULT_BLACK_THRESHOLD,
  softness = DEFAULT_BLACK_SOFTNESS
): number {
  const maxChannel = Math.max(r, g, b);

  if (maxChannel <= threshold) {
    return 0;
  }

  if (softness <= 0 || maxChannel >= threshold + softness) {
    return 1;
  }

  return clamp((maxChannel - threshold) / softness, 0, 1);
}

export function buildAdjustedIcingLayer(
  layerData: Uint8ClampedArray,
  {
    hueShift,
    saturationShift,
    lightnessShift,
    blackThreshold = DEFAULT_BLACK_THRESHOLD,
    blackSoftness = DEFAULT_BLACK_SOFTNESS,
  }: IcingLayerAdjustments
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(layerData.length);

  for (let index = 0; index < layerData.length; index += 4) {
    const r = layerData[index];
    const g = layerData[index + 1];
    const b = layerData[index + 2];
    const a = layerData[index + 3];

    if (a === 0) {
      continue;
    }

    const nonBlackAlpha = getNonBlackAlpha(r, g, b, blackThreshold, blackSoftness);
    if (nonBlackAlpha <= 0) {
      continue;
    }

    const baseHsl = rgbToHsl(r, g, b);
    const adjustedHue = normalizeHue(baseHsl.h + hueShift);
    const adjustedSaturation = clamp(baseHsl.s + saturationShift / 100, 0, 1);
    const adjustedLightness = clamp(baseHsl.l + lightnessShift / 100, 0, 1);
    const adjustedRgb = hslToRgb(adjustedHue, adjustedSaturation, adjustedLightness);

    output[index] = adjustedRgb.r;
    output[index + 1] = adjustedRgb.g;
    output[index + 2] = adjustedRgb.b;
    output[index + 3] = Math.round(a * nonBlackAlpha);
  }

  return output;
}

function normalizeHue(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
