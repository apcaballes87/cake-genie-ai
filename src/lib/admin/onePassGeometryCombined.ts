import { Type, type Schema } from '@google/genai';

import { buildSearchAnalysisResponseSchema, type AnalysisGenerationSizeSchema } from './searchAnalysisContract';
import type { GeneratedAnalysisTypeEnums } from '@/lib/ai/generatedAnalysisContract';

export const ONE_PASS_GEOMETRY_COMBINED_MODE = 'one_pass_geometry_combined' as const;

export const ONE_PASS_GEOMETRY_COMBINED_PROMPT = `
You are running a true one-pass cake analysis and geometry audit. Use the supplied original cake image and return exactly one JSON object with two fields: "analysis" and "geometry".

The "analysis" field must follow the existing storefront cake-analysis contract exactly. Do not simplify it when adding geometry: include every required analysis field and never emit null for a required field. When the selected production schema uses direct diameter-anchor sizing, include a valid size string for every main topper and every non-sizeless support element; omit size only for the explicitly sizeless edible_flowers_filler type. The "geometry" field is an exhaustive visual inventory of every intentional cake-design element, including decorations on the cake body, base, and cake board. Exclude only genuine background, table, stand, or scene artifacts. Repeated identical decorations are one counted group with one representative box. Continuous piping, drips, borders, and similar treatments receive one complete treatment box.

For every accepted geometry element, provide a stable snake_case element_id, label, category, description, belongs_to_cake_design=true, visible_count, box_2d, and confidence. Use normalized 0–1000 image coordinates with a top-left origin. Boxes are [ymin, xmin, ymax, xmax] and must tightly enclose the visible representative unit without padding.

When a geometry element corresponds to an analysis.main_toppers or analysis.support_elements row, use the normalized snake_case form of that row's group_id as element_id and use category "main_toppers" or "support_elements". This lets the client attach the exact box and confidence back to the priced analysis row. Geometry-only decorations that are not analysis rows keep their own unique element_id.

All measurement line endpoints are [y, x] tuples. For cake_diameter_line, start at the left endpoint (smaller x) and end at the right endpoint (larger x). cake_diameter_line must span the widest horizontal top-tier rim. For cake_height_line, start at the visible top FRONT edge where the top surface meets the front sidewall (smaller y) and end at the visible base edge (larger y) on the front-center vertical axis of that same top tier. Do not use the rear rim, highest pixel, exposed top surface, topper, board, or plate for the height line. Return empty geometry elements and omit measurement lines when the image is rejected. Return JSON only.`.trim();

type PointTuple = [number, number];

export type CombinedGeometryElement = {
  element_id: string;
  label: string;
  category: string;
  description: string;
  belongs_to_cake_design: true;
  visible_count: number;
  box_2d: [number, number, number, number];
  confidence: number;
};

export type CombinedGeometry = {
  geometry_version: typeof ONE_PASS_GEOMETRY_COMBINED_MODE;
  cake_diameter_line?: { start: PointTuple; end: PointTuple };
  cake_height_line?: { start: PointTuple; end: PointTuple };
  elements: CombinedGeometryElement[];
};

export type CombinedResponse = {
  analysis: Record<string, unknown>;
  geometry: CombinedGeometry;
};

export type CombinedGeometryAttachment = Pick<CombinedGeometryElement, 'element_id' | 'label' | 'category' | 'box_2d' | 'confidence' | 'visible_count'>;

export class OnePassGeometryCombinedError extends Error {
  constructor(message: string) {
    super(`true one-pass geometry failed: ${message}`);
    this.name = 'OnePassGeometryCombinedError';
  }
}

