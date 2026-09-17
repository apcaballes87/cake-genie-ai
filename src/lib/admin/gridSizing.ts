import sharp from 'sharp';
import { Type } from '@google/genai';

import { isSizelessSupportElementType } from '@/constants/pricingEnums';
import { classifyLocalBboxAreaSize } from '@/lib/ai/localAnalysisSizing';

export const GRID_SIZING_VERSION = 'grid_sizing_v2' as const;
export const GRID_SIZING_MODE = 'grid_sizing_v2' as const;
export const GRID_COLUMNS = 20;
export const GRID_ROWS = 20;

export type GridSizingRole = 'main_toppers' | 'support_elements';
export type GridSizingCategory = 'small' | 'medium' | 'large';

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
  version: typeof GRID_SIZING_VERSION;
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

export type GridSizingPayload = GridSizingAnchor & {
  items: GridSizingItem[];
};

export type CalculatedGridSizingItem = GridSizingItem & {
  bbox_width_units: number;
  bbox_height_units: number;
  bbox_area_units: number;
  ratio: number;
  category?: GridSizingCategory;
};

export type CalculatedGridSizing = Omit<GridSizingPayload, 'items'> & {
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

/** The exact user-supplied experiment prompt, retained verbatim. */
export const GRID_SIZING_PROMPT = `You are an expert computer vision assistant specialized in analyzing custom cake decorations and topper sizing.



what i want to do when we Analyze the attached image, we will overlay the image of the custom cake with a 20x20 reference grid overlaid on it (where columns are numbered 1 to 20 from left to right, and rows are labeled or numbered 1 to 20 from top to bottom). i want the grid to be visible so that the ai can see it.

### Task Instructions:

1. Locate the top tier of the cake and estimate its visible diameter (width) and wall height in total grid units.
2. Identify all individual toppers and decorative elements (e.g., main acrylic toppers, side accents, 3D fondant pieces).
3. For each storefront row, locate one representative visible unit with a bounding box in grid coordinates.
4. Return coordinates only. The application calculates every area ratio and size category.

###`;

export const GRID_SIZING_OUTPUT_RULES = `

### GRID SIZING EXPERIMENT OUTPUT CONTRACT

The overlaid grid is a visual measuring aid, not a cake decoration. Never count grid lines, labels, or the grid background as cake elements.

Return one additional top-level object named "grid_sizing" containing only the shared grid version plus top-tier diameter and height spans. Keep the normal storefront analysis fields in the response as well. The application will recalculate every ratio and category from the returned coordinates, so do not omit a measurement because the arithmetic is difficult.

Use continuous grid-boundary coordinates from 0 through 20 for the measurement points: the left/top image boundary is 0 and the right/bottom image boundary is 20. The visible cell labels 1 through 20 identify the grid cells. Use x for columns and y for rows.

Set grid_sizing.version to "grid_sizing_v2". Set cake_top_diameter to a left-to-right span across the visible width of the TOP TIER only. Set cake_top_height to a top-to-bottom wall span for that same top tier only. Put one "grid_sizing" object inside every corresponding main_toppers or support_elements row. It must contain only bbox, with top_left and bottom_right points in the 0–20 grid coordinate system. The application calculates bbox area ÷ (top-tier diameter × top-tier height). Do not return a top-level grid_sizing.items array.

The parent main_toppers or support_elements row supplies the group_id, role, type, and quantity, so do not repeat any of those fields inside the local grid_sizing object. For a grouped row with quantity greater than one, box one typical visible representative unit only; never box every repeated unit or the full group. If differently sized units need different pricing rows, emit separate storefront rows. Do not include background, board-only, plate, stand, shadow, icing texture, or other non-priced scene objects. If an item is a size-free storefront type, still record its visible representative bbox when it is a priced cake element; the application will preserve its size-free storefront contract.

For the two-step visual inventory, place the same local grid_sizing object inside the corresponding observed_groups row. The compiler must carry those coordinates into the final main_toppers or support_elements row without changing bbox.

Do not invent hidden portions of an object. Use only directly visible boundaries and record the best visible span when an object is partially occluded. Keep all normal response fields valid for the existing schema.`;

export const GRID_SIZING_SYSTEM_RULES = `

GRID SIZING LAB OVERRIDE

This is an isolated Prompt Lab experiment. The final grid_sizing object is the visual measurement authority for this request. It overrides any older direct-diameter, type-specific, fixed-band, or "do not emit coordinates" sizing instruction in the supplied reference prompt, but it does not override cake membership, material classification, rejection, or storefront type rules. Return the normal response plus the required grid_sizing object. Do not treat the overlay as a cake decoration.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GridSizingError(`${path} must be a finite number`);
  }
  if (value < 0 || value > GRID_COLUMNS) {
    throw new GridSizingError(`${path} must be between 0 and ${GRID_COLUMNS}`);
  }
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new GridSizingError(`${path} must be a non-blank string`);
  }
  return value;
}

function parsePoint(value: unknown, path: string): GridSizingPoint {
  if (!isRecord(value)) throw new GridSizingError(`${path} must be an object`);
  return {
    x: requiredNumber(value.x, `${path}.x`),
    y: requiredNumber(value.y, `${path}.y`),
  };
}

function parseSpan(value: unknown, path: string) {
  if (!isRecord(value)) throw new GridSizingError(`${path} must be an object`);
  return {
    start: parsePoint(value.start, `${path}.start`),
    end: parsePoint(value.end, `${path}.end`),
  };
}

export function validateGridSizingAnchor(value: unknown): GridSizingAnchor {
  if (!isRecord(value)) throw new GridSizingError('grid_sizing must be an object');
  if (value.version !== GRID_SIZING_VERSION) {
    throw new GridSizingError(`grid_sizing.version must be ${GRID_SIZING_VERSION}`);
  }
  if ('items' in value) throw new GridSizingError('grid_sizing.items is not allowed; embed measurements in their analysis rows');

  return {
    version: GRID_SIZING_VERSION,
    cake_top_diameter: parseSpan(value.cake_top_diameter, 'grid_sizing.cake_top_diameter'),
    cake_top_height: parseSpan(value.cake_top_height, 'grid_sizing.cake_top_height'),
  };
}

export function gridSizingMeasurementResponseSchema() {
  const point = {
    type: Type.OBJECT,
    properties: {
      x: { type: Type.NUMBER, minimum: 0, maximum: GRID_COLUMNS },
      y: { type: Type.NUMBER, minimum: 0, maximum: GRID_ROWS },
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

export function validateGridSizingMeasurement(value: unknown, path = 'grid_sizing'): GridSizingMeasurement {
  if (!isRecord(value)) throw new GridSizingError(`${path} must be an object`);
  const keys = Object.keys(value).sort();
  if (keys.length !== 1 || keys[0] !== 'bbox') {
    throw new GridSizingError(`${path} must contain only bbox`);
  }
  return {
    bbox: {
      top_left: parsePoint(isRecord(value.bbox) ? value.bbox.top_left : undefined, `${path}.bbox.top_left`),
      bottom_right: parsePoint(isRecord(value.bbox) ? value.bbox.bottom_right : undefined, `${path}.bbox.bottom_right`),
    },
  };
}

export function buildGridSizingPayload(
  anchorValue: unknown,
  bindings: Array<{
    source_group_id: unknown;
    role: GridSizingRole | null;
    description: unknown;
    measurement: unknown;
  }>,
): GridSizingPayload {
  const anchor = validateGridSizingAnchor(anchorValue);
  const items = bindings.flatMap((binding) => {
    const sourceGroupId = requiredString(binding.source_group_id, 'grid_sizing source_group_id');
    const description = requiredString(binding.description, `grid_sizing.${sourceGroupId}.description`);
    return [{
      ...validateGridSizingMeasurement(binding.measurement, `grid_sizing.${sourceGroupId}`),
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

export function validateGridSizing(value: unknown): GridSizingPayload {
  if (!isRecord(value)) throw new GridSizingError('normalized grid sizing payload must be an object');
  if (value.version !== GRID_SIZING_VERSION) {
    throw new GridSizingError(`grid_sizing.version must be ${GRID_SIZING_VERSION}`);
  }
  const anchor: GridSizingAnchor = {
    version: GRID_SIZING_VERSION,
    cake_top_diameter: parseSpan(value.cake_top_diameter, 'grid_sizing.cake_top_diameter'),
    cake_top_height: parseSpan(value.cake_top_height, 'grid_sizing.cake_top_height'),
  };
  if (!Array.isArray(value.items)) throw new GridSizingError('normalized grid sizing payload must contain items');

  const items = value.items.map((rawItem, index): GridSizingItem => {
    const path = `grid_sizing.items[${index}]`;
    if (!isRecord(rawItem)) throw new GridSizingError(`${path} must be an object`);
    const role = rawItem.role;
    if (role !== 'main_toppers' && role !== 'support_elements' && role !== null) {
      throw new GridSizingError(`${path}.role must be main_toppers, support_elements, or null`);
    }
    return {
      source_group_id: requiredString(rawItem.source_group_id, `${path}.source_group_id`),
      role,
      description: requiredString(rawItem.description, `${path}.description`),
      bbox: {
        top_left: parsePoint(isRecord(rawItem.bbox) ? rawItem.bbox.top_left : undefined, `${path}.bbox.top_left`),
        bottom_right: parsePoint(isRecord(rawItem.bbox) ? rawItem.bbox.bottom_right : undefined, `${path}.bbox.bottom_right`),
      },
    };
  });

  if (new Set(items.map((item) => `${item.role ?? 'inventory'}:${item.source_group_id}`)).size !== items.length) {
    throw new GridSizingError('normalized grid sizing payload contains duplicate source groups');
  }

  return { ...anchor, items };
}

export function gridSizingResponseSchema() {
  const point = {
    type: Type.OBJECT,
    properties: {
      x: { type: Type.NUMBER, minimum: 0, maximum: GRID_COLUMNS },
      y: { type: Type.NUMBER, minimum: 0, maximum: GRID_ROWS },
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
      version: { type: Type.STRING, enum: [GRID_SIZING_VERSION] },
      cake_top_diameter: span,
      cake_top_height: span,
    },
    required: ['version', 'cake_top_diameter', 'cake_top_height'],
  };
}

export function appendGridSizingPrompt(prompt: string): string {
  return [prompt.trim(), GRID_SIZING_PROMPT.trim(), GRID_SIZING_OUTPUT_RULES.trim()].join('\n\n');
}

export function appendGridSizingSystemRules(systemInstruction: string): string {
  return `${systemInstruction.trim()}\n${GRID_SIZING_SYSTEM_RULES}`;
}

export function addGridSizingToResponseSchema(
  baseSchema: Record<string, unknown>,
  options: { required?: boolean } = {},
) {
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
    nextProperties[role] = {
      ...roleSchema,
      items: {
        ...itemSchema,
        properties: {
          ...itemPropertiesWithoutModelSize,
          grid_sizing: gridSizingMeasurementResponseSchema(),
        },
        required: [...itemRequired.filter((field) => field !== 'size'), 'grid_sizing'],
      },
    };
  }
  return {
    ...baseSchema,
    properties: {
      ...nextProperties,
      grid_sizing: gridSizingResponseSchema(),
    },
    required: gridRequired ? [...required, 'grid_sizing'] : required,
  };
}

function lineLength(span: { start: GridSizingPoint; end: GridSizingPoint }): number {
  return Math.hypot(span.end.x - span.start.x, span.end.y - span.start.y);
}

export function calculateGridSizing(value: unknown): CalculatedGridSizing {
  const payload = validateGridSizing(value);
  const diameterUnits = lineLength(payload.cake_top_diameter);
  const heightUnits = lineLength(payload.cake_top_height);
  if (diameterUnits <= 0) throw new GridSizingError('cake_top_diameter must have positive length');
  if (heightUnits <= 0) throw new GridSizingError('cake_top_height must have positive length');
  const cakeReferenceAreaUnits = diameterUnits * heightUnits;

  const items = payload.items.map((item) => {
    const widthUnits = Math.abs(item.bbox.bottom_right.x - item.bbox.top_left.x);
    const heightUnits = Math.abs(item.bbox.bottom_right.y - item.bbox.top_left.y);
    if (widthUnits <= 0) {
      throw new GridSizingError(`${item.source_group_id} bbox must have positive horizontal width`);
    }
    if (heightUnits <= 0) {
      throw new GridSizingError(`${item.source_group_id} bbox must have positive vertical height`);
    }
    const ratio = (widthUnits * heightUnits) / cakeReferenceAreaUnits;
    return {
      ...item,
      bbox_width_units: widthUnits,
      bbox_height_units: heightUnits,
      bbox_area_units: widthUnits * heightUnits,
      ratio,
    };
  });

  return {
    version: payload.version,
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

/** Replaces only size-bearing analysis rows with app-calculated bbox-area categories. */
export function applyGridSizingToAnalysis<T extends Record<string, unknown>>(
  analysis: T,
  rawGridSizing: unknown,
) {
  if (isRecord(analysis.rejection) && analysis.rejection.isRejected === true) {
    return { analysis, gridSizing: calculateGridSizing(rawGridSizing) };
  }

  const gridSizing = calculateGridSizing(rawGridSizing);
  const rows = analysisRows(analysis);
  const rowMap = new Map(rows.map((row) => [`${row.role}:${row.groupId}`, row]));
  const itemMap = new Map<string, CalculatedGridSizingItem>();
  for (const item of gridSizing.items) {
    if (!item.role) throw new GridSizingError(`${item.source_group_id} is missing its final analysis role`);
    const key = `${item.role}:${item.source_group_id}`;
    if (!rowMap.has(key)) throw new GridSizingError(`${item.source_group_id} references an unknown source group`);
    if (itemMap.has(key)) throw new GridSizingError(`${key} has more than one representative grid bbox`);
    itemMap.set(key, item);
  }

  for (const row of rows) {
    const key = `${row.role}:${row.groupId}`;
    if (!itemMap.has(key)) throw new GridSizingError(`${key} is missing its representative grid bbox`);
  }

  const categorizedItems = gridSizing.items.map((item) => {
    if (!item.role) return item;
    const row = rowMap.get(`${item.role}:${item.source_group_id}`);
    if (!row || typeof row.item.type !== 'string') {
      throw new GridSizingError(`${item.role}:${item.source_group_id} must have a valid storefront type`);
    }
    return {
      ...item,
      category: classifyLocalBboxAreaSize(
        row.item.type,
        item.ratio,
        typeof row.item.description === 'string' ? row.item.description : '',
      ) as GridSizingCategory,
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
      if (role === 'support_elements' && isSizelessSupportElementType(rawItem.type)) return rawItem;
      return { ...rawItem, size: measuredItem?.category };
    });
  }

  return { analysis: next, gridSizing: { ...gridSizing, items: categorizedItems } };
}

export function assertGridSizingPreserved(expected: unknown, actual: unknown): GridSizingPayload {
  const expectedPayload = validateGridSizing(expected);
  const actualPayload = validateGridSizing(actual);
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
