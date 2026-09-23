import type { AnalysisGenerationSeoSchema } from '@/lib/ai/generatedAnalysisContract';
import { ThinkingLevel, Type } from '@google/genai';

import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import {
  GENERATED_ANALYSIS_CAKE_THICKNESSES,
  GENERATED_ANALYSIS_CAKE_TYPES,
  GENERATED_ANALYSIS_CLASSIFICATIONS,
  GENERATED_ANALYSIS_COLOR_HEXES,
  GENERATED_PIPED_FLOWER_COVERAGES,
  GENERATED_ANALYSIS_COLOR_TYPES,
  GENERATED_ANALYSIS_ICING_BASES,
  GENERATED_ANALYSIS_MATERIALS,
  GENERATED_ANALYSIS_MESSAGE_POSITIONS,
  GENERATED_ANALYSIS_MESSAGE_TYPES,
  GENERATED_ANALYSIS_REJECTION_REASONS,
  GENERATED_ANALYSIS_SIZES,
  GeneratedAnalysisContractError,
  GENERATED_MAIN_TOPPER_TYPES,
  GENERATED_SUPPORT_ELEMENT_TYPES,
  mergeGeneratedAnalysisSubtypeMap,
  reconcileGeneratedCakeTypeThickness,
  validateGeneratedCakeAnalysisResult,
  type GeneratedAnalysisTypeEnums,
  type GeneratedCakeAnalysisResult,
} from '@/lib/ai/generatedAnalysisContract';
import { normalizeLegacyAnalysisPayload } from '@/lib/ai/analysisSize';
import {
  applyLocalBboxAreaSizing,
  applyLocalLineRatioSizing,
} from '@/lib/ai/localAnalysisSizing';
import {
  applyIntegratedBboxSizing,
  INTEGRATED_AGGREGATE_GEOMETRY_TYPES,
  INTEGRATED_GEOMETRY_SCOPES,
  INTEGRATED_MAX_UNIT_BOXES,
  INTEGRATED_TREATMENT_GEOMETRY_TYPES,
  validateIntegratedBboxResponse,
} from '@/lib/ai/integratedBboxAnalysis';

export const SEARCH_ANALYSIS_REJECTION_REASONS = GENERATED_ANALYSIS_REJECTION_REASONS;
export const SEARCH_ANALYSIS_ICING_BASES = GENERATED_ANALYSIS_ICING_BASES;
export const SEARCH_ANALYSIS_COLOR_TYPES = GENERATED_ANALYSIS_COLOR_TYPES;

export type AnalysisGenerationSizeSchema =
  | 'legacy_six_band'
  | 'three_band'
  | 'ai_diameter_anchor'
  | 'local_bbox_area'
  | 'local_line_ratio'
  | 'integrated_bbox_v1'
  | 'integrated_bbox_v2';

/**
 * Independent visual verdict for the exceptional, priced wafer-wave type.
 * It is intentionally not part of generated analysis JSON or cached output.
 */
export type WhiteWaferPaperSideWaveVerification = {
  hasDistinctThinPaperStrips: boolean;
  hasUprightSeparateAttachment: boolean;
  hasLooseFreeWavyEdges: boolean;
  hasPredominantlyFullHeightWrap: boolean;
  hasWhiteUnprintedSheets: boolean;
};

const LEGACY_GENERATION_SIZES = ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'] as const;

/**
 * v3.66 can safely run during the compatibility deploy. Its six-band response
 * is immediately collapsed in memory; v3.67+ is constrained to three bands at
 * the provider schema boundary.
 */
export function getAnalysisGenerationSizeSchema(promptVersion: string): AnalysisGenerationSizeSchema {
  // The checked-in fallback prompt carries the v3.93 scoped integrated-geometry
  // contract. Its response envelope must be validated as geometry, never as
  // the older direct-size response shape.
  if (promptVersion === 'fallback') return 'integrated_bbox_v2';
  if (promptVersion === 'local-dev-diameter-anchor') return 'ai_diameter_anchor';
  if (promptVersion === 'local-dev-bbox') return 'local_bbox_area';
  if (promptVersion === 'local-dev-line') return 'local_line_ratio';
  const match = promptVersion.match(/^(?:v)?(\d+)\.(\d+)$/i);
  if (!match) return 'legacy_six_band';
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  // v3.93+ owns scope, sizing, and cardinality in application code from a
  // single Gemini response with row-attached [y, x] boxes and cake lines.
  if (major > 3 || (major === 3 && minor >= 93)) return 'integrated_bbox_v2';
  // v3.92 owns sizing in application code from a single Gemini response with
  // row-attached [y, x] bounding boxes and cake measurement lines.
  if (major > 3 || (major === 3 && minor >= 92)) return 'integrated_bbox_v1';
  // v3.84+ uses direct three-band output with the visible top-tier diameter
  // as the model's only sizing anchor; no coordinate geometry is requested.
  if (major > 3 || (major === 3 && minor >= 84)) return 'ai_diameter_anchor';
  // v3.74-v3.83 use the guarded production line-ratio prompt release.
  if (major > 3 || (major === 3 && minor >= 74)) return 'local_line_ratio';
  return major > 3 || (major === 3 && minor >= 67)
    ? 'three_band'
    : 'legacy_six_band';
}

const TINY_SUGAR_PEARL_OR_BEAD = /\b(?:sugar\s+)?(?:pearl|bead)s?\b|\bnonpareils?\b/i;
const SCATTERED_OR_REPEATED = /\b(?:scattered?|sprinkled?|repeated|multiple|many|around|across)\b/i;
const EXPLICIT_SCENE_ONLY_LOCATION = /\b(?:in|against|from)\s+(?:the\s+)?(?:photo\s+)?(?:background|backdrop|scene)\b|\bbehind\s+(?:the\s+)?cake\b|\b(?:photo|scene)\s+(?:prop|staging)\b/i;
const EXPLICIT_CAKE_MEMBERSHIP = /\b(?:on|onto|attached(?:\s+to)?|adhered(?:\s+to)?|inserted\s+into|wrapped\s+around|resting\s+on)\s+(?:the\s+)?(?:cake(?:\s+(?:top|side|surface|base|board))?|tier|cake\s+board|board)\b|\baround\s+(?:the\s+)?cake\s+base\b/i;
const WAFER_PAPER_TERM = /\bwafer(?:\s|-)?paper\b|\bwaferpaper\b/i;
const UPRIGHT_WAFER_SHEETS = /\b(?:upright|vertical)\b/i;
const LOOSE_WAFER_EDGES = /\b(?:loose|free)\b[\s\S]{0,32}\b(?:wavy|ruffled|pleated)\b[\s\S]{0,32}\bedges?\b/i;
const FULL_HEIGHT_WAFER_WRAP = /\b(?:repeated|full[- ]height|predominantly\s+full[- ]height|perimeter)\b[\s\S]{0,48}\b(?:wrap|side|tier|sheets?|strips?)\b|\b(?:wrap|side|tier|sheets?|strips?)\b[\s\S]{0,48}\b(?:repeated|full[- ]height|predominantly\s+full[- ]height|perimeter)\b/i;
const SECONDARY_OBJECT_CONNECTOR = /\b(?:topped\s+with|covered\s+(?:in|with)|decorated\s+with|finished\s+with|featuring|with)\b/i;
const MULTIPLE_PRIMARY_OBJECTS = /\b(?:and|plus|alongside)\b|[;&+]/i;
const SAFE_DESCRIPTOR_PATTERN = [
  'descriptor', 'black', 'blue', 'brown', 'champagne', 'colorful', 'coral',
  'edible', 'fondant', 'gold', 'green', 'gumpaste', 'ivory', 'lavender',
  'metallic', 'mint', 'multicolor', 'navy', 'orange', 'peach', 'pink',
  'purple', 'rainbow', 'red', 'silver', 'tan', 'teal', 'white', 'yellow',
  'top', 'sides?', 'base', 'front', 'back',
].join('|');
const SAFE_COORDINATED_DESCRIPTORS = new RegExp(
  `\\b(?:${SAFE_DESCRIPTOR_PATTERN})\\s*(?:,\\s*)?(?:and|&)\\s+(?:${SAFE_DESCRIPTOR_PATTERN})\\b`,
  'gi',
);
const SECONDARY_LEAD_IN = /\b(?:around|behind|beside|near|under|beneath|next\s+to|wearing|holding|carrying|containing|surrounded\s+by|adorned(?:\s+(?:by|with))?)\b/i;
const PRIMARY_GROUPING_OF = /\b(?:cluster|bouquet|arrangement|set|pair|group)\s+of\b/gi;

