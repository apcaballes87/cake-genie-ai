import type {
  HybridAnalysisResult,
  MainTopper,
  MainTopperType,
  SupportElement,
  SupportElementType,
} from '@/types';

export const DEFAULT_PRINTOUT_SOURCE_TYPES = [
  'toy',
  'figurine',
  'plastic_ball',
] as const satisfies readonly MainTopperType[];

const defaultPrintoutSourceTypes = new Set<MainTopperType>(DEFAULT_PRINTOUT_SOURCE_TYPES);
const legacyEdibleFlowerSourceTypes = new Set<SupportElementType>([
  'fresh_flowers',
  'artificial_flowers',
]);

/**
 * Converts raw physical topper observations into the default fulfillable option.
 *
 * The function is intentionally non-mutating: callers may persist the original
 * analysis while using the returned copy for initial UI state or pricing.
 */
export function normalizeMainTopperForDefaultFulfillment<T extends MainTopper>(
  topper: T,
): T {
  if (!defaultPrintoutSourceTypes.has(topper.type)) return { ...topper };

  const sourceType = topper.type;
  return {
    ...topper,
    type: 'printout',
    original_type: topper.original_type ?? sourceType,
    printout_source_type: topper.printout_source_type ?? sourceType,
  };
}

/**
 * Converts obsolete non-edible flower classifications into the one edible
 * flower fulfillment type without mutating the stored source analysis.
 */
export function normalizeSupportElementForDefaultFulfillment<T extends SupportElement>(
  supportElement: T,
): T {
  if (!legacyEdibleFlowerSourceTypes.has(supportElement.type)) {
    return { ...supportElement };
  }

  const sourceType = supportElement.type;
  return {
    ...supportElement,
    type: 'edible_flowers',
    material: 'edible_fondant',
    original_type: supportElement.original_type ?? sourceType,
  };
}

export function normalizeAnalysisForDefaultFulfillment(
  analysis: HybridAnalysisResult,
): HybridAnalysisResult {
  return {
    ...analysis,
    main_toppers: (analysis.main_toppers ?? []).map(
      normalizeMainTopperForDefaultFulfillment,
    ),
    support_elements: (analysis.support_elements ?? []).map(
      normalizeSupportElementForDefaultFulfillment,
    ),
    cake_messages: [...(analysis.cake_messages ?? [])],
    icing_design: analysis.icing_design
      ? {
          ...analysis.icing_design,
          colors: { ...analysis.icing_design.colors },
        }
      : analysis.icing_design,
  };
}
