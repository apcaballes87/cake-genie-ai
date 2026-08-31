import type {
  CakeMessageTypeEnum,
  MainTopperTypeEnum,
  SupportElementTypeEnum,
  ValidSize,
} from '@/constants/pricingEnums';
import {
  CAKE_MESSAGE_TYPES,
  MAIN_TOPPER_TYPES,
  SUBTYPES_BY_TYPE,
  SUPPORT_ELEMENT_TYPES,
  VALID_SIZES,
} from '@/constants/pricingEnums';

export const GENERATED_ANALYSIS_CAKE_TYPES = [
  '1 Tier',
  '2 Tier',
  '3 Tier',
  '1 Tier Fondant',
  '2 Tier Fondant',
  '3 Tier Fondant',
  'Square',
  'Rectangle',
  'Slab Cake',
  'Bento',
  'Square Fondant',
  'Rectangle Fondant',
  'Cupcake',
  'Bento Cupcake Set',
] as const;

export const GENERATED_ANALYSIS_CAKE_THICKNESSES = [
  '2 in',
  '3 in',
  '4 in',
  '5 in',
  '6 in',
] as const;

export const GENERATED_ANALYSIS_MATERIALS = [
  'wax',
  'plastic',
  'cardstock',
  'photopaper',
  'waferpaper',
  'edible_fondant',
  'icing',
  'candy',
  'non-edible',
  'ceramic',
] as const;

export const GENERATED_ANALYSIS_ICING_BASES = ['soft_icing', 'fondant'] as const;
export const GENERATED_ANALYSIS_COLOR_TYPES = ['single', 'gradient', 'multicolor'] as const;
export const GENERATED_ANALYSIS_CLASSIFICATIONS = ['hero', 'support'] as const;
export const GENERATED_ANALYSIS_MESSAGE_POSITIONS = ['top', 'side', 'base_board'] as const;

export const GENERATED_ANALYSIS_REJECTION_MESSAGES = {
  not_a_cake: "This image doesn't appear to be a cake. Please upload a cake image.",
  multiple_cakes: 'Please upload a single cake image. This image contains multiple cakes.',
  cake_slice_only: "We can't price cakes that are 1 slice only. Please upload a whole cake design image.",
  complex_sculpture: 'This cake design is too complex for online pricing. Please contact us for a custom quote.',
  large_wedding_cake: 'Large wedding cakes require in-store consultation for accurate pricing.',
  selfie: "This is a selfie or portrait photo of humans. Let's make an edible photo cake!",
  payment_receipt: 'This looks like a payment receipt or screenshot. Please upload a cake design image instead.',
} as const;

export const GENERATED_ANALYSIS_REJECTION_REASONS = Object.keys(
  GENERATED_ANALYSIS_REJECTION_MESSAGES,
) as Array<keyof typeof GENERATED_ANALYSIS_REJECTION_MESSAGES>;

export const GENERATED_ANALYSIS_COLOR_HEXES = [
  '#8B0000',
  '#FF0000',
  '#FF7F50',
  '#FFA500',
  '#FFDAB9',
  '#FFD700',
  '#FFFF00',
  '#FFFFE0',
  '#F7E7CE',
  '#FFFFF0',
  '#F5F5DC',
  '#008000',
  '#90EE90',
  '#98FF98',
  '#008080',
  '#000080',
  '#0000FF',
  '#87CEEB',
  '#800080',
  '#E6E6FA',
  '#FF69B4',
  '#FFC0CB',
  '#FFB6C1',
  '#B76E79',
  '#8B4513',
  '#D2B48C',
  '#C0C0C0',
  '#FFFFFF',
  '#000000',
] as const;

export const GENERATED_ANALYSIS_THICKNESSES_BY_CAKE_TYPE = {
  '1 Tier': ['3 in', '4 in', '5 in', '6 in'],
  '2 Tier': ['4 in', '5 in'],
  '3 Tier': ['4 in', '5 in'],
  Square: ['3 in', '4 in'],
  Rectangle: ['3 in', '4 in'],
  'Slab Cake': ['6 in'],
  '1 Tier Fondant': ['5 in', '6 in'],
  '2 Tier Fondant': ['5 in', '6 in'],
  '3 Tier Fondant': ['5 in', '6 in'],
  Bento: ['2 in'],
  'Square Fondant': ['5 in', '6 in'],
  'Rectangle Fondant': ['5 in', '6 in'],
  Cupcake: ['2 in'],
  'Bento Cupcake Set': ['2 in'],
} as const satisfies Record<GeneratedCakeType, readonly GeneratedCakeThickness[]>;