function fail(path: string, message: string): never {
  throw new OnePassGeometryCombinedError(`${path} ${message}`);
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

function text(value: unknown, path: string) {
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
  const horizontalSpan = Math.abs(line.end[1] - line.start[1]);
  const verticalDrift = Math.abs(line.end[0] - line.start[0]);
  return horizontalSpan > 0 && verticalDrift <= MAX_AXIS_DRIFT && verticalDrift <= horizontalSpan * 0.1;
}

function isPredominantlyVertical(line: { start: PointTuple; end: PointTuple }) {
  const verticalSpan = Math.abs(line.end[0] - line.start[0]);
  const horizontalDrift = Math.abs(line.end[1] - line.start[1]);
  return verticalSpan > 0 && horizontalDrift <= MAX_AXIS_DRIFT && horizontalDrift <= verticalSpan * 0.1;
}

function isFrontCenterHeight(line: { start: PointTuple; end: PointTuple }, diameter: { start: PointTuple; end: PointTuple }) {
  const diameterCenterX = (diameter.start[1] + diameter.end[1]) / 2;
  const diameterSpan = diameter.end[1] - diameter.start[1];
  const heightCenterX = (line.start[1] + line.end[1]) / 2;
  return Math.abs(heightCenterX - diameterCenterX) <= Math.max(MAX_AXIS_DRIFT, diameterSpan * MAX_HEIGHT_CENTER_OFFSET);
}

function validateLine(value: unknown, path: string): { start: PointTuple; end: PointTuple } {
  const item = record(value, path);
  exactKeys(item, ['start', 'end'], path);
  return { start: point(item.start, `${path}.start`), end: point(item.end, `${path}.end`) };
}

function orderHorizontalLine(line: { start: PointTuple; end: PointTuple }) {
  return line.start[1] <= line.end[1] ? line : { start: line.end, end: line.start };
}

function orderVerticalLine(line: { start: PointTuple; end: PointTuple }) {
  return line.start[0] <= line.end[0] ? line : { start: line.end, end: line.start };
}

function validateGeometry(value: unknown, rejected: boolean): CombinedGeometry {
  const result = record(value, 'geometry');
  const expectedKeys = rejected
    ? ['geometry_version', 'elements']
    : ['geometry_version', 'cake_diameter_line', 'cake_height_line', 'elements'];
  exactKeys(result, expectedKeys, 'geometry');
  if (result.geometry_version !== ONE_PASS_GEOMETRY_COMBINED_MODE) {
    fail('geometry.geometry_version', `must be ${ONE_PASS_GEOMETRY_COMBINED_MODE}`);
  }
  if (!Array.isArray(result.elements)) fail('geometry.elements', 'must be an array');
  if (rejected && result.elements.length) fail('geometry.elements', 'must be empty for a rejected image');

  const elements = result.elements.map((value, index) => {
    const item = record(value, `geometry.elements[${index}]`);
    const path = `geometry.elements[${index}]`;
    exactKeys(item, ['element_id', 'label', 'category', 'description', 'belongs_to_cake_design', 'visible_count', 'box_2d', 'confidence'], path);
    const elementId = text(item.element_id, `${path}.element_id`);
    if (!/^[a-z][a-z0-9_]*$/.test(elementId)) fail(`${path}.element_id`, 'must be a stable snake_case identifier');
    if (typeof item.belongs_to_cake_design !== 'boolean' || item.belongs_to_cake_design !== true) {
      fail(`${path}.belongs_to_cake_design`, 'must be true for an intentional cake-design element');
    }
    if (!Number.isInteger(item.visible_count) || Number(item.visible_count) < 1) {
      fail(`${path}.visible_count`, 'must be a positive integer');
    }
    if (!Array.isArray(item.box_2d) || item.box_2d.length !== 4) fail(`${path}.box_2d`, 'must be [ymin, xmin, ymax, xmax]');
    const box = item.box_2d.map((entry, coordinateIndex) => coordinate(entry, `${path}.box_2d[${coordinateIndex}]`)) as [number, number, number, number];
    if (box[0] >= box[2] || box[1] >= box[3]) fail(`${path}.box_2d`, 'must have positive ordered extents');
    const confidence = typeof item.confidence === 'number' && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1
      ? item.confidence
      : fail(`${path}.confidence`, 'must be between 0 and 1');
    return {
      element_id: elementId,
      label: text(item.label, `${path}.label`),
      category: text(item.category, `${path}.category`),
      description: text(item.description, `${path}.description`),
      belongs_to_cake_design: true as const,
      visible_count: Number(item.visible_count),
      box_2d: box,
      confidence,
    };
  });
  if (new Set(elements.map((element) => element.element_id)).size !== elements.length) {
    fail('geometry.elements', 'contains duplicate element_id values');
  }
  if (rejected) return { geometry_version: ONE_PASS_GEOMETRY_COMBINED_MODE, elements };

  const rawCakeDiameterLine = validateLine(result.cake_diameter_line, 'geometry.cake_diameter_line');
  const rawCakeHeightLine = validateLine(result.cake_height_line, 'geometry.cake_height_line');
  if (!isPredominantlyHorizontal(rawCakeDiameterLine)) {
    fail('geometry.cake_diameter_line', 'must be a positive predominantly horizontal left-to-right [y, x] span');
  }
  if (!isPredominantlyVertical(rawCakeHeightLine)) {
    fail('geometry.cake_height_line', 'must be a positive predominantly vertical top-to-bottom [y, x] span');
  }
  // Reversing endpoints does not change the measured segment. Canonicalize
  // only that recoverable ordering error while retaining the raw response.
  const cakeDiameterLine = orderHorizontalLine(rawCakeDiameterLine);
  const cakeHeightLine = orderVerticalLine(rawCakeHeightLine);
  if (!isFrontCenterHeight(cakeHeightLine, cakeDiameterLine)) {
    fail('geometry.cake_height_line', 'must run on the front-center axis aligned with the cake diameter midpoint');
  }
  return {
    geometry_version: ONE_PASS_GEOMETRY_COMBINED_MODE,
    cake_diameter_line: cakeDiameterLine,
    cake_height_line: cakeHeightLine,
    elements,
  };
}

function geometryKey(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/_(?:elem|element|box)$/, '')
    : '';
}

