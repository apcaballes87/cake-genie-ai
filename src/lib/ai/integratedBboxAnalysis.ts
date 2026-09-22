import type { ValidSize } from '@/constants/pricingEnums';
import { GeneratedAnalysisContractError } from '@/lib/ai/generatedAnalysisContract';
import { cakeThicknessForAspectRatio, LOCAL_VARIABLE_HEIGHT_SINGLE_BODY_TYPES } from '@/lib/ai/localAnalysisSizing';

export const INTEGRATED_BBOX_V1_GEOMETRY_VERSION = 'integrated_bbox_v1' as const;
export const INTEGRATED_BBOX_GEOMETRY_VERSION = 'integrated_bbox_v2' as const;
export const INTEGRATED_MAX_UNIT_BOXES = 5;
export const INTEGRATED_GEOMETRY_SCOPES = ['unit', 'piped_cluster', 'treatment'] as const;
export type IntegratedGeometryScope = typeof INTEGRATED_GEOMETRY_SCOPES[number];
export type IntegratedBboxGeometryVersion =
  | typeof INTEGRATED_BBOX_V1_GEOMETRY_VERSION
  | typeof INTEGRATED_BBOX_GEOMETRY_VERSION;

export const INTEGRATED_PIPED_CLUSTER_TYPES = [
  'piped_flowers_top',
  'piped_flowers_side',
] as const;

/** Types whose geometry represents one intentional treated region, not per-piece units. */
export const INTEGRATED_TREATMENT_GEOMETRY_TYPES = [
  'gumpaste_bundle',
  'gumpaste_panel',
  'sprinkles',
  'premium_sprinkles',
  'icing_doodle_intricate_top',
  'icing_doodle_intricate_side',
  'icing_palette_knife',
  'icing_brush_stroke',
  'icing_splatter',
  'icing_minimalist_spread',
  'edible_photo_side',
  'edible_photo_side_wave',
  'thin_fabric_ribbon_bows',
  'satin_ribbon',
] as const;

/**
 * The v1 contract treated icing_decorations as an aggregate fallback. Keep
 * that historical allowlist for warm v1 responses, while v2 deliberately
 * reserves icing_decorations for independently placed unit rows.
 */
export const INTEGRATED_AGGREGATE_GEOMETRY_TYPES = [
  ...INTEGRATED_TREATMENT_GEOMETRY_TYPES,
  'icing_decorations',
] as const;

function isTreatmentGeometryType(value: unknown): boolean {
  return typeof value === 'string'
    && INTEGRATED_TREATMENT_GEOMETRY_TYPES.includes(value as typeof INTEGRATED_TREATMENT_GEOMETRY_TYPES[number]);
}

function isV1AggregateGeometryType(value: unknown): boolean {
  return typeof value === 'string'
    && INTEGRATED_AGGREGATE_GEOMETRY_TYPES.includes(value as typeof INTEGRATED_AGGREGATE_GEOMETRY_TYPES[number]);
}

function isPipedClusterType(value: unknown): boolean {
  return typeof value === 'string'
    && INTEGRATED_PIPED_CLUSTER_TYPES.includes(value as typeof INTEGRATED_PIPED_CLUSTER_TYPES[number]);
}

export type IntegratedBboxPoint = [number, number];
export type IntegratedBbox = [number, number, number, number];
export type IntegratedBboxCollection = IntegratedBbox[];
export type IntegratedBboxValue = IntegratedBbox | IntegratedBboxCollection;

export type IntegratedBboxLine = {
  start: IntegratedBboxPoint;
  end: IntegratedBboxPoint;
};

