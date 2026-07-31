import type { HybridAnalysisResult, MainTopper, MainTopperType } from '@/types';

export const DEFAULT_PRINTOUT_SOURCE_TYPES = [
  'toy',
  'figurine',
  'plastic_ball',
] as const satisfies readonly MainTopperType[];

const defaultPrintoutSourceTypes = new Set<MainTopperType>(DEFAULT_PRINTOUT_SOURCE_TYPES);

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

export function normalizeAnalysisForDefaultFulfillment(
  analysis: HybridAnalysisResult,
): HybridAnalysisResult {
  return {
    ...analysis,
    main_toppers: (analysis.main_toppers ?? []).map(
      normalizeMainTopperForDefaultFulfillment,
    ),
    support_elements: [...(analysis.support_elements ?? [])],
    cake_messages: [...(analysis.cake_messages ?? [])],
    icing_design: analysis.icing_design
      ? {
          ...analysis.icing_design,
          colors: { ...analysis.icing_design.colors },
        }
      : analysis.icing_design,
  };
}