const GENERATED_ANALYSIS_THICKNESS_INCHES = Object.fromEntries(
  GENERATED_ANALYSIS_CAKE_THICKNESSES.map((thickness) => [
    thickness,
    Number.parseInt(thickness, 10),
  ]),
) as Record<GeneratedCakeThickness, number>;

type LegacyGeneratedMainTopperType =
  | 'edible_photo_print'
  | 'icing_doodle_intricate'
  | 'icing_palette_knife_intricate';

const LEGACY_GENERATED_MAIN_TOPPER_TYPES = new Set<MainTopperTypeEnum>([
  'edible_photo_print',
  'icing_doodle_intricate',
  'icing_palette_knife_intricate',
]);

export const GENERATED_MAIN_TOPPER_TYPES = MAIN_TOPPER_TYPES.filter(
  (type) => !LEGACY_GENERATED_MAIN_TOPPER_TYPES.has(type),
) as Exclude<MainTopperTypeEnum, LegacyGeneratedMainTopperType>[];

export const GENERATED_SUPPORT_ELEMENT_TYPES = [
  ...SUPPORT_ELEMENT_TYPES,
].filter((type) => type !== 'plastic_ball') as Exclude<
  SupportElementTypeEnum,
  'plastic_ball'
>[];

export const GENERATED_ANALYSIS_SIZES = VALID_SIZES;
export const GENERATED_ANALYSIS_MESSAGE_TYPES = CAKE_MESSAGE_TYPES;
export const GENERATED_ANALYSIS_SUBTYPES_BY_TYPE = SUBTYPES_BY_TYPE;

export type GeneratedCakeType = typeof GENERATED_ANALYSIS_CAKE_TYPES[number];
export type GeneratedCakeThickness = typeof GENERATED_ANALYSIS_CAKE_THICKNESSES[number];
export type GeneratedAnalysisMaterial = typeof GENERATED_ANALYSIS_MATERIALS[number];
export type GeneratedAnalysisRejectionReason = keyof typeof GENERATED_ANALYSIS_REJECTION_MESSAGES;

export interface GeneratedMainTopper {
  type: Exclude<MainTopperTypeEnum, LegacyGeneratedMainTopperType>;
  material: GeneratedAnalysisMaterial;
  group_id: string;
  classification: typeof GENERATED_ANALYSIS_CLASSIFICATIONS[number];
  size: ValidSize;
  quantity: number;
  description: string;
  color?: string;
  colors?: string[];
  subtype?: string;
}

export interface GeneratedSupportElement {
  type: Exclude<SupportElementTypeEnum, 'plastic_ball'>;
  material: GeneratedAnalysisMaterial;
  group_id: string;
  color: string;
  colors?: string[];
  size: ValidSize;
  quantity: number;
  description: string;
  subtype?: string;
}

export interface GeneratedCakeMessage {
  text: string;
  type: CakeMessageTypeEnum;
  color: string;
  position: typeof GENERATED_ANALYSIS_MESSAGE_POSITIONS[number];
}

export interface GeneratedIcingDesign {
  base: typeof GENERATED_ANALYSIS_ICING_BASES[number];
  color_type: typeof GENERATED_ANALYSIS_COLOR_TYPES[number];
  colors: {
    side: string;
    top: string;
    gumpasteBaseBoardColor?: string;
  };
  drip: boolean;
  border_top: boolean;
  border_base: boolean;
  gumpasteBaseBoard: boolean;
}

interface GeneratedCakeAnalysisFields {
  main_toppers: GeneratedMainTopper[];
  support_elements: GeneratedSupportElement[];
  cake_messages: GeneratedCakeMessage[];
  icing_design: GeneratedIcingDesign;
}

export interface GeneratedAcceptedCakeAnalysisResult extends GeneratedCakeAnalysisFields {
  cakeType: GeneratedCakeType;
  cakeThickness: GeneratedCakeThickness;
  keyword: string;
  alt_text: string;
  seo_title: string;
  seo_description: string;
  rejection: {
    isRejected: false;
    reason: '';
    message: '';
  };
}

