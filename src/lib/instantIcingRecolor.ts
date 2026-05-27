export type RecolorSurfaceKey =
  | 'top'
  | 'side'
  | 'drip'
  | 'borderTop'
  | 'borderBase'
  | 'gumpasteBaseBoard';

export interface SurfaceMaskLayer {
  key: RecolorSurfaceKey;
  label: string;
  colorHex: string;
  enabled: boolean;
  maskData: Uint8ClampedArray;
}

export interface RenderDimensions {
  width: number;
  height: number;
  scale: number;
}

const EPSILON = 0.0001;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.trim().replace('#', '');
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return {
    r: Number.parseInt(fullHex.slice(0, 2), 16),
    g: Number.parseInt(fullHex.slice(2, 4), 16),
    b: Number.parseInt(fullHex.slice(4, 6), 16),
  };
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta < EPSILON) {
    return { h: 0, s: 0, l };
  }

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h = 0;

  switch (max) {
    case rn:
      h = (gn - bn) / delta + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / delta + 2;
      break;
    default:
      h = (rn - gn) / delta + 4;
      break;
  }

  return { h: (h * 60) % 360, s, l };
}

export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (huePrime >= 0 && huePrime < 1) {
    rn = chroma;
    gn = x;
  } else if (huePrime < 2) {
    rn = x;
    gn = chroma;
  } else if (huePrime < 3) {
    gn = chroma;
    bn = x;
  } else if (huePrime < 4) {
    gn = x;
    bn = chroma;
  } else if (huePrime < 5) {
    rn = x;
    bn = chroma;
  } else {
    rn = chroma;
    bn = x;
  }

  const match = l - chroma / 2;

  return {
    r: Math.round((rn + match) * 255),
    g: Math.round((gn + match) * 255),
    b: Math.round((bn + match) * 255),
  };
}

export function constrainDimensions(
  width: number,
  height: number,
  maxDimension: number
): RenderDimensions {
  if (width <= 0 || height <= 0) {
    throw new Error('Image dimensions must be positive');
  }

  const longestSide = Math.max(width, height);

  if (maxDimension <= 0 || longestSide <= maxDimension) {
    return { width, height, scale: 1 };
  }

  const scale = maxDimension / longestSide;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export function getMaskStrength(
  r: number,
  g: number,
  b: number,
  a: number
): number {
  if (a <= 0) return 0;

  const alpha = a / 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return clamp(alpha * luminance, 0, 1);
}

export function applyMaskedHslRecolor({
  baseData,
  maskData,
  targetHex,
  intensity = 1,
}: {
  baseData: Uint8ClampedArray;
  maskData: Uint8ClampedArray;
  targetHex: string;
  intensity?: number;
}): void {
  if (baseData.length !== maskData.length) {
    throw new Error('Base image and mask must have the same pixel buffer length');
  }

  const { r: targetR, g: targetG, b: targetB } = hexToRgb(targetHex);
  const targetHsl = rgbToHsl(targetR, targetG, targetB);
  const clampedIntensity = clamp(intensity, 0, 1);

  for (let index = 0; index < baseData.length; index += 4) {
    const strength =
      getMaskStrength(
        maskData[index],
        maskData[index + 1],
        maskData[index + 2],
        maskData[index + 3]
      ) * clampedIntensity;

    if (strength <= EPSILON) {
      continue;
    }

    const baseR = baseData[index];
    const baseG = baseData[index + 1];
    const baseB = baseData[index + 2];
    const baseA = baseData[index + 3];
    const baseHsl = rgbToHsl(baseR, baseG, baseB);

    const nextHue = lerpHue(baseHsl.h, targetHsl.h, strength);
    const saturationGoal =
      targetHsl.s < 0.05
        ? targetHsl.s
        : Math.max(baseHsl.s * 0.35, targetHsl.s * 0.95);
    const lightnessBlend =
      targetHsl.s < 0.05
        ? baseHsl.l * 0.6 + targetHsl.l * 0.4
        : baseHsl.l * 0.82 + targetHsl.l * 0.18;

    const nextSaturation = lerp(baseHsl.s, clamp(saturationGoal, 0, 1), strength);
    const nextLightness = lerp(baseHsl.l, clamp(lightnessBlend, 0, 1), strength);
    const recolored = hslToRgb(nextHue, nextSaturation, nextLightness);

    baseData[index] = recolored.r;
    baseData[index + 1] = recolored.g;
    baseData[index + 2] = recolored.b;
    baseData[index + 3] = baseA;
  }
}

export function buildMaskOverlayData(
  maskData: Uint8ClampedArray,
  colorHex: string,
  opacity = 0.32
): Uint8ClampedArray {
  const { r, g, b } = hexToRgb(colorHex);
  const clampedOpacity = clamp(opacity, 0, 1);
  const overlay = new Uint8ClampedArray(maskData.length);

  for (let index = 0; index < maskData.length; index += 4) {
    const strength = getMaskStrength(
      maskData[index],
      maskData[index + 1],
      maskData[index + 2],
      maskData[index + 3]
    );

    if (strength <= EPSILON) {
      continue;
    }

    overlay[index] = r;
    overlay[index + 1] = g;
    overlay[index + 2] = b;
    overlay[index + 3] = Math.round(255 * clampedOpacity * strength);
  }

  return overlay;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function lerpHue(start: number, end: number, amount: number): number {
  const delta = ((end - start + 540) % 360) - 180;
  return (start + delta * amount + 360) % 360;
}
