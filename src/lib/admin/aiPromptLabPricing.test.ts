import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HybridAnalysisResult } from '@/types';

const mocks = vi.hoisted(() => ({
  getCakeBasePriceOptions: vi.fn(),
  mapAnalysisToPricingState: vi.fn(),
  calculatePriceFromDatabase: vi.fn(),
}));

vi.mock('@/services/supabaseService', () => ({
  getCakeBasePriceOptions: mocks.getCakeBasePriceOptions,
  mapAnalysisToPricingState: mocks.mapAnalysisToPricingState,
}));

vi.mock('@/services/pricingService.database', () => ({
  calculatePriceFromDatabase: mocks.calculatePriceFromDatabase,
}));

import { runAiPromptLabPricing } from './aiPromptLabPricing';

describe('runAiPromptLabPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the storefront mapping/calculator for every base option and exposes the lowest total trace', async () => {
    const pricingState = {
      mainToppers: [], supportElements: [], cakeMessages: [], icingDesign: {},
      cakeInfo: { type: '1 Tier', thickness: '3 in', size: '6" Round', flavors: [] },
    };
    mocks.mapAnalysisToPricingState.mockReturnValue(pricingState);
    mocks.getCakeBasePriceOptions.mockResolvedValue([
      { size: '6" Round', price: 1200 },
      { size: '8" Round', price: 1600 },
    ]);
    mocks.calculatePriceFromDatabase
      .mockResolvedValueOnce({
        addOnPricing: { addOnPrice: 300, breakdown: [{ item: 'Flowers', price: 300 }] },
        itemPrices: new Map([['flower', 300]]), pricingTrace: [{ itemId: 'flower', amount: 300 }],
      })
      .mockResolvedValueOnce({
        addOnPricing: { addOnPrice: 400, breakdown: [{ item: 'Flowers', price: 400 }] },
        itemPrices: new Map([['flower', 400]]), pricingTrace: [{ itemId: 'flower', amount: 400 }],
      });

    const result = await runAiPromptLabPricing({} as HybridAnalysisResult);

    expect(mocks.getCakeBasePriceOptions).toHaveBeenCalledWith('1 Tier', '3 in');
    expect(mocks.calculatePriceFromDatabase).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ cakeInfo: expect.objectContaining({ size: '6" Round' }) }),
      undefined,
      { trace: true },
    );
    expect(result.basePriceOptions).toEqual([
      { size: '6" Round', basePrice: 1200, addOnPrice: 300, total: 1499, isLowest: true },
      { size: '8" Round', basePrice: 1600, addOnPrice: 400, total: 1999, isLowest: false },
    ]);
    expect(result.addOnPrice).toBe(300);
    expect(result.itemPrices).toEqual({ flower: 300 });
    expect(result.pricingTrace).toEqual([{ itemId: 'flower', amount: 300 }]);
  });

  it('fails before pricing when the storefront has no valid base size', async () => {
    mocks.mapAnalysisToPricingState.mockReturnValue({
      mainToppers: [], supportElements: [], cakeMessages: [], icingDesign: {},
      cakeInfo: { type: '1 Tier', thickness: '3 in', size: '6" Round', flavors: [] },
    });
    mocks.getCakeBasePriceOptions.mockResolvedValue([]);

    await expect(runAiPromptLabPricing({} as HybridAnalysisResult))
      .rejects.toThrow('No base-price options are available');
    expect(mocks.calculatePriceFromDatabase).not.toHaveBeenCalled();
  });

  it('keys item prices to the matching analysis array positions for lab result cards', async () => {
    mocks.mapAnalysisToPricingState.mockReturnValue({
      mainToppers: [{ id: 'topper-id' }], supportElements: [{ id: 'support-id' }], cakeMessages: [], icingDesign: {},
      cakeInfo: { type: '1 Tier', thickness: '3 in', size: '6" Round', flavors: [] },
    });
    mocks.getCakeBasePriceOptions.mockResolvedValue([{ size: '6" Round', price: 1200 }]);
    mocks.calculatePriceFromDatabase.mockResolvedValue({
      addOnPricing: { addOnPrice: 350, breakdown: [] },
      itemPrices: new Map([['topper-id', 300], ['support-id', 50]]),
      pricingTrace: [],
    });

    await expect(runAiPromptLabPricing({} as HybridAnalysisResult)).resolves.toMatchObject({
      analysisItemPrices: { 'main_toppers:0': 300, 'support_elements:0': 50 },
    });
  });
});
