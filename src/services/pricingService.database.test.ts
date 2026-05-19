import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CakeInfoUI, CakeMessageUI, IcingDesignUI, PricingRule } from '@/types';

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
      type: 'icing_text',
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
});