type ItemRole = 'main' | 'support';
type TargetRole = ItemRole | 'preserve';

type DescriptionTypeRule = {
  id: string;
  material: string;
  targetRole: TargetRole;
  targetType: string | Partial<Record<ItemRole, string>>;
  quantity?: number;
  matches: (primaryDescription: string, item: Record<string, unknown>, role: ItemRole) => boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsPrimaryNoun(description: string, noun: RegExp) {
  const match = noun.exec(description);
  if (!match || match.index === undefined) return false;
  const nounPrefix = description.slice(0, match.index);
  return !SECONDARY_LEAD_IN.test(nounPrefix)
    && !/\bof\b/i.test(nounPrefix.replace(PRIMARY_GROUPING_OF, ''));
}

function hasAllTerms(description: string, terms: RegExp[]) {
  return terms.every((term) => term.test(description));
}

function hasMultiplePrimaryObjects(description: string) {
  let remaining = description;
  let previous: string;
  do {
    previous = remaining;
    remaining = remaining.replace(SAFE_COORDINATED_DESCRIPTORS, ' descriptor ');
  } while (remaining !== previous);
  return MULTIPLE_PRIMARY_OBJECTS.test(remaining);
}

const DESCRIPTION_TYPE_RULES: DescriptionTypeRule[] = [
  {
    id: 'icing_sprinkles',
    targetType: 'icing_decorations',
    material: 'icing',
    targetRole: 'preserve',
    matches: (primary) => hasAllTerms(primary, [
      /\bsprinkles\b/i,
      /\b(?:icing|piped|buttercream)\b/i,
    ]),
  },
  {
    id: 'premium_sprinkles',
    targetType: 'premium_sprinkles',
    material: 'candy',
    targetRole: 'support',
    quantity: 1,
    matches: (primary) => hasAllTerms(primary, [/\bpremium\b/i, /\bsprinkles\b/i])
      && !/\b(?:icing|piped|buttercream)\b/i.test(primary),
  },
  {
    id: 'sprinkles',
    targetType: 'sprinkles',
    material: 'candy',
    targetRole: 'support',
    quantity: 1,
    matches: (primary) => /\bsprinkles\b/i.test(primary)
      && !/\b(?:premium|icing|piped|buttercream)\b/i.test(primary),
  },
  {
    id: 'tiny_sugar_pearls',
    targetType: 'sprinkles',
    material: 'candy',
    targetRole: 'support',
    quantity: 1,
    matches: (_primary, item, role) => {
      if (role !== 'support' || item.type !== 'edible_3d_ordinary') return false;
      if (item.size !== 'small') return false;
      const text = `${String(item.group_id ?? '')} ${String(item.description ?? '')}`;
      const repeatedQuantity = typeof item.quantity === 'number' && item.quantity >= 2;
      return TINY_SUGAR_PEARL_OR_BEAD.test(text)
        && (repeatedQuantity || SCATTERED_OR_REPEATED.test(text))
        && !/\b(?:drag(?:e|é)es?|premium)\b/i.test(text);
    },
  },
  {
    id: 'dragees',
    targetType: 'dragees',
    material: 'candy',
    targetRole: 'support',
    matches: (primary) => (
      /\bdrag(?:e|é)es?\b/i.test(primary) && !/\bsprinkle\b/i.test(primary)
    ),
  },
  {
    id: 'edible_flowers',
    targetType: 'edible_flowers',
    material: 'edible_fondant',
    targetRole: 'preserve',
    matches: (primary) => containsPrimaryNoun(primary, /\bflowers?\b/i) && (
      /\b(?:edible|fondant|gumpaste)\b[^,.;]{0,40}\bflowers?\b/i.test(primary)
      || /\bflowers?\b[^,.;]{0,40}\b(?:edible|fondant|gumpaste)\b/i.test(primary)
    ),
  },
  {
    id: 'candle',
    targetType: 'candle',
    material: 'wax',
    targetRole: 'main',
    matches: (primary) => (
      containsPrimaryNoun(primary, /\bcandles?\b/i)
      && !/\b(?:candle[ -]?holders?|candle[ -]?shaped|edible|fondant|gumpaste)\b/i.test(primary)
    ),
  },
  {
    id: 'edible_crown',
    targetType: 'edible_crown',
    material: 'edible_fondant',
    targetRole: 'main',
    matches: (primary) => (
      containsPrimaryNoun(primary, /\b(?:crowns?|tiaras?)\b/i)
      && /\b(?:edible|fondant|gumpaste)\b/i.test(primary)
    ),
  },
  {
    id: 'plastic_crown',
    targetType: 'plastic_crown',
    material: 'plastic',
    targetRole: 'main',
    matches: (primary) => (
      containsPrimaryNoun(primary, /\b(?:crowns?|tiaras?)\b/i)
      && /\b(?:plastic|metal|rhinestone)\b/i.test(primary)
    ),
  },
  {
    id: 'printout',
    targetType: { main: 'printout', support: 'support_printout' },
    material: 'photopaper',
    targetRole: 'preserve',
    matches: (primary) => (
      containsPrimaryNoun(primary, /\bprintouts?\b/i)
      || /\bprinted[ -]paper\s+(?:cutouts?|toppers?)\b/i.test(primary)
    ),
  },
  {
    id: 'cardstock',
    targetType: 'cardstock',
    material: 'cardstock',
    targetRole: 'main',
    matches: (primary) => containsPrimaryNoun(primary, /\bcard[ -]?stock\b/i),
  },
  {
    id: 'toy',
    targetType: 'toy',
    material: 'plastic',
    targetRole: 'main',
    matches: (primary) => (
      containsPrimaryNoun(primary, /\btoys?\b/i)
      && !/\btoy\s+story\b/i.test(primary)
      && !/\b(?:edible|fondant|gumpaste)\b/i.test(primary)
    ),
  },
  {
    id: 'edible_3d_complex',
    targetType: 'edible_3d_complex',
    material: 'edible_fondant',
    targetRole: 'main',
    matches: (primary) => hasAllTerms(primary, [
      /\b(?:complex|detailed|intricate)\b/i,
      /\b(?:edible|fondant|gumpaste)\b/i,
      /\b3[ -]?d\b/i,
    ]),
  },
  {
    id: 'edible_3d_ordinary',
    targetType: 'edible_3d_ordinary',
    material: 'edible_fondant',
    targetRole: 'preserve',
    matches: (primary) => hasAllTerms(primary, [
      /\b(?:ordinary|simple[ -]molded)\b/i,
      /\b(?:edible|fondant|gumpaste)\b/i,
      /\b3[ -]?d\b/i,
    ]),
  },
];

function getTargetType(rule: DescriptionTypeRule, role: ItemRole) {
  return typeof rule.targetType === 'string' ? rule.targetType : rule.targetType[role];
}

function reconcileDescriptionItem(
  item: Record<string, unknown>,
  sourceRole: ItemRole,
  typeEnums: GeneratedAnalysisTypeEnums,
): { item: Record<string, unknown>; role: ItemRole } | null {
  if (typeof item.description !== 'string') return null;

  const primaryDescription = item.description.split(SECONDARY_OBJECT_CONNECTOR, 1)[0].trim();
  if (!primaryDescription) return null;

  const matchingRules = DESCRIPTION_TYPE_RULES.filter((rule) => (
    rule.matches(primaryDescription, item, sourceRole)
  ));
  const matchedTypes = new Set(matchingRules.map((rule) => {
    const role = rule.targetRole === 'preserve' ? sourceRole : rule.targetRole;
    return getTargetType(rule, role);
  }));
  if (matchedTypes.size !== 1) return null;

  const rule = matchingRules[0];
  const includesTinySugarPearlGuard = matchingRules.some(({ id }) => id === 'tiny_sugar_pearls');
  if (!includesTinySugarPearlGuard && hasMultiplePrimaryObjects(primaryDescription)) {
    return null;
  }

  const targetRole = rule.targetRole === 'preserve' ? sourceRole : rule.targetRole;
  const targetType = getTargetType(rule, targetRole);
  if (!targetType) return null;
  if (targetRole === 'main' && !typeEnums.mainTopperTypes.includes(targetType)) return null;
  if (targetRole === 'support' && !typeEnums.supportElementTypes.includes(targetType)) return null;

  let color: unknown;
  if (targetRole === 'support') {
    color = item.color;
    if (typeof color !== 'string' && Array.isArray(item.colors)) {
      color = item.colors.find((value) => typeof value === 'string');
    }
    if (typeof color !== 'string') return null;
  }

  const nextItem: Record<string, unknown> = {
    ...item,
    type: targetType,
    material: rule.material,
  };
  if (rule.quantity !== undefined) nextItem.quantity = rule.quantity;
  if (item.type !== targetType) delete nextItem.subtype;

  if (targetRole === 'main') {
    nextItem.classification = 'hero';
  } else {
    delete nextItem.classification;
    nextItem.color = color;
  }

  return { item: nextItem, role: targetRole };
}

/**
 * Reconciles only explicit primary-object wording. Secondary garnish phrases,
 * ambiguous rows, and unknown nouns remain unchanged for strict validation.
 */
function reconcileDescriptionTypes(
  result: unknown,
  typeEnums: GeneratedAnalysisTypeEnums,
): unknown {
  if (!isRecord(result)
    || !Array.isArray(result.main_toppers)
    || !Array.isArray(result.support_elements)) return result;

  let changed = false;
  const mainToppers: unknown[] = [];
  const supportElements: unknown[] = [];

  const reconcileRole = (values: unknown[], sourceRole: ItemRole) => {
    values.forEach((value) => {
      if (!isRecord(value)) {
        (sourceRole === 'main' ? mainToppers : supportElements).push(value);
        return;
      }

      const reconciled = reconcileDescriptionItem(value, sourceRole, typeEnums);
      if (!reconciled) {
        (sourceRole === 'main' ? mainToppers : supportElements).push(value);
        return;
      }

      changed = true;
      (reconciled.role === 'main' ? mainToppers : supportElements).push(reconciled.item);
    });
  };

  reconcileRole(result.main_toppers, 'main');
  reconcileRole(result.support_elements, 'support');

  return changed ? { ...result, main_toppers: mainToppers, support_elements: supportElements } : result;
}

/**
 * The model can occasionally acknowledge that a valid-looking object is only a
 * photo-scene prop, then still emit it as a priced cake element. Remove only
 * rows with explicit scene-only wording and no explicit cake-membership cue;
 * never infer scene status from a generic word such as "background" alone.
 * This operates only on fresh generation results before validation/persistence.
 */
function removeExplicitSceneOnlyItems(result: unknown): unknown {
  if (!isRecord(result)
    || !Array.isArray(result.main_toppers)
    || !Array.isArray(result.support_elements)) return result;

  if (isRecord(result.rejection) && result.rejection.isRejected === true) return result;

  const keepCakeMemberItems = (items: unknown[]) => items.filter((item) => {
    if (!isRecord(item) || typeof item.description !== 'string') return true;
    return !EXPLICIT_SCENE_ONLY_LOCATION.test(item.description)
      || EXPLICIT_CAKE_MEMBERSHIP.test(item.description);
  });
  const mainToppers = keepCakeMemberItems(result.main_toppers);
  const supportElements = keepCakeMemberItems(result.support_elements);

  if (mainToppers.length === result.main_toppers.length
    && supportElements.length === result.support_elements.length) return result;

  return { ...result, main_toppers: mainToppers, support_elements: supportElements };
}

function hasDirectWaferPaperWaveEvidence(description: string): boolean {
  return WAFER_PAPER_TERM.test(description)
    && UPRIGHT_WAFER_SHEETS.test(description)
    && LOOSE_WAFER_EDGES.test(description)
    && FULL_HEIGHT_WAFER_WRAP.test(description);
}

function hasVerifiedWhiteWaferPaperWave(
  verification: WhiteWaferPaperSideWaveVerification | undefined,
): boolean {
  return verification?.hasDistinctThinPaperStrips === true
    && verification.hasUprightSeparateAttachment === true
    && verification.hasLooseFreeWavyEdges === true
    && verification.hasPredominantlyFullHeightWrap === true
    && verification.hasWhiteUnprintedSheets === true;
}

/**
 * This priced type is valid only for separately visible full-height wafer-paper
 * sheets. Text-only repair cannot establish those visual facts, so never add a
 * wave row from generated SEO/alt wording. Instead, fail closed by removing a
 * model-emitted wave row unless its own description confirms wafer material,
 * vertical placement, loose wavy edges, and a repeated/full-height side wrap.
 * A separate image-only verifier must also establish all construction cues and
 * literal white/unprinted sheets. This operates only on fresh generation
 * results and fails closed when the verifier is unavailable.
 */
function removeUnverifiedConditionedWaferPaperWaves(
  result: unknown,
  verification: WhiteWaferPaperSideWaveVerification | undefined,
): unknown {
  if (!isRecord(result) || !Array.isArray(result.support_elements)) return result;

  if (isRecord(result.rejection) && result.rejection.isRejected === true) return result;

  const supportElements = result.support_elements.filter((element) => (
    !isRecord(element)
    || element.type !== 'edible_photo_side_wave'
    || (
      hasVerifiedWhiteWaferPaperWave(verification)
      && typeof element.description === 'string'
      && hasDirectWaferPaperWaveEvidence(element.description)
    )
  ));

  return supportElements.length === result.support_elements.length
    ? result
    : { ...result, support_elements: supportElements };
}

const BBOX_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    x: { type: Type.INTEGER, description: 'Left edge on the normalized 0–1000 horizontal axis of the complete image frame supplied to the analyzer after preprocessing, before UI cropping, panning, or display scaling. Locate it in apparent image space without perspective correction, then round and clamp to 0–1000.' },
    y: { type: Type.INTEGER, description: 'Top edge on the normalized 0–1000 vertical axis of the complete image frame supplied to the analyzer after preprocessing, before UI cropping, panning, or display scaling. Locate it in apparent image space without perspective correction, then round and clamp to 0–1000.' },
    width: { type: Type.INTEGER, description: 'Width on the normalized 0–1000 horizontal axis of the complete analyzer image frame.' },
    height: { type: Type.INTEGER, description: 'Height on the normalized 0–1000 vertical axis of the complete analyzer image frame.' },
  },
  required: ['x', 'y', 'width', 'height'],
};