export type IntegratedBboxGeometry = {
  geometry_version: IntegratedBboxGeometryVersion;
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
// Real cake photos can be strongly perspective-skewed, especially when the
// phone is held at an angle. Keep requiring a positive span on the requested
// axis, but allow the visible rim/wall to drift by up to 125% on the other
// axis instead of failing an otherwise usable analysis.
const MAX_ORIENTATION_DRIFT_RATIO = 1.25;
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

function canonicalizeLineDirection(
  value: IntegratedBboxLine,
  axis: 'horizontal' | 'vertical',
): IntegratedBboxLine {
  const isReversed = axis === 'horizontal'
    ? value.start[1] > value.end[1]
    : value.start[0] > value.end[0];
  return isReversed ? { start: value.end, end: value.start } : value;
}

function box(value: unknown, path: string): IntegratedBbox {
  if (!Array.isArray(value) || value.length !== 4) fail(path, 'must be [ymin, xmin, ymax, xmax]');
  const result = value.map((coordinate, index) => normalizedCoordinate(coordinate, `${path}[${index}]`)) as IntegratedBbox;
  if (result[0] >= result[2] || result[1] >= result[3]) {
    fail(path, 'must have positive ordered extents');
  }
  return result;
}

function isBoxTuple(value: unknown): value is unknown[] {
  return Array.isArray(value)
    && value.length === 4
    && value.every((entry) => typeof entry === 'number');
}

function boxes(value: unknown, path: string, requireCollection = false): IntegratedBboxCollection {
  if (isBoxTuple(value)) {
    if (requireCollection) fail(path, `must be an array containing 1 through ${INTEGRATED_MAX_UNIT_BOXES} boxes`);
    return [box(value, path)];
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > INTEGRATED_MAX_UNIT_BOXES) {
    fail(path, `must be one box or an array containing 1 through ${INTEGRATED_MAX_UNIT_BOXES} boxes`);
  }
  return value.map((candidate, index) => box(candidate, `${path}[${index}]`));
}

function confidence(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(path, 'must be a finite number from 0 through 1');
  }
  return value;
}

function confidences(value: unknown, path: string, boxCount: number, requireCollection = false): number[] {
  if (typeof value === 'number') {
    if (requireCollection) fail(path, `must be an array of exactly ${boxCount} confidence values`);
    const normalized = confidence(value, path);
    // Older/still-warm prompt caches may emit one confidence for a row even
    // after the response schema changed to one confidence per unit box. The
    // confidence describes the model's certainty for that row, so broadcasting
    // it to each validated box is deterministic and keeps geometry strict.
    return Array.from({ length: boxCount }, () => normalized);
  }
  if (!Array.isArray(value) || value.length !== boxCount) {
    fail(path, `must be a number or an array of exactly ${boxCount} confidence values`);
  }
  return value.map((candidate, index) => confidence(candidate, `${path}[${index}]`));
}

function requiredGeometryScope(row: Record<string, unknown>, path: string): IntegratedGeometryScope {
  const scope = row.geometry_scope;
  if (typeof scope !== 'string' || !INTEGRATED_GEOMETRY_SCOPES.includes(scope as IntegratedGeometryScope)) {
    fail(`${path}.geometry_scope`, `must be one of: ${INTEGRATED_GEOMETRY_SCOPES.join(', ')}`);
  }
  return scope as IntegratedGeometryScope;
}

function expectedBoxCount(
  row: Record<string, unknown>,
  path: string,
  geometryVersion: IntegratedBboxGeometryVersion,
): number {
  if (geometryVersion === INTEGRATED_BBOX_V1_GEOMETRY_VERSION) {
    if (isV1AggregateGeometryType(row.type) || isPipedClusterType(row.type)) return 1;
  } else {
    const scope = requiredGeometryScope(row, path);
    if (scope === 'piped_cluster') {
      if (!isPipedClusterType(row.type)) {
        fail(`${path}.geometry_scope`, 'piped_cluster is allowed only for piped_flowers_top or piped_flowers_side');
      }
      if (row.quantity !== 1) fail(`${path}.quantity`, 'must be 1 for a piped_cluster');
      if (!['small', 'medium', 'large'].includes(row.coverage as string)) {
        fail(`${path}.coverage`, 'must be small, medium, or large for a piped_cluster');
      }
      return 1;
    }
    if (scope === 'treatment') {
      if (!isTreatmentGeometryType(row.type)) {
        fail(`${path}.geometry_scope`, 'treatment is not allowed for this type');
      }
      return 1;
    }
    if (isPipedClusterType(row.type)) {
      fail(`${path}.geometry_scope`, 'piped flower clusters must use piped_cluster scope');
    }
  }
  if (!Number.isInteger(row.quantity) || Number(row.quantity) <= 0) {
    fail(`${path}.quantity`, 'must be a positive integer to determine the required box count');
  }
  return Math.min(Number(row.quantity), INTEGRATED_MAX_UNIT_BOXES);
}

