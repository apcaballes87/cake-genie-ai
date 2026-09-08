import type { ValidSize } from '@/constants/pricingEnums';
import {
  GENERATED_ANALYSIS_THICKNESSES_BY_CAKE_TYPE,
  GeneratedAnalysisContractError,
  reconcileCakeThicknessForType,
  type GeneratedBoundingBox,
  type GeneratedCakeThickness,
  type GeneratedCakeMeasurements,
} from '@/lib/ai/generatedAnalysisContract';

export const LOCAL_BBOX_AREA_REFERENCE_FACTOR = 0.90;

type SizeBand = {
  mediumAt: number;
  largeAt: number;
};

type LocalSizingItem = {
  type?: unknown;
  bbox?: unknown;
  size_line?: unknown;
  size?: unknown;
  [key: string]: unknown;
};

type LocalSizingAnalysis = {
  rejection?: { isRejected?: unknown };
  cakeType?: unknown;
  cakeThickness?: unknown;
  cake_measurements?: unknown;
  main_toppers?: unknown;
  support_elements?: unknown;
  [key: string]: unknown;
};

const GENERIC_BANDS: SizeBand = { mediumAt: 0.30, largeAt: 0.90 };
const TOY_BANDS: SizeBand = { mediumAt: 0.50, largeAt: 1.10 };
const FLOWER_BANDS: SizeBand = { mediumAt: 0.30, largeAt: 0.80 };
const CANDLE_BANDS: SizeBand = { mediumAt: 0.15, largeAt: 0.60 };
const COVERAGE_BANDS: SizeBand = { mediumAt: 0.40, largeAt: 0.80 };
const COMPLEX_ARTWORK_BANDS: SizeBand = { mediumAt: 0.20, largeAt: 0.50 };
const LOGO_BANDS: SizeBand = { mediumAt: 0.25, largeAt: 0.50 };

export const LOCAL_CAKE_ASPECT_REFERENCES = [
  { thickness: '3 in', ratio: 2.00 },
  { thickness: '4 in', ratio: 1.50 },
  { thickness: '5 in', ratio: 1.20 },
  { thickness: '6 in', ratio: 1.00 },
] as const satisfies ReadonlyArray<{ thickness: GeneratedCakeThickness; ratio: number }>;

export const LOCAL_VARIABLE_HEIGHT_SINGLE_BODY_TYPES = new Set([
  '1 Tier',
  '1 Tier Fondant',
  'Square',
  'Rectangle',
  'Square Fondant',
  'Rectangle Fondant',
]);

const TOY_TYPES = new Set([
  'toy',
  'plastic_crown',
  'edible_crown',
  'figurine',
]);

const FLOWER_TYPES = new Set(['edible_flowers']);
const CANDLE_TYPES = new Set(['candle']);
const COVERAGE_TYPES = new Set([
  'gumpaste_panel',
  'edible_photo_side',
]);
const COMPLEX_ARTWORK_TYPES = new Set(['edible_2d_complex']);
const LOGO_TYPES = new Set(['edible_logo_2d']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LocalAnalysisSizingError(`${path} must be a finite number`);
  }
  return value;
}

function requireNormalizedCoordinate(value: unknown, path: string): number {
  const coordinate = requireFiniteNumber(value, path);
  if (!Number.isInteger(coordinate) || coordinate < 0 || coordinate > 1000) {
    throw new LocalAnalysisSizingError(`${path} must be an integer from 0 through 1000`);
  }
  return coordinate;
}

function requireMeasurementLine(value: unknown, path: string) {
  if (value === undefined || value === null) {
    throw new LocalAnalysisSizingError(`${path} is required`);
  }
  if (!isRecord(value) || !isRecord(value.start) || !isRecord(value.end)) {
    throw new LocalAnalysisSizingError(`${path} must contain start and end points`);
  }

  const start = {
    x: requireNormalizedCoordinate(value.start.x, `${path}.start.x`),
    y: requireNormalizedCoordinate(value.start.y, `${path}.start.y`),
  };
  const end = {
    x: requireNormalizedCoordinate(value.end.x, `${path}.end.x`),
    y: requireNormalizedCoordinate(value.end.y, `${path}.end.y`),
  };

  return { start, end };
}