function geometryMatchScore(
  row: Record<string, unknown>,
  section: 'main_toppers' | 'support_elements',
  element: CombinedGeometryElement,
): number {
  const groupId = geometryKey(row.group_id);
  const description = geometryKey(row.description);
  const elementId = geometryKey(element.element_id);
  const label = geometryKey(element.label);
  const elementDescription = geometryKey(element.description);
  const category = geometryKey(element.category);
  let score = category === section ? 30 : 0;
  if (groupId && (elementId === groupId || label === groupId)) score += 100;
  if (description && (elementDescription === description || label === description)) score += 80;
  if (groupId && ((elementId && (elementId.includes(groupId) || groupId.includes(elementId))) || (label && (label.includes(groupId) || groupId.includes(label))))) score += 40;
  return score;
}

/**
 * Adds review-only geometry to the validated priced rows without changing the
 * production analysis fields used by pricing. Geometry-only decorations remain
 * available in geometry.elements and are not forced into a priced row.
 */
export function attachCombinedGeometryToAnalysis(
  analysis: Record<string, unknown>,
  geometry: CombinedGeometry,
): Record<string, unknown> {
  const usedElementIds = new Set<string>();
  const attachRows = (section: 'main_toppers' | 'support_elements') => {
    const rows = analysis[section];
    if (!Array.isArray(rows)) return rows;
    return rows.map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const row = value as Record<string, unknown>;
      const ranked = geometry.elements
        .filter((element) => !usedElementIds.has(element.element_id))
        .map((element) => ({ element, score: geometryMatchScore(row, section, element) }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score);
      const best = ranked[0];
      const tied = best && ranked.filter((candidate) => candidate.score === best.score).length > 1;
      const attachment: CombinedGeometryAttachment | null = best && !tied
        ? {
          element_id: best.element.element_id,
          label: best.element.label,
          category: best.element.category,
          visible_count: best.element.visible_count,
          box_2d: best.element.box_2d,
          confidence: best.element.confidence,
        }
        : null;
      if (attachment) usedElementIds.add(attachment.element_id);
      return { ...row, geometry: attachment };
    });
  };
  return {
    ...analysis,
    main_toppers: attachRows('main_toppers'),
    support_elements: attachRows('support_elements'),
  };
}