function requireGeometryRows(
  analysis: Record<string, unknown>,
  path: 'main_toppers' | 'support_elements' | 'cake_messages',
  geometryVersion: IntegratedBboxGeometryVersion,
) {
  const rows = analysis[path];
  if (!Array.isArray(rows)) fail(`analysis.${path}`, 'must be an array');
  rows.forEach((rawRow, index) => {
    const rowPath = `analysis.${path}[${index}]`;
    const row = requireRecord(rawRow, rowPath);
    for (const field of FORBIDDEN_MODEL_SIZING_FIELDS) {
      if (field in row) fail(`${rowPath}.${field}`, `must not be model-generated in ${geometryVersion}`);
    }
    const requireCollection = geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION && path !== 'cake_messages';
    const rowBoxes = boxes(row.box_2d, `${rowPath}.box_2d`, requireCollection);
    const rowConfidences = confidences(
      row.bbox_confidence,
      `${rowPath}.bbox_confidence`,
      rowBoxes.length,
      requireCollection,
    );
    if (path === 'cake_messages') {
      if (rowBoxes.length !== 1 || rowConfidences.length !== 1) {
        fail(rowPath, 'cake messages require exactly one box and one confidence');
      }
      return;
    }
    const expectedCount = expectedBoxCount(row, rowPath, geometryVersion);
    if (geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION && rowBoxes.length !== expectedCount) {
      fail(`${rowPath}.box_2d`, `must contain exactly ${expectedCount} box${expectedCount === 1 ? '' : 'es'} for ${row.geometry_scope} scope`);
    }
    if (geometryVersion === INTEGRATED_BBOX_V1_GEOMETRY_VERSION && rowBoxes.length > expectedCount) {
      fail(`${rowPath}.box_2d`, `must contain at most ${expectedCount} box${expectedCount === 1 ? '' : 'es'} for quantity ${row.quantity}`);
    }
    if (geometryVersion === INTEGRATED_BBOX_V1_GEOMETRY_VERSION && expectedCount > 1 && rowBoxes.length < expectedCount) {
      console.warn('[AI Contract] Integrated bbox localized fewer visible units than quantity', {
        path: rowPath,
        quantity: row.quantity,
        expectedVisibleUnitCap: expectedCount,
        localizedBoxCount: rowBoxes.length,
      });
    }
  });
}

function normalizeIntegratedConfidenceArrays(
  analysis: Record<string, unknown>,
  geometryVersion: IntegratedBboxGeometryVersion,
): Record<string, unknown> {
  const normalized = { ...analysis };
  for (const path of ['main_toppers', 'support_elements', 'cake_messages'] as const) {
    const rows = normalized[path];
    if (!Array.isArray(rows)) continue;
    normalized[path] = rows.map((rawRow, index) => {
      const row = requireRecord(rawRow, `analysis.${path}[${index}]`);
      const rowBoxes = boxes(
        row.box_2d,
        `analysis.${path}[${index}].box_2d`,
        geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION && path !== 'cake_messages',
      );
      if (typeof row.bbox_confidence !== 'number' || rowBoxes.length === 1) return row;
      return {
        ...row,
        bbox_confidence: confidences(
          row.bbox_confidence,
          `analysis.${path}[${index}].bbox_confidence`,
          rowBoxes.length,
        ),
      };
    });
  }
  return normalized;
}