const ELEMENT_BBOX_SCHEMA = {
  ...BBOX_SCHEMA,
  description: 'Bounding box for one item. When quantity is greater than 1, box one visible representative unit only; never enclose the complete group.',
};

const COORDINATE_POINT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    x: { type: Type.INTEGER, description: 'Normalized 0–1000 horizontal coordinate from the top-left of the complete image frame supplied to the analyzer after preprocessing, before UI cropping, panning, or display scaling. Locate in apparent image space without perspective correction, then round and clamp.' },
    y: { type: Type.INTEGER, description: 'Normalized 0–1000 vertical coordinate from the top-left of the complete image frame supplied to the analyzer after preprocessing, before UI cropping, panning, or display scaling. Locate in apparent image space without perspective correction, then round and clamp.' },
  },
  required: ['x', 'y'],
};

const MEASUREMENT_LINE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    start: COORDINATE_POINT_SCHEMA,
    end: COORDINATE_POINT_SCHEMA,
  },
  required: ['start', 'end'],
};

const CAKE_MEASUREMENTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    diameter: {
      ...MEASUREMENT_LINE_SCHEMA,
      description: 'Visible left-to-right width line for the TOP TIER or reference body. For a round, heart, or elliptical body, use opposing visible edges of one cross-section; prefer the visible top ellipse, with opposing cake-wall edges at one level as fallback. For Square, Rectangle, Square Fondant, Rectangle Fondant, or Slab Cake, use opposing visible left/right body edges across one representative top-surface or sidewall cross-section. For a number-shaped cake normalized to Rectangle, use the widest uninterrupted visible cake-body span at one level and do not bridge an internal numeral void. For Cupcake, use one representative visible cupcake, and use that same cupcake for height. For Bento Cupcake Set and Bento accompanied by omitted cupcakes, measure the bento cake body. Use apparent image-space geometry without perspective correction. If an edge is occluded, choose another valid visible cross-section or stop at the visible boundary; never infer hidden continuation or cross a holder, decoration, board, plate, or background. Perspective may make it slanted; keep both endpoint coordinates explicit and order it left-to-right.',
    },
    height: {
      ...MEASUREMENT_LINE_SCHEMA,
      description: 'Visible top-to-bottom wall line for the same TOP TIER, reference body, or representative cupcake used for cake_measurements.diameter. For a round or elliptical body, start at the near/front top rim on the lower/closer arc of the top ellipse, where the top surface becomes the front wall, and end at the near/front bottom rim. For a non-round body, use one directly visible front or side wall span. For Cupcake, exclude frosting and the paper holder where it extends beyond the cake body. Do not use the highest pixel, rear/back edge, exposed top surface, decoration, board, or plate. Use apparent image-space geometry without perspective correction; order predominantly vertical endpoints top-to-bottom. If a boundary is occluded, use the nearest visible point and never infer hidden cake.',
    },
  },
  required: ['diameter', 'height'],
  description: 'Explicit normalized line endpoints for the top tier, reference body, or representative cupcake used as the local sizing reference. Do not include lower tiers, toppers, decorations, holders, plate, board, or background.',
};

