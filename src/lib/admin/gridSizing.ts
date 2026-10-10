import sharp from 'sharp';
import { Type } from '@google/genai';

import { isSizelessSupportElementType } from '@/constants/pricingEnums';

export const GRID_SIZING_VERSION = 'grid_sizing_v2' as const;
export const GRID_SIZING_MODE = 'grid_sizing_v2' as const;
export const CARTESIAN_SIZING_VERSION = 'cartesian_sizing_v1' as const;
export const CARTESIAN_SIZING_MODE = 'cartesian_sizing_v1' as const;
export const GRID_COLUMNS = 20;
export const GRID_ROWS = 20;
export const CARTESIAN_MIN = -10;
export const CARTESIAN_MAX = 10;

export type CoordinateSizingMode = 'grid_20' | 'cartesian_4q';

function sizingVersion(mode: CoordinateSizingMode) {
  return mode === 'cartesian_4q' ? CARTESIAN_SIZING_VERSION : GRID_SIZING_VERSION;
}

function coordinateBounds(mode: CoordinateSizingMode) {
  return mode === 'cartesian_4q'
    ? { min: CARTESIAN_MIN, max: CARTESIAN_MAX }
    : { min: 0, max: GRID_COLUMNS };
}

export type GridSizingRole = 'main_toppers' | 'support_elements';
export type GridSizingCategory = 'small' | 'medium' | 'large';

export function classifyGridSizingAreaRatio(ratio: number): GridSizingCategory {
  if (ratio <= 0.3333) return 'small';
  if (ratio <= 0.8333) return 'medium';
  return 'large';
}

export type GridSizingPoint = {
  x: number;
  y: number;
};

export type GridSizingMeasurement = {
  bbox: {
    top_left: GridSizingPoint;
    bottom_right: GridSizingPoint;
  };
};

export type GridSizingAnchor = {
  version: typeof GRID_SIZING_VERSION | typeof CARTESIAN_SIZING_VERSION;
  cake_top_diameter: {
    start: GridSizingPoint;
    end: GridSizingPoint;
  };
  cake_top_height: {
    start: GridSizingPoint;
    end: GridSizingPoint;
  };
};

export type GridSizingItem = GridSizingMeasurement & {
  source_group_id: string;
  role: GridSizingRole | null;
  description: string;
};

export type GridSizingBinding = {
  source_group_id: unknown;
  role: GridSizingRole | null;
  description: unknown;
  measurement: unknown;
};

export type GridSizingPayload = GridSizingAnchor & {
  items: GridSizingItem[];
};

export type CalculatedGridSizingItem = GridSizingItem & {
  geometry_method: 'bbox_area';
  bbox_width_units: number;
  bbox_height_units: number;
  bbox_area_units: number;
  ratio: number;
  category?: GridSizingCategory;
};

export type CalculatedGridSizing = Omit<GridSizingPayload, 'items'> & {
  coordinate_system: CoordinateSizingMode;
  diameter_units: number;
  height_units: number;
  cake_reference_area_units: number;
  items: CalculatedGridSizingItem[];
};

export class GridSizingError extends Error {
  constructor(message: string) {
    super(`grid sizing failed: ${message}`);
    this.name = 'GridSizingError';
  }
}

export const GRID_SIZING_PROMPT_MARKER_START = '===== BEGIN PROMPT LAB 20×20 GRID INSTRUCTIONS =====';
export const GRID_SIZING_PROMPT_MARKER_END = '===== END PROMPT LAB 20×20 GRID INSTRUCTIONS =====';

export const GRID_SIZING_PROMPT = `### 20×20 GRID MEASUREMENT — FOLLOW AFTER CAKE ANALYSIS

The attached cake image already contains a visible 20×20 grid. The grid is a measuring aid, never a cake decoration.

COORDINATE MODEL
- Return whole-number grid-line coordinates only: 0 through 20.
- x=0 and y=0 are the left and top yellow image edges; x=20 and y=20 are the right and bottom yellow image edges.
- The numbered labels name cells. They are not coordinate points. Every returned point must sit on a visible grid-line intersection.

ROW AND TARGET LOCK
- Create one storefront row per priced cake-design group, not one row for every visible motif.
- Before writing a row's bbox, identify that row's exact physical target from its own type, material, and description. Never reuse a nearby object, a different number candle, the cake body, or another row's object.
- A grouped/repeated row gets one typical visible physical unit only. A repeated piping treatment gets one typical shell, bead, dollop, rosette, or swirl only—not the full border perimeter.

TIGHT BBOX RULE
- Every main_toppers and support_elements row must contain one non-zero-area grid_sizing.bbox.
- The bbox must be the smallest grid-aligned rectangle that encloses only the directly visible target. Each edge should touch or immediately border that target's visible outer contour.
- Never include a second decoration, bare cake, empty background, board, plate, shadow, support stick, or hidden/imagined continuation.
- Do not return a bbox in empty space. Before responding, verify that the bbox visibly contains the row's named target and not a different item.

CAKE REFERENCE
- grid_sizing.cake_top_diameter is one left-to-right cross-section of the TOP TIER cake body only.
- grid_sizing.cake_top_height is the base-to-top measurement of the visible FRONT-CENTER wall of that same tier, encoded top-to-bottom because image y increases downward. Start at the visible front top rim where the top surface meets the sidewall and end at the visible base edge.
- Never measure a topper, printed decoration, border, lower tier, board, plate, or background as cake reference geometry.

Return coordinates and normal storefront analysis fields only. The application calculates area ratios and size categories.`;

export const GRID_SIZING_OUTPUT_RULES = `### GRID JSON CONTRACT

Return one top-level grid_sizing object with version "grid_sizing_v2", cake_top_diameter, and cake_top_height. Put exactly one local grid_sizing.bbox with top_left and bottom_right inside every main_toppers and support_elements row. Do not return grid_sizing.items, cake_messages[].bbox, pixel coordinates, size_line, cake_measurements, or a model-owned size.

The parent row already supplies group_id, role, type, material, description, and quantity; do not duplicate those fields inside local grid_sizing. The app calculates bbox area ÷ (top-tier diameter × top-tier height), then inserts the category before storefront validation.

The normal production exception that omits an element bbox does not apply to this separate row-local grid_sizing.bbox: every priced cake-design row needs this grid measurement. Keep all normal response fields valid for the existing schema.`;