export function calculateNormalizedLineLength(line: {
  start: { x: number; y: number };
  end: { x: number; y: number };
}): number {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

export type LocalCakeMeasurementGeometry = {
  diameterLength: number;
  measuredHeightLength: number;
  rawAspectRatio: number;
  effectiveHeightLength: number;
  effectiveAspectRatio: number;
  usedHighAngleCorrection: boolean;
};

export function calculateLocalCakeMeasurementGeometry(
  measurements: GeneratedCakeMeasurements,
): LocalCakeMeasurementGeometry {
  const diameter = requireMeasurementLine(measurements.diameter, 'cake_measurements.diameter');
  const height = requireMeasurementLine(measurements.height, 'cake_measurements.height');
  const diameterLength = calculateNormalizedLineLength(diameter);
  const measuredHeightLength = calculateNormalizedLineLength(height);

  if (diameterLength <= 0 || measuredHeightLength <= 0) {
    throw new LocalAnalysisSizingError('cake_measurements lines must have positive lengths');
  }

  const rawAspectRatio = diameterLength / measuredHeightLength;
  if (!Number.isFinite(rawAspectRatio) || rawAspectRatio <= 0) {
    throw new LocalAnalysisSizingError('cake_measurements must produce a positive aspect ratio');
  }

  const usedHighAngleCorrection = rawAspectRatio > 2.0;
  const effectiveHeightLength = usedHighAngleCorrection
    ? diameterLength / 2.0
    : measuredHeightLength;
  const effectiveAspectRatio = diameterLength / effectiveHeightLength;

  return {
    diameterLength,
    measuredHeightLength,
    rawAspectRatio,
    effectiveHeightLength,
    effectiveAspectRatio,
    usedHighAngleCorrection,
  };
}

export function calculateTopTierReferenceArea(
  measurements: GeneratedCakeMeasurements,
): number {
  return calculateTopTierReferenceAreaFromGeometry(calculateLocalCakeMeasurementGeometry(measurements));
}

export function calculateTopTierReferenceAreaFromGeometry(
  geometry: LocalCakeMeasurementGeometry,
): number {
  const referenceArea = geometry.diameterLength
    * geometry.effectiveHeightLength
    * LOCAL_BBOX_AREA_REFERENCE_FACTOR;

  if (!Number.isFinite(referenceArea) || referenceArea <= 0) {
    throw new LocalAnalysisSizingError('cake_measurements must produce a positive top-tier reference area');
  }

  return referenceArea;
}

function nearestAspectReference(
  ratio: number,
  candidates: readonly (typeof LOCAL_CAKE_ASPECT_REFERENCES[number])[],
): typeof LOCAL_CAKE_ASPECT_REFERENCES[number] {
  return candidates.reduce((nearest, candidate) => {
    const candidateDistance = Math.abs(candidate.ratio - ratio);
    const nearestDistance = Math.abs(nearest.ratio - ratio);
    if (candidateDistance < nearestDistance) return candidate;
    if (candidateDistance === nearestDistance) {
      return Number.parseInt(candidate.thickness, 10) < Number.parseInt(nearest.thickness, 10)
        ? candidate
        : nearest;
    }
    return nearest;
  });
}

export function inferLocalCakeThickness(
  cakeType: unknown,
  measurements: GeneratedCakeMeasurements,
): GeneratedCakeThickness | null {
  return inferLocalCakeThicknessFromGeometry(
    cakeType,
    calculateLocalCakeMeasurementGeometry(measurements),
  );
}

function inferLocalCakeThicknessFromGeometry(
  cakeType: unknown,
  geometry: LocalCakeMeasurementGeometry,
): GeneratedCakeThickness | null {
  if (typeof cakeType !== 'string' || !LOCAL_VARIABLE_HEIGHT_SINGLE_BODY_TYPES.has(cakeType)) {
    return null;
  }

  const allowedThicknesses = GENERATED_ANALYSIS_THICKNESSES_BY_CAKE_TYPE[
    cakeType as keyof typeof GENERATED_ANALYSIS_THICKNESSES_BY_CAKE_TYPE
  ];
  if (!allowedThicknesses) {
    throw new LocalAnalysisSizingError(`no thickness candidates are defined for cakeType ${cakeType}`);
  }

  const allowedThicknessSet = new Set<string>(allowedThicknesses);
  const candidates = LOCAL_CAKE_ASPECT_REFERENCES.filter((reference) =>
    allowedThicknessSet.has(reference.thickness),
  );
  if (candidates.length === 0) {
    throw new LocalAnalysisSizingError(`no supported thickness candidates are defined for cakeType ${cakeType}`);
  }

  const selected = nearestAspectReference(geometry.effectiveAspectRatio, candidates);
  return reconcileCakeThicknessForType(cakeType, selected.thickness) ?? selected.thickness;
}

export function calculateLocalBboxAreaRatio(
  bbox: GeneratedBoundingBox,
  topTierArea: number,
): number {
  const width = requireFiniteNumber(bbox.width, 'bbox.width');
  const height = requireFiniteNumber(bbox.height, 'bbox.height');
  if (width <= 0 || height <= 0) {
    throw new LocalAnalysisSizingError('bbox width and height must be positive');
  }

  const ratio = (width * height) / topTierArea;
  if (!Number.isFinite(ratio) || ratio < 0) {
    throw new LocalAnalysisSizingError('bbox area ratio must be finite and non-negative');
  }
  return ratio;
}

export function calculateLocalLineRatio(
  sizeLine: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  },
  cakeDiameterLength: number,
): number {
  const diameterLength = requireFiniteNumber(cakeDiameterLength, 'cake diameter line length');
  if (diameterLength <= 0) {
    throw new LocalAnalysisSizingError('cake diameter line must have a positive length');
  }

  const elementLength = calculateNormalizedLineLength(sizeLine);
  if (elementLength <= 0) {
    throw new LocalAnalysisSizingError('size_line must have a positive length');
  }

  const ratio = elementLength / diameterLength;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new LocalAnalysisSizingError('size_line ratio must be finite and positive');
  }

  return ratio;
}