type GeneratedRejectedAnalysisRejection = {
  [Reason in GeneratedAnalysisRejectionReason]: {
    isRejected: true;
    reason: Reason;
    message: typeof GENERATED_ANALYSIS_REJECTION_MESSAGES[Reason];
  };
}[GeneratedAnalysisRejectionReason];

export interface GeneratedRejectedCakeAnalysisResult extends GeneratedCakeAnalysisFields {
  cakeType: '';
  cakeThickness: '';
  main_toppers: [];
  support_elements: [];
  cake_messages: [];
  icing_design: {
    base: 'soft_icing';
    color_type: 'single';
    colors: {
      side: '#FFFFFF';
      top: '#FFFFFF';
    };
    drip: false;
    border_top: false;
    border_base: false;
    gumpasteBaseBoard: false;
  };
  keyword: '';
  alt_text: '';
  seo_title: '';
  seo_description: '';
  rejection: GeneratedRejectedAnalysisRejection;
}

export type GeneratedCakeAnalysisResult =
  | GeneratedAcceptedCakeAnalysisResult
  | GeneratedRejectedCakeAnalysisResult;

export function isRejectedGeneratedCakeAnalysis(
  result: GeneratedCakeAnalysisResult,
): result is GeneratedRejectedCakeAnalysisResult {
  return result.rejection.isRejected;
}

export type GeneratedAnalysisTypeEnums = {
  mainTopperTypes: string[];
  supportElementTypes: string[];
  subtypesByType?: Record<string, string[]>;
};

export function reconcileCakeThicknessForType(
  cakeType: unknown,
  cakeThickness: unknown,
): GeneratedCakeThickness | null {
  if (
    typeof cakeType !== 'string'
    || !GENERATED_ANALYSIS_CAKE_TYPES.includes(cakeType as GeneratedCakeType)
  ) {
    return null;
  }

  const canonicalCakeType = cakeType as GeneratedCakeType;
  const allowedThicknesses = GENERATED_ANALYSIS_THICKNESSES_BY_CAKE_TYPE[
    canonicalCakeType
  ] as readonly GeneratedCakeThickness[];
  if (
    typeof cakeThickness !== 'string'
    || !GENERATED_ANALYSIS_CAKE_THICKNESSES.includes(cakeThickness as GeneratedCakeThickness)
  ) {
    return allowedThicknesses[0];
  }

  const canonicalThickness = cakeThickness as GeneratedCakeThickness;
  if (allowedThicknesses.includes(canonicalThickness)) {
    return canonicalThickness;
  }

  const observedInches = GENERATED_ANALYSIS_THICKNESS_INCHES[canonicalThickness];
  return allowedThicknesses.reduce((nearest, candidate) => {
    const nearestDistance = Math.abs(
      GENERATED_ANALYSIS_THICKNESS_INCHES[nearest] - observedInches,
    );
    const candidateDistance = Math.abs(
      GENERATED_ANALYSIS_THICKNESS_INCHES[candidate] - observedInches,
    );
    return candidateDistance < nearestDistance ? candidate : nearest;
  });
}

export function reconcileGeneratedCakeTypeThickness(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.rejection) || value.rejection.isRejected !== false) {
    return value;
  }

  const cakeType = value.cakeType;
  const cakeThickness = value.cakeThickness;
  if (
    typeof cakeType !== 'string'
    || !GENERATED_ANALYSIS_CAKE_TYPES.includes(cakeType as GeneratedCakeType)
    || typeof cakeThickness !== 'string'
    || !GENERATED_ANALYSIS_CAKE_THICKNESSES.includes(cakeThickness as GeneratedCakeThickness)
  ) {
    return value;
  }

  const reconciledThickness = reconcileCakeThicknessForType(cakeType, cakeThickness);
  if (!reconciledThickness || reconciledThickness === cakeThickness) {
    return value;
  }

  return {
    ...value,
    cakeThickness: reconciledThickness,
  };
}

