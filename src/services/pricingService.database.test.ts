import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, PricingRule, SupportElementUI } from '@/types';

const pricingRows: PricingRule[] = [
  {
    rule_id: 1,
    item_key: 'icing_script',
    item_type: 'message',
    classification: 'message',
    size: null,
    description: 'Icing script message',
    price: 50,
    category: 'message',
    quantity_rule: null,
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 2,
    item_key: 'gumpaste_allowance',
    item_type: 'special',
    classification: 'special',
    size: null,
    description: 'Gumpaste allowance',
    price: 100,
    category: 'special',
    quantity_rule: null,
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 3,
    item_key: 'edible_photo_top',
    item_type: 'edible_photo_top',
    classification: 'non-gumpaste',
    size: null,
    description: 'Edible photo top',
    price: 200,
    category: 'main_topper',
    quantity_rule: null,
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 4,
    item_key: 'satin_ribbon',
    item_type: 'satin_ribbon',
    classification: 'support',
    size: null,
    description: 'Satin or organza fabric ribbon',
    price: 100,
    category: 'support_element',
    quantity_rule: null,
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: pricingRows, error: null }),
      }),
    }),
  }),
}));

describe('calculatePriceFromDatabase', () => {
  beforeEach(async () => {
    const { clearPricingCache } = await import('./pricingService.database');
    clearPricingCache();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('prices legacy icing_text messages through the icing_script rule without warning', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');

    const message: CakeMessageUI = {
      id: 'message-1',
      type: 'icing_text' as CakeMessageUI['type'],
      text: 'Happy Birthday',
      quantity: 1,
      isEnabled: true,
    };

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers: [],
      supportElements: [],
      cakeMessages: [message],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier' } as CakeInfoUI,
    });

    expect(itemPrices.get('message-1')).toBe(50);
    expect(addOnPricing.addOnPrice).toBe(50);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('icing_text'));
  });

  it('prices edible_photo_top based on cake size (Bento: 0, 6" Round: 100, others: 200)', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');

    const topper = {
      id: 'topper-1',
      type: 'edible_photo_top',
      description: 'Edible photo top',
      quantity: 1,
      isEnabled: true,
      size: 'medium',
    } as MainTopperUI;

    // Test Bento
    const resBento = await calculatePriceFromDatabase({
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Bento', size: '4" Round' } as CakeInfoUI,
    });
    expect(resBento.itemPrices.get('topper-1')).toBe(0);

    // Test 6" Round
    const res6in = await calculatePriceFromDatabase({
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });
    expect(res6in.itemPrices.get('topper-1')).toBe(100);

    // Test 8" Round
    const res8in = await calculatePriceFromDatabase({
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '8" Round' } as CakeInfoUI,
    });
    expect(res8in.itemPrices.get('topper-1')).toBe(200);
  });

  it('prices satin or organza ribbon as a flat support element regardless of cake size', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');

    const ribbon = {
      id: 'ribbon-1',
      type: 'satin_ribbon',
      material: 'non-edible',
      description: 'light blue organza fabric ruffle and bow wrap',
      quantity: 1,
      isEnabled: true,
      size: 'large',
    } as SupportElementUI;

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers: [],
      supportElements: [ribbon],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '3 Tier', size: '10" Round' } as CakeInfoUI,
    });

    expect(itemPrices.get('ribbon-1')).toBe(100);
    expect(addOnPricing.addOnPrice).toBe(100);
  });
});