function classifyRatio(ratio: number, bands: SizeBand): ValidSize {
  if (ratio < bands.mediumAt) return 'small';
  if (ratio < bands.largeAt) return 'medium';
  return 'large';
}

function fixedLocalSize(type: string): ValidSize | undefined {
  if (type === 'sprinkles' || type === 'thin_fabric_ribbon_bows') return 'small';
  if (type === 'edible_photo_side_wave' || type === 'edible_photo_top' || type === 'satin_ribbon') {
    return 'large';
  }
  return undefined;
}

function classifyLocalRatioSize(
  type: string,
  ratio: number,
  description = '',
): ValidSize {
  const fixedSize = fixedLocalSize(type);
  if (fixedSize) return fixedSize;
  if (TOY_TYPES.has(type)) return classifyRatio(ratio, TOY_BANDS);
  if (FLOWER_TYPES.has(type) || (type === 'edible_3d_ordinary' && /\brainbow\b/i.test(description))) {
    return classifyRatio(ratio, FLOWER_BANDS);
  }
  if (CANDLE_TYPES.has(type)) return classifyRatio(ratio, CANDLE_BANDS);
  if (COVERAGE_TYPES.has(type)) return classifyRatio(ratio, COVERAGE_BANDS);
  if (COMPLEX_ARTWORK_TYPES.has(type)) return classifyRatio(ratio, COMPLEX_ARTWORK_BANDS);
  if (LOGO_TYPES.has(type)) return classifyRatio(ratio, LOGO_BANDS);
  return classifyRatio(ratio, GENERIC_BANDS);
}

export function classifyLocalBboxAreaSize(
  type: string,
  ratio: number,
  description = '',
): ValidSize {
  // These are explicit fulfillment rules in the analysis prompt, not AI size
  // estimates. Keep them local so the model cannot override them.
  return classifyLocalRatioSize(type, ratio, description);
}

export function classifyLocalLineRatioSize(
  type: string,
  ratio: number,
  description = '',
): ValidSize {
  return classifyLocalRatioSize(type, ratio, description);
}

function sizeItems(
  value: unknown,
  path: 'main_toppers' | 'support_elements',
  topTierArea: number,
): unknown {
  if (!Array.isArray(value)) return value;

  return value.map((rawItem, index) => {
    if (!isRecord(rawItem)) {
      throw new LocalAnalysisSizingError(`${path}[${index}] must be an object`);
    }

    const item = rawItem as LocalSizingItem;
    if (typeof item.type !== 'string' || item.type.length === 0) {
      throw new LocalAnalysisSizingError(`${path}[${index}].type is required for local sizing`);
    }
    if (!isRecord(item.bbox)) {
      throw new LocalAnalysisSizingError(`${path}[${index}].bbox is required for local sizing`);
    }

    const ratio = calculateLocalBboxAreaRatio(item.bbox as unknown as GeneratedBoundingBox, topTierArea);
    return {
      ...rawItem,
      size: classifyLocalBboxAreaSize(item.type, ratio, typeof item.description === 'string' ? item.description : ''),
    };
  });
}