/** This entire block is inserted into the editable Prompt Lab textarea in grid mode. */
export const GRID_SIZING_EDITABLE_PROMPT = [
  GRID_SIZING_PROMPT_MARKER_START,
  GRID_SIZING_PROMPT.trim(),
  GRID_SIZING_OUTPUT_RULES.trim(),
  GRID_SIZING_PROMPT_MARKER_END,
].join('\n\n');

export const CARTESIAN_SIZING_PROMPT_MARKER_START = '===== BEGIN PROMPT LAB CARTESIAN 4-QUADRANT INSTRUCTIONS =====';
export const CARTESIAN_SIZING_PROMPT_MARKER_END = '===== END PROMPT LAB CARTESIAN 4-QUADRANT INSTRUCTIONS =====';

export const CARTESIAN_SIZING_PROMPT = `### CARTESIAN 4-QUADRANT MEASUREMENT — FOLLOW AFTER CAKE ANALYSIS

The attached cake image contains a transparent Cartesian overlay. It is a measuring aid, never a cake decoration.

COORDINATE MODEL
- The exact origin [0,0] is the center of the complete image, where the two bold axes cross.
- Use continuous coordinates from -10 through +10 on both axes. Use ordinary numbers in JSON: 0, 4, -3, not strings with a plus sign.
- +x points right, -x points left, +y points upward, and -y points downward.
- The signed tick labels and axis markers are reference labels, not cake objects or coordinate points.
- For every bbox, top_left means the smallest x and largest y; bottom_right means the largest x and smallest y.

ROW AND TARGET LOCK
- Create one storefront row per priced cake-design group, not one row for every visible motif.
- Identify each row's exact physical target from its own type, material, and description. Never reuse a nearby object, another number candle, the cake body, or another row's object.
- A grouped/repeated row gets one typical visible physical unit only. A repeated piping treatment gets one typical shell, bead, dollop, rosette, or swirl only—not the full border perimeter.

TIGHT BBOX RULE
- Every main_toppers and support_elements row must contain one non-zero-area local grid_sizing.bbox.
- The bbox must be the smallest axis-aligned rectangle enclosing only the directly visible target. Each edge should touch or immediately border that target's visible contour.
- Never include a second decoration, bare cake, empty background, board, plate, shadow, support stick, or hidden continuation.
- Before responding, verify that each bbox visibly contains its named target and not a different item.

CAKE REFERENCE
- grid_sizing.cake_top_diameter is one horizontal left-to-right cross-section of the TOP TIER cake body only. Use equal y values for its endpoints when possible.
- grid_sizing.cake_top_height is the base-to-top measurement of the visible FRONT-CENTER wall of that same tier, encoded top-to-bottom in image space. In Cartesian coordinates its start is the upper point (+y) and its end is the lower point (-y).
- Never measure a topper, printed decoration, border, lower tier, board, plate, or background as cake reference geometry.

Return coordinates and normal storefront analysis fields only. The application calculates bbox areas, ratios, and size categories.`;

export const CARTESIAN_SIZING_OUTPUT_RULES = `### CARTESIAN JSON CONTRACT

Return one top-level grid_sizing object with version "cartesian_sizing_v1", cake_top_diameter, and cake_top_height. Put exactly one local grid_sizing.bbox with top_left and bottom_right inside every main_toppers and support_elements row. Do not return grid_sizing.items, cake_messages[].bbox, pixel coordinates, size_line, cake_measurements, or a model-owned size.

The parent row already supplies group_id, role, type, material, description, and quantity; do not duplicate those fields inside local grid_sizing. Use signed Cartesian coordinates from -10 through +10. The app calculates bbox area ÷ (top-tier diameter × top-tier height), then inserts the category before storefront validation.

Every priced cake-design row needs this local bbox. Keep all normal response fields valid for the existing storefront schema.`;

/** This entire block is inserted into the editable Prompt Lab textarea in Cartesian mode. */
export const CARTESIAN_SIZING_EDITABLE_PROMPT = [
  CARTESIAN_SIZING_PROMPT_MARKER_START,
  CARTESIAN_SIZING_PROMPT.trim(),
  CARTESIAN_SIZING_OUTPUT_RULES.trim(),
  CARTESIAN_SIZING_PROMPT_MARKER_END,
].join('\n\n');

/**
 * The coordinate pass is deliberately separate from classification and pricing.
 * It sees the grid image and an immutable row manifest, so its only job is to
 * find physical boundaries. This prevents a broad visual group from becoming a
 * pricing box merely because it was useful to the analysis pass.
 */
export const GRID_SIZING_LOCATOR_PROMPT = `
You are the visual coordinate-measurement pass for a custom-cake sizing experiment. The image has a numbered 20×20 grid. Return only the response-schema JSON.

You are given an immutable manifest of already-identified storefront rows. Do not add, remove, merge, rename, classify, count, or price rows. Measure only the physical cake geometry and one representative visible unit for each manifest row.

CALIBRATE THE CAKE CROSS-SECTION FIRST
1. cake_top_diameter.start and .end must be the left and right OUTER EDGES of the same physical top-tier cake body, on one horizontal cross-section. They must not land on a topper, message, card, image, icing decoration, background, board, or grid label.
2. cake_top_height.start and .end must be the top and bottom OUTER EDGES of the visible FRONT-CENTER wall of that same tier, on one vertical cross-section. Start at the physical front top rim where the top surface becomes the sidewall and end at the physical bottom edge of that wall. Do not measure a topper, a sign, a side decoration, or the entire multi-tier cake.
3. Diameter must run left-to-right and height must run top-to-bottom. Use directly visible boundaries only; do not infer hidden cake behind decorations.

MEASURE EACH ROW TIGHTLY
4. For every manifest row, return the smallest axis-aligned non-zero-area box enclosing one visible representative physical unit only. Its edges must touch that unit's visible outer contour as closely as the grid permits.
5. A repeated row still gets exactly one typical unit box. Never draw one box around all repeated units, a cluster, empty gaps, other decorations, the cake surface, or the background.
6. A flat edible panel, printed image, or applied decoration is itself the unit: box the visible panel only, not the surrounding cake wall. A freestanding topper is itself the unit: box the topper only, not its support shadow or cake behind it.
7. Before responding, visually re-check every endpoint against the grid. If a box includes a second object or a large area of bare cake, tighten it before returning.

Coordinates are continuous image-boundary values from 0 through 20. x increases left-to-right; y increases top-to-bottom. The returned geometry will be used directly for pricing, so accuracy is more important than explaining your answer.`.trim();

