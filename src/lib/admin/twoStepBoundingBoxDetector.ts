import { Type } from '@google/genai';

export const TWO_STEP_BOUNDING_BOXES_MODE = 'two_step_bounding_boxes' as const;

export const BOUNDING_BOX_IDENTIFICATION_PROMPT = `
You are Step 1 of a two-step cake computer-vision experiment. Inspect the supplied cake image and return exactly one JSON object matching the response schema.

Identify every intentional topper and cake-design element: signs, candles, figurines, florals, printed pieces, piping, drips, pearls, borders, motifs, and decorations on the cake body, base, or cake board. Exclude only genuine background, stand, table, and scene artifacts.

Create one homogeneous element for each independently identifiable design treatment. For repeated identical pearls, flowers, or similar pieces, return one counted group with a stable snake_case element_id; Step 2 will box one representative visible unit. Continuous piping, drips, and borders are each one treatment. Do not price, infer fulfillment types, or create geometry in this step.

If the image cannot be analyzed as one cake, set rejection.isRejected true and emit no elements. Return JSON only.`.trim();

export const BOUNDING_BOX_GEOMETRY_PROMPT = `
You are Step 2 of a two-step cake computer-vision experiment. You receive the original cake image and an immutable Step 1 identification manifest. Return exactly one JSON object matching the response schema.

Create precise geometry only for the supplied manifest elements. Do not add, remove, rename, merge, or recategorize them. Use the normalized 0–1000 image grid with a top-left origin. Points are [y, x]. Boxes are [ymin, xmin, ymax, xmax], tightly enclosing one representative physical unit without padding. For continuous piping, drips, or borders, box the complete treatment.

cake_diameter_line must span the widest horizontal top-tier rim. cake_height_line represents the base-to-top height on the front-center vertical axis of that same top tier. Because image y increases downward, encode it as start at the visible top FRONT edge where the top surface meets the front sidewall, then end at the visible base/bottom edge of the cake wall. Use the front/middle of the cake, not the rear rim, highest pixel, top-surface center, topper, board, or plate. Align its x coordinate with the midpoint of the diameter span. Return JSON only.`.trim();

export type DetectorElement = {
  element_id: string;
  label: string;
  category: string;
  description: string;
  belongs_to_cake_design: boolean;
  visible_count: number;
};

export type DetectorIdentification = {
  identification_version: typeof TWO_STEP_BOUNDING_BOXES_MODE;
  elements: DetectorElement[];
  rejection: { isRejected: boolean; reason: string; message: string };
};

type PointTuple = [number, number];
export type DetectorGeometry = {
  geometry_version: typeof TWO_STEP_BOUNDING_BOXES_MODE;
  cake_diameter_line: { start: PointTuple; end: PointTuple };
  cake_height_line: { start: PointTuple; end: PointTuple };
  toppers: Array<{
    element_id: string;
    label: string;
    category: string;
    box_2d: [number, number, number, number];
    confidence: number;
  }>;
};

function fail(path: string, message: string): never { throw new Error(`Invalid bounding-box detector response: ${path} ${message}`); }
function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string) {
  const actual = Object.keys(value).sort(); const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) fail(path, `must contain exactly: ${required.join(', ')}`);
}
function text(value: unknown, path: string, blank = false) {
  if (typeof value !== 'string' || (!blank && !value.trim())) fail(path, 'must be a non-blank string');
  return value;
}
function bool(value: unknown, path: string) { if (typeof value !== 'boolean') fail(path, 'must be a boolean'); return value; }
function count(value: unknown, path: string) { if (!Number.isInteger(value) || Number(value) < 1) fail(path, 'must be a positive integer'); return Number(value); }
function coordinate(value: unknown, path: string) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) fail(path, 'must be a finite 0–1000 number'); return value; }
function point(value: unknown, path: string): PointTuple {
  if (!Array.isArray(value) || value.length !== 2) fail(path, 'must be [y, x]');
  return [coordinate(value[0], `${path}[0]`), coordinate(value[1], `${path}[1]`)];
}

const MAX_HEIGHT_CENTER_OFFSET = 0.12;

