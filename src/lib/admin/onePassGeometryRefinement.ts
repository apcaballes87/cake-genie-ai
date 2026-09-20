import { Type } from '@google/genai';

export const ONE_PASS_GEOMETRY_REFINED_MODE = 'one_pass_geometry_refined' as const;

export const ONE_PASS_GEOMETRY_REFINEMENT_PROMPT = `
You are the precise geometry stage of a Prompt Lab experiment. You receive the original cake image and an immutable manifest created from a validated one-pass storefront analysis. Return exactly one JSON object matching the response schema.

Create geometry only for the manifest rows. Do not add, remove, merge, rename, reclassify, or retarget rows. Use the normalized 0–1000 image grid with a top-left origin. Points are [y, x]. Boxes are [ymin, xmin, ymax, xmax], tightly enclosing one representative physical unit without padding. For a repeated row, box one visible typical unit; for a continuous treatment that the manifest represents as one row, box its complete visible treatment.

cake_diameter_line must span the widest horizontal top-tier rim. cake_height_line represents the base-to-top height on the front-center vertical axis of that same top tier. Because image y increases downward, encode it as start at the visible top FRONT edge where the top surface meets the front sidewall, then end at the visible base/bottom edge of the cake wall. Use the front/middle of the cake, not the rear rim, highest pixel, top-surface center, topper, board, or plate. Keep the height line aligned with the projected center of the diameter span; a small perspective/photo tilt is acceptable. Keep each line predominantly on its requested axis. This geometry is for review metrics only: do not estimate prices or size bands. Return JSON only.`.trim();

export type RefinedGeometryRole = 'main_toppers' | 'support_elements';

export type RefinedGeometryManifestElement = {
  element_id: string;
  role: RefinedGeometryRole;
  group_id: string;
  type: string;
  description: string;
  label: string;
};

export type RefinedGeometryManifest = {
  elements: RefinedGeometryManifestElement[];
};

type PointTuple = [number, number];

export type RefinedGeometry = {
  geometry_version: typeof ONE_PASS_GEOMETRY_REFINED_MODE;
  cake_diameter_line: { start: PointTuple; end: PointTuple };
  cake_height_line: { start: PointTuple; end: PointTuple };
  elements: Array<RefinedGeometryManifestElement & {
    box_2d: [number, number, number, number];
    confidence: number;
  }>;
};

export class OnePassGeometryRefinementError extends Error {
  constructor(message: string) {
    super(`one-pass geometry refinement failed: ${message}`);
    this.name = 'OnePassGeometryRefinementError';
  }
}