const ELEMENT_SIZE_LINE_SCHEMA = {
  ...MEASUREMENT_LINE_SCHEMA,
  description: 'One representative normalized line for the item primary dimension used for local sizing. Measure height for 3D figures, toys, crowns, figurines, and candles; the larger visible span along the dominant physical axis for flat toppers; bloom width for flowers; sphere width for balls; and the longest relevant visible span along one dominant edge or axis for flat artwork, logos, panels, and other flat items. For a repeated icing border row, measure one typical visible shell, bead, dollop, rosette, or swirl, never the full perimeter or border run. Put endpoints on opposite directly visible boundaries of that same dimension and keep the segment within the representative item. Use apparent image-space geometry without perspective correction. Use vertical or horizontal by default; order horizontal lines left-to-right, vertical lines top-to-bottom, and other diagonals by smaller x first. Allow a slant only when the item or its true primary axis is visibly rotated or perspective-skewed. Never use a corner-to-corner diagonal, infer hidden continuation, cross empty space, or slant merely to increase length. For repeated rows, measure one typical visible unit only.',
};

const INTEGRATED_BBOX_UNIT_SCHEMA = {
  type: Type.ARRAY,
  items: { type: Type.NUMBER },
  minItems: 4,
  maxItems: 4,
  description: 'Tight normalized [ymin, xmin, ymax, xmax] box for one visible unit or one intentional aggregate region.',
};

const INTEGRATED_BBOX_COLLECTION_SCHEMA = {
  type: Type.ARRAY,
  items: INTEGRATED_BBOX_UNIT_SCHEMA,
  minItems: 1,
  maxItems: INTEGRATED_MAX_UNIT_BOXES,
  description: `One tight normalized box per visible discrete unit, from 1 through ${INTEGRATED_MAX_UNIT_BOXES} boxes. For an aggregate treatment, return exactly one full-region box.`,
};

const INTEGRATED_BBOX_CONFIDENCE_COLLECTION_SCHEMA = {
  type: Type.ARRAY,
  items: { type: Type.NUMBER },
  minItems: 1,
  maxItems: INTEGRATED_MAX_UNIT_BOXES,
  description: 'One confidence from 0 through 1 for each box, in the same order as box_2d.',
};

