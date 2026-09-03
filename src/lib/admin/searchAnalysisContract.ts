import { ThinkingLevel, Type } from '@google/genai';

import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import {
  GENERATED_ANALYSIS_CAKE_THICKNESSES,
  GENERATED_ANALYSIS_CAKE_TYPES,
  GENERATED_ANALYSIS_CLASSIFICATIONS,
  GENERATED_ANALYSIS_COLOR_HEXES,
  GENERATED_ANALYSIS_COLOR_TYPES,
  GENERATED_ANALYSIS_ICING_BASES,
  GENERATED_ANALYSIS_MATERIALS,
  GENERATED_ANALYSIS_MESSAGE_POSITIONS,
  GENERATED_ANALYSIS_MESSAGE_TYPES,
  GENERATED_ANALYSIS_REJECTION_REASONS,
  GENERATED_ANALYSIS_SIZES,
  GENERATED_MAIN_TOPPER_TYPES,
  GENERATED_SUPPORT_ELEMENT_TYPES,
  mergeGeneratedAnalysisSubtypeMap,
  reconcileGeneratedCakeTypeThickness,
  validateGeneratedCakeAnalysisResult,
  type GeneratedAnalysisTypeEnums,
  type GeneratedCakeAnalysisResult,
} from '@/lib/ai/generatedAnalysisContract';
import { normalizeLegacyAnalysisPayload } from '@/lib/ai/analysisSize';

export const SEARCH_ANALYSIS_REJECTION_REASONS = GENERATED_ANALYSIS_REJECTION_REASONS;
export const SEARCH_ANALYSIS_ICING_BASES = GENERATED_ANALYSIS_ICING_BASES;
export const SEARCH_ANALYSIS_COLOR_TYPES = GENERATED_ANALYSIS_COLOR_TYPES;

export type AnalysisGenerationSizeSchema = 'legacy_six_band' | 'three_band';

const LEGACY_GENERATION_SIZES = ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'] as const;

/**
 * v3.66 can safely run during the compatibility deploy. Its six-band response
 * is immediately collapsed in memory; v3.67+ is constrained to three bands at
 * the provider schema boundary.
 */
export function getAnalysisGenerationSizeSchema(promptVersion: string): AnalysisGenerationSizeSchema {
  if (promptVersion === 'fallback') return 'three_band';
  const match = promptVersion.match(/^(?:v)?(\d+)\.(\d+)$/i);
  if (!match) return 'legacy_six_band';
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
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

/**
 * This priced type is valid only for separately visible full-height wafer-paper
 * sheets. Text-only repair cannot establish those visual facts, so never add a
 * wave row from generated SEO/alt wording. Instead, fail closed by removing a
 * model-emitted wave row unless its own description confirms wafer material,
 * vertical placement, loose wavy edges, and a repeated/full-height side wrap.
 * This operates only on fresh generation results.
 */
function removeUnverifiedConditionedWaferPaperWaves(result: unknown): unknown {
  if (!isRecord(result) || !Array.isArray(result.support_elements)) return result;

  if (isRecord(result.rejection) && result.rejection.isRejected === true) return result;

  const supportElements = result.support_elements.filter((element) => (
    !isRecord(element)
    || element.type !== 'edible_photo_side_wave'
    || (typeof element.description === 'string' && hasDirectWaferPaperWaveEvidence(element.description))
  ));

  return supportElements.length === result.support_elements.length
    ? result
    : { ...result, support_elements: supportElements };
}

export function buildSearchAnalysisResponseSchema(
  typeEnums: GeneratedAnalysisTypeEnums,
  sizeSchema: AnalysisGenerationSizeSchema = 'three_band',
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

  return {
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
            type: { type: Type.STRING, enum: mainTopperTypes },
            material: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MATERIALS] },
            group_id: { type: Type.STRING },
            classification: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_CLASSIFICATIONS] },
            size: { type: Type.STRING, enum: [...generationSizes] },
            quantity: { type: Type.INTEGER },
            description: { type: Type.STRING },
            color: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            },
            ...subtypeProperty,
          },
          required: ['type', 'material', 'group_id', 'classification', 'size', 'quantity', 'description'],
        },
      },
      support_elements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: supportElementTypes },
            material: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_MATERIALS] },
            group_id: { type: Type.STRING },
            color: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: [...GENERATED_ANALYSIS_COLOR_HEXES] },
            },
            size: { type: Type.STRING, enum: [...generationSizes] },
            quantity: { type: Type.INTEGER },
            description: { type: Type.STRING },
            ...subtypeProperty,
          },
          required: ['type', 'material', 'group_id', 'color', 'size', 'quantity', 'description'],
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
          },
          required: ['text', 'type', 'color', 'position'],
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
              },
            },
            required: ['side', 'top'],
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
      alt_text: {
        type: Type.STRING,
        description: 'One factual visual sentence, ideally 80-140 characters and never more than 160. Character and franchise names are allowed when visually relevant.',
      },
      seo_title: { type: Type.STRING, description: 'SEO optimized title for the cake product.' },
      seo_description: {
        type: Type.STRING,
        description: 'Natural customer-facing cake description in 5 to 7 sentences. Do not include availability or lead-time claims.',
      },
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
      'alt_text',
      'seo_title',
      'seo_description',
      'rejection',
    ],
  };
}

export function buildSearchAnalysisGenerationConfig(
  typeEnums: GeneratedAnalysisTypeEnums,
  sizeSchema: AnalysisGenerationSizeSchema = 'three_band',
) {
  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: 'application/json',
    responseSchema: buildSearchAnalysisResponseSchema(typeEnums, sizeSchema),
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  };
}

export function postProcessSearchAnalysisResult(
  result: unknown,
  typeEnums: GeneratedAnalysisTypeEnums,
  sizeSchema: AnalysisGenerationSizeSchema = 'three_band',
): GeneratedCakeAnalysisResult {
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
  return validateGeneratedCakeAnalysisResult(
    removeUnverifiedConditionedWaferPaperWaves(
      reconcileDescriptionTypes(removeExplicitSceneOnlyItems(sizeNormalizedResult), typeEnums),
    ),
    typeEnums,
  );
}