const TOP_LEVEL_KEYS = [
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
] as const;
const MAIN_TOPPER_KEYS = [
  'type',
  'material',
  'group_id',
  'classification',
  'size',
  'quantity',
  'description',
  'color',
  'colors',
  'subtype',
] as const;
const SUPPORT_ELEMENT_KEYS = [
  'type',
  'material',
  'group_id',
  'color',
  'colors',
  'size',
  'quantity',
  'description',
  'subtype',
] as const;
const CAKE_MESSAGE_KEYS = ['text', 'type', 'color', 'position'] as const;
const ICING_DESIGN_KEYS = [
  'base',
  'color_type',
  'colors',
  'drip',
  'border_top',
  'border_base',
  'gumpasteBaseBoard',
] as const;
const ICING_COLOR_KEYS = ['side', 'top', 'gumpasteBaseBoardColor'] as const;
const REJECTION_KEYS = ['isRejected', 'reason', 'message'] as const;

function fail(path: string, detail: string): never {
  throw new GeneratedAnalysisContractError(`${path}: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) fail(path, 'must be an object');
  return value;
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  path: string,
) {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (extra.length) fail(path, `contains unsupported field(s): ${extra.join(', ')}`);
  const missing = required.filter((key) => !(key in value));
  if (missing.length) fail(path, `is missing required field(s): ${missing.join(', ')}`);
}

function requireString(value: unknown, path: string, allowBlank = false): string {
  if (typeof value !== 'string') fail(path, 'must be a string');
  if (!allowBlank && !value.trim()) fail(path, 'must not be blank');
  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean');
  return value;
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  const stringValue = requireString(value, path);
  if (!allowed.includes(stringValue as T)) {
    fail(path, `must be one of: ${allowed.join(', ')}`);
  }
  return stringValue as T;
}

function requirePositiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    fail(path, 'must be a positive integer');
  }
  return Number(value);
}

function requirePaletteHex(value: unknown, path: string): string {
  return requireEnum(value, GENERATED_ANALYSIS_COLOR_HEXES, path);
}

function optionalPaletteHexArray(value: unknown, path: string) {
  if (value === undefined) return;
  if (!Array.isArray(value)) fail(path, 'must be an array');
  value.forEach((hex, index) => requirePaletteHex(hex, `${path}[${index}]`));
}

export function mergeGeneratedAnalysisSubtypeMap(
  dynamic?: Record<string, string[]>,
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  for (const [type, subtypes] of Object.entries(GENERATED_ANALYSIS_SUBTYPES_BY_TYPE)) {
    merged[type] = [...subtypes];
  }
  for (const [type, subtypes] of Object.entries(dynamic ?? {})) {
    merged[type] = [...new Set([...(merged[type] ?? []), ...subtypes])];
  }
  return merged;
}

function validateOptionalSubtype(
  item: Record<string, unknown>,
  type: string,
  subtypeMap: Record<string, string[]>,
  path: string,
) {
  if (item.subtype === undefined) return;
  const subtype = requireString(item.subtype, `${path}.subtype`);
  const allowed = subtypeMap[type] ?? [];
  if (!allowed.includes(subtype)) {
    fail(`${path}.subtype`, allowed.length
      ? `must be one of ${allowed.join(', ')} for type ${type}`
      : `is not supported for type ${type}`);
  }
}

function validateMainTopper(
  value: unknown,
  index: number,
  typeEnums: GeneratedAnalysisTypeEnums,
  subtypeMap: Record<string, string[]>,
) {
  const path = `main_toppers[${index}]`;
  const item = requireRecord(value, path);
  requireExactKeys(
    item,
    MAIN_TOPPER_KEYS,
    ['type', 'material', 'group_id', 'classification', 'size', 'quantity', 'description'],
    path,
  );
  const type = requireEnum(item.type, typeEnums.mainTopperTypes, `${path}.type`);
  requireEnum(item.material, GENERATED_ANALYSIS_MATERIALS, `${path}.material`);
  requireString(item.group_id, `${path}.group_id`);
  requireEnum(item.classification, GENERATED_ANALYSIS_CLASSIFICATIONS, `${path}.classification`);
  requireEnum(item.size, GENERATED_ANALYSIS_SIZES, `${path}.size`);
  requirePositiveInteger(item.quantity, `${path}.quantity`);
  requireString(item.description, `${path}.description`);
  if (item.color !== undefined) requirePaletteHex(item.color, `${path}.color`);
  optionalPaletteHexArray(item.colors, `${path}.colors`);
  validateOptionalSubtype(item, type, subtypeMap, path);
}

function validateSupportElement(
  value: unknown,
  index: number,
  typeEnums: GeneratedAnalysisTypeEnums,
  subtypeMap: Record<string, string[]>,
) {
  const path = `support_elements[${index}]`;
  const item = requireRecord(value, path);
  requireExactKeys(
    item,
    SUPPORT_ELEMENT_KEYS,
    ['type', 'material', 'group_id', 'color', 'size', 'quantity', 'description'],
    path,
  );
  const type = requireEnum(item.type, typeEnums.supportElementTypes, `${path}.type`);
  requireEnum(item.material, GENERATED_ANALYSIS_MATERIALS, `${path}.material`);
  requireString(item.group_id, `${path}.group_id`);
  requirePaletteHex(item.color, `${path}.color`);
  optionalPaletteHexArray(item.colors, `${path}.colors`);
  requireEnum(item.size, GENERATED_ANALYSIS_SIZES, `${path}.size`);
  requirePositiveInteger(item.quantity, `${path}.quantity`);
  requireString(item.description, `${path}.description`);
  validateOptionalSubtype(item, type, subtypeMap, path);
}

function validateCakeMessage(value: unknown, index: number) {
  const path = `cake_messages[${index}]`;
  const item = requireRecord(value, path);
  requireExactKeys(item, CAKE_MESSAGE_KEYS, CAKE_MESSAGE_KEYS, path);
  requireString(item.text, `${path}.text`);
  requireEnum(item.type, GENERATED_ANALYSIS_MESSAGE_TYPES, `${path}.type`);
  requirePaletteHex(item.color, `${path}.color`);
  requireEnum(item.position, GENERATED_ANALYSIS_MESSAGE_POSITIONS, `${path}.position`);
}

function validateIcingDesign(value: unknown) {
  const icing = requireRecord(value, 'icing_design');
  requireExactKeys(icing, ICING_DESIGN_KEYS, ICING_DESIGN_KEYS, 'icing_design');
  requireEnum(icing.base, GENERATED_ANALYSIS_ICING_BASES, 'icing_design.base');
  requireEnum(icing.color_type, GENERATED_ANALYSIS_COLOR_TYPES, 'icing_design.color_type');
  const colors = requireRecord(icing.colors, 'icing_design.colors');
  requireExactKeys(colors, ICING_COLOR_KEYS, ['side', 'top'], 'icing_design.colors');
  requirePaletteHex(colors.side, 'icing_design.colors.side');
  requirePaletteHex(colors.top, 'icing_design.colors.top');
  if (colors.gumpasteBaseBoardColor !== undefined) {
    requirePaletteHex(colors.gumpasteBaseBoardColor, 'icing_design.colors.gumpasteBaseBoardColor');
  }
  requireBoolean(icing.drip, 'icing_design.drip');
  requireBoolean(icing.border_top, 'icing_design.border_top');
  requireBoolean(icing.border_base, 'icing_design.border_base');
  const hasGumpasteBaseBoard = requireBoolean(
    icing.gumpasteBaseBoard,
    'icing_design.gumpasteBaseBoard',
  );
  if (hasGumpasteBaseBoard && colors.gumpasteBaseBoardColor === undefined) {
    fail(
      'icing_design.colors.gumpasteBaseBoardColor',
      'is required when gumpasteBaseBoard is true',
    );
  }
}

function validateRejection(value: unknown) {
  const rejection = requireRecord(value, 'rejection');
  requireExactKeys(rejection, REJECTION_KEYS, REJECTION_KEYS, 'rejection');
  const isRejected = requireBoolean(rejection.isRejected, 'rejection.isRejected');
  const reason = requireString(rejection.reason, 'rejection.reason', true);
  const message = requireString(rejection.message, 'rejection.message', true);

  if (!isRejected) {
    if (reason !== '' || message !== '') {
      fail('rejection', 'accepted analyses must use blank reason and message');
    }
    return { isRejected, reason, message };
  }

  if (!GENERATED_ANALYSIS_REJECTION_REASONS.includes(reason as GeneratedAnalysisRejectionReason)) {
    fail('rejection.reason', `must be one of: ${GENERATED_ANALYSIS_REJECTION_REASONS.join(', ')}`);
  }
  const expectedMessage = GENERATED_ANALYSIS_REJECTION_MESSAGES[
    reason as GeneratedAnalysisRejectionReason
  ];
  if (message !== expectedMessage) {
    fail('rejection.message', `must match the canonical message for ${reason}`);
  }
  return { isRejected, reason, message };
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

export class GeneratedAnalysisContractError extends Error {
  constructor(message: string) {
    super(`Invalid generated cake analysis: ${message}`);
    this.name = 'GeneratedAnalysisContractError';
  }
}

export function validateGeneratedCakeAnalysisResult(
  value: unknown,
  typeEnums: GeneratedAnalysisTypeEnums,
): GeneratedCakeAnalysisResult {
  const result = requireRecord(value, 'analysis');
  requireExactKeys(result, TOP_LEVEL_KEYS, TOP_LEVEL_KEYS, 'analysis');
  const rejection = validateRejection(result.rejection);
  validateIcingDesign(result.icing_design);

  const mainToppers = requireArray(result.main_toppers, 'main_toppers');
  const supportElements = requireArray(result.support_elements, 'support_elements');
  const cakeMessages = requireArray(result.cake_messages, 'cake_messages');
  const subtypeMap = mergeGeneratedAnalysisSubtypeMap(typeEnums.subtypesByType);
  const canonicalTypeEnums: GeneratedAnalysisTypeEnums = {
    mainTopperTypes: typeEnums.mainTopperTypes.filter(
      (type) => GENERATED_MAIN_TOPPER_TYPES.includes(type as never),
    ),
    supportElementTypes: typeEnums.supportElementTypes.filter(
      (type) => GENERATED_SUPPORT_ELEMENT_TYPES.includes(type as never),
    ),
    subtypesByType: typeEnums.subtypesByType,
  };

  mainToppers.forEach((item, index) => validateMainTopper(item, index, canonicalTypeEnums, subtypeMap));
  supportElements.forEach((item, index) => validateSupportElement(item, index, canonicalTypeEnums, subtypeMap));
  cakeMessages.forEach(validateCakeMessage);

  const cakeType = requireString(result.cakeType, 'cakeType', rejection.isRejected);
  const cakeThickness = requireString(result.cakeThickness, 'cakeThickness', rejection.isRejected);
  const keyword = requireString(result.keyword, 'keyword', rejection.isRejected);
  const altText = requireString(result.alt_text, 'alt_text', rejection.isRejected);
  const seoTitle = requireString(result.seo_title, 'seo_title', rejection.isRejected);
  const seoDescription = requireString(result.seo_description, 'seo_description', rejection.isRejected);

  if (rejection.isRejected) {
    const icing = result.icing_design as Record<string, unknown>;
    const icingColors = icing.colors as Record<string, unknown>;
    if (
      cakeType !== ''
      || cakeThickness !== ''
      || keyword !== ''
      || altText !== ''
      || seoTitle !== ''
      || seoDescription !== ''
      || mainToppers.length
      || supportElements.length
      || cakeMessages.length
      || icing.base !== 'soft_icing'
      || icing.color_type !== 'single'
      || icingColors.side !== '#FFFFFF'
      || icingColors.top !== '#FFFFFF'
      || icingColors.gumpasteBaseBoardColor !== undefined
      || icing.drip !== false
      || icing.border_top !== false
      || icing.border_base !== false
      || icing.gumpasteBaseBoard !== false
    ) {
      fail(
        'analysis',
        'rejected analyses must use the canonical empty fields and default icing design',
      );
    }
    return result as unknown as GeneratedCakeAnalysisResult;
  }

  const canonicalCakeType = requireEnum(
    cakeType,
    GENERATED_ANALYSIS_CAKE_TYPES,
    'cakeType',
  );
  const canonicalThickness = requireEnum(
    cakeThickness,
    GENERATED_ANALYSIS_CAKE_THICKNESSES,
    'cakeThickness',
  );
  const allowedThicknesses = GENERATED_ANALYSIS_THICKNESSES_BY_CAKE_TYPE[
    canonicalCakeType
  ] as readonly GeneratedCakeThickness[];
  if (!allowedThicknesses.includes(canonicalThickness)) {
    fail('cakeThickness', `${canonicalThickness} is not supported for ${canonicalCakeType}`);
  }

  const icing = result.icing_design as Record<string, unknown>;
  const expectedBase = canonicalCakeType.includes('Fondant') ? 'fondant' : 'soft_icing';
  if (icing.base !== expectedBase) {
    fail('icing_design.base', `${canonicalCakeType} requires ${expectedBase}`);
  }

  return result as unknown as GeneratedCakeAnalysisResult;
}
