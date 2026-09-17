import { Type } from '@google/genai';
import {
  gridSizingMeasurementResponseSchema,
  gridSizingResponseSchema,
  validateGridSizingAnchor,
  validateGridSizingMeasurement,
  type GridSizingAnchor,
  type GridSizingMeasurement,
} from '@/lib/admin/gridSizing';

export const TWO_STEP_V385_MODE = 'two_step_v385' as const;
export const TWO_STEP_V385_TARGET_VERSION = '3.85';
export const TWO_STEP_V385_TARGET_CHECKSUM = 'c98da2f592085f039e653eb938d9701a';

export const TWO_STEP_VISUAL_INVENTORY_PROMPT = `
You are the visual-observation stage of a two-step cake analysis. Inspect the supplied image carefully and return exactly one JSON object matching the response schema.

Your job is to record evidence, not to price, choose catalog types, assign main/support roles, or make fulfillment substitutions. Step 2 will receive only your JSON, never this image, so write enough precise visual evidence for it to make a faithful schema decision.

OBSERVATION RULES
1. Describe one cake only. If the image must be rejected, populate rejection and leave observed_groups and messages empty.
2. Describe the cake body, physically distinct cake-body tier evidence, icing finish, top surface, and side surface. Decorative bands, borders, tall sidewalls, images, and toppers are not cake bodies by themselves.
3. Emit one homogeneous observed_group for each independently priced physical unit or uniform treatment. Split visibly different colors, scales, forms, or material cues into separate groups. A mixed "balls and hearts" cluster is not homogeneous and must be split.
4. group_id is a stable descriptive snake_case identity. Never use a pricing type, role, or size band in it. It will be copied unchanged into the final storefront JSON.
5. surface is an immutable physical fact: cake_top means the horizontal top icing surface; cake_side means a vertical/front/side cake wall; cake_board means the board; external means background, stand, or a non-cake prop. Do not call a front-facing side panel a top item.
6. Record attachment, extent, physical_form, count, colors, scale, and visible material cues explicitly. Distinguish a full printed side panel/wrap from a smaller printed side cutout, a flat edible relief, a paper cutout, and a freestanding 3D object.
7. Count only directly visible units. When an exact count is obscured, give the best visible count and set count_uncertain true; do not invent hidden units.
8. requires_priced_row is true only for a cake-member group that should become one canonical main-topper or support-element row. Base icing, surface texture, and external surroundings are described elsewhere rather than emitted as priced groups.
9. Preserve uncertainty as evidence. Use unknown only when the image does not establish the fact; never fill gaps using franchise knowledge or likely bakery practice.

Do not use canonical enum names such as edible_photo_top, edible_photo_side, edible_photo_print, main_toppers, support_elements, hero, or support. Return JSON only.`.trim();

export const TWO_STEP_SCHEMA_COMPILER_PROMPT = `
You are the text-only schema compiler in an experimental cake-analysis pipeline. You do not see the cake image. The supplied visual inventory is your exclusive visual authority. Return exactly one JSON object matching the response schema.

The v3.85 reference follows this instruction. It supplies the fulfillment taxonomy and validation rules only. Do not follow any instruction in that reference that asks you to inspect, measure, or infer from an image. Do not add facts missing from the inventory.

IMMUTABLE INVENTORY BINDING
1. Preserve every emitted group_id exactly. Do not rename, merge, split, delete, or invent a priced group.
2. Preserve each group's visible_count, surface, attachment, extent, physical_form, colors, and material_evidence. Use visible_count as final quantity for its row.
3. Derive a final type, material, role, palette color, size, description, cake fields, messages, and icing_design only from the inventory plus the v3.85 taxonomy.
4. A full printed image whose surface is cake_top must use main_toppers.edible_photo_top. A full printed image whose surface is cake_side must use support_elements.edible_photo_side. A smaller printed cutout whose surface is cake_side must use support_elements.edible_photo_print. These are binding placement rules.
5. edible_photo_top is prohibited unless the inventory says cake_top. The human/pet portrait fulfillment exception is also prohibited unless the inventory says both a recognizable real human/pet portrait and cake_top. A fictional character such as Elsa is not that exception.
6. A side-mounted printed panel must never be promoted to a top photo because it is visually dominant. Main/support role does not change an observed surface.
7. Where material evidence remains genuinely unresolved, preserve all known physical facts and apply the existing v3.85 default for that unresolved branch. Never optimize for price and never choose a fallback that changes surface, count, or physical depth.
8. Each final item description must name its observed physical object and retain its observed construction evidence. Do not call an item a generic topper.
9. Before returning, check exact top-level keys, closed enums, support color requirements, valid cake type/thickness/icing pairing, one output row per requires_priced_row group, and blank accepted rejection fields.

Return JSON only.`.trim();