/** The calibrated locator measures the cake body without competing item targets. */
export const GRID_SIZING_ANCHOR_LOCATOR_PROMPT = `
You are the cake-geometry calibration pass for a custom-cake sizing experiment. The image has a numbered 20×20 grid. Return only the response-schema JSON.

Measure the visible TOP TIER CAKE BODY only. Do not identify, count, classify, or box any topper or decoration.

1. cake_top_diameter.start and .end must be the left and right OUTER EDGES of the same physical top-tier cake body, on one horizontal cross-section. Do not land on a topper, message, card, icing decoration, background, board, plate, or grid label.
2. cake_top_height.start and .end must be the top and bottom OUTER EDGES of the visible FRONT-CENTER wall of that same tier, on one vertical cross-section. Start at the physical front top rim where the top surface becomes the sidewall; end at the physical bottom edge of that wall. Do not measure a topper, side decoration, board, or a different tier.
3. Use directly visible boundaries only. Diameter runs left-to-right; height runs top-to-bottom. Re-check both spans against the grid before responding.

Coordinates are continuous image-boundary values from 0 through 20. x increases left-to-right; y increases top-to-bottom.`.trim();

/**
 * A row is deliberately located in isolation. Presenting every description in
 * one request caused Gemini to borrow a large hero-topper rectangle for support
 * rows with adjacent or overlapping visual motifs.
 */
export function gridSizingRowLocatorPrompt(
  binding: Omit<GridSizingBinding, 'measurement'>,
  index: number,
  total: number,
) {
  const groupId = requiredString(binding.source_group_id, 'coordinate target group_id');
  const description = requiredString(binding.description, `coordinate target ${groupId}.description`);
  const role = binding.role === null ? 'observed cake group' : binding.role;
  return `
You are the single-target visual coordinate-measurement pass for a custom-cake sizing experiment. The image has a numbered 20×20 grid. Return only the response-schema JSON.

TARGET ${index} OF ${total}
group_id: ${JSON.stringify(groupId)}
role: ${role}
description: ${JSON.stringify(description)}

Locate ONLY this exact target on the pictured cake. Return the smallest axis-aligned grid box that encloses one directly visible representative physical unit.

- Do not locate, merge, or use any other topper, support element, message, cake area, board, plate, shadow, or background.
- Do not use a broad themed composition merely because the target description mentions other motifs. A freestanding topper is its joined physical cutout only. A flat applied panel is its visible panel only. A repeated row gets one typical physical unit only, never the full set or cluster.
- The bbox is mandatory. Box the target's visible outer contour tightly. If the candidate includes a second object or substantial bare cake, tighten it before responding. The corners must span positive width and height; never collapse them onto the same grid edge.
- The returned group_id must match the target group_id exactly. Coordinates are continuous image-boundary values from 0 through 20; x increases left-to-right and y increases top-to-bottom.

The bbox is used directly for pricing. Do not return a line or substitute any other geometry.`.trim();
}

export const GRID_SIZING_SYSTEM_RULES = `

GRID SIZING LAB OVERRIDE

This is an isolated Prompt Lab experiment. Grid mode replaces—not supplements—every earlier sizing, geometry, coordinate, bbox, or size_line instruction in this system message and the reference prompt. Ignore every prior prohibition on bboxes or coordinates and every prior requirement for model-owned size, size_line, cake_measurements, or 0–1000 pixel geometry.

For this request, the only sizing geometry is grid_sizing.cake_top_diameter, grid_sizing.cake_top_height, and one required row-local grid_sizing.bbox on every main_toppers and support_elements row. Follow the editable grid instruction block exactly. This does not override cake membership, material classification, rejection, storefront type rules, or the response schema. Do not treat the overlay as a cake decoration.`;

