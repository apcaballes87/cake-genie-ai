import {
  buildAdjustedIcingLayer,
  getLayerColorAdjustments,
} from '@/lib/icingLayerComposite';
import { constrainDimensions } from '@/lib/instantIcingRecolor';

/**
 * Maximum constrained working dimension (longest side) used when compositing the
 * recolored icing preview. Matches the internal icing recolor lab
 * (`src/app/admin/icing-recolor-lab/IcingRecolorLabClient.tsx`) so the customizer
 * and the lab render at the same scale.
 */
export const PREVIEW_MAX_DIMENSION = 1200;

export interface RecolorWithMaskParams {
  /** The current working cake image, fully loaded (drawn as the base layer). */
  baseImage: HTMLImageElement;
  /** Decoded icing mask pixels (icing rendered red, everything else pitch-black). */
  maskImageData: ImageData;
  /** Native width of the decoded mask, used to detect/scale dimension mismatches. */
  maskWidth: number;
  /** Native height of the decoded mask, used to detect/scale dimension mismatches. */
  maskHeight: number;
  /** Target icing color as a hex string (e.g. `#FFC0CB`). */
  targetHex: string;
}

/**
 * Recolors a cake's icing entirely client-side by keying out the black pixels of a
 * pre-generated icing mask and applying an HSL shift (from the mask's base red
 * `#FF0000`) toward `targetHex`, then compositing that adjusted icing layer over the
 * original base photo.
 *
 * This is the warm-path compositor: it performs no network or Gemini calls. It is a
 * pure, reusable port of the `renderPreview` canvas logic in the icing recolor lab,
 * operating on an `HTMLImageElement` base plus a decoded mask `ImageData`.
 *
 * Working dimensions are constrained via `constrainDimensions`, which throws
 * `'Image dimensions must be positive'` when the base image has a non-positive width
 * or height. That error is allowed to propagate so the caller can leave the current
 * preview unchanged (producing no output) — satisfying the "non-positive base
 * dimensions" guard.
 *
 * @returns an `image/webp` data URL of the recolored cake at the constrained working
 *   dimensions.
 * @throws if the base image has non-positive dimensions, or if a required canvas 2D
 *   context cannot be created.
 */
export function recolorWithMask({
  baseImage,
  maskImageData,
  maskWidth,
  maskHeight,
  targetHex,
}: RecolorWithMaskParams): string {
  // Step 1: constrain the working dimensions to the preview size (parity with the lab).
  // constrainDimensions throws on non-positive base dimensions; we let it propagate so
  // the caller produces no output and leaves the current preview unchanged.
  const dimensions = constrainDimensions(
    baseImage.naturalWidth,
    baseImage.naturalHeight,
    PREVIEW_MAX_DIMENSION
  );

  // Step 2: draw the base image onto a working canvas at the constrained dimensions.
  const workCanvas = document.createElement('canvas');
  workCanvas.width = dimensions.width;
  workCanvas.height = dimensions.height;

  const workContext = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workContext) {
    throw new Error('Could not create working canvas context');
  }

  workContext.drawImage(baseImage, 0, 0, dimensions.width, dimensions.height);

  // Step 3: ensure the mask matches the working dimensions, rescaling when they differ.
  const maskData =
    maskWidth === dimensions.width && maskHeight === dimensions.height
      ? maskImageData
      : rescaleMaskImageData(maskImageData, maskWidth, maskHeight, dimensions.width, dimensions.height);

  // Step 4: compute the HSL shift from the mask base color (#FF0000) to the target color.
  const adjustments = getLayerColorAdjustments(targetHex);

  // Step 5: key out black + apply the HSL shift to produce the recolored icing layer.
  const adjustedLayer = buildAdjustedIcingLayer(maskData.data, {
    hueShift: adjustments.hueShift,
    saturationShift: adjustments.saturationShift,
    lightnessShift: adjustments.lightnessShift,
  });

  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = dimensions.width;
  layerCanvas.height = dimensions.height;

  const layerContext = layerCanvas.getContext('2d', { willReadFrequently: true });
  if (!layerContext) {
    throw new Error('Could not create adjusted layer canvas context');
  }

  const adjustedImageData = new ImageData(
    Uint8ClampedArray.from(adjustedLayer),
    dimensions.width,
    dimensions.height
  );
  layerContext.putImageData(adjustedImageData, 0, 0);

  // Step 6: composite the recolored icing layer over the original photo.
  workContext.drawImage(layerCanvas, 0, 0);

  // Result may be lossy; only the stored mask must be lossless.
  return workCanvas.toDataURL('image/webp');
}

/**
 * Rescales a mask `ImageData` to the target working dimensions using an offscreen
 * canvas: the source mask is painted at its own dimensions, then drawn scaled onto a
 * second canvas at the working dimensions, and the result is read back.
 */
function rescaleMaskImageData(
  maskImageData: ImageData,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;

  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) {
    throw new Error('Could not create mask source canvas context');
  }
  sourceContext.putImageData(maskImageData, 0, 0);

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = targetWidth;
  scaledCanvas.height = targetHeight;

  const scaledContext = scaledCanvas.getContext('2d', { willReadFrequently: true });
  if (!scaledContext) {
    throw new Error('Could not create mask scaling canvas context');
  }
  scaledContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  return scaledContext.getImageData(0, 0, targetWidth, targetHeight);
}