function sizeLineItems(
  value: unknown,
  path: 'main_toppers' | 'support_elements',
  cakeDiameterLength: number,
): unknown {
  if (!Array.isArray(value)) return value;

  return value.map((rawItem, index) => {
    if (!isRecord(rawItem)) {
      throw new LocalAnalysisSizingError(`${path}[${index}] must be an object`);
    }

    const item = rawItem as LocalSizingItem;
    if (typeof item.type !== 'string' || item.type.length === 0) {
      throw new LocalAnalysisSizingError(`${path}[${index}].type is required for local sizing`);
    }

    const description = typeof item.description === 'string' ? item.description : '';
    const fixedSize = fixedLocalSize(item.type);
    let size = fixedSize;
    if (!size) {
      const ratio = calculateLocalLineRatio(
        requireMeasurementLine(item.size_line, `${path}[${index}].size_line`),
        cakeDiameterLength,
      );
      size = classifyLocalLineRatioSize(item.type, ratio, description);
    }

    // Fresh line-mode output does not persist priced-element bboxes. The
    // destructure also protects against a provider returning an unexpected
    // legacy field despite the line-mode response schema.
    const lineItem = { ...rawItem };
    delete lineItem.bbox;
    return {
      ...lineItem,
      size,
    };
  });
}

export class LocalAnalysisSizingError extends GeneratedAnalysisContractError {
  constructor(message: string) {
    super(`local sizing failed: ${message}`);
    this.name = 'LocalAnalysisSizingError';
  }
}

/**
 * Replaces model-provided sizes with local primary-dimension line ratios.
 * Fresh line-mode results intentionally omit priced-element bboxes; message
 * bboxes and historical cached records are handled by their existing paths.
 */
export function applyLocalLineRatioSizing<T extends LocalSizingAnalysis>(analysis: T): T {
  if (analysis.rejection?.isRejected === true) return analysis;

  const measurements = analysis.cake_measurements;
  if (!isRecord(measurements)) {
    throw new LocalAnalysisSizingError('cake_measurements is required for accepted analyses');
  }

  const typedMeasurements = measurements as unknown as GeneratedCakeMeasurements;
  const geometry = calculateLocalCakeMeasurementGeometry(typedMeasurements);
  const localCakeThickness = inferLocalCakeThicknessFromGeometry(analysis.cakeType, geometry);
  return {
    ...analysis,
    ...(localCakeThickness ? { cakeThickness: localCakeThickness } : {}),
    main_toppers: sizeLineItems(analysis.main_toppers, 'main_toppers', geometry.diameterLength),
    support_elements: sizeLineItems(analysis.support_elements, 'support_elements', geometry.diameterLength),
  } as T;
}

/**
 * Replaces model-provided sizes with local bbox-area sizes without mutating the
 * generated payload or any of its bbox/message objects.
 */
export function applyLocalBboxAreaSizing<T extends LocalSizingAnalysis>(analysis: T): T {
  if (analysis.rejection?.isRejected === true) return analysis;

  const measurements = analysis.cake_measurements;
  if (!isRecord(measurements)) {
    throw new LocalAnalysisSizingError('cake_measurements is required for accepted analyses');
  }

  const typedMeasurements = measurements as unknown as GeneratedCakeMeasurements;
  const geometry = calculateLocalCakeMeasurementGeometry(typedMeasurements);
  const topTierArea = calculateTopTierReferenceAreaFromGeometry(geometry);
  const localCakeThickness = inferLocalCakeThicknessFromGeometry(analysis.cakeType, geometry);
  return {
    ...analysis,
    ...(localCakeThickness ? { cakeThickness: localCakeThickness } : {}),
    main_toppers: sizeItems(analysis.main_toppers, 'main_toppers', topTierArea),
    support_elements: sizeItems(analysis.support_elements, 'support_elements', topTierArea),
  } as T;
}