const INTEGRATED_BBOX_SCOPE_SCHEMA = {
  type: Type.STRING,
  enum: [...INTEGRATED_GEOMETRY_SCOPES],
  description: 'unit for countable independent decorations; piped_cluster for one cohesive piped botanical treatment; treatment for an allowed non-countable treatment.',
};

const INTEGRATED_POINT_SCHEMA = {
  type: Type.ARRAY,
  items: { type: Type.NUMBER },
  minItems: 2,
  maxItems: 2,
  description: 'Normalized [y, x] point in the original image.',
};

const INTEGRATED_LINE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    start: INTEGRATED_POINT_SCHEMA,
    end: INTEGRATED_POINT_SCHEMA,
  },
  required: ['start', 'end'],
};

/**
 * Older system instructions still document direct and line-ratio modes for
 * historical prompts. Append this only for v3.92+ so the selected generation
 * contract wins without changing a live pre-v3.92 analysis.
 */
const INTEGRATED_BBOX_V1_SYSTEM_OVERRIDE = `

## V3.92 INTEGRATED BOUNDING-BOX PRECEDENCE (AUTHORITATIVE)

For the integrated_bbox_v1 response schema, this instruction overrides every earlier direct-diameter, model-owned size, cake_measurements, size_line, bbox, fixed-size, size-free filler, and coverage-to-size instruction, including the earlier singular representative-unit wording in the v3.92 addendum. Return the required { analysis, geometry } envelope in one response. Never emit a model-owned size, ratio, area, legacy bbox, size_line, or cake_measurements field. Every accepted main_toppers and support_elements row needs a tight normalized box_2d array and matching bbox_confidence array; every cake_messages row needs one tight normalized [ymin, xmin, ymax, xmax] box_2d and one bbox_confidence; accepted images need the two geometry lines. Preserve coverage and subtype as analysis metadata only. Always emit icing_design.colors.gumpasteBaseBoardColor; when gumpasteBaseBoard is false, repeat the closest visible side color.

BOX SCOPE POLICY: First decide whether the row is a discrete/countable item or an aggregate treatment. For every discrete/countable main_toppers or support_elements row—including candles, flowers, gems, dragees, stars, balls, chocolates, lollipops, and repeated figures—return one tight box per clearly visible unit in the row's box_2d array, up to min(quantity, ${INTEGRATED_MAX_UNIT_BOXES}) boxes. When all units are visible, quantity 1 means 1 box and quantities 2 through ${INTEGRATED_MAX_UNIT_BOXES} mean that many boxes; quantities above ${INTEGRATED_MAX_UNIT_BOXES} are capped at ${INTEGRATED_MAX_UNIT_BOXES} boxes while preserving the actual visible count in quantity. If some units cannot be localized with tight boundaries, return every confidently visible unit rather than inventing, merging, or enlarging a box; never use one arrangement-wide box for a discrete row. Return a matching bbox_confidence array with one confidence per box. Aggregate treatment scope is allowed only for these explicit types: ${INTEGRATED_AGGREGATE_GEOMETRY_TYPES.join(', ')}. For an aggregate-treatment type, return exactly one full-region box and one confidence, and use quantity 1 unless that type's existing fulfillment rule explicitly counts covered tiers. This includes inseparable or spread materials such as sand-like texture, sprinkles, splatter, brush-applied icing, piping, borders, panels, and wraps. Do not choose aggregate scope merely because a discrete cluster is difficult to count, and do not invent a new type for sand; use the closest existing allowed aggregate-treatment type. Cake messages remain one box and one confidence because they are not quantity-priced items.

The application determines variable-height cakeThickness from cake_diameter_width / cake_height_length using >=2 => 3 in, >=1.5 => 4 in, >1.2 => 5 in, and <=1.2 => 6 in; do not treat your cakeThickness as authoritative. For topper/support size bands, the application uses cake_area = diameter_width * diameter_width; the height line is not part of that area denominator. It assigns Small when area_ratio_percent <= 15, Medium when area_ratio_percent > 15 and <= 70, and Large when area_ratio_percent > 70. The application accepts either endpoint order and canonicalizes diameter left-to-right and height top-to-bottom before validation and calculation. Rejected images have empty arrays and geometry_version only, with no measurement lines.

FINAL CARDINALITY CHECK BEFORE JSON: For every discrete row, count the nested arrays inside box_2d before responding. Return no more than min(quantity, ${INTEGRATED_MAX_UNIT_BOXES}) distinct tight boxes, one for each confidently visible unit; when all units are visible, return the full capped count. Never collapse a discrete row into an arrangement-wide box because the units are small or difficult to count. Reserve one-box geometry only for a single visible unit or the explicit aggregate-treatment types above.`;

const INTEGRATED_BBOX_V2_SYSTEM_OVERRIDE = `

## V3.93 INTEGRATED BOUNDING-BOX SCOPE (AUTHORITATIVE)

For the integrated_bbox_v2 response schema, this instruction overrides every earlier direct-diameter, model-owned size, cake_measurements, size_line, bbox, fixed-size, size-free filler, and coverage-to-size instruction. Return the required { analysis, geometry } envelope in one response. Never emit a model-owned size, ratio, area, legacy bbox, size_line, or cake_measurements field. Every accepted main_toppers and support_elements row needs geometry_scope, a normalized box_2d array, and a matching bbox_confidence array. Every cake_messages row needs one tight normalized [ymin, xmin, ymax, xmax] box_2d and one bbox_confidence. Accepted images need the diameter line; include a cake height line when it is measurable.

FIRST CHOOSE ONE GEOMETRY SCOPE FOR EACH TOPPER OR SUPPORT ROW:

1. unit — Use this for every independently fulfillable, countable decoration: separate fondant/gumpaste flowers, leaves, gems, stars, chocolates, candles, figures, and individually placed piped flowers or leaf motifs. For separate piped botanicals, use type icing_decorations and material icing. Set quantity to the actual visible count. box_2d must contain exactly min(quantity, ${INTEGRATED_MAX_UNIT_BOXES}) distinct tight unit boxes, and bbox_confidence must contain exactly one confidence per box. A discrete row never receives an arrangement-wide, spray-wide, garland-wide, or cluster-wide box. Split visibly different scales into separate rows.

2. piped_cluster — Use this only for one cohesive piped botanical treatment made of icing that is fulfilled and priced as a cluster. Use type piped_flowers_top for a top treatment or piped_flowers_side for a side treatment, material icing, quantity 1, and coverage small, medium, or large. box_2d must contain exactly one tight box around the full cluster, with one confidence. This review box does not size the row: coverage alone selects its fixed cluster price. Do not report a component count for the flowers or leaves inside the cluster.

3. treatment — Use this only for a non-countable treated region of one of these types: ${INTEGRATED_TREATMENT_GEOMETRY_TYPES.join(', ')}. For icing_decorations, treatment is allowed only for one continuous icing border or region with material icing and quantity 1. Individually placed piped blooms, leaf motifs, and other discrete decorations remain unit rows with exact per-unit boxes.

Cake messages remain one box and one confidence because they are not quantity-priced items. The application determines variable-height cakeThickness from cake_diameter_width / cake_height_length using >=2 => 3 in, >=1.5 => 4 in, >1.2 => 5 in, and <=1.2 => 6 in, then reconciles that value to the nearest thickness supported by the cake type. For unit rows, it uses cake_area = diameter_width * diameter_width and assigns Small when area_ratio_percent <= 15, Medium when > 15 and <= 70, and Large when > 70. All sampled unit boxes in a row must land in the same band. The height line is not part of the area denominator. The application accepts either endpoint order and canonicalizes diameter left-to-right and height top-to-bottom before validation and calculation. The diameter line is required. If the cake height line is missing or unusable after one complete replacement attempt, omit it; the application keeps a valid model thickness or uses the lowest thickness supported for a confirmed cake type. Rejected images have empty arrays and geometry_version only, with no measurement lines.

FINAL CARDINALITY CHECK BEFORE JSON: Every unit row must contain exactly min(quantity, ${INTEGRATED_MAX_UNIT_BOXES}) nested boxes and confidences. Every piped_cluster row must contain one box, one confidence, quantity 1, and coverage. Every icing_decorations treatment row must be one continuous icing region with quantity 1. Never merge separate decorations into a cluster box.`;

