// src/constants/pricingEnums.ts
// ===================================================
// SINGLE SOURCE OF TRUTH for Pricing Types
// ===================================================
// This file is the canonical reference for:
// 1. AI Prompt generation (geminiService.ts)
// 2. Analysis validation (validateAnalysis.ts)
// 3. Database pricing rules (pricing_rules table)
// 4. TypeScript types (types.ts)
// ===================================================

/**
 * Valid sizes for pricing rules
 * These MUST match the database pricing_rules.size column values
 */
export const VALID_SIZES = ['tiny', 'small', 'medium', 'large'] as const;
export type ValidSize = typeof VALID_SIZES[number];

/**
 * Main topper types for hero elements
 * Includes both current and legacy types for backward compatibility
 */
export const MAIN_TOPPER_TYPES = [
    // Current types
    'edible_3d_complex',
    'edible_3d_ordinary',
    'printout',
    'toy',
    'figurine',
    'cardstock',
    'edible_photo_top',
    'candle',
    'edible_2d_shapes',
    'edible_flowers',
    'icing_doodle',
    'icing_palette_knife',
    'icing_brush_stroke',
    'icing_splatter',
    'icing_minimalist_spread',
    'meringue_pop',
    'plastic_ball',
    // Legacy types from database for backward compatibility
    'edible_photo_print',
    'icing_decorations',
    'icing_doodle_intricate',
    'icing_palette_knife_intricate',
] as const;
export type MainTopperTypeEnum = typeof MAIN_TOPPER_TYPES[number];

/**
 * Support element types for decorations
 * Includes both current and legacy types for backward compatibility
 */
export const SUPPORT_ELEMENT_TYPES = [
    // Current types
    'edible_3d_support',
    'edible_2d_support',
    'chocolates',
    'sprinkles',
    'support_printout',
    'isomalt',
    'dragees',
    'edible_flowers',
    'edible_photo_side',
    'icing_doodle',
    'icing_palette_knife',
    'icing_brush_stroke',
    'icing_splatter',
    'icing_minimalist_spread',
    // Legacy types from database for backward compatibility
    'gumpaste_panel',
    'gumpaste_bundle',
    'edible_lollipops',
    'marshmallows',
    'plastic_ball_regular',
    'plastic_ball_disco',
    'icing_decorations',
    'edible_3d_ordinary',
    'printout',
] as const;
export type SupportElementTypeEnum = typeof SUPPORT_ELEMENT_TYPES[number];

/**
 * Subtypes per item type
 * Used for subtype-specific pricing (e.g., chocolates_ferrero costs more)
 */
export const SUBTYPES_BY_TYPE: Record<string, readonly string[]> = {
    chocolates: ['ferrero', 'oreo', 'kisses', 'm&ms'] as const,
    edible_3d_ordinary: ['ice_cream_cone'] as const,
    edible_flowers: ['flower_cluster'] as const,
} as const;

/**
 * Get all valid subtypes as a flat array
 */
export const ALL_SUBTYPES = Object.values(SUBTYPES_BY_TYPE).flat();

/**
 * Pricing categories for database lookup
 */
export const PRICING_CATEGORIES = [
    'main_topper',
    'support_element',
    'special',
    'message',
    'icing_feature',
] as const;
export type PricingCategory = typeof PRICING_CATEGORIES[number];

/**
 * Cake message types
 */
export const CAKE_MESSAGE_TYPES = [
    'gumpaste_letters',
    'icing_script',
    'printout',
    'cardstock',
] as const;
export type CakeMessageTypeEnum = typeof CAKE_MESSAGE_TYPES[number];

/**
 * Helper function to check if a type is valid
 */
export function isValidMainTopperType(type: string): type is MainTopperTypeEnum {
    return MAIN_TOPPER_TYPES.includes(type as MainTopperTypeEnum);
}

export function isValidSupportElementType(type: string): type is SupportElementTypeEnum {
    return SUPPORT_ELEMENT_TYPES.includes(type as SupportElementTypeEnum);
}

export function isValidSize(size: string): size is ValidSize {
    return VALID_SIZES.includes(size as ValidSize);
}

export function getValidSubtypesForType(type: string): readonly string[] {
    return SUBTYPES_BY_TYPE[type] || [];
}
