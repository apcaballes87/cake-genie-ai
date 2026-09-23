import type { ValidSize } from '@/constants/pricingEnums';
import {
  GeneratedAnalysisContractError,
  reconcileCakeThicknessForType,
} from '@/lib/ai/generatedAnalysisContract';
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
  'icing_decorations',
  'edible_photo_side',
  'edible_photo_side_wave',
  'thin_fabric_ribbon_bows',
  'satin_ribbon',
] as const;

/**
 * The v1 contract treated icing_decorations as an aggregate fallback. V2 also
 * permits it as a treatment only for one continuous icing region; independent
 * decorations still use exact per-unit boxes.
 */
export const INTEGRATED_AGGREGATE_GEOMETRY_TYPES = [
  ...INTEGRATED_TREATMENT_GEOMETRY_TYPES,
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

export type IntegratedBboxRepairCandidate = {
  category: 'main_toppers' | 'support_elements' | 'cake_messages';
  groupId: string;
  type: string;
  quantity: number;
  geometryScope?: IntegratedGeometryScope;
  targetBoxCount: number;
  reasons: string[];
};

const RETRYABLE_BBOX_REASONS = new Set([
  'missing_boxes',
  'invalid_box_collection',
  'invalid_boxes',
  'under_count',
  'over_count',
  'confidence_count_mismatch',
  'invalid_confidence',
  'scope_normalized',
]);

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

function boxes(
  value: unknown,
  path: string,
  requireCollection = false,
  allowEmpty = false,
): IntegratedBboxCollection {
  if (isBoxTuple(value)) {
    if (requireCollection) fail(path, `must be an array containing 1 through ${INTEGRATED_MAX_UNIT_BOXES} boxes`);
    return [box(value, path)];
  }
  if (
    !Array.isArray(value)
    || (!allowEmpty && value.length < 1)
    || value.length > INTEGRATED_MAX_UNIT_BOXES
  ) {
    fail(path, `must be one box or an array containing ${allowEmpty ? '0' : '1'} through ${INTEGRATED_MAX_UNIT_BOXES} boxes`);
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

function isValidCoverage(value: unknown): boolean {
  return value === 'small' || value === 'medium' || value === 'large';
}

function normalizeV2Scope(row: Record<string, unknown>): {
  scope: IntegratedGeometryScope;
  normalized: boolean;
} {
  const type = row.type;
  const quantity = row.quantity;
  const provided = row.geometry_scope;
  const isPipedType = isPipedClusterType(type);

  if (isPipedType && quantity === 1 && isValidCoverage(row.coverage)) {
    return { scope: 'piped_cluster', normalized: provided !== 'piped_cluster' };
  }

  if (provided === 'unit') return { scope: 'unit', normalized: false };
  if (provided === 'treatment') {
    const treatmentIsValid = isTreatmentGeometryType(type)
      && (type !== 'icing_decorations' || (row.material === 'icing' && quantity === 1));
    return treatmentIsValid
      ? { scope: 'treatment', normalized: false }
      : { scope: 'unit', normalized: true };
  }
  if (provided === 'piped_cluster') {
    return isPipedType && quantity === 1 && isValidCoverage(row.coverage)
      ? { scope: 'piped_cluster', normalized: false }
      : { scope: 'unit', normalized: true };
  }

  // A missing, unknown, or incompatible scope is safely recoverable for an
  // ordinary countable item. Explicit piped types were handled above.
  return { scope: 'unit', normalized: true };
}

function rawBoxCandidates(value: unknown): { values: unknown[]; invalidCollection: boolean } {
  if (isBoxTuple(value)) return { values: [value], invalidCollection: false };
  if (Array.isArray(value)) return { values: value, invalidCollection: false };
  return { values: [], invalidCollection: true };
}

function validBoxOrNull(value: unknown, path: string): IntegratedBbox | null {
  try {
    return box(value, path);
  } catch {
    return null;
  }
}

function targetBoxCountForV2(
  row: Record<string, unknown>,
  scope: IntegratedGeometryScope,
  path: string,
): number {
  if (scope === 'piped_cluster' || scope === 'treatment') return 1;
  if (!Number.isInteger(row.quantity) || Number(row.quantity) <= 0) {
    fail(`${path}.quantity`, 'must be a positive integer to determine the required box count');
  }
  return Math.min(Number(row.quantity), INTEGRATED_MAX_UNIT_BOXES);
}

type NormalizedGeometryRow = {
  row: Record<string, unknown>;
  targetBoxCount: number;
  returnedBoxCount: number;
  validBoxCount: number;
  reasons: string[];
};

function normalizeV2GeometryRow(
  rawRow: unknown,
  path: string,
  options: { allowApplicationReview?: boolean; includeScope?: boolean } = {},
): NormalizedGeometryRow {
  const row = requireRecord(rawRow, path);
  for (const field of FORBIDDEN_MODEL_SIZING_FIELDS) {
    if (field in row) fail(`${path}.${field}`, `must not be model-generated in ${INTEGRATED_BBOX_GEOMETRY_VERSION}`);
  }
  if (!options.allowApplicationReview && ('bbox_review' in row || 'parent_group_id' in row)) {
    fail(path, 'must not contain application-generated bbox review or parent identity fields');
  }

  const scopeResult = options.includeScope === false
    ? { scope: 'unit' as const, normalized: false }
    : normalizeV2Scope(row);
  const rowWithScope = options.includeScope === false
    ? row
    : { ...row, geometry_scope: scopeResult.scope };
  const targetBoxCount = targetBoxCountForV2(
    options.includeScope === false ? { ...rowWithScope, quantity: 1 } : rowWithScope,
    scopeResult.scope,
    path,
  );
  const { values: rawBoxes, invalidCollection } = rawBoxCandidates(row.box_2d);
  const reasons: string[] = [];
  if (scopeResult.normalized) reasons.push('scope_normalized');
  if (invalidCollection) reasons.push('invalid_box_collection');
  if (rawBoxes.length === 0) reasons.push('missing_boxes');
  if (rawBoxes.length !== targetBoxCount) {
    reasons.push(rawBoxes.length < targetBoxCount ? 'under_count' : 'over_count');
  }

  const confidenceValue = row.bbox_confidence;
  const aligned: Array<{ box: IntegratedBbox; confidence: number }> = [];
  if (typeof confidenceValue === 'number') {
    if (rawBoxes.length !== 1) reasons.push('confidence_count_mismatch');
  } else if (!Array.isArray(confidenceValue) || confidenceValue.length !== rawBoxes.length) {
    reasons.push('confidence_count_mismatch');
  }

  rawBoxes.forEach((rawBox, index) => {
    const validBox = validBoxOrNull(rawBox, `${path}.box_2d[${index}]`);
    if (!validBox) {
      reasons.push('invalid_boxes');
      return;
    }
    let candidateConfidence: unknown;
    if (typeof confidenceValue === 'number') candidateConfidence = confidenceValue;
    else if (Array.isArray(confidenceValue)) candidateConfidence = confidenceValue[index];
    if (typeof candidateConfidence !== 'number' || !Number.isFinite(candidateConfidence)
      || candidateConfidence < 0 || candidateConfidence > 1) {
      candidateConfidence = 0;
      reasons.push('invalid_confidence');
    }
    aligned.push({ box: validBox, confidence: candidateConfidence as number });
  });

  if (aligned.length !== targetBoxCount && rawBoxes.length >= targetBoxCount) {
    reasons.push(aligned.length < targetBoxCount ? 'under_count' : 'over_count');
  }

  const kept = aligned.slice(0, targetBoxCount);
  if (Number(row.quantity) > INTEGRATED_MAX_UNIT_BOXES && scopeResult.scope === 'unit') {
    reasons.push('sample_capped');
  }

  const existingReview = options.allowApplicationReview && isRecord(row.bbox_review)
    ? row.bbox_review
    : null;
  const priorReasons = existingReview && Array.isArray(existingReview.reasons)
    ? existingReview.reasons.filter((reason): reason is string => typeof reason === 'string')
    : [];
  const allReasons = [...new Set([...priorReasons, ...reasons])];
  const review = allReasons.length > 0
    ? {
      status: 'needs_review',
      target_box_count: existingReview && Number.isInteger(existingReview.target_box_count)
        ? existingReview.target_box_count
        : targetBoxCount,
      returned_box_count: existingReview && Number.isInteger(existingReview.returned_box_count)
        ? existingReview.returned_box_count
        : rawBoxes.length,
      valid_box_count: existingReview && Number.isInteger(existingReview.valid_box_count)
        ? existingReview.valid_box_count
        : kept.length,
      reasons: allReasons,
    }
    : undefined;

  return {
    row: {
      ...rowWithScope,
      box_2d: options.includeScope === false && kept.length === 1
        ? kept[0].box
        : kept.map((entry) => entry.box),
      bbox_confidence: options.includeScope === false && kept.length === 1
        ? kept[0].confidence
        : kept.map((entry) => entry.confidence),
      ...(review ? { bbox_review: review } : {}),
    },
    targetBoxCount,
    returnedBoxCount: rawBoxes.length,
    validBoxCount: kept.length,
    reasons: allReasons,
  };
}

/** Returns only bbox defects that merit one bounded image-grounded repair call. */
export function getIntegratedBboxRepairCandidates(value: unknown): IntegratedBboxRepairCandidate[] {
  if (!isRecord(value) || !isRecord(value.analysis) || !isRecord(value.analysis.rejection)
    || value.analysis.rejection.isRejected === true) return [];
  const analysis = value.analysis;
  const candidates: IntegratedBboxRepairCandidate[] = [];
  const categories = ['main_toppers', 'support_elements', 'cake_messages'] as const;
  for (const category of categories) {
    const rows = analysis[category];
    if (!Array.isArray(rows)) continue;
    rows.forEach((rawRow, index) => {
      if (!isRecord(rawRow)) return;
      try {
        const normalized = category === 'cake_messages'
          ? normalizeV2GeometryRow({
            ...rawRow,
            geometry_scope: 'unit',
            quantity: 1,
          }, `${category}[${index}]`, { includeScope: false })
          : normalizeV2GeometryRow(rawRow, `${category}[${index}]`);
        const retryReasons = normalized.reasons.filter((reason) => RETRYABLE_BBOX_REASONS.has(reason));
        if (retryReasons.length === 0) return;
        const groupId = typeof rawRow.group_id === 'string' ? rawRow.group_id : '';
        if (!groupId) return;
        candidates.push({
          category,
          groupId,
          type: String(rawRow.type ?? ''),
          quantity: category === 'cake_messages' ? 1 : Number(rawRow.quantity),
          geometryScope: category === 'cake_messages' ? undefined : normalizeV2Scope(rawRow).scope,
          targetBoxCount: normalized.targetBoxCount,
          reasons: retryReasons,
        });
      } catch {
        // Core semantic fields remain the responsibility of analysis validation.
      }
    });
  }
  return candidates;
}

/** Merge bbox-only repair output by category and stable group_id, never array position. */
export function mergeIntegratedBboxRepairResponse(
  envelope: unknown,
  candidates: IntegratedBboxRepairCandidate[],
  repair: unknown,
): unknown {
  if (!isRecord(envelope) || !isRecord(envelope.analysis) || !isRecord(repair)
    || !Array.isArray(repair.repairs)) return envelope;
  const analysis = { ...envelope.analysis };
  const repairByKey = new Map<string, Record<string, unknown>>();
  repair.repairs.forEach((entry) => {
    if (!isRecord(entry) || typeof entry.repair_key !== 'string' || repairByKey.has(entry.repair_key)) return;
    repairByKey.set(entry.repair_key, entry);
  });
  for (const [candidateIndex, candidate] of candidates.entries()) {
    const replacement = repairByKey.get(`row_${candidateIndex}`);
    const rows = analysis[candidate.category];
    if (!replacement || !Array.isArray(rows)) continue;
    const matching = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => isRecord(row) && row.group_id === candidate.groupId);
    if (matching.length !== 1) continue;
    const originalRow = matching[0].row as Record<string, unknown>;
    const updatedRows = [...rows];
    updatedRows[matching[0].index] = {
      ...originalRow,
      ...(replacement.box_2d !== undefined ? { box_2d: replacement.box_2d } : {}),
      ...(replacement.bbox_confidence !== undefined ? { bbox_confidence: replacement.bbox_confidence } : {}),
      ...(candidate.category !== 'cake_messages' && replacement.geometry_scope !== undefined
        ? { geometry_scope: replacement.geometry_scope }
        : {}),
    };
    analysis[candidate.category] = updatedRows;
  }
  return { ...envelope, analysis };
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
      if (row.type === 'icing_decorations' && (row.material !== 'icing' || row.quantity !== 1)) {
        fail(`${path}.geometry_scope`, 'icing_decorations treatment requires icing material and quantity 1');
      }
      return 1;
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
  allowApplicationReview = false,
) {
  const rows = analysis[path];
  if (!Array.isArray(rows)) fail(`analysis.${path}`, 'must be an array');
  rows.forEach((rawRow, index) => {
    const rowPath = `analysis.${path}[${index}]`;
    const row = requireRecord(rawRow, rowPath);
    if (
      geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION
      && !allowApplicationReview
      && ('bbox_review' in row || 'parent_group_id' in row)
    ) {
      fail(rowPath, 'must not contain application-generated bbox review or parent identity fields');
    }
    for (const field of FORBIDDEN_MODEL_SIZING_FIELDS) {
      if (field in row) fail(`${rowPath}.${field}`, `must not be model-generated in ${geometryVersion}`);
    }
    const requireCollection = geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION && path !== 'cake_messages';
    const allowEmpty = geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION
      && isRecord(row.bbox_review)
      && row.bbox_review.status === 'needs_review';
    const rowBoxes = boxes(row.box_2d, `${rowPath}.box_2d`, requireCollection, allowEmpty);
    const rowConfidences = confidences(
      row.bbox_confidence,
      `${rowPath}.bbox_confidence`,
      rowBoxes.length,
      requireCollection,
    );
    if (path === 'cake_messages') {
      const reviewAllowsNoBox = allowApplicationReview
        && isRecord(row.bbox_review)
        && row.bbox_review.status === 'needs_review';
      if ((!reviewAllowsNoBox && rowBoxes.length !== 1) || rowConfidences.length !== rowBoxes.length) {
        fail(rowPath, 'cake messages require exactly one box and one confidence');
      }
      return;
    }
    const expectedCount = expectedBoxCount(row, rowPath, geometryVersion);
    if (geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION && rowBoxes.length !== expectedCount && !allowEmpty) {
      // V2 cardinality is repaired once, then retained with an explicit review
      // marker if Gemini still under- or over-localizes the group.
      if (!isRecord(row.bbox_review) || row.bbox_review.status !== 'needs_review') {
        fail(`${rowPath}.box_2d`, `must contain exactly ${expectedCount} box${expectedCount === 1 ? '' : 'es'} for ${row.geometry_scope} scope`);
      }
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

function normalizeV2AnalysisGeometry(
  analysis: Record<string, unknown>,
  options: { allowApplicationReview?: boolean } = {},
): Record<string, unknown> {
  const normalized = { ...analysis };
  for (const category of ['main_toppers', 'support_elements', 'cake_messages'] as const) {
    const rows = normalized[category];
    if (!Array.isArray(rows)) continue;
    normalized[category] = rows.map((row, index) => normalizeV2GeometryRow(
      row,
      `analysis.${category}[${index}]`,
      { ...options, includeScope: category !== 'cake_messages' },
    ).row);
  }
  return normalized;
}

function validateGeometry(
  value: unknown,
  rejected: boolean,
  geometryVersion: IntegratedBboxGeometryVersion,
  allowMissingCakeHeightLine = false,
): IntegratedBboxGeometry {
  const geometry = requireRecord(value, 'geometry');
  const canFallbackHeight = !rejected
    && geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION
    && allowMissingCakeHeightLine;
  if (rejected) {
    requireExactKeys(geometry, ['geometry_version'], 'geometry');
  } else if (canFallbackHeight) {
    const allowedKeys = ['geometry_version', 'cake_diameter_line', 'cake_height_line'];
    if (Object.keys(geometry).some((key) => !allowedKeys.includes(key))) {
      fail('geometry', `must contain only: ${allowedKeys.join(', ')}`);
    }
    if (!('geometry_version' in geometry)) fail('geometry.geometry_version', 'is required');
    if (!('cake_diameter_line' in geometry)) fail('geometry.cake_diameter_line', 'is required for accepted analysis');
  } else {
    const expected = ['geometry_version', 'cake_diameter_line', 'cake_height_line'];
    if (Object.keys(geometry).some((key) => !expected.includes(key))) {
      fail('geometry', `must contain only: ${expected.join(', ')}`);
    }
    for (const key of expected) {
      if (!(key in geometry)) fail(`geometry.${key}`, 'is required');
    }
  }
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
  if (!isPredominantlyHorizontal(diameter)) {
    fail('geometry.cake_diameter_line', 'must be a left-to-right predominantly horizontal line');
  }
  let height: IntegratedBboxLine | undefined;
  try {
    if (!('cake_height_line' in geometry)) {
      fail('geometry.cake_height_line', 'is required for accepted analysis');
    }
    height = canonicalizeLineDirection(
      line(geometry.cake_height_line, 'geometry.cake_height_line'),
      'vertical',
    );
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
  } catch (error) {
    const isHeightLineFailure = error instanceof GeneratedAnalysisContractError
      && error.message.includes('geometry.cake_height_line');
    if (!canFallbackHeight || !isHeightLineFailure) throw error;
    height = undefined;
  }

  return {
    geometry_version: geometryVersion,
    cake_diameter_line: diameter,
    ...(height ? { cake_height_line: height } : {}),
  };
}

/**
 * Validates the raw Gemini envelope before post-processing. This intentionally
 * rejects model-owned size fields: only the application may add them later.
 */
export function validateIntegratedBboxResponse(
  value: unknown,
  geometryVersion: IntegratedBboxGeometryVersion = INTEGRATED_BBOX_V1_GEOMETRY_VERSION,
  options: {
    allowMissingCakeHeightLine?: boolean;
    allowApplicationReview?: boolean;
    tolerantRows?: boolean;
  } = {},
): IntegratedBboxResponse {
  const response = requireRecord(value, 'integrated response');
  requireExactKeys(response, ['analysis', 'geometry'], 'integrated response');
  const analysis = requireRecord(response.analysis, 'analysis');
  const rejection = requireRecord(analysis.rejection, 'analysis.rejection');
  if (typeof rejection.isRejected !== 'boolean') fail('analysis.rejection.isRejected', 'must be a boolean');
  if ('cake_measurements' in analysis || 'cake_bbox' in analysis || 'geometry' in analysis) {
    fail('analysis', 'must not include legacy or duplicate geometry fields');
  }

  const geometry = validateGeometry(
    response.geometry,
    rejection.isRejected,
    geometryVersion,
    options.allowMissingCakeHeightLine,
  );
  if (!rejection.isRejected) {
    const normalizedAnalysis = geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION && options.tolerantRows
      ? normalizeV2AnalysisGeometry(analysis, options)
      : analysis;
    const allowApplicationReview = Boolean(options.tolerantRows);
    requireGeometryRows(normalizedAnalysis, 'main_toppers', geometryVersion, allowApplicationReview);
    requireGeometryRows(normalizedAnalysis, 'support_elements', geometryVersion, allowApplicationReview);
    requireGeometryRows(normalizedAnalysis, 'cake_messages', geometryVersion, allowApplicationReview);
    return {
      analysis: geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION && options.tolerantRows
        ? normalizedAnalysis
        : normalizeIntegratedConfidenceArrays(analysis, geometryVersion),
      geometry,
    };
  }

  return {
    analysis,
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

function cachedSizeForRow(
  previousAnalysis: unknown,
  path: 'main_toppers' | 'support_elements',
  row: Record<string, unknown>,
): ValidSize | undefined {
  if (!isRecord(previousAnalysis) || !Array.isArray(previousAnalysis[path])) return undefined;
  const candidates = (previousAnalysis[path] as unknown[]).filter((candidate): candidate is Record<string, unknown> => (
    isRecord(candidate)
    && candidate.type === row.type
    && (
      candidate.group_id === row.group_id
      || candidate.parent_group_id === row.group_id
    )
  ));
  const sizes = candidates
    .map((candidate) => candidate.size)
    .filter((size): size is ValidSize => size === 'small' || size === 'medium' || size === 'large');
  if (sizes.length === 0) return undefined;
  // A previously size-split parent can have more than one cached child size.
  // With no new boxes to distinguish them, preserve the conservative largest.
  return sizes.reduce((largest, size) => (
    ['small', 'medium', 'large'].indexOf(size) > ['small', 'medium', 'large'].indexOf(largest)
      ? size
      : largest
  ));
}

function addReviewReason(row: Record<string, unknown>, reason: string): Record<string, unknown> {
  const current = isRecord(row.bbox_review) && Array.isArray(row.bbox_review.reasons)
    ? row.bbox_review.reasons.filter((value): value is string => typeof value === 'string')
    : [];
  const review = isRecord(row.bbox_review) ? row.bbox_review : {
    status: 'needs_review',
    target_box_count: 0,
    returned_box_count: 0,
    valid_box_count: 0,
  };
  return {
    ...row,
    bbox_review: {
      ...review,
      status: 'needs_review',
      reasons: [...new Set([...current, reason])],
    },
  };
}

function assignSize(
  rawRow: unknown,
  rowPath: string,
  cakeArea: number,
  geometryVersion: IntegratedBboxGeometryVersion,
  previousAnalysis?: unknown,
  category?: 'main_toppers' | 'support_elements',
  tolerantRows = false,
): Record<string, unknown> {
  const row = requireRecord(rawRow, rowPath);
  const scope = geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION
    ? requiredGeometryScope(row, rowPath)
    : undefined;
  if (scope === 'piped_cluster') {
    const coverage = row.coverage;
    if (!['small', 'medium', 'large'].includes(coverage as string)) {
      fail(`${rowPath}.coverage`, 'must be small, medium, or large for a piped_cluster');
    }
    // A cluster box is persisted for review only. Its coverage band—not its
    // visible area—selects the fixed cluster price.
    return { ...row, size: coverage as ValidSize };
  }
  const rowBoxes = boxes(
    row.box_2d,
    `${rowPath}.box_2d`,
    geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION,
    isRecord(row.bbox_review) && row.bbox_review.status === 'needs_review',
  );
  confidences(
    row.bbox_confidence,
    `${rowPath}.bbox_confidence`,
    rowBoxes.length,
    geometryVersion === INTEGRATED_BBOX_GEOMETRY_VERSION,
  );
  if (rowBoxes.length === 0) {
    const previousSize = category ? cachedSizeForRow(previousAnalysis, category, row) : undefined;
    const preservedRow = previousSize
      ? addReviewReason(row, 'zero_boxes_prior_size_preserved')
      : addReviewReason(row, 'zero_boxes_no_prior_size_large_fallback');
    return { ...preservedRow, size: previousSize ?? 'large' };
  }
  const areaRatios = rowBoxes.map(([ymin, xmin, ymax, xmax]) => (
    ((xmax - xmin) * (ymax - ymin) / cakeArea) * 100
  ));
  if (areaRatios.some((areaRatioPercent) => !Number.isFinite(areaRatioPercent) || areaRatioPercent <= 0)) {
    fail(rowPath, 'must produce positive finite bbox area ratios');
  }
  const sizes = areaRatios.map(sizeForAreaRatio);
  if (scope === 'unit' && new Set(sizes).size !== 1 && !tolerantRows) {
    fail(rowPath, 'unit boxes cross size bands; split visually different scales into separate rows');
  }
  // A partial/capped sample can contain multiple bands; the largest valid unit
  // is the safe deterministic band. Fully observed mixed groups are split by
  // applyIntegratedBboxSizing below.
  const size: ValidSize = scope === 'unit' && new Set(sizes).size === 1
    ? sizes[0]
    : sizeForAreaRatio(Math.max(...areaRatios));
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

  if (!geometry.cake_height_line) {
    const fallbackThickness = reconcileCakeThicknessForType(cakeType, analysis.cakeThickness);
    return !fallbackThickness || fallbackThickness === analysis.cakeThickness
      ? analysis
      : { ...analysis, cakeThickness: fallbackThickness };
  }

  const diameterLength = measuredLineLength(geometry.cake_diameter_line!);
  const heightLength = measuredLineLength(geometry.cake_height_line!);
  const aspectRatio = diameterLength / heightLength;
  const requestedThickness = cakeThicknessForAspectRatio(aspectRatio);
  const cakeThickness = reconcileCakeThicknessForType(cakeType, requestedThickness);
  if (!cakeThickness) return analysis;
  if (cakeThickness !== requestedThickness) {
    console.warn('[AI Contract] Reconciled measured cake thickness to the nearest supported value', {
      cakeType,
      measuredThickness: requestedThickness,
      reconciledThickness: cakeThickness,
    });
  }
  return cakeThickness === analysis.cakeThickness ? analysis : { ...analysis, cakeThickness };
}

/** Applies the user-approved area formula without type-specific overrides. */
function splitFullyObservedMixedSizeRow(
  row: Record<string, unknown>,
  cakeArea: number,
): Record<string, unknown>[] {
  if (
    row.geometry_scope !== 'unit'
    || row.bbox_review !== undefined
    || !Number.isInteger(row.quantity)
    || Number(row.quantity) < 2
    || Number(row.quantity) > INTEGRATED_MAX_UNIT_BOXES
    || !Array.isArray(row.box_2d)
    || row.box_2d.length !== Number(row.quantity)
    || !Array.isArray(row.bbox_confidence)
    || row.bbox_confidence.length !== row.box_2d.length
  ) return [row];

  const groups = new Map<ValidSize, { boxes: unknown[]; confidences: unknown[] }>();
  const confidenceValues = row.bbox_confidence as unknown[];
  row.box_2d.forEach((rawBox, index) => {
    const [ymin, xmin, ymax, xmax] = rawBox as IntegratedBbox;
    const areaRatio = ((xmax - xmin) * (ymax - ymin) / cakeArea) * 100;
    const size = sizeForAreaRatio(areaRatio);
    const group = groups.get(size) ?? { boxes: [], confidences: [] };
    group.boxes.push(rawBox);
    group.confidences.push(confidenceValues[index]);
    groups.set(size, group);
  });
  if (groups.size <= 1) return [row];

  const parentGroupId = typeof row.parent_group_id === 'string'
    ? row.parent_group_id
    : String(row.group_id);
  const base = { ...row };
  return [...groups.entries()].map(([size, group]) => ({
    ...base,
    group_id: `${parentGroupId}::bbox:${size}`,
    parent_group_id: parentGroupId,
    quantity: group.boxes.length,
    box_2d: group.boxes,
    bbox_confidence: group.confidences,
    size,
  }));
}

export function applyIntegratedBboxSizing(
  response: IntegratedBboxResponse,
  options: { previousAnalysis?: unknown; tolerantRows?: boolean } = {},
): Record<string, unknown> {
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
    return rows.flatMap((rawRow, index) => {
      const sized = assignSize(
        rawRow,
        `analysis.${path}[${index}]`,
        cakeArea,
        geometry.geometry_version,
        options.previousAnalysis,
        path,
        options.tolerantRows,
      );
      return geometry.geometry_version === INTEGRATED_BBOX_GEOMETRY_VERSION && options.tolerantRows
        ? splitFullyObservedMixedSizeRow(sized, cakeArea)
        : [sized];
    });
  };

  const aspectRatioAnalysis = applyAspectRatioCakeThickness(analysis, geometry);
  return {
    ...aspectRatioAnalysis,
    main_toppers: sizeRows('main_toppers'),
    support_elements: sizeRows('support_elements'),
    geometry,
  };
}
