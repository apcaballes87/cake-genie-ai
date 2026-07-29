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
    rule_id: 5,
    item_key: 'edible_flowers_small',
    item_type: 'edible_flowers',
    classification: 'support',
    size: 'small',
    description: 'Edible flowers',
    price: 10,
    category: 'support_element',
    quantity_rule: 'buy_3_get_1_free',
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
  {
    rule_id: 6,
    item_key: 'icing_doodle_intricate_top',
    item_type: 'icing_doodle_intricate_top',
    classification: 'non-gumpaste',
    size: null,
    description: 'Full intricate icing doodle on the cake top',
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
    rule_id: 7,
    item_key: 'icing_doodle_intricate_side',
    item_type: 'icing_doodle_intricate_side',
    classification: 'non-gumpaste',
    size: null,
    description: 'Full intricate icing doodle covering the cake sides',
    price: 200,
    category: 'support_element',
    quantity_rule: null,
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  ...([
    ['tiny', 50],
    ['xsmall', 75],
    ['small', 100],
    ['medium', 200],
    ['large', 300],
    ['xlarge', 400],
  ] as const).map(([size, price], index): PricingRule => ({
    rule_id: 8 + index,
    item_key: `edible_2d_complex_${size}`,
    item_type: 'edible_2d_complex',
    classification: 'hero',
    size,
    description: `Complex 2D edible artwork (${size})`,
    price,
    category: 'main_topper',
    quantity_rule: 'per_piece',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  })),
  ...([
    ['tiny', 40],
    ['xsmall', 60],
  ] as const).map(([size, price], index): PricingRule => ({
    rule_id: 20 + index,
    item_key: `toy_${size}`,
    item_type: 'toy',
    classification: 'non-gumpaste',
    size,
    description: `${size} high-detail toy`,
    price,
    category: 'main_topper',
    quantity_rule: 'per_piece',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  })),
  {
    rule_id: 14,
    item_key: 'gumpaste_bundle_small',
    item_type: 'gumpaste_bundle',
    classification: 'support',
    size: 'small',
    description: 'Allowance-eligible support bundle',
    price: 100,
    category: 'support_element',
    quantity_rule: 'per_piece',
    multiplier_rule: null,
    special_conditions: { allowance_eligible: true },
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

  it('prices legacy fresh_flowers through edible flower pricing rules', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');

    const flowers = {
      id: 'flowers-1',
      type: 'fresh_flowers',
      material: 'non-edible',
      description: 'Pink natural-looking flowers',
      quantity: 4,
      isEnabled: true,
      size: 'small',
    } as SupportElementUI;

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers: [],
      supportElements: [flowers],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(itemPrices.get('flowers-1')).toBe(30);
    expect(addOnPricing.addOnPrice).toBe(30);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('fresh_flowers'));
  });

  it('keeps zero-cost icing decorations out of the price without a missing-rule warning', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');
    const icingDecoration = {
      id: 'icing-decoration-1',
      type: 'icing_decorations',
      description: 'Blue icing stars',
      quantity: 1,
      isEnabled: true,
      size: 'tiny',
    } as SupportElementUI;

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers: [],
      supportElements: [icingDecoration],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(itemPrices.get('icing-decoration-1')).toBe(0);
    expect(addOnPricing.addOnPrice).toBe(0);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('icing_decorations'));
  });

  it('adds one flat ₱200 charge for each full intricate top and side doodle region', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');

    const topDoodle = {
      id: 'doodle-top',
      type: 'icing_doodle_intricate_top',
      material: 'icing',
      description: 'large intricate line-art portrait',
      quantity: 8,
      isEnabled: true,
      size: 'large',
    } as unknown as MainTopperUI;
    const sideDoodle = {
      id: 'doodle-side',
      type: 'icing_doodle_intricate_side',
      material: 'icing',
      description: 'coordinated intricate hobby icon side wrap',
      quantity: 12,
      isEnabled: true,
      size: 'large',
    } as unknown as SupportElementUI;

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers: [topDoodle],
      supportElements: [sideDoodle],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(itemPrices.get('doodle-top')).toBe(200);
    expect(itemPrices.get('doodle-side')).toBe(200);
    expect(addOnPricing.addOnPrice).toBe(400);
  });

  it.each([
    ['tiny', 50],
    ['xsmall', 75],
    ['small', 100],
    ['medium', 200],
    ['large', 300],
    ['xlarge', 400],
  ] as const)('prices %s edible_2d_complex artwork from its Supabase size rule at ₱%i', async (size, expectedPrice) => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');
    const topper = {
      id: `complex-2d-${size}`,
      type: 'edible_2d_complex',
      description: `${size} layered Roblox character face`,
      quantity: 1,
      isEnabled: true,
      size,
    } as MainTopperUI;

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(itemPrices.get(topper.id)).toBe(expectedPrice);
    expect(addOnPricing.addOnPrice).toBe(expectedPrice);
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('edible_2d_complex');
  });

  it('multiplies edible_2d_complex pricing per piece and keeps hero pricing outside the support allowance', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');
    const topper = {
      id: 'complex-2d-multiple',
      type: 'edible_2d_complex',
      description: 'three small layered character plaques',
      quantity: 3,
      isEnabled: true,
      size: 'small',
    } as MainTopperUI;
    const allowanceEligibleSupport = {
      id: 'support-bundle',
      type: 'gumpaste_bundle',
      material: 'edible_fondant',
      description: 'small support bundle',
      quantity: 1,
      isEnabled: true,
      size: 'small',
    } as SupportElementUI;

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers: [topper],
      supportElements: [allowanceEligibleSupport],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(itemPrices.get(topper.id)).toBe(300);
    expect(itemPrices.get(allowanceEligibleSupport.id)).toBe(100);
    expect(addOnPricing.addOnPrice).toBe(300);
    expect(addOnPricing.breakdown).toContainEqual({
      item: 'Gumpaste Allowance',
      price: -100,
    });
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('edible_2d_complex');
  });

  it.each([
    ['tiny', 40, 3, 120],
    ['xsmall', 60, 10, 600],
  ] as const)('prices %s toys at ₱%i per piece', async (size, unitPrice, quantity, expectedPrice) => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');
    const topper = {
      id: `toy-${size}`,
      type: 'toy',
      description: `${size} molded army soldiers`,
      quantity,
      isEnabled: true,
      size,
    } as MainTopperUI;

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(itemPrices.get(topper.id)).toBe(expectedPrice);
    expect(addOnPricing.addOnPrice).toBe(expectedPrice);
    expect(expectedPrice).toBe(unitPrice * quantity);
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain(`toy-${size}`);
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

    const complex2dEdibleTopper = {
      id: 'complex-2d-1',
      type: 'edible_2d_complex',
      description: 'Layered Roblox character face',
      quantity: 1,
      isEnabled: true,
    } as MainTopperUI;

    const normalSprinkles = {
      id: 'sprinkles-normal',
      type: 'sprinkles',
      description: 'Long rainbow sprinkles',
      quantity: 1,
      isEnabled: true,
    } as SupportElementUI;

    const premiumSprinkles = {
      id: 'sprinkles-premium',
      type: 'premium_sprinkles',
      description: 'Metallic gold sprinkles covering 50% of cupcake',
      quantity: 1,
      isEnabled: true,
    } as SupportElementUI;

    // Test normal sprinkles only (0)
    const resNormalSprinkles = await calculatePriceFromDatabase({
      mainToppers: [],
      supportElements: [normalSprinkles],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Cupcake' } as CakeInfoUI,
    });
    expect(resNormalSprinkles.itemPrices.get('sprinkles-normal')).toBe(0);
    expect(resNormalSprinkles.addOnPricing.addOnPrice).toBe(0);

    // Test premium sprinkles only (100)
    const resPremiumSprinkles = await calculatePriceFromDatabase({
      mainToppers: [],
      supportElements: [premiumSprinkles],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Cupcake' } as CakeInfoUI,
    });
    expect(resPremiumSprinkles.itemPrices.get('sprinkles-premium')).toBe(100);
    expect(resPremiumSprinkles.addOnPricing.addOnPrice).toBe(100);

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

    // Test complex 2D only (200), between simple/ordinary (100) and complex 3D (300)
    const resComplex2d = await calculatePriceFromDatabase({
      mainToppers: [complex2dEdibleTopper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Cupcake' } as CakeInfoUI,
    });
    expect(resComplex2d.itemPrices.get('complex-2d-1')).toBe(200);
    expect(resComplex2d.addOnPricing.addOnPrice).toBe(200);

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

    // Test Option B: Flat maximum for mixed toppers across all three edible craft bands
    // Capped at complex 3D (300), with complex 2D retained at 200 per item.
    const resMixed = await calculatePriceFromDatabase({
      mainToppers: [printoutTopper, simpleEdibleTopper, complex2dEdibleTopper, complexEdibleTopper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Cupcake' } as CakeInfoUI,
    });
    expect(resMixed.itemPrices.get('printout-1')).toBe(0);
    expect(resMixed.itemPrices.get('simple-1')).toBe(100);
    expect(resMixed.itemPrices.get('complex-2d-1')).toBe(200);
    expect(resMixed.itemPrices.get('complex-1')).toBe(300);
    expect(resMixed.addOnPricing.addOnPrice).toBe(300);
    expect(resMixed.addOnPricing.breakdown[0].item).toContain('Character figure');
  });
});