const DIRECT_DIAMETER_SYSTEM_OVERRIDE = `

## DIRECT DIAMETER SIZE CONTRACT (AUTHORITATIVE)

For the ai_diameter_anchor response schema, every main_toppers and support_elements row, including edible_flowers_filler, MUST contain exactly one size value: small, medium, or large. Do not omit size for any row. The response schema is the final field contract: do not follow older size-free filler or application-owned geometry instructions when this schema is active. Do not emit cake_measurements, size_line, bbox, coordinates, or real-world inch estimates in this mode.`;

export function buildSearchAnalysisResponseSchema(
  typeEnums: GeneratedAnalysisTypeEnums,
  sizeSchema: AnalysisGenerationSizeSchema = 'three_band',
  seoSchema: AnalysisGenerationSeoSchema = 'analysis_only',
) {
  const mainTopperTypes = typeEnums.mainTopperTypes.filter(
    (type) => GENERATED_MAIN_TOPPER_TYPES.includes(type as never),
  );
  const supportElementTypes = typeEnums.supportElementTypes.filter(
    (type) => GENERATED_SUPPORT_ELEMENT_TYPES.includes(type as never),
  );
  const subtypes = [...new Set(
    Object.values(mergeGeneratedAnalysisSubtypeMap(typeEnums.subtypesByType)).flat(),
  )];
  const subtypeProperty = subtypes.length
    ? { subtype: { type: Type.STRING, enum: subtypes } }
    : {};
  const generationSizes = sizeSchema === 'legacy_six_band'
    ? LEGACY_GENERATION_SIZES
    : GENERATED_ANALYSIS_SIZES;
  const isLocalLineRatio = sizeSchema === 'local_line_ratio';
  const isLocalBboxArea = sizeSchema === 'local_bbox_area';
  const isDirectDiameterAnchor = sizeSchema === 'ai_diameter_anchor';
  const isIntegratedBbox = sizeSchema === 'integrated_bbox_v1' || sizeSchema === 'integrated_bbox_v2';
  const isIntegratedBboxV2 = sizeSchema === 'integrated_bbox_v2';
  const usesLocalGeometry = isLocalLineRatio || isLocalBboxArea || isIntegratedBbox;
  const generatedSizeProperty = usesLocalGeometry
    ? {}
    : { size: { type: Type.STRING, enum: [...generationSizes] } };
  // Local geometry assigns size after generation. Direct-diameter and three-band
  // modes require every generated item to carry a canonical size. Local-geometry
  // modes intentionally omit it until application sizing runs.
  const generatedSizeRequired = usesLocalGeometry ? [] : ['size'];
  // The line is required by local post-processing for ratio-sized items, but
  // fixed-size overrides intentionally do not need one. The type-specific
  // requirement is enforced after generation rather than in this shared
  // provider schema.
  const localGeometryRequired = isIntegratedBbox
    ? [...(isIntegratedBboxV2 ? ['geometry_scope'] : []), 'box_2d', 'bbox_confidence']
    : isLocalBboxArea
      ? ['bbox']
      : [];
  const generatedElementGeometryProperty = isLocalLineRatio
    ? { size_line: ELEMENT_SIZE_LINE_SCHEMA }
    : isLocalBboxArea
      ? { bbox: ELEMENT_BBOX_SCHEMA }
      : isIntegratedBbox
        ? {
          ...(isIntegratedBboxV2 ? { geometry_scope: INTEGRATED_BBOX_SCOPE_SCHEMA } : {}),
          box_2d: INTEGRATED_BBOX_COLLECTION_SCHEMA,
          bbox_confidence: INTEGRATED_BBOX_CONFIDENCE_COLLECTION_SCHEMA,
        }
      : isDirectDiameterAnchor
        ? {}
        : { bbox: ELEMENT_BBOX_SCHEMA };

  const schema = {
    type: Type.OBJECT,
    properties: {
      // Gemini rejects empty strings inside response-schema enum arrays. These
      // fields must allow "" for the canonical rejected shape, so the provider
      // schema describes the values and the strict post-generation validator
      // enforces the actual enum and cake-type/thickness combination.
      cakeType: {
        type: Type.STRING,
        description: `Accepted: ${GENERATED_ANALYSIS_CAKE_TYPES.join(', ')}. Rejected: empty string.`,
      },
      cakeThickness: {
        type: Type.STRING,
        description: [
          `Accepted values: ${GENERATED_ANALYSIS_CAKE_THICKNESSES.join(', ')}.`,
          'Use only these exact cakeType pairings:',
          '1 Tier = 3 in, 4 in, 5 in, or 6 in;',
          '2 Tier or 3 Tier = 4 in or 5 in;',
          'Square or Rectangle = 3 in or 4 in;',
          'Slab Cake = 6 in;',
          'every Fondant cake type, including tiered, Square Fondant, and Rectangle Fondant = 5 in or 6 in;',
          'Bento, Cupcake, or Bento Cupcake Set = 2 in.',
          'Rejected: empty string.',
        ].join(' '),
      },
      main_toppers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: mainTopperTypes,
              ...(isIntegratedBboxV2
                ? { description: 'Set geometry_scope first. unit rows use exact per-unit boxes; piped_cluster is allowed only for piped_flower types with quantity 1; icing_decorations may use treatment only for one continuous icing region with material icing and quantity 1; all other treatment types use the authoritative v2 treatment list.' }
                : isIntegratedBbox
                ? { description: `Use one box per visible discrete unit, capped at ${INTEGRATED_MAX_UNIT_BOXES} boxes. Aggregate full-region geometry is limited to: ${INTEGRATED_AGGREGATE_GEOMETRY_TYPES.join(', ')}.` }
                : {}),
            },
            material: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MATERIALS] },
            group_id: { type: Type.STRING },
            classification: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_CLASSIFICATIONS] },
            quantity: {
              type: Type.INTEGER,
              ...(isIntegratedBboxV2 ? {
                description: `unit requires exactly min(quantity, ${INTEGRATED_MAX_UNIT_BOXES}) individual boxes. piped_cluster requires quantity 1. icing_decorations treatment requires icing material and quantity 1.`,
              } : isIntegratedBbox ? {
                description: `For discrete rows, box_2d may contain up to min(quantity, ${INTEGRATED_MAX_UNIT_BOXES}) distinct visible-unit boxes. Never use one arrangement-wide box.`,
              } : {}),
            },
            description: { type: Type.STRING },
            color: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            },
            coverage: {
              type: Type.STRING,
              enum: [...GENERATED_PIPED_FLOWER_COVERAGES],
              description: isIntegratedBboxV2
                ? 'Required for piped_flowers_top with piped_cluster scope. It selects the fixed cluster price; the BBox does not.'
                : isIntegratedBbox
                  ? 'Required only for piped_flowers_top as existing treatment metadata. It does not determine size in integrated_bbox_v1.'
                : 'Required only for piped_flowers_top. Exact top-surface piped-flower coverage price band: small under 30%, medium 30% to under 60%, large 60% or more.',
            },
            ...generatedElementGeometryProperty,
            ...generatedSizeProperty,
            ...subtypeProperty,
          },
          required: ['type', 'material', 'group_id', 'classification', ...generatedSizeRequired, 'quantity', 'description', ...localGeometryRequired],
        },
      },
      support_elements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: supportElementTypes,
              ...(isIntegratedBboxV2
                ? { description: 'Set geometry_scope first. unit rows use exact per-unit boxes; piped_cluster is allowed only for piped_flower types with quantity 1; icing_decorations may use treatment only for one continuous icing region with material icing and quantity 1; all other treatment types use the authoritative v2 treatment list.' }
                : isIntegratedBbox
                ? { description: `Use one box per visible discrete unit, capped at ${INTEGRATED_MAX_UNIT_BOXES} boxes. Aggregate full-region geometry is limited to: ${INTEGRATED_AGGREGATE_GEOMETRY_TYPES.join(', ')}.` }
                : {}),
            },
            material: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MATERIALS] },
            group_id: { type: Type.STRING },
            color: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            },
            coverage: {
              type: Type.STRING,
              enum: [...GENERATED_PIPED_FLOWER_COVERAGES],
              description: isIntegratedBboxV2
                ? 'Required for piped_flowers_side with piped_cluster scope. It selects the fixed cluster price; the BBox does not.'
                : isIntegratedBbox
                  ? 'Required only for piped_flowers_side as existing treatment metadata. It does not determine size in integrated_bbox_v1.'
                : 'Required only for piped_flowers_side. Exact visible cake-side piped-flower coverage price band: small under 30%, medium 30% to under 60%, large 60% or more.',
            },
            quantity: {
              type: Type.INTEGER,
              ...(isIntegratedBboxV2 ? {
                description: `unit requires exactly min(quantity, ${INTEGRATED_MAX_UNIT_BOXES}) individual boxes. piped_cluster requires quantity 1. icing_decorations treatment requires icing material and quantity 1.`,
              } : isIntegratedBbox ? {
                description: `For discrete rows, box_2d may contain up to min(quantity, ${INTEGRATED_MAX_UNIT_BOXES}) distinct visible-unit boxes. Never use one arrangement-wide box.`,
              } : {}),
            },
            description: { type: Type.STRING },
            ...generatedElementGeometryProperty,
            ...generatedSizeProperty,
            ...subtypeProperty,
          },
          required: ['type', 'material', 'group_id', 'color', ...generatedSizeRequired, 'quantity', 'description', ...localGeometryRequired],
        },
      },
      cake_messages: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            type: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MESSAGE_TYPES] },
            color: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            position: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MESSAGE_POSITIONS] },
            ...(isIntegratedBbox
              ? {
                box_2d: INTEGRATED_BBOX_UNIT_SCHEMA,
                bbox_confidence: { type: Type.NUMBER, description: 'Confidence from 0 through 1 for this tight visible box.' },
              }
              : { bbox: ELEMENT_BBOX_SCHEMA }),
          },
          required: [
            'text', 'type', 'color', 'position',
            ...(isIntegratedBbox ? ['box_2d', 'bbox_confidence'] : []),
          ],
        },
      },
      icing_design: {
        type: Type.OBJECT,
        properties: {
          base: { type: Type.STRING, enum: [...SEARCH_ANALYSIS_ICING_BASES] },
          color_type: { type: Type.STRING, enum: [...SEARCH_ANALYSIS_COLOR_TYPES] },
          colors: {
            type: Type.OBJECT,
            properties: {
              side: {
                type: Type.STRING,
                enum: [...GENERATED_ANALYSIS_COLOR_HEXES],
                description: 'REQUIRED. Customer-facing dominant color. The swatch filter reads this. Must be a hex from the approved palette. See CATEGORY 5 side color rules.',
              },
              top: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
              gumpasteBaseBoardColor: {
                type: Type.STRING,
                enum: [...GENERATED_ANALYSIS_COLOR_HEXES],
                description: isIntegratedBbox
                  ? 'Required in every integrated_bbox_v1 response. When gumpasteBaseBoard is false, repeat the closest visible side color.'
                  : undefined,
              },
            },
            required: ['side', 'top', ...(isIntegratedBbox ? ['gumpasteBaseBoardColor'] : [])],
          },
          drip: { type: Type.BOOLEAN }, border_top: { type: Type.BOOLEAN },
          border_base: { type: Type.BOOLEAN },
          gumpasteBaseBoard: {
            type: Type.BOOLEAN,
            description: 'REQUIRED. True only when visual construction cues show that the cake board surface is fully or mostly covered by one continuous fondant/gumpaste layer. Board color alone does not decide this.',
          },
        },
        required: [
          'base',
          'color_type',
          'colors',
          'drip',
          'border_top',
          'border_base',
          'gumpasteBaseBoard',
        ],
      },
      keyword: { type: Type.STRING },
      ...(seoSchema === 'legacy_inline_seo' ? {
      alt_text: {
        type: Type.STRING,
        description: 'One factual visual sentence, ideally 80-140 characters and never more than 160. Character and franchise names are allowed when visually relevant.',
      },
      seo_title: { type: Type.STRING, description: 'SEO optimized title for the cake product.' },
      seo_description: {
        type: Type.STRING,
        description: 'Natural customer-facing cake description in 5 to 7 sentences. Do not include availability or lead-time claims.',
      },
      } : {}),
      ...(!isDirectDiameterAnchor && !isIntegratedBbox ? { cake_measurements: CAKE_MEASUREMENTS_SCHEMA } : {}),
      rejection: {
        type: Type.OBJECT,
        properties: {
          isRejected: { type: Type.BOOLEAN },
          reason: {
            type: Type.STRING,
            description: `Accepted: empty string. Rejected: exactly one of ${SEARCH_ANALYSIS_REJECTION_REASONS.join(', ')}.`,
          },
          message: { type: Type.STRING },
        },
        required: ['isRejected', 'reason', 'message'],
      },
    },
    required: [
      'cakeType',
      'cakeThickness',
      'main_toppers',
      'support_elements',
      'cake_messages',
      'icing_design',
      'keyword',
      ...(seoSchema === 'legacy_inline_seo' ? ['alt_text', 'seo_title', 'seo_description'] : []),
      'rejection',
    ],
  };

  return schema;
}

