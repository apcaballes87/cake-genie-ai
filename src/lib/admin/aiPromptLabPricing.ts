import type { HybridAnalysisResult } from '@/types';
import { getCakeBasePriceOptions, mapAnalysisToPricingState } from '@/services/supabaseService';
import {
  calculatePriceFromDatabase,
  type PricingTraceEntry,
} from '@/services/pricingService.database';
import { roundDownToNearest99 } from '@/lib/utils/pricing';

export type AiPromptLabBasePriceOption = {
  size: string;
  basePrice: number;
  addOnPrice: number;
  total: number;
  isLowest: boolean;
};

export type AiPromptLabPricingResult = {
  addOnPrice: number;
  breakdown: { item: string; price: number }[];
  /** Object form is safe to serialize from the route response. */
  itemPrices: Record<string, number>;
  /** Prices keyed by stable analysis array position, for read-only lab cards. */
  analysisItemPrices: Record<string, number>;
  pricingTrace: PricingTraceEntry[];
  basePriceOptions: AiPromptLabBasePriceOption[];
};

/**
 * Prices an already validated lab analysis through the storefront's mapping,
 * database calculator and rounding rule. It performs reads only and deliberately
 * has no cache, cart, order, or prompt persistence hooks.
 */
export async function runAiPromptLabPricing(
  analysis: HybridAnalysisResult,
): Promise<AiPromptLabPricingResult> {
  const pricingState = mapAnalysisToPricingState(analysis);
  const baseOptions = await getCakeBasePriceOptions(
    pricingState.cakeInfo.type,
    pricingState.cakeInfo.thickness,
  );

  if (baseOptions.length === 0) {
    throw new Error(
      `No base-price options are available for ${pricingState.cakeInfo.type} (${pricingState.cakeInfo.thickness}).`,
    );
  }

  const optionResults = await Promise.all(baseOptions.map(async (option) => {
    // The selected base size is input to a small number of storefront rules
    // (notably photo toppers), so calculate every option rather than assuming
    // the add-on value is uniform.
    const result = await calculatePriceFromDatabase({
      ...pricingState,
      cakeInfo: { ...pricingState.cakeInfo, size: option.size },
    }, undefined, { trace: true });

    return {
      size: option.size,
      basePrice: option.price,
      addOnPrice: result.addOnPricing.addOnPrice,
      total: roundDownToNearest99(
        option.price + result.addOnPricing.addOnPrice,
        option.price,
      ),
      breakdown: result.addOnPricing.breakdown,
      itemPrices: result.itemPrices,
      pricingTrace: result.pricingTrace ?? [],
    };
  }));

  const lowestTotal = Math.min(...optionResults.map((option) => option.total));
  // Keep the diagnostics coherent: they describe the first lowest-priced size
  // shown as selected by the lab UI.
  const selected = optionResults.find((option) => option.total === lowestTotal)!;

  return {
    addOnPrice: selected.addOnPrice,
    breakdown: selected.breakdown,
    itemPrices: Object.fromEntries(selected.itemPrices),
    analysisItemPrices: Object.fromEntries([
      ...pricingState.mainToppers.map((item, index) => [
        `main_toppers:${index}`,
        selected.itemPrices.get(item.id) ?? 0,
      ]),
      ...pricingState.supportElements.map((item, index) => [
        `support_elements:${index}`,
        selected.itemPrices.get(item.id) ?? 0,
      ]),
    ]),
    pricingTrace: selected.pricingTrace,
    basePriceOptions: optionResults.map((option) => ({
      size: option.size,
      basePrice: option.basePrice,
      addOnPrice: option.addOnPrice,
      total: option.total,
      isLowest: option.total === lowestTotal,
    })),
  };
}