export const CARTESIAN_SIZING_SYSTEM_RULES = `

CARTESIAN SIZING LAB OVERRIDE

This is an isolated Prompt Lab experiment. Cartesian mode replaces—not supplements—every earlier sizing, geometry, coordinate, bbox, or size_line instruction in this system message and the reference prompt. Ignore every prior prohibition on bboxes or coordinates and every prior requirement for model-owned size, size_line, cake_measurements, or 0–1000 pixel geometry.

For this request, the only sizing geometry is grid_sizing.cake_top_diameter, grid_sizing.cake_top_height, and one required row-local grid_sizing.bbox on every main_toppers and support_elements row. Use the exact centered signed coordinate system in the editable Cartesian instruction block. This does not override cake membership, material classification, rejection, storefront type rules, or the response schema. Do not treat the overlay as a cake decoration.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredNumber(value: unknown, path: string, mode: CoordinateSizingMode = 'grid_20'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GridSizingError(`${path} must be a finite number`);
  }
  const bounds = coordinateBounds(mode);
  if (value < bounds.min || value > bounds.max) {
    throw new GridSizingError(`${path} must be between ${bounds.min} and ${bounds.max}`);
  }
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new GridSizingError(`${path} must be a non-blank string`);
  }
  return value;
}

function parsePoint(value: unknown, path: string, mode: CoordinateSizingMode = 'grid_20'): GridSizingPoint {
  if (!isRecord(value)) throw new GridSizingError(`${path} must be an object`);
  return {
    x: requiredNumber(value.x, `${path}.x`, mode),
    y: requiredNumber(value.y, `${path}.y`, mode),
  };
}

function parseSpan(value: unknown, path: string, mode: CoordinateSizingMode = 'grid_20') {
  if (!isRecord(value)) throw new GridSizingError(`${path} must be an object`);
  return {
    start: parsePoint(value.start, `${path}.start`, mode),
    end: parsePoint(value.end, `${path}.end`, mode),
  };
}

export function validateGridSizingAnchor(value: unknown, mode: CoordinateSizingMode = 'grid_20'): GridSizingAnchor {
  if (!isRecord(value)) throw new GridSizingError('grid_sizing must be an object');
  const version = sizingVersion(mode);
  if (value.version !== version) {
    throw new GridSizingError(`grid_sizing.version must be ${version}`);
  }
  if ('items' in value) throw new GridSizingError('grid_sizing.items is not allowed; embed measurements in their analysis rows');

  const cakeTopDiameter = parseSpan(value.cake_top_diameter, 'grid_sizing.cake_top_diameter', mode);
  const cakeTopHeight = parseSpan(value.cake_top_height, 'grid_sizing.cake_top_height', mode);
  // Vision endpoints can follow perspective and arrive slightly slanted. The
  // reference-area contract is the horizontal cake width × vertical wall
  // height, so project each valid span to its intended display/pricing axis.
  // A truly zero horizontal or vertical extent still fails below.
  return {
    version,
    cake_top_diameter: {
      start: { x: Math.min(cakeTopDiameter.start.x, cakeTopDiameter.end.x), y: (cakeTopDiameter.start.y + cakeTopDiameter.end.y) / 2 },
      end: { x: Math.max(cakeTopDiameter.start.x, cakeTopDiameter.end.x), y: (cakeTopDiameter.start.y + cakeTopDiameter.end.y) / 2 },
    },
    cake_top_height: {
      start: {
        x: (cakeTopHeight.start.x + cakeTopHeight.end.x) / 2,
        y: mode === 'cartesian_4q'
          ? Math.max(cakeTopHeight.start.y, cakeTopHeight.end.y)
          : Math.min(cakeTopHeight.start.y, cakeTopHeight.end.y),
      },
      end: {
        x: (cakeTopHeight.start.x + cakeTopHeight.end.x) / 2,
        y: mode === 'cartesian_4q'
          ? Math.min(cakeTopHeight.start.y, cakeTopHeight.end.y)
          : Math.max(cakeTopHeight.start.y, cakeTopHeight.end.y),
      },
    },
  };
}

export function gridSizingMeasurementResponseSchema(mode: CoordinateSizingMode = 'grid_20') {
  const bounds = coordinateBounds(mode);
  const point = {
    type: Type.OBJECT,
    properties: {
      x: { type: Type.NUMBER, minimum: bounds.min, maximum: bounds.max },
      y: { type: Type.NUMBER, minimum: bounds.min, maximum: bounds.max },
    },
    required: ['x', 'y'],
  };
  return {
    type: Type.OBJECT,
    properties: {
      bbox: {
        type: Type.OBJECT,
        properties: { top_left: point, bottom_right: point },
        required: ['top_left', 'bottom_right'],
      },
    },
    required: ['bbox'],
  };
}

export function validateGridSizingMeasurement(
  value: unknown,
  path = 'grid_sizing',
  mode: CoordinateSizingMode = 'grid_20',
): GridSizingMeasurement {
  if (!isRecord(value)) throw new GridSizingError(`${path} must be an object`);
  if (!isRecord(value.bbox)) throw new GridSizingError(`${path}.bbox must be an object`);
  const first = parsePoint(value.bbox.top_left, `${path}.bbox.top_left`, mode);
  const second = parsePoint(value.bbox.bottom_right, `${path}.bbox.bottom_right`, mode);
  const bbox = mode === 'cartesian_4q'
    ? {
      top_left: { x: Math.min(first.x, second.x), y: Math.max(first.y, second.y) },
      bottom_right: { x: Math.max(first.x, second.x), y: Math.min(first.y, second.y) },
    }
    : {
      top_left: { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y) },
      bottom_right: { x: Math.max(first.x, second.x), y: Math.max(first.y, second.y) },
    };
  const heightIsPositive = mode === 'cartesian_4q'
    ? bbox.top_left.y > bbox.bottom_right.y
    : bbox.bottom_right.y > bbox.top_left.y;
  if (bbox.bottom_right.x <= bbox.top_left.x || !heightIsPositive) {
    throw new GridSizingError(`${path}.bbox must span positive width and height`);
  }
  return { bbox };
}

export function buildGridSizingPayload(
  anchorValue: unknown,
  bindings: GridSizingBinding[],
  mode: CoordinateSizingMode = 'grid_20',
): GridSizingPayload {
  const anchor = validateGridSizingAnchor(anchorValue, mode);
  const items = bindings.flatMap((binding) => {
    const sourceGroupId = requiredString(binding.source_group_id, 'grid_sizing source_group_id');
    const description = requiredString(binding.description, `grid_sizing.${sourceGroupId}.description`);
    return [{
      ...validateGridSizingMeasurement(binding.measurement, `grid_sizing.${sourceGroupId}`, mode),
      source_group_id: sourceGroupId,
      role: binding.role,
      description,
    }];
  });

  if (new Set(items.map((item) => `${item.role ?? 'inventory'}:${item.source_group_id}`)).size !== items.length) {
    throw new GridSizingError('embedded grid measurements contain duplicate source groups');
  }

  return {
    ...anchor,
    items,
  };
}

/** Private coordinate-pass shape. It is never shown as a storefront analysis. */
export function gridSizingLocatorResponseSchema(mode: CoordinateSizingMode = 'grid_20') {
  const bounds = coordinateBounds(mode);
  const point = {
    type: Type.OBJECT,
    properties: {
      x: { type: Type.NUMBER, minimum: bounds.min, maximum: bounds.max },
      y: { type: Type.NUMBER, minimum: bounds.min, maximum: bounds.max },
    },
    required: ['x', 'y'],
  };
  const span = {
    type: Type.OBJECT,
    properties: { start: point, end: point },
    required: ['start', 'end'],
  };
  return {
    type: Type.OBJECT,
    properties: {
      grid_sizing: {
        type: Type.OBJECT,
        properties: {
          version: { type: Type.STRING, enum: [sizingVersion(mode)] },
          cake_top_diameter: span,
          cake_top_height: span,
        },
        required: ['version', 'cake_top_diameter', 'cake_top_height'],
      },
      rows: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            group_id: { type: Type.STRING },
            grid_sizing: gridSizingMeasurementResponseSchema(mode),
          },
          required: ['group_id', 'grid_sizing'],
        },
      },
    },
    required: ['grid_sizing', 'rows'],
  };
}

/** Private schema for the calibrated cake-geometry request. */
export function gridSizingAnchorLocatorResponseSchema(mode: CoordinateSizingMode = 'grid_20') {
  return {
    type: Type.OBJECT,
    properties: {
      grid_sizing: gridSizingResponseSchema(mode),
    },
    required: ['grid_sizing'],
  };
}

/** Private schema for one isolated target-box request. */
export function gridSizingRowLocatorResponseSchema(groupId: string, mode: CoordinateSizingMode = 'grid_20') {
  return {
    type: Type.OBJECT,
    properties: {
      group_id: { type: Type.STRING, enum: [groupId] },
      grid_sizing: gridSizingMeasurementResponseSchema(mode),
    },
    required: ['group_id', 'grid_sizing'],
  };
}

/** Converts the private locator result into the normalized internal payload. */
export function buildGridSizingPayloadFromLocator(
  value: unknown,
  bindings: Omit<GridSizingBinding, 'measurement'>[],
  mode: CoordinateSizingMode = 'grid_20',
): GridSizingPayload {
  if (!isRecord(value)) throw new GridSizingError('coordinate pass response must be an object');
  if (!Array.isArray(value.rows)) throw new GridSizingError('coordinate pass response must contain rows');
  const locatorRows = value.rows.map((row, index) => {
    if (!isRecord(row)) throw new GridSizingError(`coordinate pass rows[${index}] must be an object`);
    return {
      group_id: requiredString(row.group_id, `coordinate pass rows[${index}].group_id`),
      measurement: row.grid_sizing,
    };
  });
  const measurements = new Map<string, unknown>();
  for (const row of locatorRows) {
    if (measurements.has(row.group_id)) throw new GridSizingError(`coordinate pass has duplicate group_id ${row.group_id}`);
    measurements.set(row.group_id, row.measurement);
  }
  const expectedIds = bindings.map((binding) => requiredString(binding.source_group_id, 'grid sizing source_group_id'));
  if (new Set(expectedIds).size !== expectedIds.length) throw new GridSizingError('coordinate pass bindings contain duplicate source groups');
  for (const groupId of expectedIds) {
    if (!measurements.has(groupId)) throw new GridSizingError(`coordinate pass is missing ${groupId}`);
  }
  for (const groupId of measurements.keys()) {
    if (!expectedIds.includes(groupId)) throw new GridSizingError(`coordinate pass returned unknown group ${groupId}`);
  }
  return buildGridSizingPayload(value.grid_sizing, bindings.map((binding) => ({
    ...binding,
    measurement: measurements.get(requiredString(binding.source_group_id, 'grid sizing source_group_id')),
  })), mode);
}

/** Combines one calibrated cake-geometry response with isolated row locators. */
export function buildGridSizingPayloadFromCalibratedLocator(
  anchorValue: unknown,
  rowValues: unknown[],
  bindings: Omit<GridSizingBinding, 'measurement'>[],
  mode: CoordinateSizingMode = 'grid_20',
): GridSizingPayload {
  if (!isRecord(anchorValue)) throw new GridSizingError('cake geometry response must be an object');
  return buildGridSizingPayloadFromLocator({
    grid_sizing: anchorValue.grid_sizing,
    rows: rowValues,
  }, bindings, mode);
}

export function validateGridSizing(value: unknown, mode: CoordinateSizingMode = 'grid_20'): GridSizingPayload {
  if (!isRecord(value)) throw new GridSizingError('normalized grid sizing payload must be an object');
  const version = sizingVersion(mode);
  if (value.version !== version) {
    throw new GridSizingError(`grid_sizing.version must be ${version}`);
  }
  const anchor: GridSizingAnchor = {
    version,
    cake_top_diameter: parseSpan(value.cake_top_diameter, 'grid_sizing.cake_top_diameter', mode),
    cake_top_height: parseSpan(value.cake_top_height, 'grid_sizing.cake_top_height', mode),
  };
  if (!Array.isArray(value.items)) throw new GridSizingError('normalized grid sizing payload must contain items');

  const items = value.items.map((rawItem, index): GridSizingItem => {
    const path = `grid_sizing.items[${index}]`;
    if (!isRecord(rawItem)) throw new GridSizingError(`${path} must be an object`);
    const role = rawItem.role;
    if (role !== 'main_toppers' && role !== 'support_elements' && role !== null) {
      throw new GridSizingError(`${path}.role must be main_toppers, support_elements, or null`);
    }
    const measurement = validateGridSizingMeasurement({ bbox: rawItem.bbox }, path, mode);
    return {
      source_group_id: requiredString(rawItem.source_group_id, `${path}.source_group_id`),
      role,
      description: requiredString(rawItem.description, `${path}.description`),
      bbox: measurement.bbox,
    };
  });

  if (new Set(items.map((item) => `${item.role ?? 'inventory'}:${item.source_group_id}`)).size !== items.length) {
    throw new GridSizingError('normalized grid sizing payload contains duplicate source groups');
  }

  return { ...anchor, items };
}

export function gridSizingResponseSchema(mode: CoordinateSizingMode = 'grid_20') {
  const bounds = coordinateBounds(mode);
  const point = {
    type: Type.OBJECT,
    properties: {
      x: { type: Type.NUMBER, minimum: bounds.min, maximum: bounds.max },
      y: { type: Type.NUMBER, minimum: bounds.min, maximum: bounds.max },
    },
    required: ['x', 'y'],
  };
  const span = {
    type: Type.OBJECT,
    properties: { start: point, end: point },
    required: ['start', 'end'],
  };
  return {
    type: Type.OBJECT,
    properties: {
      version: { type: Type.STRING, enum: [sizingVersion(mode)] },
      cake_top_diameter: span,
      cake_top_height: span,
    },
    required: ['version', 'cake_top_diameter', 'cake_top_height'],
  };
}

export function appendGridSizingPrompt(prompt: string, mode: CoordinateSizingMode = 'grid_20'): string {
  return [prompt.trim(), mode === 'cartesian_4q' ? CARTESIAN_SIZING_EDITABLE_PROMPT : GRID_SIZING_EDITABLE_PROMPT].join('\n\n');
}

export function appendGridSizingSystemRules(systemInstruction: string, mode: CoordinateSizingMode = 'grid_20'): string {
  return `${systemInstruction.trim()}\n${mode === 'cartesian_4q' ? CARTESIAN_SIZING_SYSTEM_RULES : GRID_SIZING_SYSTEM_RULES}`;
}

export function addGridSizingToResponseSchema(
  baseSchema: Record<string, unknown>,
  options: { required?: boolean; coordinateSystem?: CoordinateSizingMode } = {},
) {
  const coordinateSystem = options.coordinateSystem ?? 'grid_20';
  const properties = isRecord(baseSchema.properties) ? baseSchema.properties : {};
  const required = Array.isArray(baseSchema.required) ? baseSchema.required : [];
  const gridRequired = options.required !== false;
  const nextProperties = { ...properties };
  for (const role of ['main_toppers', 'support_elements'] as const) {
    const roleSchema = isRecord(properties[role]) ? properties[role] : null;
    const itemSchema = roleSchema && isRecord(roleSchema.items) ? roleSchema.items : null;
    if (!roleSchema || !itemSchema) continue;
    const itemProperties = isRecord(itemSchema.properties) ? itemSchema.properties : {};
    const itemRequired = Array.isArray(itemSchema.required) ? itemSchema.required : [];
    const itemPropertiesWithoutModelSize = { ...itemProperties };
    delete itemPropertiesWithoutModelSize.size;
    delete itemPropertiesWithoutModelSize.size_line;
    nextProperties[role] = {
      ...roleSchema,
      items: {
        ...itemSchema,
        properties: {
          ...itemPropertiesWithoutModelSize,
          grid_sizing: gridSizingMeasurementResponseSchema(coordinateSystem),
        },
        required: [...itemRequired.filter((field) => field !== 'size' && field !== 'size_line'), 'grid_sizing'],
      },
    };
  }
  // Grid coordinates are row-local `grid_sizing` values. A cake-message bbox
  // belongs to the normal 0–1000 pixel contract, so exclude it entirely from
  // this 0–20 grid experiment rather than inviting Gemini to mix coordinate
  // systems.
  const cakeMessagesSchema = isRecord(properties.cake_messages) ? properties.cake_messages : null;
  const cakeMessageItemSchema = cakeMessagesSchema && isRecord(cakeMessagesSchema.items)
    ? cakeMessagesSchema.items
    : null;
  if (cakeMessagesSchema && cakeMessageItemSchema) {
    const messageProperties = isRecord(cakeMessageItemSchema.properties) ? cakeMessageItemSchema.properties : {};
    const messageRequired = Array.isArray(cakeMessageItemSchema.required) ? cakeMessageItemSchema.required : [];
    const messagePropertiesWithoutBbox = { ...messageProperties };
    delete messagePropertiesWithoutBbox.bbox;
    nextProperties.cake_messages = {
      ...cakeMessagesSchema,
      items: {
        ...cakeMessageItemSchema,
        properties: messagePropertiesWithoutBbox,
        required: messageRequired.filter((field) => field !== 'bbox'),
      },
    };
  }
  return {
    ...baseSchema,
    properties: {
      ...nextProperties,
      grid_sizing: gridSizingResponseSchema(coordinateSystem),
    },
    required: gridRequired ? [...required, 'grid_sizing'] : required,
  };
}

function lineLength(span: { start: GridSizingPoint; end: GridSizingPoint }): number {
  return Math.hypot(span.end.x - span.start.x, span.end.y - span.start.y);
}

/**
 * The visible grid is a whole-cell measurement aid. Keep the pricing geometry
 * identical to the rendered rectangle by snapping each returned box outward
 * to grid boundaries before calculating area. This contains the visible model
 * box and guarantees a valid positive-area box stays at least one grid cell.
 */
function snapLowerCoordinateBoundary(value: number, mode: CoordinateSizingMode): number {
  const bounds = coordinateBounds(mode);
  return Math.max(bounds.min, Math.min(bounds.max, Math.floor(value)));
}

function snapUpperCoordinateBoundary(value: number, mode: CoordinateSizingMode): number {
  const bounds = coordinateBounds(mode);
  return Math.max(bounds.min, Math.min(bounds.max, Math.ceil(value)));
}

function snapBboxToCoordinateLines(
  bbox: GridSizingMeasurement['bbox'],
  mode: CoordinateSizingMode,
): GridSizingMeasurement['bbox'] {
  const topLeft = mode === 'cartesian_4q'
    ? {
      x: snapLowerCoordinateBoundary(bbox.top_left.x, mode),
      y: snapUpperCoordinateBoundary(bbox.top_left.y, mode),
    }
    : {
      x: snapLowerCoordinateBoundary(bbox.top_left.x, mode),
      y: snapLowerCoordinateBoundary(bbox.top_left.y, mode),
    };
  const bottomRight = mode === 'cartesian_4q'
    ? {
      x: snapUpperCoordinateBoundary(bbox.bottom_right.x, mode),
      y: snapLowerCoordinateBoundary(bbox.bottom_right.y, mode),
    }
    : {
      x: snapUpperCoordinateBoundary(bbox.bottom_right.x, mode),
      y: snapUpperCoordinateBoundary(bbox.bottom_right.y, mode),
    };
  const positiveHeight = mode === 'cartesian_4q'
    ? topLeft.y > bottomRight.y
    : bottomRight.y > topLeft.y;
  if (bottomRight.x <= topLeft.x || !positiveHeight) {
    throw new GridSizingError('representative bbox must span positive width and height');
  }
  return { top_left: topLeft, bottom_right: bottomRight };
}

export function calculateGridSizing(value: unknown, mode: CoordinateSizingMode = 'grid_20'): CalculatedGridSizing {
  const payload = validateGridSizing(value, mode);
  const diameterVerticalDrift = Math.abs(payload.cake_top_diameter.end.y - payload.cake_top_diameter.start.y);
  const heightHorizontalDrift = Math.abs(payload.cake_top_height.end.x - payload.cake_top_height.start.x);
  if (payload.cake_top_diameter.end.x <= payload.cake_top_diameter.start.x || diameterVerticalDrift > 0.75) {
    throw new GridSizingError('cake_top_diameter must run left-to-right across one horizontal top-tier cross-section');
  }
  const heightDirectionIsValid = mode === 'cartesian_4q'
    ? payload.cake_top_height.start.y > payload.cake_top_height.end.y
    : payload.cake_top_height.end.y > payload.cake_top_height.start.y;
  if (!heightDirectionIsValid || heightHorizontalDrift > 0.75) {
    throw new GridSizingError('cake_top_height must run top-to-bottom across one vertical top-tier wall cross-section');
  }
  const diameterUnits = lineLength(payload.cake_top_diameter);
  const heightUnits = lineLength(payload.cake_top_height);
  if (diameterUnits <= 0) throw new GridSizingError('cake_top_diameter must have positive length');
  if (heightUnits <= 0) throw new GridSizingError('cake_top_height must have positive length');
  const cakeReferenceAreaUnits = diameterUnits * heightUnits;

  const items = payload.items.map((item) => {
    const bbox = snapBboxToCoordinateLines(item.bbox, mode);
    const widthUnits = bbox.bottom_right.x - bbox.top_left.x;
    const itemHeightUnits = mode === 'cartesian_4q'
      ? bbox.top_left.y - bbox.bottom_right.y
      : bbox.bottom_right.y - bbox.top_left.y;
    return {
      ...item,
      bbox,
      geometry_method: 'bbox_area' as const,
      bbox_width_units: widthUnits,
      bbox_height_units: itemHeightUnits,
      bbox_area_units: widthUnits * itemHeightUnits,
      ratio: (widthUnits * itemHeightUnits) / cakeReferenceAreaUnits,
    };
  });

  return {
    version: payload.version,
    coordinate_system: mode,
    cake_top_diameter: payload.cake_top_diameter,
    cake_top_height: payload.cake_top_height,
    diameter_units: diameterUnits,
    height_units: heightUnits,
    cake_reference_area_units: cakeReferenceAreaUnits,
    items,
  };
}

function analysisRows(analysis: unknown) {
  if (!isRecord(analysis)) throw new GridSizingError('analysis must be an object');
  return (['main_toppers', 'support_elements'] as const).flatMap((role) => {
    const values = analysis[role];
    if (!Array.isArray(values)) throw new GridSizingError(`${role} must be an array`);
    return values.map((item, index) => {
      if (!isRecord(item)) throw new GridSizingError(`${role}[${index}] must be an object`);
      const groupId = requiredString(item.group_id, `${role}[${index}].group_id`);
      return { role, item, groupId };
    });
  });
}

/** Replaces model sizes with application-calculated bbox-area categories. */
export function applyGridSizingToAnalysis<T extends Record<string, unknown>>(
  analysis: T,
  rawGridSizing: unknown,
  mode: CoordinateSizingMode = 'grid_20',
) {
  if (isRecord(analysis.rejection) && analysis.rejection.isRejected === true) {
    return { analysis, gridSizing: calculateGridSizing(rawGridSizing, mode) };
  }

  const gridSizing = calculateGridSizing(rawGridSizing, mode);
  const rows = analysisRows(analysis);
  const rowMap = new Map(rows.map((row) => [`${row.role}:${row.groupId}`, row]));
  const itemMap = new Map<string, CalculatedGridSizingItem>();
  for (const item of gridSizing.items) {
    if (!item.role) throw new GridSizingError(`${item.source_group_id} is missing its final analysis role`);
    const key = `${item.role}:${item.source_group_id}`;
    if (!rowMap.has(key)) throw new GridSizingError(`${item.source_group_id} references an unknown source group`);
    if (itemMap.has(key)) throw new GridSizingError(`${key} has more than one representative grid measurement`);
    itemMap.set(key, item);
  }

  for (const row of rows) {
    const key = `${row.role}:${row.groupId}`;
    if (!itemMap.has(key)) throw new GridSizingError(`${key} is missing its required representative grid bbox`);
  }

  const categorizedItems = gridSizing.items.map((item) => {
    if (!item.role) return item;
    const row = rowMap.get(`${item.role}:${item.source_group_id}`);
    if (!row || typeof row.item.type !== 'string') {
      throw new GridSizingError(`${item.role}:${item.source_group_id} must have a valid storefront type`);
    }
    const isSizeless = item.role === 'support_elements' && isSizelessSupportElementType(row.item.type);
    const coverage = row.item.coverage;
    const isPipedFlower = row.item.type === 'piped_flowers_top' || row.item.type === 'piped_flowers_side';
    const category = isSizeless
      ? undefined
      : isPipedFlower && (coverage === 'small' || coverage === 'medium' || coverage === 'large')
        ? coverage
        : classifyGridSizingAreaRatio(item.ratio);
    return {
      ...item,
      ...(category ? { category } : {}),
    };
  });
  const categorizedItemMap = new Map(categorizedItems.map((item) => [
    item.role ? `${item.role}:${item.source_group_id}` : item.source_group_id,
    item,
  ]));
  const next = { ...analysis } as T;
  const nextRecord = next as Record<string, unknown>;
  for (const role of ['main_toppers', 'support_elements'] as const) {
    const values = analysis[role];
    if (!Array.isArray(values)) continue;
    nextRecord[role] = values.map((rawItem) => {
      if (!isRecord(rawItem) || typeof rawItem.group_id !== 'string') return rawItem;
      const measuredItem = categorizedItemMap.get(`${role}:${rawItem.group_id}`);
      if (typeof rawItem.type !== 'string') {
        throw new GridSizingError(`${role}:${rawItem.group_id} must have a valid storefront type`);
      }
      if (role === 'support_elements' && isSizelessSupportElementType(rawItem.type)) {
        const next = { ...rawItem };
        delete next.size;
        return next;
      }
      if (!measuredItem?.category) {
        throw new GridSizingError(`${role}:${rawItem.group_id} is missing its app-calculated size category`);
      }
      return { ...rawItem, size: measuredItem.category };
    });
  }

  return { analysis: next, gridSizing: { ...gridSizing, items: categorizedItems } };
}

export function assertGridSizingPreserved(
  expected: unknown,
  actual: unknown,
  mode: CoordinateSizingMode = 'grid_20',
): GridSizingPayload {
  const expectedPayload = validateGridSizing(expected, mode);
  const actualPayload = validateGridSizing(actual, mode);
  const comparable = (payload: GridSizingPayload) => ({
    version: payload.version,
    cake_top_diameter: payload.cake_top_diameter,
    cake_top_height: payload.cake_top_height,
    items: payload.items.map(({ source_group_id, bbox }) => ({ source_group_id, bbox })),
  });
  if (JSON.stringify(comparable(expectedPayload)) !== JSON.stringify(comparable(actualPayload))) {
    throw new GridSizingError('the two-step compiler changed the visual grid measurements');
  }
  return actualPayload;
}

function gridOverlaySvg(width: number, height: number): Buffer {
  const minorStroke = Math.max(1, Math.round(Math.min(width, height) / 900));
  const majorStroke = Math.max(2, minorStroke * 2);
  const fontSize = Math.max(10, Math.min(24, Math.round(Math.min(width, height) / 35)));
  const labelPadding = Math.max(2, Math.round(fontSize * 0.3));
  const cellWidth = width / GRID_COLUMNS;
  const cellHeight = height / GRID_ROWS;
  const lines: string[] = [];
  const labels: string[] = [];

  for (let index = 0; index <= GRID_COLUMNS; index += 1) {
    const x = index * cellWidth;
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="white" stroke-opacity="0.72" stroke-width="${index % 5 === 0 ? majorStroke : minorStroke}"/>`);
  }
  for (let index = 0; index <= GRID_ROWS; index += 1) {
    const y = index * cellHeight;
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="white" stroke-opacity="0.72" stroke-width="${index % 5 === 0 ? majorStroke : minorStroke}"/>`);
  }
  for (let index = 0; index < GRID_COLUMNS; index += 1) {
    const x = (index + 0.5) * cellWidth;
    labels.push(`<text x="${x}" y="${Math.max(fontSize, cellHeight * 0.72)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" stroke="black" stroke-opacity="0.72" stroke-width="${Math.max(1, fontSize / 8)}" paint-order="stroke">${index + 1}</text>`);
  }
  for (let index = 0; index < GRID_ROWS; index += 1) {
    const y = (index + 0.5) * cellHeight + fontSize * 0.35;
    labels.push(`<text x="${Math.max(fontSize, cellWidth * 0.48)}" y="${y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" stroke="black" stroke-opacity="0.72" stroke-width="${Math.max(1, fontSize / 8)}" paint-order="stroke">${index + 1}</text>`);
  }

  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="transparent"/>${lines.join('')}${labels.join('')}<rect x="${labelPadding}" y="${labelPadding}" width="${Math.max(1, width - labelPadding * 2)}" height="${Math.max(1, height - labelPadding * 2)}" fill="none" stroke="#ffeb3b" stroke-width="${Math.max(2, majorStroke)}" stroke-opacity="0.9"/></svg>`);
}