export function buildSearchAnalysisGenerationConfig(
  typeEnums: GeneratedAnalysisTypeEnums,
  sizeSchema: AnalysisGenerationSizeSchema = 'three_band',
  seoSchema: AnalysisGenerationSeoSchema = 'analysis_only',
) {
  const analysisSchema = buildSearchAnalysisResponseSchema(typeEnums, sizeSchema, seoSchema);
  return {
    systemInstruction: sizeSchema === 'integrated_bbox_v2'
      ? `${SYSTEM_INSTRUCTION}${INTEGRATED_BBOX_V2_SYSTEM_OVERRIDE}`
      : sizeSchema === 'integrated_bbox_v1'
        ? `${SYSTEM_INSTRUCTION}${INTEGRATED_BBOX_V1_SYSTEM_OVERRIDE}`
      : sizeSchema === 'ai_diameter_anchor'
        ? `${SYSTEM_INSTRUCTION}${DIRECT_DIAMETER_SYSTEM_OVERRIDE}`
        : SYSTEM_INSTRUCTION,
    responseMimeType: 'application/json',
    responseSchema: sizeSchema === 'integrated_bbox_v1' || sizeSchema === 'integrated_bbox_v2'
      ? {
        type: Type.OBJECT,
        properties: {
          analysis: analysisSchema,
          geometry: {
            type: Type.OBJECT,
            properties: {
              geometry_version: { type: Type.STRING, enum: [sizeSchema] },
              cake_diameter_line: INTEGRATED_LINE_SCHEMA,
              cake_height_line: INTEGRATED_LINE_SCHEMA,
            },
            // Measurement lines are intentionally optional here so the canonical
            // rejected response can omit them. Runtime validation requires them
            // for every accepted image.
            required: ['geometry_version'],
          },
        },
        required: ['analysis', 'geometry'],
      }
      : analysisSchema,
    temperature: 0,
    topP: 1,
    topK: 1,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  };
}

