import type { ValidSize } from '@/constants/pricingEnums';
import { GeneratedAnalysisContractError } from '@/lib/ai/generatedAnalysisContract';

export const INTEGRATED_BBOX_GEOMETRY_VERSION = 'integrated_bbox_v1' as const;

export type IntegratedBboxPoint = [number, number];
export type IntegratedBbox = [number, number, number, number];

export type IntegratedBboxLine = {
  start: IntegratedBboxPoint;
  end: IntegratedBboxPoint;
};

export type IntegratedBboxGeometry = {
  geometry_version: typeof INTEGRATED_BBOX_GEOMETRY_VERSION;
  cake_diameter_line?: IntegratedBboxLine;
  cake_height_line?: IntegratedBboxLine;
};

export type IntegratedBboxResponse = {
  analysis: Record<string, unknown>;
  geometry: IntegratedBboxGeometry;
};

const MAX_AXIS_DRIFT = 25;
// Cake rims and front walls are visibly perspective-skewed in many source
// photos. "Predominantly" means the requested axis remains the dominant one;
// 25% keeps that constraint meaningful without rejecting a normal cake rim.
const MAX_ORIENTATION_DRIFT_RATIO = 0.25;
const MAX_CENTER_OFFSET_RATIO = 0.12;
const FORBIDDEN_MODEL_SIZING_FIELDS = new Set([
  'size',
  'bbox',
  'size_line',
  'bbox_area',
  'cake_area',
  'area_ratio',
  'area_ratio_percent',
]);