const INVENTORY_SURFACES = ['cake_top', 'cake_side', 'cake_board', 'external'] as const;
const INVENTORY_ATTACHMENTS = ['flush_applied', 'inserted', 'freestanding', 'resting', 'wrapped', 'piped', 'scattered', 'unknown'] as const;
const INVENTORY_EXTENTS = ['full_surface', 'full_side_region', 'partial_region', 'individual_piece', 'repeated_units', 'border', 'unknown'] as const;
const INVENTORY_FORMS = ['printed_full_panel', 'printed_cutout', 'flat_edible_relief', 'flat_non_edible_cutout', 'three_dimensional_object', 'piped_icing', 'scatter', 'surface_finish', 'unknown'] as const;
const INVENTORY_SCALES = ['small', 'medium', 'large', 'unknown'] as const;

export type VisualInventoryGroup = {
  group_id: string;
  description: string;
  belongs_to_cake_design: boolean;
  surface: typeof INVENTORY_SURFACES[number];
  attachment: typeof INVENTORY_ATTACHMENTS[number];
  extent: typeof INVENTORY_EXTENTS[number];
  physical_form: typeof INVENTORY_FORMS[number];
  visible_count: number;
  count_uncertain: boolean;
  observed_scale: typeof INVENTORY_SCALES[number];
  colors: string[];
  material_evidence: string[];
  material_uncertain: boolean;
  requires_priced_row: boolean;
  evidence_summary: string;
  grid_sizing?: GridSizingMeasurement;
};

export type VisualInventory = {
  inventory_version: 'two_step_v385';
  cake: {
    form_and_body: string;
    body_tier_evidence: string;
    icing_base_and_finish: string;
    top_surface: string;
    side_surface: string;
  };
  observed_groups: VisualInventoryGroup[];
  messages: Array<{ text: string; surface: typeof INVENTORY_SURFACES[number]; color_observation: string; exact_text: boolean }>;
  board_and_surroundings: string;
  uncertainties: string[];
  grid_sizing?: GridSizingAnchor;
  rejection: { isRejected: boolean; reason: string; message: string };
};

