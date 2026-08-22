import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeMainTopperForDefaultFulfillment } from '@/lib/ai/fulfillmentNormalization';
import type { CakeInfoUI, CakeMessageUI, IcingDesignUI, MainTopperUI, PricingRule, SupportElementUI } from '@/types';

type PricingFixtureRule = Omit<PricingRule, 'quantity_rule'> & {
  quantity_rule: string | null;
  merchant_id?: string | null;
};

const DEFAULT_MERCHANT_ID = 'd29d384c-3265-4d96-9637-86888a8f649d';

const basePricingRows: PricingFixtureRule[] = [
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
    ['medium', 150],
    ['large', 200],
    ['xlarge', 250],
  ] as const).map(([size, price], index): PricingFixtureRule => ({
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
  ] as const).map(([size, price], index): PricingFixtureRule => ({
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
  ...([
    ['tiny', 40],
    ['xsmall', 60],
  ] as const).map(([size, price], index): PricingFixtureRule => ({
    rule_id: 200 + index,
    item_key: `plastic_crown_${size}`,
    item_type: 'plastic_crown',
    classification: 'non-gumpaste',
    size,
    description: `${size} plastic crown`,
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
    ['tiny', 140],
    ['xsmall', 160],
    ['small', 200],
    ['medium', 300],
    ['large', 400],
    ['xlarge', 500],
  ] as const).map(([size, price], index): PricingFixtureRule => ({
    rule_id: 210 + index,
    item_key: `edible_crown_${size}`,
    item_type: 'edible_crown',
    classification: 'hero',
    size,
    description: `${size} edible crown`,
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
    description: 'Support gumpaste bundle',
    price: 100,
    category: 'support_element',
    quantity_rule: 'per_piece',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  ...([
    ['medium', 50],
    ['large', 100],
    ['xlarge', 150],
  ] as const).map(([size, price], index): PricingFixtureRule => ({
    rule_id: 30 + index,
    item_key: `edible_2d_support_${size}`,
    item_type: 'edible_2d_support',
    classification: 'support',
    size,
    description: `Edible 2D support (${size})`,
    price,
    category: 'support_element',
    quantity_rule: 'per_piece',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  })),
  {
    rule_id: 40,
    item_key: 'cardstock_medium',
    item_type: 'cardstock',
    classification: 'non-gumpaste',
    size: 'medium',
    description: 'Medium cardstock topper',
    price: 60,
    category: 'main_topper',
    quantity_rule: 'per_piece',
    multiplier_rule: null,
    special_conditions: null,
    merchant_id: DEFAULT_MERCHANT_ID,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 41,
    item_key: 'cardstock',
    item_type: 'cardstock',
    classification: 'message',
    size: null,
    description: 'Legacy cardstock message charge',
    price: 100,
    category: 'message',
    quantity_rule: null,
    multiplier_rule: null,
    special_conditions: null,
    merchant_id: DEFAULT_MERCHANT_ID,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 42,
    item_key: 'edible_flowers_medium',
    item_type: 'edible_flowers',
    classification: 'hero',
    size: 'medium',
    description: 'Medium hero edible flowers',
    price: 100,
    category: 'main_topper',
    quantity_rule: 'buy_3_get_1_free',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 100,
    item_key: 'edible_flowers_medium',
    item_type: 'edible_flowers',
    classification: 'support',
    size: 'medium',
    description: 'Medium support edible flowers',
    price: 100,
    category: 'support_element',
    quantity_rule: 'buy_3_get_1_free',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 101,
    item_key: 'edible_flowers_large',
    item_type: 'edible_flowers',
    classification: 'support',
    size: 'large',
    description: 'Large support edible flowers',
    price: 150,
    category: 'support_element',
    quantity_rule: 'buy_3_get_1_free',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 102,
    item_key: 'edible_flowers_xlarge',
    item_type: 'edible_flowers',
    classification: 'support',
    size: 'xlarge',
    description: 'X-Large support edible flowers',
    price: 200,
    category: 'support_element',
    quantity_rule: 'buy_3_get_1_free',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 103,
    item_key: 'plastic_ball',
    item_type: 'plastic_ball',
    classification: 'support',
    size: null,
    description: 'Legacy Plastic Ball (support element)',
    price: 20,
    category: 'support_element',
    quantity_rule: 'buy_3_get_1_free',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    rule_id: 104,
    item_key: 'edible_photo_side_wave_large',
    item_type: 'edible_photo_side_wave',
    classification: 'non-gumpaste',
    size: 'large',
    description: 'Conditioned wafer paper wave side wrap',
    price: 500,
    category: 'support_element',
    quantity_rule: 'per_piece',
    multiplier_rule: null,
    special_conditions: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

const weddingAnalysisFixture = {
  tags: [
    'wedding',
    'white',
    'gold',
    'topper',
    'florals',
    'cebu',
    'genie',
    '1-tier',
    'soft',
    'icing',
    'acrylic',
    'beige',
    'rose',
    'floral',
    'cascade',
  ],
  keyword: 'Wedding',
  alt_text: 'White 1-tier soft icing wedding cake with a gold acrylic topper and white and beige rose floral cascade',
  rejection: {
    reason: '',
    message: '',
    isRejected: false,
  },
  seo_title: 'Wedding Cake With Gold Topper And Florals Cebu | Genie.ph',
  icing_design: {
    base: 'soft_icing',
    drip: false,
    colors: { top: '#FFFFFF', side: '#FFFFFF' },
    border_top: false,
    color_type: 'single',
    border_base: false,
    gumpasteBaseBoard: false,
  },
  main_toppers: [
    {
      size: 'medium',
      type: 'cardstock',
      group_id: 'mr_mrs_topper',
      material: 'cardstock',
      quantity: 1,
      description: 'Gold acrylic Mr & Mrs topper normalized to cardstock',
      classification: 'hero',
    },
  ],
  cakeType: '1 Tier',
  cakeThickness: '4 in',
  cake_messages: [
    {
      text: 'Mr & Mrs Dumaguit',
      type: 'cardstock',
      color: '#FFD700',
      position: 'top',
    },
  ],
  seo_description: 'A white 1-tier wedding cake features smooth soft icing paired with a cascade of white and beige edible roses. A gold acrylic topper sits on top, complemented by delicate pearl dragees and textured side details. The design suits a traditional wedding celebration with a neutral color palette. Its classic aesthetic also works for intimate ceremonies. The topper, floral arrangement, icing colors, and personalized message can be customized. Designed specifically for wedding or white events, this Wedding cake is a stunning 1 layer (single tier) piece finished with soft icing in white. The design is highlighted by Gold acrylic Mr & Mrs topper normalized to cardstock. Decorative accents include 8 Cluster of white and beige edible roses with green leaves, 15 White pearl dragees scattered on the side, and Textured white icing palette knife spread on the side. This design requires at least one day of lead time.',
  support_elements: [
    {
      size: 'medium',
      type: 'edible_flowers',
      color: '#FFFFFF',
      group_id: 'white_and_beige_roses',
      material: 'edible_fondant',
      quantity: 8,
      description: 'Cluster of white and beige edible roses with green leaves',
    },
    {
      size: 'tiny',
      type: 'dragees',
      color: '#FFFFFF',
      group_id: 'white_pearl_accents',
      material: 'candy',
      quantity: 15,
      description: 'White pearl dragees scattered on the side',
    },
    {
      size: 'small',
      type: 'icing_decorations',
      color: '#FFFFFF',
      group_id: 'side_icing_swirls',
      material: 'icing',
      quantity: 1,
      description: 'Textured white icing palette knife spread on the side',
    },
  ],
} as const;

let pricingRows: PricingFixtureRule[] = [...basePricingRows];

function createPricingQuery() {
  let requestedMerchantId: string | undefined;
  const query = {
    select: () => query,
    eq: () => query,
    or: (filter: string) => {
      requestedMerchantId = filter.match(/merchant_id\.eq\.([^,]+)/)?.[1];
      return query;
    },
    then: (
      resolve: (value: { data: PricingFixtureRule[]; error: null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => {
      const data = requestedMerchantId
        ? pricingRows.filter(rule => rule.merchant_id == null || rule.merchant_id === requestedMerchantId)
        : pricingRows;
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return query;
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: () => createPricingQuery(),
  }),
}));

describe('calculatePriceFromDatabase', () => {
  beforeEach(async () => {
    const { clearPricingCache } = await import('./pricingService.database');
    pricingRows = [...basePricingRows];
    clearPricingCache();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('keeps messages free even when a legacy nonzero message rule exists', async () => {
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

    expect(itemPrices.get('message-1')).toBe(0);
    expect(addOnPricing.addOnPrice).toBe(0);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('icing_text'));
  });

  it('prices the wedding analysis with its physical topper and edible flowers support element', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const mainToppers = weddingAnalysisFixture.main_toppers.map((topper, index) => ({
      ...topper,
      id: `wedding-topper-${index + 1}`,
      isEnabled: true,
    })) as unknown as MainTopperUI[];
    const supportElements = weddingAnalysisFixture.support_elements.map((element, index) => ({
      ...element,
      id: `wedding-support-${index + 1}`,
      isEnabled: true,
    })) as unknown as SupportElementUI[];
    const cakeMessages = weddingAnalysisFixture.cake_messages.map((message, index) => ({
      ...message,
      id: `wedding-message-${index + 1}`,
      isEnabled: true,
    })) as unknown as CakeMessageUI[];

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers,
      supportElements,
      cakeMessages,
      icingDesign: weddingAnalysisFixture.icing_design as IcingDesignUI,
      cakeInfo: {
        type: weddingAnalysisFixture.cakeType,
        size: '6" Round',
        thickness: weddingAnalysisFixture.cakeThickness,
      } as CakeInfoUI,
    });

    expect(itemPrices.get('wedding-topper-1')).toBe(60);
    expect(itemPrices.get('wedding-support-1')).toBe(600);
    expect(itemPrices.get('wedding-support-2')).toBe(0);
    expect(itemPrices.get('wedding-support-3')).toBe(0);
    expect(itemPrices.get('wedding-message-1')).toBe(0);
    expect(addOnPricing).toEqual({
      addOnPrice: 660,
      breakdown: [
        {
          item: 'Gold acrylic Mr & Mrs topper normalized to cardstock',
          price: 60,
        },
        {
          item: 'Cluster of white and beige edible roses with green leaves',
          price: 600,
        },
      ],
    });
  });

  it('prices edible_photo_top based on cake size (Bento: 100, all others: 200)', async () => {
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
    expect(resBento.itemPrices.get('topper-1')).toBe(100);

    // Test 6" Round
    const res6in = await calculatePriceFromDatabase({
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });
    expect(res6in.itemPrices.get('topper-1')).toBe(200);

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

  it('prices legacy plastic_ball as a support element using the support_element rule', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');

    const ball = {
      id: 'ball-1',
      type: 'plastic_ball',
      material: 'non-edible',
      description: 'Gold plastic balls scattered on top',
      quantity: 8,
      isEnabled: true,
    } as SupportElementUI;

    const { addOnPricing, itemPrices } = await calculatePriceFromDatabase({
      mainToppers: [],
      supportElements: [ball],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(itemPrices.get('ball-1')).toBe(120);
    expect(addOnPricing.addOnPrice).toBe(120);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('plastic_ball'));
  });

  it.each(['fresh_flowers', 'artificial_flowers'] as const)('prices legacy %s through edible flower pricing rules', async (legacyFlowerType) => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');

    const flowers = {
      id: 'flowers-1',
      type: legacyFlowerType,
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
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining(legacyFlowerType));
  });

  it('prices every removable decoration in the floral fruit rectangle cake analysis', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    pricingRows.push(
      {
        rule_id: 300,
        item_key: 'edible_2d_support_small',
        item_type: 'edible_2d_support',
        classification: 'support',
        size: 'small',
        description: 'Small edible 2D support piece',
        price: 10,
        category: 'support_element',
        quantity_rule: 'per_piece',
        multiplier_rule: null,
        special_conditions: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        rule_id: 301,
        item_key: 'candy_piece',
        item_type: 'candy',
        classification: 'support',
        size: null,
        description: 'Candy piece',
        price: 15,
        category: 'support_element',
        quantity_rule: 'per_piece',
        multiplier_rule: null,
        special_conditions: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }
    );

    const flowers = {
      id: 'fresh-flower-decorations',
      type: 'edible_flowers',
      description: 'mixed colorful edible flowers',
      quantity: 12,
      isEnabled: true,
      size: 'medium',
    } as SupportElementUI;
    const strawberries = {
      id: 'fresh-strawberries',
      type: 'edible_2d_shapes',
      description: 'fresh strawberries',
      quantity: 10,
      isEnabled: true,
      size: 'small',
    } as unknown as SupportElementUI;
    const orangeSlices = {
      id: 'orange-slices',
      type: 'candy',
      description: 'orange fruit slices',
      quantity: 8,
      isEnabled: true,
      size: 'small',
    } as SupportElementUI;
    const makeState = () => ({
      mainToppers: [],
      supportElements: [flowers, strawberries, orangeSlices],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: 'Rectangle', size: '8x12', thickness: '3 in' } as CakeInfoUI,
    });

    const enabledResult = await calculatePriceFromDatabase(makeState());
    expect(enabledResult.itemPrices.get(flowers.id)).toBe(800);
    expect(enabledResult.itemPrices.get(strawberries.id)).toBe(100);
    expect(enabledResult.itemPrices.get(orangeSlices.id)).toBe(120);
    expect(enabledResult.addOnPricing.addOnPrice).toBe(1020);

    strawberries.isEnabled = false;
    orangeSlices.isEnabled = false;
    const fruitsDisabledResult = await calculatePriceFromDatabase(makeState());
    expect(fruitsDisabledResult.itemPrices.get(flowers.id)).toBe(800);
    expect(fruitsDisabledResult.itemPrices.get(strawberries.id)).toBe(0);
    expect(fruitsDisabledResult.itemPrices.get(orangeSlices.id)).toBe(0);
    expect(fruitsDisabledResult.addOnPricing.addOnPrice).toBe(800);

    flowers.isEnabled = false;
    const allDisabledResult = await calculatePriceFromDatabase(makeState());
    expect(allDisabledResult.itemPrices.get(flowers.id)).toBe(0);
    expect(allDisabledResult.addOnPricing.addOnPrice).toBe(0);

    const mainCandy = {
      ...orangeSlices,
      id: 'main-candy',
      isEnabled: true,
    } as unknown as MainTopperUI;
    const wrongCategoryResult = await calculatePriceFromDatabase({
      ...makeState(),
      mainToppers: [mainCandy],
      supportElements: [],
    });
    expect(wrongCategoryResult.itemPrices.get(mainCandy.id)).toBe(0);
    expect(wrongCategoryResult.addOnPricing.addOnPrice).toBe(0);
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
    ['medium', 150],
    ['large', 200],
    ['xlarge', 250],
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

  it('charges hero and support gumpaste pricing in full', async () => {
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
    const supportBundle = {
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
      supportElements: [supportBundle],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(itemPrices.get(topper.id)).toBe(300);
    expect(itemPrices.get(supportBundle.id)).toBe(100);
    expect(addOnPricing.addOnPrice).toBe(400);
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

  it.each([
    ['tiny', 40, 3, 120],
    ['xsmall', 60, 10, 600],
  ] as const)('prices %s plastic crowns at ₱%i per piece — same as toy', async (size, unitPrice, quantity, expectedPrice) => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');
    const topper = {
      id: `plastic_crown-${size}`,
      type: 'plastic_crown',
      description: `${size} plastic crown`,
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
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain(`plastic_crown-${size}`);
  });

  it.each([
    ['tiny', 140, 1, 140],
    ['xsmall', 160, 2, 320],
    ['small', 200, 1, 200],
    ['medium', 300, 2, 600],
    ['large', 400, 1, 400],
    ['xlarge', 500, 2, 1000],
  ] as const)('prices %s edible crowns at ₱%i per piece — toy price plus ₱100', async (size, unitPrice, quantity, expectedPrice) => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');
    const topper = {
      id: `edible_crown-${size}`,
      type: 'edible_crown',
      material: 'edible_fondant',
      description: `${size} fondant crown`,
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
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain(`edible_crown-${size}`);
  });

  it('keeps the default printout free and charges the paid rule after an explicit physical toy selection', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const rawToy = {
      id: 'toy-fulfillment',
      type: 'toy',
      material: 'plastic',
      description: 'small physical character toy',
      quantity: 1,
      isEnabled: true,
      size: 'xsmall',
      original_type: 'toy',
    } as MainTopperUI;
    const defaultPrintout = {
      ...normalizeMainTopperForDefaultFulfillment(rawToy),
      id: 'toy-default-printout',
    } as MainTopperUI;
    const commonState = {
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    };

    const defaultResult = await calculatePriceFromDatabase({
      ...commonState,
      mainToppers: [defaultPrintout],
    });
    const physicalResult = await calculatePriceFromDatabase({
      ...commonState,
      mainToppers: [{ ...defaultPrintout, id: 'toy-physical', type: 'toy' }],
    });

    expect(defaultPrintout).toMatchObject({
      type: 'printout',
      original_type: 'toy',
      printout_source_type: 'toy',
    });
    expect(defaultResult.itemPrices.get('toy-default-printout')).toBe(0);
    expect(physicalResult.itemPrices.get('toy-physical')).toBe(60);
  });

  it('uses exact categories regardless of database row order and never crosses into message pricing', async () => {
    const { calculatePriceFromDatabase, clearPricingCache } = await import('./pricingService.database');
    const topper = {
      id: 'cardstock-main',
      type: 'cardstock',
      description: 'Medium acrylic-look cardstock topper',
      quantity: 2,
      isEnabled: true,
      size: 'medium',
    } as MainTopperUI;
    const uiState = {
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    };

    const forward = await calculatePriceFromDatabase(uiState);
    expect(forward.itemPrices.get(topper.id)).toBe(120);

    pricingRows = [...pricingRows].reverse();
    clearPricingCache();

    const reversed = await calculatePriceFromDatabase(uiState);
    expect(reversed.itemPrices.get(topper.id)).toBe(120);
  });

  it('uses a category-null rule only as an explicit same-key fallback', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    pricingRows.push(
      {
        rule_id: 50,
        item_key: 'generic_badge_small',
        item_type: 'generic_badge',
        classification: 'non-gumpaste',
        size: 'small',
        description: 'Legacy generic badge fallback',
        price: 25,
        category: null,
        quantity_rule: 'per_piece',
        multiplier_rule: null,
        special_conditions: null,
        merchant_id: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        rule_id: 51,
        item_key: 'generic_badge_small',
        item_type: 'generic_badge',
        classification: 'message',
        size: 'small',
        description: 'Wrong-category badge message',
        price: 999,
        category: 'message',
        quantity_rule: null,
        multiplier_rule: null,
        special_conditions: null,
        merchant_id: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }
    );

    const topper = {
      id: 'legacy-generic-badge',
      type: 'generic_badge',
      description: 'Two generic badges',
      quantity: 2,
      isEnabled: true,
      size: 'small',
    } as unknown as MainTopperUI;
    const result = await calculatePriceFromDatabase({
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(result.itemPrices.get(topper.id)).toBe(50);
  });

  it('prefers an exact merchant rule, then global, with deterministic row-order behavior', async () => {
    const { calculatePriceFromDatabase, clearPricingCache } = await import('./pricingService.database');
    const requestedMerchantId = '11111111-1111-4111-8111-111111111111';
    const otherMerchantId = '22222222-2222-4222-8222-222222222222';
    pricingRows.push(
      {
        rule_id: 60,
        item_key: 'merchant_badge_small',
        item_type: 'merchant_badge',
        classification: 'non-gumpaste',
        size: 'small',
        description: 'Global merchant badge',
        price: 10,
        category: 'main_topper',
        quantity_rule: 'fixed',
        multiplier_rule: null,
        special_conditions: null,
        merchant_id: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        rule_id: 61,
        item_key: 'merchant_badge_small',
        item_type: 'merchant_badge',
        classification: 'non-gumpaste',
        size: 'small',
        description: 'Requested merchant badge',
        price: 20,
        category: 'main_topper',
        quantity_rule: 'fixed',
        multiplier_rule: null,
        special_conditions: null,
        merchant_id: requestedMerchantId,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        rule_id: 62,
        item_key: 'merchant_badge_small',
        item_type: 'merchant_badge',
        classification: 'non-gumpaste',
        size: 'small',
        description: 'Other merchant badge',
        price: 30,
        category: 'main_topper',
        quantity_rule: 'fixed',
        multiplier_rule: null,
        special_conditions: null,
        merchant_id: otherMerchantId,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }
    );

    const topper = {
      id: 'merchant-badge',
      type: 'merchant_badge',
      description: 'Merchant badge',
      quantity: 4,
      isEnabled: true,
      size: 'small',
    } as unknown as MainTopperUI;
    const uiState = {
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    };

    const merchantResult = await calculatePriceFromDatabase(uiState, requestedMerchantId);
    expect(merchantResult.itemPrices.get(topper.id)).toBe(20);

    pricingRows = [...pricingRows].reverse();
    clearPricingCache();
    const reversedMerchantResult = await calculatePriceFromDatabase(uiState, requestedMerchantId);
    expect(reversedMerchantResult.itemPrices.get(topper.id)).toBe(20);

    clearPricingCache();
    const globalResult = await calculatePriceFromDatabase(uiState);
    expect(globalResult.itemPrices.get(topper.id)).toBe(10);
  });

  it.each([
    ['medium', 50, 3, 150],
    ['large', 100, 3, 300],
    ['xlarge', 150, 3, 450],
  ] as const)(
    'prices %s edible_2d_support per piece without an allowance',
    async (size, unitPrice, quantity, rawPrice) => {
      const { calculatePriceFromDatabase } = await import('./pricingService.database');
      const support = {
        id: `edible-2d-support-${size}`,
        type: 'edible_2d_support',
        material: 'edible_fondant',
        description: `${quantity} ${size} flat fondant stars`,
        quantity,
        isEnabled: true,
        size,
      } as SupportElementUI;

      const result = await calculatePriceFromDatabase({
        mainToppers: [],
        supportElements: [support],
        cakeMessages: [],
        icingDesign: {} as IcingDesignUI,
        cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
      });

      expect(rawPrice).toBe(unitPrice * quantity);
      expect(result.itemPrices.get(support.id)).toBe(rawPrice);
      expect(result.addOnPricing.addOnPrice).toBe(rawPrice);
    }
  );

  it.each([
    ['1 Tier', 1, 500],
    ['2 Tier', 3, 1500],
    ['3 Tier', 4, 2000],
  ] as const)('prices a %s conditioned wafer-paper wave wrap from its fulfillment units', async (cakeType, quantity, expectedPrice) => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const support = {
      id: `conditioned-wafer-paper-wave-${cakeType}`,
      type: 'edible_photo_side_wave',
      material: 'waferpaper',
      description: 'conditioned white wafer paper vertical waves around the cake sides',
      quantity,
      isEnabled: true,
      size: 'large',
    } as SupportElementUI;

    const result = await calculatePriceFromDatabase({
      mainToppers: [],
      supportElements: [support],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: cakeType, size: '6" Round' } as CakeInfoUI,
    });

    expect(result.itemPrices.get(support.id)).toBe(expectedPrice);
    expect(result.addOnPricing.addOnPrice).toBe(expectedPrice);
  });

  it('prices ordinary edible 3D pieces identically in main and support categories without allowance', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    pricingRows.push(
      {
        rule_id: 70,
        item_key: 'edible_3d_ordinary_small',
        item_type: 'edible_3d_ordinary',
        classification: 'hero',
        size: 'small',
        description: 'Small ordinary edible 3D main item',
        price: 25,
        category: 'main_topper',
        quantity_rule: 'per_piece',
        multiplier_rule: null,
        special_conditions: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        rule_id: 71,
        item_key: 'edible_3d_ordinary_small',
        item_type: 'edible_3d_ordinary',
        classification: 'support',
        size: 'small',
        description: 'Small ordinary edible 3D support item',
        price: 25,
        category: 'support_element',
        quantity_rule: 'per_piece',
        multiplier_rule: null,
        special_conditions: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }
    );
    const main = {
      id: 'ordinary-main',
      type: 'edible_3d_ordinary',
      description: 'Two simple molded spheres',
      quantity: 2,
      isEnabled: true,
      size: 'small',
    } as MainTopperUI;
    const support = {
      id: 'ordinary-support',
      type: 'edible_3d_ordinary',
      description: 'Two simple molded spheres',
      quantity: 2,
      isEnabled: true,
      size: 'small',
    } as SupportElementUI;

    const result = await calculatePriceFromDatabase({
      mainToppers: [main],
      supportElements: [support],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(result.itemPrices.get(main.id)).toBe(50);
    expect(result.itemPrices.get(support.id)).toBe(50);
    expect(result.addOnPricing.addOnPrice).toBe(100);
  });

  it('trims known quantity rules and supports fixed, flat, per-three, and per-digit semantics', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    pricingRows.push(
      ...([
        ['trimmed_rule_small', 10, ' per_piece\n', 3, 'three pieces', 30],
        ['fixed_rule_small', 40, 'fixed', 9, 'fixed item', 40],
        ['flat_rule_small', 30, 'flat', 9, 'flat item', 30],
        ['per_three_rule_small', 10, 'per_3_pieces', 7, 'seven pieces', 30],
        ['per_digit_rule_small', 5, 'per_digit', 1, 'number 12 topper', 10],
      ] as const).map(([itemKey, price, quantityRule, , description], index): PricingFixtureRule => ({
        rule_id: 80 + index,
        item_key: itemKey,
        item_type: itemKey.replace('_small', ''),
        classification: 'non-gumpaste',
        size: 'small',
        description,
        price,
        category: 'main_topper',
        quantity_rule: quantityRule,
        multiplier_rule: null,
        special_conditions: null,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }))
    );

    for (const [itemKey, , , quantity, description, expectedPrice] of [
      ['trimmed_rule_small', 10, ' per_piece\n', 3, 'three pieces', 30],
      ['fixed_rule_small', 40, 'fixed', 9, 'fixed item', 40],
      ['flat_rule_small', 30, 'flat', 9, 'flat item', 30],
      ['per_three_rule_small', 10, 'per_3_pieces', 7, 'seven pieces', 30],
      ['per_digit_rule_small', 5, 'per_digit', 1, 'number 12 topper', 10],
    ] as const) {
      const type = itemKey.replace('_small', '');
      const topper = {
        id: itemKey,
        type,
        description,
        quantity,
        isEnabled: true,
        size: 'small',
      } as unknown as MainTopperUI;
      const result = await calculatePriceFromDatabase({
        mainToppers: [topper],
        supportElements: [],
        cakeMessages: [],
        icingDesign: {} as IcingDesignUI,
        cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
      });
      expect(result.itemPrices.get(itemKey)).toBe(expectedPrice);
    }
  });

  it('warns once for a whitespace-only legacy quantity rule and treats it as flat', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    const warnSpy = vi.spyOn(console, 'warn');
    pricingRows.push({
      rule_id: 90,
      item_key: 'legacy_empty_small',
      item_type: 'legacy_empty',
      classification: 'non-gumpaste',
      size: 'small',
      description: 'Legacy empty rule',
      price: 15,
      category: 'main_topper',
      quantity_rule: ' \n',
      multiplier_rule: null,
      special_conditions: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    const topper = {
      id: 'legacy-empty',
      type: 'legacy_empty',
      description: 'Legacy empty rule',
      quantity: 4,
      isEnabled: true,
      size: 'small',
    } as unknown as MainTopperUI;

    const result = await calculatePriceFromDatabase({
      mainToppers: [topper],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    });

    expect(result.itemPrices.get(topper.id)).toBe(15);
    expect(
      warnSpy.mock.calls.filter(call => call.join(' ').includes('legacy pricing rule 90'))
    ).toHaveLength(1);
  });

  it('fails loudly when an active pricing row contains an unknown quantity rule', async () => {
    const { calculatePriceFromDatabase } = await import('./pricingService.database');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    pricingRows.push({
      rule_id: 91,
      item_key: 'unknown_quantity_small',
      item_type: 'unknown_quantity',
      classification: 'non-gumpaste',
      size: 'small',
      description: 'Unknown quantity rule',
      price: 15,
      category: 'main_topper',
      quantity_rule: 'per_dozen',
      multiplier_rule: null,
      special_conditions: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    await expect(calculatePriceFromDatabase({
      mainToppers: [],
      supportElements: [],
      cakeMessages: [],
      icingDesign: {} as IcingDesignUI,
      cakeInfo: { type: '1 Tier', size: '6" Round' } as CakeInfoUI,
    })).rejects.toThrow('Unknown quantity_rule "per_dozen"');
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