function fail(path: string, message: string): never {
  throw new GeneratedAnalysisContractError(`integrated bbox geometry: ${path} ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) fail(path, 'must be an object');
  return value;
}

function requireExactKeys(value: Record<string, unknown>, expected: readonly string[], path: string) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(path, `must contain exactly: ${required.join(', ')}`);
  }
}

function normalizedCoordinate(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) {
    fail(path, 'must be a finite number from 0 through 1000');
  }
  return value;
}

function point(value: unknown, path: string): IntegratedBboxPoint {
  if (!Array.isArray(value) || value.length !== 2) fail(path, 'must be [y, x]');
  return [
    normalizedCoordinate(value[0], `${path}[0]`),
    normalizedCoordinate(value[1], `${path}[1]`),
  ];
}

function line(value: unknown, path: string): IntegratedBboxLine {
  const candidate = requireRecord(value, path);
  requireExactKeys(candidate, ['start', 'end'], path);
  return {
    start: point(candidate.start, `${path}.start`),
    end: point(candidate.end, `${path}.end`),
  };
}

function isPredominantlyHorizontal(value: IntegratedBboxLine) {
  const width = value.end[1] - value.start[1];
  const verticalDrift = Math.abs(value.end[0] - value.start[0]);
  return width > 0 && verticalDrift <= width * MAX_ORIENTATION_DRIFT_RATIO;
}

function isPredominantlyVertical(value: IntegratedBboxLine) {
  const height = value.end[0] - value.start[0];
  const horizontalDrift = Math.abs(value.end[1] - value.start[1]);
  return height > 0 && horizontalDrift <= height * MAX_ORIENTATION_DRIFT_RATIO;
}

function box(value: unknown, path: string): IntegratedBbox {
  if (!Array.isArray(value) || value.length !== 4) fail(path, 'must be [ymin, xmin, ymax, xmax]');
  const result = value.map((coordinate, index) => normalizedCoordinate(coordinate, `${path}[${index}]`)) as IntegratedBbox;
  if (result[0] >= result[2] || result[1] >= result[3]) {
    fail(path, 'must have positive ordered extents');
  }
  return result;
}

function confidence(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(path, 'must be a finite number from 0 through 1');
  }
  return value;
}

function requireGeometryRows(analysis: Record<string, unknown>, path: 'main_toppers' | 'support_elements' | 'cake_messages') {
  const rows = analysis[path];
  if (!Array.isArray(rows)) fail(`analysis.${path}`, 'must be an array');
  rows.forEach((rawRow, index) => {
    const rowPath = `analysis.${path}[${index}]`;
    const row = requireRecord(rawRow, rowPath);
    for (const field of FORBIDDEN_MODEL_SIZING_FIELDS) {
      if (field in row) fail(`${rowPath}.${field}`, 'must not be model-generated in integrated_bbox_v1');
    }
    box(row.box_2d, `${rowPath}.box_2d`);
    confidence(row.bbox_confidence, `${rowPath}.bbox_confidence`);
  });
}

function validateGeometry(value: unknown, rejected: boolean): IntegratedBboxGeometry {
  const geometry = requireRecord(value, 'geometry');
  const expected = rejected
    ? ['geometry_version']
    : ['geometry_version', 'cake_diameter_line', 'cake_height_line'];
  requireExactKeys(geometry, expected, 'geometry');
  if (geometry.geometry_version !== INTEGRATED_BBOX_GEOMETRY_VERSION) {
    fail('geometry.geometry_version', `must be ${INTEGRATED_BBOX_GEOMETRY_VERSION}`);
  }
  if (rejected) return { geometry_version: INTEGRATED_BBOX_GEOMETRY_VERSION };

  const diameter = line(geometry.cake_diameter_line, 'geometry.cake_diameter_line');
  const height = line(geometry.cake_height_line, 'geometry.cake_height_line');
  if (!isPredominantlyHorizontal(diameter)) {
    fail('geometry.cake_diameter_line', 'must be a left-to-right predominantly horizontal line');
  }
  if (!isPredominantlyVertical(height)) {
    fail('geometry.cake_height_line', 'must be a top-to-bottom predominantly vertical line');
  }

  const diameterCenter = (diameter.start[1] + diameter.end[1]) / 2;
  const diameterWidth = diameter.end[1] - diameter.start[1];
  const centerTolerance = Math.max(MAX_AXIS_DRIFT, diameterWidth * MAX_CENTER_OFFSET_RATIO);
  if (
    Math.abs(height.start[1] - diameterCenter) > centerTolerance
    || Math.abs(height.end[1] - diameterCenter) > centerTolerance
  ) {
    fail('geometry.cake_height_line', 'must align with the cake diameter midpoint');
  }

  return {
    geometry_version: INTEGRATED_BBOX_GEOMETRY_VERSION,
    cake_diameter_line: diameter,
    cake_height_line: height,
  };
}

/**
 * Validates the raw Gemini envelope before post-processing. This intentionally
 * rejects model-owned size fields: only the application may add them later.
 */
export function validateIntegratedBboxResponse(value: unknown): IntegratedBboxResponse {
  const response = requireRecord(value, 'integrated response');
  requireExactKeys(response, ['analysis', 'geometry'], 'integrated response');
  const analysis = requireRecord(response.analysis, 'analysis');
  const rejection = requireRecord(analysis.rejection, 'analysis.rejection');
  if (typeof rejection.isRejected !== 'boolean') fail('analysis.rejection.isRejected', 'must be a boolean');
  if ('cake_measurements' in analysis || 'cake_bbox' in analysis || 'geometry' in analysis) {
    fail('analysis', 'must not include legacy or duplicate geometry fields');
  }

  const geometry = validateGeometry(response.geometry, rejection.isRejected);
  if (!rejection.isRejected) {
    requireGeometryRows(analysis, 'main_toppers');
    requireGeometryRows(analysis, 'support_elements');
    requireGeometryRows(analysis, 'cake_messages');
  }

  return { analysis, geometry };
}

function assignSize(rawRow: unknown, path: string, cakeArea: number): Record<string, unknown> {
  const row = requireRecord(rawRow, path);
  const [ymin, xmin, ymax, xmax] = box(row.box_2d, `${path}.box_2d`);
  confidence(row.bbox_confidence, `${path}.bbox_confidence`);
  const areaRatioPercent = (((xmax - xmin) * (ymax - ymin)) / cakeArea) * 100;
  if (!Number.isFinite(areaRatioPercent) || areaRatioPercent <= 0) {
    fail(path, 'must produce a positive finite bbox area ratio');
  }
  const size: ValidSize = areaRatioPercent <= 20
    ? 'small'
    : areaRatioPercent <= 70
      ? 'medium'
      : 'large';
  return { ...row, size };
}

/** Applies the user-approved area formula without type-specific overrides. */
export function applyIntegratedBboxSizing(response: IntegratedBboxResponse): Record<string, unknown> {
  const { analysis, geometry } = response;
  const rejected = (analysis.rejection as Record<string, unknown>).isRejected === true;
  if (rejected) return { ...analysis, geometry };

  const diameter = geometry.cake_diameter_line!;
  const height = geometry.cake_height_line!;
  const cakeWidth = Math.abs(diameter.end[1] - diameter.start[1]);
  const cakeHeight = Math.abs(height.end[0] - height.start[0]);
  const cakeArea = cakeWidth * cakeHeight;
  if (!Number.isFinite(cakeArea) || cakeArea <= 0) {
    fail('geometry', 'must produce a positive finite cake area');
  }

  const sizeRows = (path: 'main_toppers' | 'support_elements') => {
    const rows = analysis[path];
    if (!Array.isArray(rows)) fail(`analysis.${path}`, 'must be an array');
    return rows.map((row, index) => assignSize(row, `analysis.${path}[${index}]`, cakeArea));
  };

  return {
    ...analysis,
    main_toppers: sizeRows('main_toppers'),
    support_elements: sizeRows('support_elements'),
    geometry,
  };
}