function fail(path: string, message: string): never {
  throw new Error(`Invalid visual inventory: ${path} ${message}`);
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

function string(value: unknown, path: string, allowBlank = false) {
  if (typeof value !== 'string' || (!allowBlank && !value.trim())) fail(path, 'must be a non-blank string');
  return value;
}

function boolean(value: unknown, path: string) {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean');
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  const result = string(value, path);
  if (!allowed.includes(result as T)) fail(path, `must be one of ${allowed.join(', ')}`);
  return result as T;
}

function stringList(value: unknown, path: string) {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value.map((entry, index) => string(entry, `${path}[${index}]`));
}

export function validateVisualInventory(value: unknown): VisualInventory {
  const result = record(value, 'inventory');
  exactKeys(result, [
    'inventory_version',
    'cake',
    'observed_groups',
    'messages',
    'board_and_surroundings',
    'uncertainties',
    ...(result.grid_sizing === undefined ? [] : ['grid_sizing']),
    'rejection',
  ], 'inventory');
  if (result.inventory_version !== TWO_STEP_V385_MODE) fail('inventory.inventory_version', `must be ${TWO_STEP_V385_MODE}`);

  const cake = record(result.cake, 'inventory.cake');
  exactKeys(cake, ['form_and_body', 'body_tier_evidence', 'icing_base_and_finish', 'top_surface', 'side_surface'], 'inventory.cake');
  const normalizedCake = {
    form_and_body: string(cake.form_and_body, 'inventory.cake.form_and_body'),
    body_tier_evidence: string(cake.body_tier_evidence, 'inventory.cake.body_tier_evidence'),
    icing_base_and_finish: string(cake.icing_base_and_finish, 'inventory.cake.icing_base_and_finish'),
    top_surface: string(cake.top_surface, 'inventory.cake.top_surface'),
    side_surface: string(cake.side_surface, 'inventory.cake.side_surface'),
  };

  if (!Array.isArray(result.observed_groups)) fail('inventory.observed_groups', 'must be an array');
  const groups = result.observed_groups.map((value, index): VisualInventoryGroup => {
    const group = record(value, `inventory.observed_groups[${index}]`);
    const path = `inventory.observed_groups[${index}]`;
    exactKeys(group, [
      'group_id',
      'description',
      'belongs_to_cake_design',
      'surface',
      'attachment',
      'extent',
      'physical_form',
      'visible_count',
      'count_uncertain',
      'observed_scale',
      'colors',
      'material_evidence',
      'material_uncertain',
      'requires_priced_row',
      'evidence_summary',
      ...(group.grid_sizing === undefined ? [] : ['grid_sizing']),
    ], path);
    if (!Number.isInteger(group.visible_count) || Number(group.visible_count) <= 0) fail(`${path}.visible_count`, 'must be a positive integer');
    const normalized = {
      group_id: string(group.group_id, `${path}.group_id`),
      description: string(group.description, `${path}.description`),
      belongs_to_cake_design: boolean(group.belongs_to_cake_design, `${path}.belongs_to_cake_design`),
      surface: enumValue(group.surface, INVENTORY_SURFACES, `${path}.surface`),
      attachment: enumValue(group.attachment, INVENTORY_ATTACHMENTS, `${path}.attachment`),
      extent: enumValue(group.extent, INVENTORY_EXTENTS, `${path}.extent`),
      physical_form: enumValue(group.physical_form, INVENTORY_FORMS, `${path}.physical_form`),
      visible_count: Number(group.visible_count),
      count_uncertain: boolean(group.count_uncertain, `${path}.count_uncertain`),
      observed_scale: enumValue(group.observed_scale, INVENTORY_SCALES, `${path}.observed_scale`),
      colors: stringList(group.colors, `${path}.colors`),
      material_evidence: stringList(group.material_evidence, `${path}.material_evidence`),
      material_uncertain: boolean(group.material_uncertain, `${path}.material_uncertain`),
      requires_priced_row: boolean(group.requires_priced_row, `${path}.requires_priced_row`),
      evidence_summary: string(group.evidence_summary, `${path}.evidence_summary`),
      ...(group.grid_sizing === undefined
        ? {}
        : { grid_sizing: validateGridSizingMeasurement(group.grid_sizing, `${path}.grid_sizing`) }),
    };
    if (normalized.requires_priced_row && (!normalized.belongs_to_cake_design || normalized.surface === 'external')) {
      fail(path, 'cannot require a priced row for a non-cake or external group');
    }
    return normalized;
  });
  if (new Set(groups.map((group) => group.group_id)).size !== groups.length) fail('inventory.observed_groups', 'contains duplicate group_id values');

  if (!Array.isArray(result.messages)) fail('inventory.messages', 'must be an array');
  const messages = result.messages.map((value, index) => {
    const message = record(value, `inventory.messages[${index}]`);
    const path = `inventory.messages[${index}]`;
    exactKeys(message, ['text', 'surface', 'color_observation', 'exact_text'], path);
    return {
      text: string(message.text, `${path}.text`),
      surface: enumValue(message.surface, INVENTORY_SURFACES, `${path}.surface`),
      color_observation: string(message.color_observation, `${path}.color_observation`),
      exact_text: boolean(message.exact_text, `${path}.exact_text`),
    };
  });

  const rejection = record(result.rejection, 'inventory.rejection');
  exactKeys(rejection, ['isRejected', 'reason', 'message'], 'inventory.rejection');
  const normalizedRejection = {
    isRejected: boolean(rejection.isRejected, 'inventory.rejection.isRejected'),
    reason: string(rejection.reason, 'inventory.rejection.reason', true),
    message: string(rejection.message, 'inventory.rejection.message', true),
  };
  const gridSizing = result.grid_sizing === undefined
    ? undefined
    : validateGridSizingAnchor(result.grid_sizing);
  if (normalizedRejection.isRejected && (groups.length || messages.length)) {
    fail('inventory', 'must not emit groups or messages for a rejected image');
  }
  if (normalizedRejection.isRejected && gridSizing) {
    fail('inventory', 'must not emit grid sizing for a rejected image');
  }
  if (!normalizedRejection.isRejected && (normalizedRejection.reason || normalizedRejection.message)) {
    fail('inventory.rejection', 'must use blank reason and message for an accepted image');
  }

  return {
    inventory_version: TWO_STEP_V385_MODE,
    cake: normalizedCake,
    observed_groups: groups,
    messages,
    board_and_surroundings: string(result.board_and_surroundings, 'inventory.board_and_surroundings'),
    uncertainties: stringList(result.uncertainties, 'inventory.uncertainties'),
    ...(gridSizing ? { grid_sizing: gridSizing } : {}),
    rejection: normalizedRejection,
  };
}

export function visualInventoryResponseSchema(includeGridSizing = false) {
  return {
    type: Type.OBJECT,
    properties: {
      inventory_version: { type: Type.STRING, enum: [TWO_STEP_V385_MODE] },
      cake: {
        type: Type.OBJECT,
        properties: {
          form_and_body: { type: Type.STRING },
          body_tier_evidence: { type: Type.STRING },
          icing_base_and_finish: { type: Type.STRING },
          top_surface: { type: Type.STRING },
          side_surface: { type: Type.STRING },
        },
        required: ['form_and_body', 'body_tier_evidence', 'icing_base_and_finish', 'top_surface', 'side_surface'],
      },
      observed_groups: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            group_id: { type: Type.STRING }, description: { type: Type.STRING }, belongs_to_cake_design: { type: Type.BOOLEAN },
            surface: { type: Type.STRING, enum: [...INVENTORY_SURFACES] }, attachment: { type: Type.STRING, enum: [...INVENTORY_ATTACHMENTS] },
            extent: { type: Type.STRING, enum: [...INVENTORY_EXTENTS] }, physical_form: { type: Type.STRING, enum: [...INVENTORY_FORMS] },
            visible_count: { type: Type.INTEGER }, count_uncertain: { type: Type.BOOLEAN }, observed_scale: { type: Type.STRING, enum: [...INVENTORY_SCALES] },
            colors: { type: Type.ARRAY, items: { type: Type.STRING } }, material_evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            material_uncertain: { type: Type.BOOLEAN }, requires_priced_row: { type: Type.BOOLEAN }, evidence_summary: { type: Type.STRING },
            ...(includeGridSizing ? { grid_sizing: gridSizingMeasurementResponseSchema() } : {}),
          },
          required: ['group_id', 'description', 'belongs_to_cake_design', 'surface', 'attachment', 'extent', 'physical_form', 'visible_count', 'count_uncertain', 'observed_scale', 'colors', 'material_evidence', 'material_uncertain', 'requires_priced_row', 'evidence_summary', ...(includeGridSizing ? ['grid_sizing'] : [])],
        },
      },
      messages: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { text: { type: Type.STRING }, surface: { type: Type.STRING, enum: [...INVENTORY_SURFACES] }, color_observation: { type: Type.STRING }, exact_text: { type: Type.BOOLEAN } },
          required: ['text', 'surface', 'color_observation', 'exact_text'],
        },
      },
      board_and_surroundings: { type: Type.STRING },
      uncertainties: { type: Type.ARRAY, items: { type: Type.STRING } },
      grid_sizing: gridSizingResponseSchema(),
      rejection: {
        type: Type.OBJECT,
        properties: { isRejected: { type: Type.BOOLEAN }, reason: { type: Type.STRING }, message: { type: Type.STRING } },
        required: ['isRejected', 'reason', 'message'],
      },
    },
    required: [
      'inventory_version',
      'cake',
      'observed_groups',
      'messages',
      'board_and_surroundings',
      'uncertainties',
      ...(includeGridSizing ? ['grid_sizing'] : []),
      'rejection',
    ],
  };
}