export async function createGridOverlay(imageData: string) {
  let source: Buffer;
  try {
    source = Buffer.from(imageData, 'base64');
  } catch {
    throw new GridSizingError('image data could not be decoded');
  }
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new GridSizingError('image dimensions are unavailable');
  const overlay = await sharp(source)
    .composite([{ input: gridOverlaySvg(metadata.width, metadata.height) }])
    .png()
    .toBuffer();
  const preview = await sharp(overlay)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer();

  return {
    imageData: overlay.toString('base64'),
    mimeType: 'image/png' as const,
    previewDataUrl: `data:image/jpeg;base64,${preview.toString('base64')}`,
    width: metadata.width,
    height: metadata.height,
  };
}

function cartesianOverlaySvg(width: number, height: number): Buffer {
  const minorStroke = Math.max(1, Math.round(Math.min(width, height) / 900));
  const axisStroke = Math.max(3, minorStroke * 3);
  const fontSize = Math.max(10, Math.min(24, Math.round(Math.min(width, height) / 35)));
  const unitX = width / (CARTESIAN_MAX - CARTESIAN_MIN);
  const unitY = height / (CARTESIAN_MAX - CARTESIAN_MIN);
  const originX = width / 2;
  const originY = height / 2;
  const lines: string[] = [];
  const labels: string[] = [];

  for (let coordinate = CARTESIAN_MIN; coordinate <= CARTESIAN_MAX; coordinate += 1) {
    const x = originX + coordinate * unitX;
    const y = originY - coordinate * unitY;
    const major = coordinate % 5 === 0;
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="white" stroke-opacity="0.66" stroke-width="${major ? axisStroke : minorStroke}"/>`);
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="white" stroke-opacity="0.66" stroke-width="${major ? axisStroke : minorStroke}"/>`);
    if (coordinate !== CARTESIAN_MIN && coordinate !== CARTESIAN_MAX) {
      const label = coordinate > 0 ? `+${coordinate}` : `${coordinate}`;
      labels.push(`<text x="${x}" y="${Math.max(fontSize, fontSize * 1.25)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" stroke="black" stroke-opacity="0.72" stroke-width="${Math.max(1, fontSize / 8)}" paint-order="stroke">${label}</text>`);
      labels.push(`<text x="${Math.max(fontSize, fontSize * 0.72)}" y="${y + fontSize * 0.35}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" stroke="black" stroke-opacity="0.72" stroke-width="${Math.max(1, fontSize / 8)}" paint-order="stroke">${label}</text>`);
    }
  }

  lines.push(`<line x1="${originX}" y1="0" x2="${originX}" y2="${height}" stroke="#00e676" stroke-opacity="0.9" stroke-width="${axisStroke}"/>`);
  lines.push(`<line x1="0" y1="${originY}" x2="${width}" y2="${originY}" stroke="#00e676" stroke-opacity="0.9" stroke-width="${axisStroke}"/>`);
  labels.push(`<text x="${originX + fontSize * 0.45}" y="${originY - fontSize * 0.45}" text-anchor="start" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#00e676" stroke="black" stroke-opacity="0.7" stroke-width="${Math.max(1, fontSize / 8)}" paint-order="stroke">[0,0]</text>`);
  labels.push(`<text x="${width - fontSize}" y="${originY - fontSize * 0.5}" text-anchor="end" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#00e676" stroke="black" stroke-opacity="0.7" stroke-width="${Math.max(1, fontSize / 8)}" paint-order="stroke">+x</text>`);
  labels.push(`<text x="${originX + fontSize * 0.5}" y="${fontSize * 1.25}" text-anchor="start" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#00e676" stroke="black" stroke-opacity="0.7" stroke-width="${Math.max(1, fontSize / 8)}" paint-order="stroke">+y</text>`);
  labels.push(`<text x="${fontSize}" y="${originY - fontSize * 0.5}" text-anchor="start" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#00e676" stroke="black" stroke-opacity="0.7" stroke-width="${Math.max(1, fontSize / 8)}" paint-order="stroke">-x</text>`);
  labels.push(`<text x="${originX + fontSize * 0.5}" y="${height - fontSize * 0.5}" text-anchor="start" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#00e676" stroke="black" stroke-opacity="0.7" stroke-width="${Math.max(1, fontSize / 8)}" paint-order="stroke">-y</text>`);
  const padding = Math.max(2, Math.round(fontSize * 0.3));
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="transparent"/>${lines.join('')}${labels.join('')}<rect x="${padding}" y="${padding}" width="${Math.max(1, width - padding * 2)}" height="${Math.max(1, height - padding * 2)}" fill="none" stroke="#ffeb3b" stroke-width="${Math.max(2, axisStroke)}" stroke-opacity="0.9"/></svg>`);
}

export async function createCartesianOverlay(imageData: string) {
  let source: Buffer;
  try {
    source = Buffer.from(imageData, 'base64');
  } catch {
    throw new GridSizingError('image data could not be decoded');
  }
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new GridSizingError('image dimensions are unavailable');
  const overlay = await sharp(source)
    .composite([{ input: cartesianOverlaySvg(metadata.width, metadata.height) }])
    .png()
    .toBuffer();
  const preview = await sharp(overlay)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer();

  return {
    imageData: overlay.toString('base64'),
    mimeType: 'image/png' as const,
    previewDataUrl: `data:image/jpeg;base64,${preview.toString('base64')}`,
    width: metadata.width,
    height: metadata.height,
  };
}