/**
 * Gemini occasionally emits the conditional board flag without its optional
 * color. Keep integrated analysis usable by carrying forward the closest
 * visible cake-side color; the final generated-analysis validator still
 * enforces that the resulting value is an approved palette color.
 */
function normalizeIntegratedGumpasteBoardColor(analysis: Record<string, unknown>): Record<string, unknown> {
  const icing = analysis.icing_design;
  if (!isRecord(icing) || icing.gumpasteBaseBoard !== true || !isRecord(icing.colors)) {
    return analysis;
  }
  if (icing.colors.gumpasteBaseBoardColor !== undefined) return analysis;

  const fallbackColor = icing.colors.side;
  if (typeof fallbackColor !== 'string') return analysis;

  console.warn('[AI Contract] Missing gumpasteBaseBoardColor; using the cake side color', {
    fallbackColor,
  });
  return {
    ...analysis,
    icing_design: {
      ...icing,
      colors: {
        ...icing.colors,
        gumpasteBaseBoardColor: fallbackColor,
      },
    },
  };
}

export function postProcessSearchAnalysisResult(
  result: unknown,
  typeEnums: GeneratedAnalysisTypeEnums,
  sizeSchema: AnalysisGenerationSizeSchema = 'three_band',
  seoSchema: AnalysisGenerationSeoSchema = 'analysis_only',
  waferPaperSideWaveVerification?: WhiteWaferPaperSideWaveVerification,
  options: { allowMissingCakeHeightLine?: boolean } = {},
): GeneratedCakeAnalysisResult {
  if (sizeSchema === 'integrated_bbox_v1' || sizeSchema === 'integrated_bbox_v2') {
    const integrated = validateIntegratedBboxResponse(result, sizeSchema, options);
    const reconciledResult = reconcileGeneratedCakeTypeThickness(integrated.analysis);
    const reconciledAnalysis = removeUnverifiedConditionedWaferPaperWaves(
      reconcileDescriptionTypes(removeExplicitSceneOnlyItems(reconciledResult), typeEnums),
      waferPaperSideWaveVerification,
    );
    const reconciledOutput = normalizeIntegratedGumpasteBoardColor(
      reconciledAnalysis as Record<string, unknown>,
    );
    // Revalidate after type/description reconciliation so a row whose type is
    // normalized into or out of an aggregate-treatment exception still has the
    // correct one-box versus per-unit geometry cardinality.
    const reconciledIntegrated = validateIntegratedBboxResponse({
      analysis: reconciledOutput as Record<string, unknown>,
      geometry: integrated.geometry,
    }, sizeSchema, options);
    const locallySized = applyIntegratedBboxSizing(reconciledIntegrated);
    return validateGeneratedCakeAnalysisResult(
      locallySized,
      typeEnums,
      seoSchema,
      { integratedBbox: true, integratedBboxV2: sizeSchema === 'integrated_bbox_v2' },
    );
  }
  const reconciledResult = reconcileGeneratedCakeTypeThickness(result);
  if (reconciledResult !== result && typeof result === 'object' && result !== null) {
    const generated = result as Record<string, unknown>;
    const reconciled = reconciledResult as Record<string, unknown>;
    console.warn('[AI Contract] Reconciled unsupported cake thickness', {
      cakeType: generated.cakeType,
      generatedThickness: generated.cakeThickness,
      reconciledThickness: reconciled.cakeThickness,
    });
  }
  const sizeNormalizedResult = sizeSchema === 'legacy_six_band'
    ? normalizeLegacyAnalysisPayload(reconciledResult as Record<string, unknown>)
    : reconciledResult;
  const reconciledOutput = removeUnverifiedConditionedWaferPaperWaves(
    reconcileDescriptionTypes(removeExplicitSceneOnlyItems(sizeNormalizedResult), typeEnums),
    waferPaperSideWaveVerification,
  );
  const locallySizedResult = sizeSchema === 'local_bbox_area'
    ? applyLocalBboxAreaSizing(reconciledOutput as Record<string, unknown>)
    : sizeSchema === 'local_line_ratio'
      ? applyLocalLineRatioSizing(reconciledOutput as Record<string, unknown>)
      : reconciledOutput;
  if (sizeSchema === 'ai_diameter_anchor') {
    const directResult = locallySizedResult as Record<string, unknown>;
    if (directResult.cake_measurements !== undefined) {
      throw new GeneratedAnalysisContractError(
        'direct diameter-anchor sizing must not include cake_measurements',
      );
    }
    for (const path of ['main_toppers', 'support_elements'] as const) {
      const items = directResult[path];
      if (!Array.isArray(items)) continue;
      for (const [index, item] of items.entries()) {
        if (isRecord(item) && (item.size_line !== undefined || item.bbox !== undefined)) {
          throw new GeneratedAnalysisContractError(
            `direct diameter-anchor sizing must not include ${path}[${index}] geometry`,
          );
        }
      }
    }
  }
  return validateGeneratedCakeAnalysisResult(
    locallySizedResult,
    typeEnums,
    seoSchema,
    sizeSchema === 'ai_diameter_anchor'
      ? { requireSizeForSizelessSupportElements: true }
      : undefined,
  );
}