function finalItemRows(analysis: unknown) {
  const result = record(analysis, 'compiled analysis');
  const rows: Array<{ role: 'main' | 'support'; item: Record<string, unknown> }> = [];
  for (const [role, field] of [['main', 'main_toppers'], ['support', 'support_elements']] as const) {
    const values = result[field];
    if (!Array.isArray(values)) fail(`compiled analysis.${field}`, 'must be an array');
    values.forEach((value, index) => rows.push({ role, item: record(value, `compiled analysis.${field}[${index}]`) }));
  }
  return { result, rows };
}

/**
 * Makes the prompt's immutable observation boundary executable. The final
 * schema has no location field, so placement-sensitive photo types are checked
 * against their stage-one source before pricing is allowed.
 */
export function assertCompiledAnalysisMatchesInventory(inventory: VisualInventory, analysis: unknown) {
  const { result, rows } = finalItemRows(analysis);
  const rejection = record(result.rejection, 'compiled analysis.rejection');
  if (rejection.isRejected !== inventory.rejection.isRejected) {
    fail('compiled analysis.rejection', 'must match the inventory rejection decision');
  }
  if (inventory.rejection.isRejected) return;

  const expectedGroups = new Map(inventory.observed_groups
    .filter((group) => group.requires_priced_row)
    .map((group) => [group.group_id, group]));
  const seen = new Set<string>();
  for (const { role, item } of rows) {
    const groupId = string(item.group_id, 'compiled analysis item.group_id');
    const group = expectedGroups.get(groupId);
    if (!group) fail(`compiled analysis ${role} item ${groupId}`, 'does not correspond to a required inventory group');
    if (seen.has(groupId)) fail(`compiled analysis item ${groupId}`, 'is emitted more than once');
    seen.add(groupId);
    if (item.quantity !== group.visible_count) fail(`compiled analysis item ${groupId}.quantity`, 'must match the inventory visible_count');

    const type = string(item.type, `compiled analysis item ${groupId}.type`);
    if (type === 'edible_photo_top' && group.surface !== 'cake_top') {
      fail(`compiled analysis item ${groupId}.type`, 'edible_photo_top requires inventory surface cake_top');
    }
    if ((type === 'edible_photo_side' || type === 'edible_photo_print') && group.surface !== 'cake_side') {
      fail(`compiled analysis item ${groupId}.type`, `${type} requires inventory surface cake_side`);
    }
    if (group.physical_form === 'printed_full_panel' && group.surface === 'cake_side') {
      if (role !== 'support' || type !== 'edible_photo_side' || item.material !== 'waferpaper') {
        fail(`compiled analysis item ${groupId}`, 'must be support edible_photo_side with waferpaper material');
      }
    }
    if (group.physical_form === 'printed_cutout' && group.surface === 'cake_side') {
      if (role !== 'support' || type !== 'edible_photo_print' || item.material !== 'waferpaper') {
        fail(`compiled analysis item ${groupId}`, 'must be support edible_photo_print with waferpaper material');
      }
    }
    if (group.physical_form === 'printed_full_panel' && group.surface === 'cake_top') {
      if (role !== 'main' || type !== 'edible_photo_top' || item.material !== 'waferpaper') {
        fail(`compiled analysis item ${groupId}`, 'must be main edible_photo_top with waferpaper material');
      }
    }
  }
  if (seen.size !== expectedGroups.size) {
    const missing = [...expectedGroups.keys()].filter((groupId) => !seen.has(groupId));
    fail('compiled analysis', `omits required inventory group(s): ${missing.join(', ')}`);
  }
}

export function buildSchemaCompilerInput(
  compilerPrompt: string,
  inventory: VisualInventory,
  v385ReferencePrompt: string,
) {
  return [
    compilerPrompt.trim(),
    '--- BEGIN IMMUTABLE VISUAL INVENTORY ---',
    JSON.stringify(inventory),
    '--- END IMMUTABLE VISUAL INVENTORY ---',
    '--- BEGIN V3.85 TAXONOMY REFERENCE ---',
    v385ReferencePrompt,
    '--- END V3.85 TAXONOMY REFERENCE ---',
  ].join('\n\n');
}

export function visualInventoryRequestParts(mimeType: string, imageData: string, inventoryPrompt: string) {
  return [
    { inlineData: { mimeType, data: imageData } },
    { text: inventoryPrompt },
  ];
}

/** The compiler has no image part by design: its visual authority is the inventory text alone. */
export function textOnlyCompilerRequestParts(
  compilerPrompt: string,
  inventory: VisualInventory,
  v385ReferencePrompt: string,
) {
  return [{ text: buildSchemaCompilerInput(compilerPrompt, inventory, v385ReferencePrompt) }];
}
