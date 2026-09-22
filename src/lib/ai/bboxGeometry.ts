/**
 * Shared pure coordinate-conversion utilities for bounding-box overlays.
 *
 * These are the single source of truth for converting detected cake-element
 * geometry (Gemini normalized 0–1000 space and legacy center-origin app
 * coordinates) into display pixels. Both the customer customizer overlay and
 * any read-only inspection surface must import from here instead of
 * re-implementing the math.
 */

import type {
    GeneratedBox2D,
    GeneratedIntegratedBox2D,
    GeneratedIntegratedBboxConfidence,
} from './generatedAnalysisContract';

export type DisplayBox = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export type ImageOffset = { left: number; top: number };

/**
 * Color palette for detected-element box types.
 */
export const OVERLAY_COLORS = {
    main_topper: '#10B981',      // Green
    support_element: '#3B82F6',  // Blue
    cake_message: '#F59E0B',     // Amber
    cake: '#22C55E',             // Distinct green for cake body
    default: '#8B5CF6'           // Purple
} as const;

export const MEASUREMENT_COLORS = {
    diameter: '#22C55E',
    height: '#0EA5E9',
} as const;

/**
 * Scale a Gemini bbox from its normalized 0–1000, top-left coordinate space
 * to the rendered image. Gemini emits this normalized space regardless of the
 * original file's natural pixel dimensions.
 */
export function normalizedToDisplay(
    x: number,
    y: number,
    width: number,
    height: number,
    containerWidth: number,
    containerHeight: number,
): DisplayBox {
    const scaleX = containerWidth / 1000;
    const scaleY = containerHeight / 1000;
    return {
        left: x * scaleX,
        top: y * scaleY,
        width: width * scaleX,
        height: height * scaleY,
    };
}

export function normalizedPointToDisplay(
    point: { x: number; y: number },
    containerWidth: number,
    containerHeight: number,
): { x: number; y: number } {
    return {
        x: point.x * (containerWidth / 1000),
        y: point.y * (containerHeight / 1000),
    };
}

/**
 * Convert legacy center-origin app coordinates to display pixels.
 * Historical cached analyses store bbox origins in this center-origin space.
 */
export function appCoordinatesToDisplay(
    appX: number,
    appY: number,
    appWidth: number,
    appHeight: number,
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number,
): DisplayBox {
    const imgX = appX + (imageWidth / 2);
    const imgY = (imageHeight / 2) - appY;
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    return {
        left: imgX * scaleX,
        top: imgY * scaleY,
        width: appWidth * scaleX,
        height: appHeight * scaleY,
    };
}

/**
 * Apply the rendered image's origin (relative to its containing frame) so
 * boxes stay aligned when the image is cropped, centered, scrolled, or shown
 * with `object-cover`.
 */
export function applyImageOffset(
    display: DisplayBox,
    offset: ImageOffset,
): DisplayBox {
    return {
        ...display,
        left: display.left + offset.left,
        top: display.top + offset.top,
    };
}

/**
 * Normalize an integrated `box_2d` value into individual unit boxes.
 * A four-number array is a single box; an array of arrays holds one entry per
 * representative unit (repeated decorations must stay separate).
 */
export function splitIntegratedBox2D(box2d: GeneratedIntegratedBox2D): GeneratedBox2D[] {
    if (box2d.length === 4 && box2d.every((value) => typeof value === 'number')) {
        return [box2d as GeneratedBox2D];
    }
    return box2d as GeneratedBox2D[];
}

/**
 * Align per-unit confidences with per-unit boxes. A single scalar confidence
 * applies to every unit; an array is positional.
 */
export function alignUnitConfidences(
    unitBoxCount: number,
    confidence: GeneratedIntegratedBboxConfidence | undefined,
): Array<number | undefined> {
    if (Array.isArray(confidence)) {
        return confidence as Array<number | undefined>;
    }
    return Array.from({ length: unitBoxCount }, () => confidence);
}

/**
 * Validate a normalized [yMin, xMin, yMax, xMax] unit box. Invalid or missing
 * geometry must never be rendered as a box.
 */
export function isValidBox2DUnit(unit: unknown): unit is GeneratedBox2D {
    return Array.isArray(unit)
        && unit.length === 4
        && unit.every((value) => typeof value === 'number' && Number.isFinite(value))
        && unit[0] >= 0 && unit[1] >= 0
        && unit[2] > unit[0] && unit[3] > unit[1];
}

/**
 * Validate a legacy { x, y, width, height } bbox. Negative or non-finite
 * values indicate missing/invalid geometry and must be skipped.
 */
export function isValidLegacyBbox(bbox: unknown): bbox is { x: number; y: number; width: number; height: number } {
    return typeof bbox === 'object' && bbox !== null
        && ['x', 'y', 'width', 'height'].every((key) => {
            const value = (bbox as Record<string, unknown>)[key];
            return typeof value === 'number' && Number.isFinite(value);
        })
        && (bbox as { width: number }).width > 0
        && (bbox as { height: number }).height > 0;
}

export type MeasurementLineGeometry = {
    left: number;
    top: number;
    width: number;
    height: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    midpointX: number;
    midpointY: number;
    length: number;
    angle: number;
};

/**
 * Convert a normalized 0–1000 measurement line into display-pixel geometry,
 * including rotated-line rendering data and the image offset.
 */
export function measurementLineToDisplay(
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    containerWidth: number,
    containerHeight: number,
    offset: ImageOffset,
): MeasurementLineGeometry {
    const start = normalizedPointToDisplay(startPoint, containerWidth, containerHeight);
    const end = normalizedPointToDisplay(endPoint, containerWidth, containerHeight);
    const left = Math.min(start.x, end.x) + offset.left;
    const top = Math.min(start.y, end.y) + offset.top;
    const startX = start.x + offset.left - left;
    const startY = start.y + offset.top - top;
    const endX = end.x + offset.left - left;
    const endY = end.y + offset.top - top;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;

    return {
        left,
        top,
        width: Math.abs(deltaX),
        height: Math.abs(deltaY),
        startX,
        startY,
        endX,
        endY,
        midpointX: (startX + endX) / 2,
        midpointY: (startY + endY) / 2,
        length: Math.hypot(deltaX, deltaY),
        angle: Math.atan2(deltaY, deltaX) * (180 / Math.PI),
    };
}