function isFrontCenterHeight(line: { start: PointTuple; end: PointTuple }, diameter: { start: PointTuple; end: PointTuple }) {
  const diameterCenterX = (diameter.start[1] + diameter.end[1]) / 2;
  const diameterSpan = diameter.end[1] - diameter.start[1];
  const heightCenterX = (line.start[1] + line.end[1]) / 2;
  return Math.abs(heightCenterX - diameterCenterX) <= diameterSpan * MAX_HEIGHT_CENTER_OFFSET;
}

export function validateDetectorIdentification(value: unknown): DetectorIdentification {
  const result = record(value, 'identification');
  exactKeys(result, ['identification_version', 'elements', 'rejection'], 'identification');
  if (result.identification_version !== TWO_STEP_BOUNDING_BOXES_MODE) fail('identification.identification_version', `must be ${TWO_STEP_BOUNDING_BOXES_MODE}`);
  if (!Array.isArray(result.elements)) fail('identification.elements', 'must be an array');
  const elements = result.elements.map((value, index) => {
    const item = record(value, `identification.elements[${index}]`); const path = `identification.elements[${index}]`;
    exactKeys(item, ['element_id', 'label', 'category', 'description', 'belongs_to_cake_design', 'visible_count'], path);
    const elementId = text(item.element_id, `${path}.element_id`);
    if (!/^[a-z][a-z0-9_]*$/.test(elementId)) fail(`${path}.element_id`, 'must be a stable snake_case identifier');
    return { element_id: elementId, label: text(item.label, `${path}.label`), category: text(item.category, `${path}.category`), description: text(item.description, `${path}.description`), belongs_to_cake_design: bool(item.belongs_to_cake_design, `${path}.belongs_to_cake_design`), visible_count: count(item.visible_count, `${path}.visible_count`) };
  });
  if (new Set(elements.map((item) => item.element_id)).size !== elements.length) fail('identification.elements', 'contains duplicate element_id values');
  const rejection = record(result.rejection, 'identification.rejection'); exactKeys(rejection, ['isRejected', 'reason', 'message'], 'identification.rejection');
  const normalizedRejection = { isRejected: bool(rejection.isRejected, 'identification.rejection.isRejected'), reason: text(rejection.reason, 'identification.rejection.reason', true), message: text(rejection.message, 'identification.rejection.message', true) };
  if (normalizedRejection.isRejected && elements.length) fail('identification', 'must not emit elements for a rejected image');
  if (!normalizedRejection.isRejected && (normalizedRejection.reason || normalizedRejection.message)) fail('identification.rejection', 'must be blank for an accepted image');
  return { identification_version: TWO_STEP_BOUNDING_BOXES_MODE, elements, rejection: normalizedRejection };
}

