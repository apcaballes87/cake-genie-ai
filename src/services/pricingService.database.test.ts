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
      isEnabled: true,
    } as CakeMessageUI;

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

  it('calculates cupcake topper prices correctly (Option B - Flat Maximum)', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');

    const printoutTopper = {
      id: 'printout-1',
      type: 'printout',
      description: 'Paper topper',
      quantity: 1,
      isEnabled: true,
    } as MainTopperUI;

    const ediblePhotoTopper = {
      id: 'photo-1',
      type: 'edible_photo_top',
      description: 'Edible photo sheet',
      quantity: 1,
      isEnabled: true,
    } as MainTopperUI;

    const simpleEdibleTopper = {
      id: 'simple-1',
      type: 'edible_3d_ordinary',
      description: 'Simple flower',
      quantity: 1,
      isEnabled: true,
    } as MainTopperUI;

    const complexEdibleTopper = {
      id: 'complex-1',
      type: 'edible_3d_complex',
      description: 'Character figure',
      quantity: 1,
      isEnabled: true,
    } as MainTopperUI;

    // Test printout only (0)
    const resPrintout = await calculatePriceFromDatabase({
      mainToppers: [printoutTopper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Cupcake' } as CakeInfoUI,
    });
    expect(resPrintout.itemPrices.get('printout-1')).toBe(0);
    expect(resPrintout.addOnPricing.addOnPrice).toBe(0);

    // Test simple only (100)
    const resSimple = await calculatePriceFromDatabase({
      mainToppers: [simpleEdibleTopper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Cupcake' } as CakeInfoUI,
    });
    expect(resSimple.itemPrices.get('simple-1')).toBe(100);
    expect(resSimple.addOnPricing.addOnPrice).toBe(100);

    // Test photo only (200)
    const resPhoto = await calculatePriceFromDatabase({
      mainToppers: [ediblePhotoTopper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Cupcake' } as CakeInfoUI,
    });
    expect(resPhoto.itemPrices.get('photo-1')).toBe(200);
    expect(resPhoto.addOnPricing.addOnPrice).toBe(200);

    // Test complex only (300)
    const resComplex = await calculatePriceFromDatabase({
      mainToppers: [complexEdibleTopper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Cupcake' } as CakeInfoUI,
    });
    expect(resComplex.itemPrices.get('complex-1')).toBe(300);
    expect(resComplex.addOnPricing.addOnPrice).toBe(300);

    // Test Option B: Flat maximum for mixed toppers (printout, simple, and complex)
    // Capped at complex (300)
    const resMixed = await calculatePriceFromDatabase({
      mainToppers: [printoutTopper, simpleEdibleTopper, complexEdibleTopper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Cupcake' } as CakeInfoUI,
    });
    expect(resMixed.itemPrices.get('printout-1')).toBe(0);
    expect(resMixed.itemPrices.get('simple-1')).toBe(100);
    expect(resMixed.itemPrices.get('complex-1')).toBe(300);
    expect(resMixed.addOnPricing.addOnPrice).toBe(300);
    expect(resMixed.addOnPricing.breakdown[0].item).toContain('Character figure');
  });
});