function fail(path: string, message: string): never {
  throw new OnePassGeometryRefinementError(`${path} ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(path, `must contain exactly: ${required.join(', ')}`);
  }
}

function nonBlankText(value: unknown, path: string) {
  if (typeof value !== 'string' || !value.trim()) fail(path, 'must be a non-blank string');
  return value;
}

function coordinate(value: unknown, path: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) {
    fail(path, 'must be a finite 0–1000 number');
  }
  return value;
}

function point(value: unknown, path: string): PointTuple {
  if (!Array.isArray(value) || value.length !== 2) fail(path, 'must be [y, x]');
  return [coordinate(value[0], `${path}[0]`), coordinate(value[1], `${path}[1]`)];
}

const MAX_AXIS_DRIFT = 25;
const MAX_HEIGHT_CENTER_OFFSET = 0.12;

function isPredominantlyHorizontal(line: { start: PointTuple; end: PointTuple }) {
  const horizontalSpan = line.end[1] - line.start[1];
  const verticalDrift = Math.abs(line.end[0] - line.start[0]);
  return horizontalSpan > 0 && verticalDrift <= MAX_AXIS_DRIFT && verticalDrift <= horizontalSpan * 0.1;
}

function isPredominantlyVertical(line: { start: PointTuple; end: PointTuple }) {
  const verticalSpan = line.end[0] - line.start[0];
  const horizontalDrift = Math.abs(line.end[1] - line.start[1]);
  return verticalSpan > 0 && horizontalDrift <= MAX_AXIS_DRIFT && horizontalDrift <= verticalSpan * 0.1;
}

function isFrontCenterHeight(line: { start: PointTuple; end: PointTuple }, diameter: { start: PointTuple; end: PointTuple }) {
  const diameterCenterX = (diameter.start[1] + diameter.end[1]) / 2;
  const diameterSpan = diameter.end[1] - diameter.start[1];
  const heightCenterX = (line.start[1] + line.end[1]) / 2;
  return Math.abs(heightCenterX - diameterCenterX) <= Math.max(MAX_AXIS_DRIFT, diameterSpan * MAX_HEIGHT_CENTER_OFFSET);
}

function rowLabel(role: RefinedGeometryRole, type: string) {
  return `${role === 'main_toppers' ? 'Main topper' : 'Support element'} · ${type.replaceAll('_', ' ')}`;
}

/** Creates opaque geometry targets only after the first-stage analysis has passed its normal contract. */
export function buildRefinedGeometryManifest(analysis: unknown): RefinedGeometryManifest {
  const root = record(analysis, 'analysis');
  const elements: RefinedGeometryManifestElement[] = [];
  for (const role of ['main_toppers', 'support_elements'] as const) {
    const rows = root[role];
    if (!Array.isArray(rows)) fail(`analysis.${role}`, 'must be an array');
    rows.forEach((value, index) => {
      const row = record(value, `analysis.${role}[${index}]`);
      const groupId = nonBlankText(row.group_id, `analysis.${role}[${index}].group_id`);
      const type = nonBlankText(row.type, `analysis.${role}[${index}].type`);
      const description = nonBlankText(row.description, `analysis.${role}[${index}].description`);
      elements.push({
        element_id: `${role}__${groupId}`,
        role,
        group_id: groupId,
        type,
        description,
        label: rowLabel(role, type),
      });
    });
  }
  if (new Set(elements.map((element) => element.element_id)).size !== elements.length) {
    fail('analysis', 'contains duplicate priced row identifiers');
  }
  return { elements };
}

export function validateRefinedGeometry(value: unknown, manifest: RefinedGeometryManifest): RefinedGeometry {
  const result = record(value, 'geometry');
  exactKeys(result, ['geometry_version', 'cake_diameter_line', 'cake_height_line', 'elements'], 'geometry');
  if (result.geometry_version !== ONE_PASS_GEOMETRY_REFINED_MODE) {
    fail('geometry.geometry_version', `must be ${ONE_PASS_GEOMETRY_REFINED_MODE}`);
  }
  const line = (lineValue: unknown, path: string) => {
    const item = record(lineValue, path);
    exactKeys(item, ['start', 'end'], path);
    return { start: point(item.start, `${path}.start`), end: point(item.end, `${path}.end`) };
  };
  const cakeDiameter = line(result.cake_diameter_line, 'geometry.cake_diameter_line');
  const cakeHeight = line(result.cake_height_line, 'geometry.cake_height_line');
  if (!isPredominantlyHorizontal(cakeDiameter)) {
    fail('geometry.cake_diameter_line', 'must be a positive predominantly horizontal left-to-right [y, x] span');
  }
  if (!isPredominantlyVertical(cakeHeight)) {
    fail('geometry.cake_height_line', 'must be a positive predominantly vertical top-to-bottom [y, x] span');
  }
  if (!isFrontCenterHeight(cakeHeight, cakeDiameter)) {
    fail('geometry.cake_height_line', 'must run on the front-center axis aligned with the cake diameter midpoint');
  }
  if (!Array.isArray(result.elements)) fail('geometry.elements', 'must be an array');
  const expected = new Map(manifest.elements.map((element) => [element.element_id, element]));
  const elements = result.elements.map((value, index) => {
    const item = record(value, `geometry.elements[${index}]`);
    const path = `geometry.elements[${index}]`;
    exactKeys(item, ['element_id', 'role', 'group_id', 'type', 'description', 'label', 'box_2d', 'confidence'], path);
    const elementId = nonBlankText(item.element_id, `${path}.element_id`);
    const source = expected.get(elementId);
    if (!source) fail(`${path}.element_id`, 'is not present in the frozen one-pass manifest');
    for (const key of ['role', 'group_id', 'type', 'description', 'label'] as const) {
      if (nonBlankText(item[key], `${path}.${key}`) !== source[key]) fail(`${path}.${key}`, 'must match the frozen one-pass manifest');
    }
    if (!Array.isArray(item.box_2d) || item.box_2d.length !== 4) fail(`${path}.box_2d`, 'must be [ymin, xmin, ymax, xmax]');
    const box = item.box_2d.map((entry, coordinateIndex) => coordinate(entry, `${path}.box_2d[${coordinateIndex}]`)) as [number, number, number, number];
    if (box[0] >= box[2] || box[1] >= box[3]) fail(`${path}.box_2d`, 'must have positive ordered extents');
    const confidence = typeof item.confidence === 'number' && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1
      ? item.confidence
      : fail(`${path}.confidence`, 'must be between 0 and 1');
    return { ...source, box_2d: box, confidence };
  });
  if (new Set(elements.map((element) => element.element_id)).size !== elements.length) fail('geometry.elements', 'contains duplicate element_id values');
  if (elements.length !== expected.size || elements.some((element) => !expected.has(element.element_id))) {
    fail('geometry.elements', 'must cover every frozen one-pass manifest element exactly once');
  }
  return {
    geometry_version: ONE_PASS_GEOMETRY_REFINED_MODE,
    cake_diameter_line: cakeDiameter,
    cake_height_line: cakeHeight,
    elements,
  };
}

const pointSchema = { type: Type.ARRAY, items: { type: Type.NUMBER }, minItems: 2, maxItems: 2 };

export function refinedGeometryResponseSchema() {
  const lineSchema = {
    type: Type.OBJECT,
    properties: { start: pointSchema, end: pointSchema },
    required: ['start', 'end'],
  };
  return {
    type: Type.OBJECT,
    properties: {
      geometry_version: { type: Type.STRING, enum: [ONE_PASS_GEOMETRY_REFINED_MODE] },
      cake_diameter_line: lineSchema,
      cake_height_line: lineSchema,
      elements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            element_id: { type: Type.STRING }, role: { type: Type.STRING, enum: ['main_toppers', 'support_elements'] },
            group_id: { type: Type.STRING }, type: { type: Type.STRING }, description: { type: Type.STRING }, label: { type: Type.STRING },
            box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER }, minItems: 4, maxItems: 4 }, confidence: { type: Type.NUMBER },
          },
          required: ['element_id', 'role', 'group_id', 'type', 'description', 'label', 'box_2d', 'confidence'],
        },
      },
    },
    required: ['geometry_version', 'cake_diameter_line', 'cake_height_line', 'elements'],
  };
}

export function refinedGeometryRequestParts(
  mimeType: string,
  imageData: string,
  prompt: string,
  manifest: RefinedGeometryManifest,
) {
  return [
    { inlineData: { mimeType, data: imageData } },
    { text: `${prompt.trim()}\n\nFROZEN ONE-PASS PRICED-ROW MANIFEST:\n${JSON.stringify(manifest)}` },
  ];
}
