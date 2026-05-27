import { hslToRgb, rgbToHsl } from '@/lib/instantIcingRecolor';

export interface IcingLayerAdjustments {
  hueShift: number;
  saturationShift: number;
  lightnessShift: number;
  blackThreshold?: number;
  blackSoftness?: number;
}

const DEFAULT_BLACK_THRESHOLD = 14;
const DEFAULT_BLACK_SOFTNESS = 28;

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