export function validateOnePassGeometryCombinedResponse(value: unknown): CombinedResponse {
  const result = record(value, 'combined response');
  exactKeys(result, ['analysis', 'geometry'], 'combined response');
  const analysis = record(result.analysis, 'analysis');
  const rejection = record(analysis.rejection, 'analysis.rejection');
  if (typeof rejection.isRejected !== 'boolean') fail('analysis.rejection.isRejected', 'must be a boolean');
  return { analysis, geometry: validateGeometry(result.geometry, rejection.isRejected) };
}

function requireDirectSizingFields(schema: Schema, sizeSchema: AnalysisGenerationSizeSchema): Schema {
  if (sizeSchema !== 'ai_diameter_anchor' || !schema.properties) return schema;
  const mainItems = schema.properties.main_toppers?.items;
  if (mainItems?.required && !mainItems.required.includes('size')) {
    mainItems.required = [...mainItems.required, 'size'];
  }

  // Support rows have one intentional exception: edible_flowers_filler is
  // size-free. Use an anyOf branch so every other support type is required to
  // provide the value that strict post-processing already demands.
  const supportItems = schema.properties.support_elements?.items;
  const supportProperties = supportItems?.properties;
  const supportRequired = supportItems?.required;
  const supportType = supportProperties?.type;
  if (!supportItems || !supportProperties || !supportRequired || !supportType || !Array.isArray(supportType.enum)) return schema;
  const sizeableTypes = supportType.enum.filter((type) => type !== 'edible_flowers_filler');
  const fillerProperties = {
    ...supportProperties,
    type: { ...supportType, enum: ['edible_flowers_filler'] },
  };
  const sizeableProperties = {
    ...supportProperties,
    type: { ...supportType, enum: sizeableTypes },
  };
  schema.properties.support_elements = {
    ...schema.properties.support_elements,
    items: {
      anyOf: [
        { ...supportItems, properties: sizeableProperties, required: [...new Set([...supportRequired, 'size'])] },
        { ...supportItems, properties: fillerProperties, required: supportRequired.filter((field) => field !== 'size') },
      ],
    },
  };
  return schema;
}

export function combinedGeometryResponseSchema(
  typeEnums: GeneratedAnalysisTypeEnums,
  sizeSchema: AnalysisGenerationSizeSchema = 'ai_diameter_anchor',
) {
  const analysisSchema = requireDirectSizingFields(
    buildSearchAnalysisResponseSchema(typeEnums, sizeSchema) as unknown as Schema,
    sizeSchema,
  );
  const pointSchema = { type: Type.ARRAY, items: { type: Type.NUMBER }, minItems: 2, maxItems: 2 };
  const lineSchema = { type: Type.OBJECT, properties: { start: pointSchema, end: pointSchema }, required: ['start', 'end'] };
  const elementSchema = {
    type: Type.OBJECT,
    properties: {
      element_id: { type: Type.STRING }, label: { type: Type.STRING }, category: { type: Type.STRING }, description: { type: Type.STRING },
      belongs_to_cake_design: { type: Type.BOOLEAN }, visible_count: { type: Type.INTEGER },
      box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER }, minItems: 4, maxItems: 4 }, confidence: { type: Type.NUMBER },
    },
    required: ['element_id', 'label', 'category', 'description', 'belongs_to_cake_design', 'visible_count', 'box_2d', 'confidence'],
  };
  return {
    type: Type.OBJECT,
    properties: {
      analysis: analysisSchema,
      geometry: {
        type: Type.OBJECT,
        properties: {
          geometry_version: { type: Type.STRING, enum: [ONE_PASS_GEOMETRY_COMBINED_MODE] },
          cake_diameter_line: lineSchema,
          cake_height_line: lineSchema,
          elements: { type: Type.ARRAY, items: elementSchema },
        },
        required: ['geometry_version', 'elements'],
      },
    },
    required: ['analysis', 'geometry'],
  };
}

export function combinedGeometryRequestParts(mimeType: string, imageData: string, prompt: string) {
  return [{ inlineData: { mimeType, data: imageData } }, { text: prompt.trim() }];
}