function validateGeometry(
  value: unknown,
  rejected: boolean,
  geometryVersion: IntegratedBboxGeometryVersion,
): IntegratedBboxGeometry {
  const geometry = requireRecord(value, 'geometry');
  const expected = rejected
    ? ['geometry_version']
    : ['geometry_version', 'cake_diameter_line', 'cake_height_line'];
  requireExactKeys(geometry, expected, 'geometry');
  if (geometry.geometry_version !== geometryVersion) {
    fail('geometry.geometry_version', `must be ${geometryVersion}`);
  }
  if (rejected) return { geometry_version: geometryVersion };

  // Gemini may identify the correct endpoints but emit them in either order.
  // Normalize direction before orientation, midpoint, aspect-ratio, and size
  // calculations so endpoint order is not a needless validation failure.
  const diameter = canonicalizeLineDirection(
    line(geometry.cake_diameter_line, 'geometry.cake_diameter_line'),
    'horizontal',
  );
  const height = canonicalizeLineDirection(
    line(geometry.cake_height_line, 'geometry.cake_height_line'),
    'vertical',
  );
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
    geometry_version: geometryVersion,
    cake_diameter_line: diameter,
    cake_height_line: height,
  };
}

/**
 * Validates the raw Gemini envelope before post-processing. This intentionally
 * rejects model-owned size fields: only the application may add them later.
 */
export function validateIntegratedBboxResponse(
  value: unknown,
  geometryVersion: IntegratedBboxGeometryVersion = INTEGRATED_BBOX_V1_GEOMETRY_VERSION,
): IntegratedBboxResponse {
  const response = requireRecord(value, 'integrated response');
  requireExactKeys(response, ['analysis', 'geometry'], 'integrated response');
  const analysis = requireRecord(response.analysis, 'analysis');
  const rejection = requireRecord(analysis.rejection, 'analysis.rejection');
  if (typeof rejection.isRejected !== 'boolean') fail('analysis.rejection.isRejected', 'must be a boolean');
  if ('cake_measurements' in analysis || 'cake_bbox' in analysis || 'geometry' in analysis) {
    fail('analysis', 'must not include legacy or duplicate geometry fields');
  }

  const geometry = validateGeometry(response.geometry, rejection.isRejected, geometryVersion);
  if (!rejection.isRejected) {
    requireGeometryRows(analysis, 'main_toppers', geometryVersion);
    requireGeometryRows(analysis, 'support_elements', geometryVersion);
    requireGeometryRows(analysis, 'cake_messages', geometryVersion);
  }

  return {
    analysis: rejection.isRejected ? analysis : normalizeIntegratedConfidenceArrays(analysis, geometryVersion),
    geometry,
  };
}

function sizeForAreaRatio(areaRatioPercent: number): ValidSize {
  return areaRatioPercent <= 15
    ? 'small'
    : areaRatioPercent <= 70
      ? 'medium'
      : 'large';
}