export function validateDetectorGeometry(value: unknown, identification: DetectorIdentification): DetectorGeometry {
  const result = record(value, 'geometry'); exactKeys(result, ['geometry_version', 'cake_diameter_line', 'cake_height_line', 'toppers'], 'geometry');
  if (result.geometry_version !== TWO_STEP_BOUNDING_BOXES_MODE) fail('geometry.geometry_version', `must be ${TWO_STEP_BOUNDING_BOXES_MODE}`);
  const line = (value: unknown, path: string) => { const item = record(value, path); exactKeys(item, ['start', 'end'], path); return { start: point(item.start, `${path}.start`), end: point(item.end, `${path}.end`) }; };
  const cakeDiameter = line(result.cake_diameter_line, 'geometry.cake_diameter_line');
  const cakeHeight = line(result.cake_height_line, 'geometry.cake_height_line');
  if (cakeDiameter.start[0] !== cakeDiameter.end[0] || cakeDiameter.start[1] >= cakeDiameter.end[1]) {
    fail('geometry.cake_diameter_line', 'must be a positive left-to-right horizontal [y, x] span');
  }
  if (cakeHeight.start[1] !== cakeHeight.end[1] || cakeHeight.start[0] >= cakeHeight.end[0]) {
    fail('geometry.cake_height_line', 'must be a positive top-to-bottom vertical [y, x] span');
  }
  if (!isFrontCenterHeight(cakeHeight, cakeDiameter)) {
    fail('geometry.cake_height_line', 'must run on the front-center axis aligned with the cake diameter midpoint');
  }
  if (!Array.isArray(result.toppers)) fail('geometry.toppers', 'must be an array');
  const expected = new Map(identification.elements.map((item) => [item.element_id, item]));
  const toppers = result.toppers.map((value, index) => {
    const item = record(value, `geometry.toppers[${index}]`); const path = `geometry.toppers[${index}]`;
    exactKeys(item, ['element_id', 'label', 'category', 'box_2d', 'confidence'], path);
    const elementId = text(item.element_id, `${path}.element_id`); const source = expected.get(elementId);
    if (!source) fail(`${path}.element_id`, 'is not present in Step 1');
    if (text(item.label, `${path}.label`) !== source.label || text(item.category, `${path}.category`) !== source.category) fail(path, 'must preserve the Step 1 label and category');
    if (!Array.isArray(item.box_2d) || item.box_2d.length !== 4) fail(`${path}.box_2d`, 'must be [ymin, xmin, ymax, xmax]');
    const box = item.box_2d.map((entry, coordinateIndex) => coordinate(entry, `${path}.box_2d[${coordinateIndex}]`)) as [number, number, number, number];
    if (box[0] >= box[2] || box[1] >= box[3]) fail(`${path}.box_2d`, 'must have positive ordered extents');
    const confidence = typeof item.confidence === 'number' && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1 ? item.confidence : fail(`${path}.confidence`, 'must be between 0 and 1');
    return { element_id: elementId, label: source.label, category: source.category, box_2d: box, confidence };
  });
  if (new Set(toppers.map((item) => item.element_id)).size !== toppers.length) fail('geometry.toppers', 'contains duplicate element_id values');
  if (toppers.length !== expected.size || toppers.some((item) => !expected.has(item.element_id))) fail('geometry.toppers', 'must cover every Step 1 element exactly once');
  return { geometry_version: TWO_STEP_BOUNDING_BOXES_MODE, cake_diameter_line: cakeDiameter, cake_height_line: cakeHeight, toppers };
}

export function detectorIdentificationResponseSchema() {
  return { type: Type.OBJECT, properties: { identification_version: { type: Type.STRING, enum: [TWO_STEP_BOUNDING_BOXES_MODE] }, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { element_id: { type: Type.STRING }, label: { type: Type.STRING }, category: { type: Type.STRING }, description: { type: Type.STRING }, belongs_to_cake_design: { type: Type.BOOLEAN }, visible_count: { type: Type.INTEGER } }, required: ['element_id', 'label', 'category', 'description', 'belongs_to_cake_design', 'visible_count'] } }, rejection: { type: Type.OBJECT, properties: { isRejected: { type: Type.BOOLEAN }, reason: { type: Type.STRING }, message: { type: Type.STRING } }, required: ['isRejected', 'reason', 'message'] } }, required: ['identification_version', 'elements', 'rejection'] };
}

const pointSchema = { type: Type.ARRAY, items: { type: Type.NUMBER }, minItems: 2, maxItems: 2 };
export function detectorGeometryResponseSchema() {
  const lineSchema = { type: Type.OBJECT, properties: { start: pointSchema, end: pointSchema }, required: ['start', 'end'] };
  return { type: Type.OBJECT, properties: { geometry_version: { type: Type.STRING, enum: [TWO_STEP_BOUNDING_BOXES_MODE] }, cake_diameter_line: lineSchema, cake_height_line: lineSchema, toppers: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { element_id: { type: Type.STRING }, label: { type: Type.STRING }, category: { type: Type.STRING }, box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER }, minItems: 4, maxItems: 4 }, confidence: { type: Type.NUMBER } }, required: ['element_id', 'label', 'category', 'box_2d', 'confidence'] } } }, required: ['geometry_version', 'cake_diameter_line', 'cake_height_line', 'toppers'] };
}

export function detectorIdentificationRequestParts(mimeType: string, imageData: string, prompt: string) {
  return [{ inlineData: { mimeType, data: imageData } }, { text: prompt.trim() }];
}

export function detectorGeometryRequestParts(mimeType: string, imageData: string, prompt: string, identification: DetectorIdentification) {
  return [{ inlineData: { mimeType, data: imageData } }, { text: [prompt.trim(), '--- BEGIN IMMUTABLE STEP 1 IDENTIFICATION MANIFEST ---', JSON.stringify(identification), '--- END IMMUTABLE STEP 1 IDENTIFICATION MANIFEST ---'].join('\n\n') }];
}
