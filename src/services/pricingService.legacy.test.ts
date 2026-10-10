import { describe, expect, it } from 'vitest';

import type { CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, SupportElementUI } from '@/types';
import { calculatePrice } from './pricingService';

describe('legacy pricing fallback', () => {
  it.each([[1, 10], [3, 30]] as const)('prices %s plain candle sticks at ₱10 per piece', (quantity, expectedPrice) => {
    const topper = {
      id: `legacy-candle-stick-${quantity}`,
      type: 'candle_stick',
      size: 'medium',
      quantity,
      description: 'Plain straight cylindrical candle sticks',
      isEnabled: true,
    } as unknown as MainTopperUI;

    const result = calculatePrice({
      mainToppers: [topper],
      supportElements: [] as SupportElementUI[],
      cakeMessages: [] as CakeMessageUI[],
      icingDesign: { drip: false, gumpasteBaseBoard: false } as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(result.itemPrices.get(topper.id)).toBe(expectedPrice);
    expect(result.addOnPricing.addOnPrice).toBe(expectedPrice);
  });
});