function assignSize(
  rawRow: unknown,
  path: string,
  cakeArea: number,
  geometryVersion: IntegratedBboxGeometryVersion,
): Record<string, unknown> {
  const row = requireRecord(rawRow, path);
  const scope = geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION
    ? requiredGeometryScope(row, path)
    : undefined;
  if (scope === 'piped_cluster') {
    const coverage = row.coverage;
    if (!['small', 'medium', 'large'].includes(coverage as string)) {
      fail(`${path}.coverage`, 'must be small, medium, or large for a piped_cluster');
    }
    // A cluster box is persisted for review only. Its coverage band—not its
    // visible area—selects the fixed cluster price.
    return { ...row, size: coverage as ValidSize };
  }
  const rowBoxes = boxes(
    row.box_2d,
    `${path}.box_2d`,
    geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION,
  );
  confidences(
    row.bbox_confidence,
    `${path}.bbox_confidence`,
    rowBoxes.length,
    geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION,
  );
  const areaRatios = rowBoxes.map(([ymin, xmin, ymax, xmax]) => (
    ((xmax - xmin) * (ymax - ymin) / cakeArea) * 100
  ));
  if (areaRatios.some((areaRatioPercent) => !Number.isFinite(areaRatioPercent) || areaRatioPercent <= 0)) {
    fail(path, 'must produce positive finite bbox area ratios');
  }
  const sizes = areaRatios.map(sizeForAreaRatio);
  if (scope === 'unit' && new Set(sizes).size !== 1) {
    fail(path, 'unit boxes cross size bands; split visually different scales into separate rows');
  }
  // V1 and non-countable treatment rows retain their historical conservative
  // largest-region sizing. V2 unit rows have already proved that every sample
  // belongs in the same band.
  const size: ValidSize = scope === 'unit' ? sizes[0] : sizeForAreaRatio(Math.max(...areaRatios));
  return { ...row, size };
}

function measuredLineLength(lineValue: IntegratedBboxLine): number {
  return Math.hypot(
    lineValue.end[1] - lineValue.start[1],
    lineValue.end[0] - lineValue.start[0],
  );
}

function applyAspectRatioCakeThickness(
  analysis: Record<string, unknown>,
  geometry: IntegratedBboxGeometry,
): Record<string, unknown> {
  const cakeType = analysis.cakeType;
  if (typeof cakeType !== 'string' || !LOCAL_VARIABLE_HEIGHT_SINGLE_BODY_TYPES.has(cakeType)) {
    return analysis;
  }

  const diameterLength = measuredLineLength(geometry.cake_diameter_line!);
  const heightLength = measuredLineLength(geometry.cake_height_line!);
  const aspectRatio = diameterLength / heightLength;
  const requestedThickness = cakeThicknessForAspectRatio(aspectRatio);
  const allowedThicknesses = ['1 Tier', 'Square', 'Rectangle'].includes(cakeType)
    ? ['3 in', '4 in', '5 in', '6 in']
    : cakeType.includes('Fondant')
      ? ['5 in', '6 in']
      : ['3 in', '4 in'];
  const cakeThickness = allowedThicknesses.includes(requestedThickness)
    ? requestedThickness
    : analysis.cakeThickness;
  return cakeThickness === analysis.cakeThickness ? analysis : { ...analysis, cakeThickness };
}

/** Applies the user-approved area formula without type-specific overrides. */
export function applyIntegratedBboxSizing(response: IntegratedBboxResponse): Record<string, unknown> {
  const { analysis, geometry } = response;
  const rejected = (analysis.rejection as Record<string, unknown>).isRejected === true;
  if (rejected) return { ...analysis, geometry };

  const diameter = geometry.cake_diameter_line!;
  const cakeWidth = Math.abs(diameter.end[1] - diameter.start[1]);
  // The height line remains the aspect-ratio input for cakeThickness. For
  // topper/support area bands, use the diameter square as the stable reference
  // area so camera perspective on the wall height cannot change size bands.
  const cakeArea = cakeWidth * cakeWidth;
  if (!Number.isFinite(cakeArea) || cakeArea <= 0) {
    fail('geometry', 'must produce a positive finite cake area');
  }

  const sizeRows = (path: 'main_toppers' | 'support_elements') => {
    const rows = analysis[path];
    if (!Array.isArray(rows)) fail(`analysis.${path}`, 'must be an array');
    return rows.map((row, index) => assignSize(
      row,
      `analysis.${path}[${index}]`,
      cakeArea,
      geometry.geometry_version,
    ));
  };

  const aspectRatioAnalysis = applyAspectRatioCakeThickness(analysis, geometry);
  return {
    ...aspectRatioAnalysis,
    main_toppers: sizeRows('main_toppers'),
    support_elements: sizeRows('support_elements'),
    geometry,
  };
}
