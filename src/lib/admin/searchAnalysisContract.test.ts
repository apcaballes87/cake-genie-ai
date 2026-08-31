import { describe, expect, it } from 'vitest';

import {
  buildSearchAnalysisResponseSchema,
  postProcessSearchAnalysisResult,
  SEARCH_ANALYSIS_COLOR_TYPES,
  SEARCH_ANALYSIS_ICING_BASES,
  SEARCH_ANALYSIS_REJECTION_REASONS,
} from './searchAnalysisContract';

const typeEnums = {
  mainTopperTypes: [
    'printout',
    'icing_doodle',
    'icing_doodle_intricate',
    'icing_doodle_intricate_top',
    'edible_photo_top',
    'edible_2d_complex',
    'edible_3d_complex',
    'edible_3d_ordinary',
    'edible_flowers',
    'candle',
    'toy',
    'plastic_crown',
    'edible_crown',
    'cardstock',
    'icing_decorations',
    'plastic_ball',
  ],
  supportElementTypes: [
    'sprinkles',
    'premium_sprinkles',
    'dragees',
    'support_printout',
    'edible_2d_support',
    'fresh_flowers',
    'artificial_flowers',
    'edible_flowers',
    'edible_photo_side_wave',
    'icing_decorations',
    'meringue',
    'icing_doodle',
    'icing_doodle_intricate_side',
    'chocolates',
    'edible_3d_ordinary',
    'plastic_ball',
    'plastic_ball_regular',
  ],
  subtypesByType: {
    chocolates: ['ferrero', 'oreo'],
  },
};

function validAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    cakeType: '1 Tier',
    cakeThickness: '4 in',
    main_toppers: [],
    support_elements: [],
    cake_messages: [],
    icing_design: {
      base: 'soft_icing',
      color_type: 'single',
      colors: { side: '#FFFFFF', top: '#FFFFFF' },
      drip: false,
      border_top: false,
      border_base: false,
      gumpasteBaseBoard: false,
    },
    keyword: 'Birthday',
    alt_text: 'White birthday cake with simple decorations.',
    seo_title: 'White Birthday Cake with Simple Decorations in Cebu',
    seo_description: 'A white birthday cake with simple decorations.',
    rejection: { isRejected: false, reason: '', message: '' },
    ...overrides,
  };
}

describe('search analysis contract', () => {
  it('includes the canonical rejection reasons and enums used by the prompt', () => {
    const schema = buildSearchAnalysisResponseSchema(typeEnums);

    expect(SEARCH_ANALYSIS_REJECTION_REASONS).toContain('payment_receipt');
    expect(SEARCH_ANALYSIS_REJECTION_REASONS).toContain('selfie');
    expect(schema.properties.rejection.properties.reason.description).toContain('payment_receipt');
    expect(schema.properties.rejection.properties.reason.description).toContain('selfie');
    expect(schema.properties.rejection.properties.reason.description).toContain('Accepted: empty string');
    expect(schema.properties.rejection.properties.reason).not.toHaveProperty('enum');
    expect(schema.properties.rejection.required).toContain('reason');
    expect(schema.properties.icing_design.properties.base.enum).toEqual([...SEARCH_ANALYSIS_ICING_BASES]);
    expect(schema.properties.icing_design.properties.color_type.enum).toEqual([...SEARCH_ANALYSIS_COLOR_TYPES]);
    expect(schema.properties.cake_messages.items.properties.type.enum).toEqual([
      'gumpaste_letters',
      'icing_script',
      'printout',
      'cardstock',
    ]);
    expect(schema.properties.support_elements.items.properties.type.enum).toContain('edible_flowers');
    expect(schema.properties.support_elements.items.properties.type.enum).toContain('edible_photo_side_wave');
    expect(schema.properties.support_elements.items.properties.type.enum).not.toContain('fresh_flowers');
    expect(schema.properties.support_elements.items.properties.type.enum).not.toContain('artificial_flowers');
    expect(schema.properties.main_toppers.items.properties.type.enum).toContain('icing_doodle_intricate_top');
    expect(schema.properties.main_toppers.items.properties.type.enum).not.toContain('icing_doodle_intricate');
    expect(schema.properties.main_toppers.items.properties.type.enum).not.toContain('icing_palette_knife_intricate');
    expect(schema.properties.main_toppers.items.properties.type.enum).not.toContain('edible_photo_print');
    expect(schema.properties.main_toppers.items.properties.type.enum).toContain('edible_2d_complex');
    expect(schema.properties.main_toppers.items.properties.type.enum).toContain('edible_crown');
    expect(schema.properties.support_elements.items.properties.type.enum).not.toContain('edible_2d_complex');
    expect(schema.properties.support_elements.items.properties.type.enum).toContain('icing_doodle_intricate_side');
    expect(schema.properties.support_elements.items.properties.type.enum).toContain('plastic_ball_regular');
    expect(schema.properties.support_elements.items.properties.type.enum).not.toContain('plastic_ball');
    expect(schema.properties).not.toHaveProperty('is_tall_proportion');
    expect(schema.properties.main_toppers.items.properties).not.toHaveProperty('digits');
    expect(schema.properties.main_toppers.items.properties).not.toHaveProperty('x');
    expect(schema.properties.support_elements.items.properties).not.toHaveProperty('bbox');
    expect(schema.properties).not.toHaveProperty('icing_surfaces');
    expect(schema.properties.main_toppers.items.properties.subtype.enum).toContain('ferrero');
    expect(schema.properties.main_toppers.items.properties.type.enum).toContain('plastic_ball');
    expect(schema.properties.main_toppers.items.properties.material.enum).toContain('photopaper');
    expect(schema.properties.icing_design.required).toContain('gumpasteBaseBoard');
    expect(schema.properties.icing_design.required).toEqual(expect.arrayContaining([
      'drip',
      'border_top',
      'border_base',
    ]));
    expect(schema.properties.icing_design.properties.colors.required).toEqual(['side', 'top']);
    expect(schema.properties.icing_design.properties.gumpasteBaseBoard.type).toBeDefined();
    expect(schema.properties.cakeType.description).toContain('Bento Cupcake Set');
    expect(schema.properties.cakeType.description).toContain('Slab Cake');
    expect(schema.properties.cakeThickness.description).toContain('6 in');
    expect(schema.properties.cakeThickness.description).toContain('Slab Cake = 6 in');
    expect(schema.properties.cakeThickness.description).toContain(
      'every Fondant cake type, including tiered, Square Fondant, and Rectangle Fondant = 5 in or 6 in',
    );
    expect(schema.properties.cakeType).not.toHaveProperty('enum');
    expect(schema.properties.cakeThickness).not.toHaveProperty('enum');
  });

  it('keeps the model-provided thickness without fabricating coordinates', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      cakeThickness: '6 in',
    }), typeEnums);

    expect(result.cakeThickness).toBe('6 in');
    expect(result).not.toHaveProperty('is_tall_proportion');
  });

  it('rejects forbidden legacy generated fields instead of silently deleting them', () => {
    expect(() => postProcessSearchAnalysisResult(validAnalysis({
      is_tall_proportion: true,
    }), typeEnums)).toThrow(/unsupported field.*is_tall_proportion/i);
  });

  it('accepts canonical blank rejection fields and validates subtype by item type', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'chocolates',
        material: 'candy',
        group_id: 'chocolate-1',
        color: '#8B4513',
        size: 'small',
        quantity: 2,
        description: 'Ferrero chocolates',
        subtype: 'ferrero',
      }],
    }), typeEnums);

    expect(result.rejection).toEqual({ isRejected: false, reason: '', message: '' });
    expect(result.support_elements[0].subtype).toBe('ferrero');
  });

  it('rejects invalid generated-only fields, quantities, subtypes, and unknown cake thicknesses', () => {
    expect(() => postProcessSearchAnalysisResult(validAnalysis({
      main_toppers: [{
        type: 'printout',
        material: 'photopaper',
        group_id: 'printout-1',
        classification: 'hero',
        size: 'small',
        quantity: 0,
        description: 'Printed character',
        x: 0.5,
      }],
    }), typeEnums)).toThrow(/unsupported field.*x/i);

    expect(() => postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'chocolates',
        material: 'candy',
        group_id: 'chocolate-1',
        color: '#8B4513',
        size: 'small',
        quantity: 1,
        description: 'Chocolate',
        subtype: 'unsupported',
      }],
    }), typeEnums)).toThrow(/subtype/i);

    expect(() => postProcessSearchAnalysisResult(validAnalysis({
      cakeType: 'Bento',
      cakeThickness: '7 in',
    }), typeEnums)).toThrow(/cakeThickness/i);

    expect(() => postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'plastic_ball',
        material: 'plastic',
        group_id: 'support-ball',
        color: '#FFD700',
        size: 'small',
        quantity: 1,
        description: 'supporting gold plastic ball',
      }],
    }), typeEnums)).toThrow(/support_elements\[0\]\.type/i);
  });

  it.each([
    ['1 Tier Fondant', '4 in', '5 in'],
    ['2 Tier Fondant', '4 in', '5 in'],
    ['3 Tier Fondant', '3 in', '5 in'],
    ['Square Fondant', '4 in', '5 in'],
    ['Rectangle Fondant', '3 in', '5 in'],
    ['1 Tier Fondant', '6 in', '6 in'],
    ['2 Tier', '6 in', '5 in'],
    ['Square', '5 in', '4 in'],
    ['Slab Cake', '4 in', '6 in'],
    ['Slab Cake', '6 in', '6 in'],
    ['Bento', '4 in', '2 in'],
    ['Cupcake', '3 in', '2 in'],
    ['Bento Cupcake Set', '5 in', '2 in'],
  ])(
    'reconciles %s thickness %s to the allowed %s choice',
    (cakeType, cakeThickness, expectedThickness) => {
      const result = postProcessSearchAnalysisResult(validAnalysis({
        cakeType,
        cakeThickness,
        icing_design: {
          ...validAnalysis().icing_design,
          base: cakeType.includes('Fondant') ? 'fondant' : 'soft_icing',
        },
      }), typeEnums);

      expect(result.cakeThickness).toBe(expectedThickness);
    },
  );

  it('reconciles on a copy and still enforces the Fondant icing base', () => {
    const generated = validAnalysis({
      cakeType: '1 Tier Fondant',
      cakeThickness: '4 in',
      icing_design: {
        ...validAnalysis().icing_design,
        base: 'fondant',
      },
    });

    const result = postProcessSearchAnalysisResult(generated, typeEnums);

    expect(result.cakeThickness).toBe('5 in');
    expect(generated.cakeThickness).toBe('4 in');
    expect(() => postProcessSearchAnalysisResult(validAnalysis({
      cakeType: '1 Tier Fondant',
      cakeThickness: '4 in',
    }), typeEnums)).toThrow(/requires fondant/i);
  });

  it('normalizes repeated tiny sugar pearls to one candy sprinkles support item', () => {
    const generated = validAnalysis({
      support_elements: [{
        type: 'edible_3d_ordinary',
        material: 'edible_fondant',
        group_id: 'tiny_white_sugar_pearls',
        color: '#FFFFFF',
        size: 'tiny',
        quantity: 15,
        description: 'tiny white sugar pearl beads scattered on top and sides',
      }],
    });

    const result = postProcessSearchAnalysisResult(generated, typeEnums);

    expect(result.support_elements).toEqual([expect.objectContaining({
      type: 'sprinkles',
      material: 'candy',
      quantity: 1,
    })]);
    expect((generated.support_elements as Array<Record<string, unknown>>)[0]).toMatchObject({
      type: 'edible_3d_ordinary',
      material: 'edible_fondant',
      quantity: 15,
    });
  });

  it('does not invent a conditioned wafer-paper wave row from generic vertical-wave prose', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      alt_text: 'White minimalist birthday cake with vertical textured waves, white flowers, and a gold candle.',
      seo_description: 'A white cake has distinctive vertical wave textured sides around the full cake perimeter.',
    }), typeEnums);

    expect(result.support_elements).toEqual([]);
  });

  it('drops explicit scene-only items while retaining an attached cake member', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [
        {
          type: 'edible_flowers',
          material: 'edible_fondant',
          group_id: 'scene_flowers',
          color: '#FFC0CB',
          size: 'medium',
          quantity: 4,
          description: 'pink flowers in the background',
        },
        {
          type: 'edible_flowers',
          material: 'edible_fondant',
          group_id: 'attached_flowers',
          color: '#FFC0CB',
          size: 'medium',
          quantity: 2,
          description: 'pink flowers attached to the cake side',
        },
      ],
    }), typeEnums);

    expect(result.support_elements).toEqual([expect.objectContaining({
      group_id: 'attached_flowers',
    })]);
  });

  it('does not convert explicitly piped, buttercream, palette-knife, spatula, or combed side waves', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      alt_text: 'White cake with piped vertical buttercream waves around the sides.',
      seo_description: 'The palette-knife frosting creates a continuous textured wave side finish.',
    }), typeEnums);

    expect(result.support_elements).toEqual([]);
  });

  it('removes a model-emitted wafer-wave row without all direct construction evidence', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'edible_photo_side_wave',
        material: 'waferpaper',
        group_id: 'conditioned_waferpaper_vertical_wave_side_wrap',
        color: '#FFFFFF',
        size: 'large',
        quantity: 3,
        description: 'white conditioned wafer paper vertical wave side wrap',
      }],
    }), typeEnums);

    expect(result.support_elements).toEqual([]);
  });

  it('retains an evidence-backed conditioned wafer-paper wave row', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'edible_photo_side_wave',
        material: 'waferpaper',
        group_id: 'conditioned_waferpaper_vertical_wave_side_wrap',
        color: '#FFFFFF',
        size: 'large',
        quantity: 3,
        description: 'repeated full-height perimeter wrap of distinct separate thin upright wafer paper strips with loose free wavy edges',
      }],
    }), typeEnums);

    expect(result.support_elements).toEqual([expect.objectContaining({
      type: 'edible_photo_side_wave',
      material: 'waferpaper',
      quantity: 3,
    })]);
  });

  it('retains the concise direct-construction description emitted for the true wafer-wave reference', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'edible_photo_side_wave',
        material: 'waferpaper',
        group_id: 'wafer_paper_side_wrap',
        color: '#FFFFFF',
        size: 'large',
        quantity: 1,
        description: 'repeated vertical white wafer-paper side wrap with loose wavy edges',
      }],
    }), typeEnums);

    expect(result.support_elements).toEqual([expect.objectContaining({
      type: 'edible_photo_side_wave',
      material: 'waferpaper',
      quantity: 1,
      description: 'repeated vertical white wafer-paper side wrap with loose wavy edges',
    })]);
  });

  it('keeps a single substantial fondant pearl as an ordinary 3D support item', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'edible_3d_ordinary',
        material: 'edible_fondant',
        group_id: 'small_fondant_pearl',
        color: '#FFFFFF',
        size: 'small',
        quantity: 1,
        description: 'one small molded fondant pearl decoration',
      }],
    }), typeEnums);

    expect(result.support_elements[0]).toMatchObject({
      type: 'edible_3d_ordinary',
      material: 'edible_fondant',
      quantity: 1,
    });
  });

  it.each([
    ['colorful sprinkles on top', 'edible_2d_support'],
    ['tiny red heart sprinkles scattered across the sides', 'icing_decorations'],
    ['pink and gold sprinkles scattered on top', 'edible_2d_support'],
    ['red, white & blue sprinkles around the base', 'edible_2d_support'],
    ['pink, gold, and white sprinkles on top', 'edible_2d_support'],
    ['red and white and blue sprinkles on top', 'edible_2d_support'],
  ])('corrects %s to one candy sprinkles row', (description, generatedType) => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: generatedType,
        material: generatedType === 'icing_decorations' ? 'icing' : 'edible_fondant',
        group_id: 'tiny_red_accents',
        color: '#FF0000',
        size: 'tiny',
        quantity: 12,
        description,
      }],
    }), typeEnums);

    expect(result.support_elements).toEqual([expect.objectContaining({
      type: 'sprinkles',
      material: 'candy',
      quantity: 1,
    })]);
  });

  it('corrects explicit edible flowers without changing their support role', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'edible_3d_ordinary',
        material: 'candy',
        group_id: 'small_pink_flowers',
        color: '#FFC0CB',
        size: 'small',
        quantity: 3,
        description: 'small pink fondant flowers',
      }],
    }), typeEnums);

    expect(result.main_toppers).toEqual([]);
    expect(result.support_elements[0]).toMatchObject({
      type: 'edible_flowers',
      material: 'edible_fondant',
      quantity: 3,
    });
  });

  it('moves an explicit complex edible 3D object to a hero main row and clears its old subtype', () => {
    const generated = validAnalysis({
      support_elements: [{
        type: 'edible_3d_ordinary',
        material: 'candy',
        group_id: 'medium_dragon',
        color: '#008000',
        size: 'medium',
        quantity: 1,
        description: 'detailed edible 3D dragon figure',
        subtype: 'ice_cream_cone',
      }],
    });

    const result = postProcessSearchAnalysisResult(generated, typeEnums);

    expect(result.support_elements).toEqual([]);
    expect(result.main_toppers).toEqual([expect.objectContaining({
      type: 'edible_3d_complex',
      material: 'edible_fondant',
      classification: 'hero',
      description: 'detailed edible 3D dragon figure',
    })]);
    expect(result.main_toppers[0]).not.toHaveProperty('subtype');
    expect((generated.support_elements as Array<Record<string, unknown>>)[0]).toHaveProperty(
      'type',
      'edible_3d_ordinary',
    );
  });

  it.each([
    ['fondant donuts with sprinkles', 'edible_3d_ordinary', 'edible_fondant'],
    ['meringue kisses with sprinkles', 'meringue', 'candy'],
    ['piped icing dollops topped with sprinkles', 'icing_decorations', 'icing'],
  ])('preserves the primary object in composite description: %s', (description, type, material) => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type,
        material,
        group_id: 'composite_primary',
        color: '#FFFFFF',
        size: 'small',
        quantity: 2,
        description,
      }],
    }), typeEnums);

    expect(result.support_elements[0]).toMatchObject({ type, material, quantity: 2 });
  });

  it.each([
    'small fondant figure decoration',
    'simple fondant shape',
    'fondant flowers and sprinkles',
    'gold round metallic pearl sprinkle dragees',
    'white fondant candle holders',
    'fondant clouds behind the number candle',
    'hand-sculpted fondant lion wearing a crown',
    'fondant vase holding edible flowers',
    'fondant lion surrounded by edible flowers',
    'sprinkle-covered fondant donut',
    'sprinkle donut topper',
    'fondant toy car',
  ])('leaves generic or ambiguous primary wording unchanged: %s', (description) => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'edible_3d_ordinary',
        material: 'edible_fondant',
        group_id: 'ambiguous_item',
        color: '#FFFFFF',
        size: 'small',
        quantity: 1,
        description,
      }],
    }), typeEnums);

    expect(result.support_elements[0]).toMatchObject({
      type: 'edible_3d_ordinary',
      material: 'edible_fondant',
    });
  });

  it('moves a main sprinkles row to support only when it already has a usable color', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      main_toppers: [{
        type: 'edible_3d_ordinary',
        material: 'edible_fondant',
        group_id: 'rainbow_sprinkles',
        classification: 'support',
        color: '#FF0000',
        size: 'tiny',
        quantity: 20,
        description: 'rainbow sprinkles scattered on top',
        subtype: 'ice_cream_cone',
      }],
    }), typeEnums);

    expect(result.main_toppers).toEqual([]);
    expect(result.support_elements).toEqual([expect.objectContaining({
      type: 'sprinkles',
      material: 'candy',
      color: '#FF0000',
      quantity: 1,
    })]);
    expect(result.support_elements[0]).not.toHaveProperty('classification');
    expect(result.support_elements[0]).not.toHaveProperty('subtype');
  });

  it('uses an existing colors entry when a canonical support row is missing color', () => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'sprinkles',
        material: 'candy',
        group_id: 'red_sprinkles',
        colors: ['#FF0000'],
        size: 'tiny',
        quantity: 1,
        description: 'red sprinkles scattered on top',
      }],
    }), typeEnums);

    expect(result.support_elements[0]).toMatchObject({
      type: 'sprinkles',
      material: 'candy',
      color: '#FF0000',
    });
  });

  it.each([
    ['premium gold sprinkles', 'premium_sprinkles', 'candy'],
    ['silver dragees', 'dragees', 'candy'],
    ['piped icing sprinkles on the sides', 'icing_decorations', 'icing'],
    ['cluster of edible flowers', 'edible_flowers', 'edible_fondant'],
    ['bouquet of fondant flowers', 'edible_flowers', 'edible_fondant'],
    ['small fondant edible 3D ordinary topper', 'edible_3d_ordinary', 'edible_fondant'],
    ['small printed paper cutout', 'support_printout', 'photopaper'],
  ])('maps explicit support wording %s to %s', (description, type, material) => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      support_elements: [{
        type: 'edible_3d_ordinary',
        material: 'edible_fondant',
        group_id: 'explicit_support_item',
        color: '#C0C0C0',
        size: 'small',
        quantity: 2,
        description,
      }],
    }), typeEnums);

    expect(result.support_elements[0]).toMatchObject({ type, material });
  });

  it.each([
    ['single birthday candle', 'candle', 'wax'],
    ['set of birthday candles', 'candle', 'wax'],
    ['fondant edible crown', 'edible_crown', 'edible_fondant'],
    ['metallic fondant crown', 'edible_crown', 'edible_fondant'],
    ['plastic rhinestone tiara', 'plastic_crown', 'plastic'],
    ['printed paper printout', 'printout', 'photopaper'],
    ['gold cardstock topper', 'cardstock', 'cardstock'],
    ['small plastic toy', 'toy', 'plastic'],
  ])('maps explicit main wording %s to %s', (description, type, material) => {
    const result = postProcessSearchAnalysisResult(validAnalysis({
      main_toppers: [{
        type: 'edible_3d_ordinary',
        material: 'edible_fondant',
        group_id: 'explicit_main_item',
        classification: 'support',
        size: 'small',
        quantity: 1,
        description,
      }],
    }), typeEnums);

    expect(result.main_toppers[0]).toMatchObject({
      type,
      material,
      classification: 'hero',
    });
  });

  it('requires exact rejection messages and complete icing colors', () => {
    const rejected = validAnalysis({
      cakeType: '',
      cakeThickness: '',
      keyword: '',
      alt_text: '',
      seo_title: '',
      seo_description: '',
      rejection: {
        isRejected: true,
        reason: 'not_a_cake',
        message: "This image doesn't appear to be a cake. Please upload a cake image.",
      },
    });
    expect(postProcessSearchAnalysisResult(rejected, typeEnums).rejection.isRejected).toBe(true);

    expect(() => postProcessSearchAnalysisResult({
      ...rejected,
      rejection: {
        isRejected: true,
        reason: 'not_a_cake',
        message: 'Wrong message',
      },
    }, typeEnums)).toThrow(/canonical message/i);

    expect(() => postProcessSearchAnalysisResult({
      ...rejected,
      icing_design: {
        ...(rejected.icing_design as Record<string, unknown>),
        drip: true,
      },
    }, typeEnums)).toThrow(/default icing design/i);

    expect(() => postProcessSearchAnalysisResult(validAnalysis({
      icing_design: {
        base: 'soft_icing',
        color_type: 'single',
        colors: { side: '#FFFFFF' },
        drip: false,
        border_top: false,
        border_base: false,
        gumpasteBaseBoard: false,
      },
    }), typeEnums)).toThrow(/top/i);

    expect(() => postProcessSearchAnalysisResult(validAnalysis({
      icing_design: {
        base: 'soft_icing',
        color_type: 'single',
        colors: { side: '#FFFFFF', top: '#FFFFFF' },
        drip: false,
        border_top: false,
        border_base: false,
        gumpasteBaseBoard: true,
      },
    }), typeEnums)).toThrow(/gumpasteBaseBoardColor/i);
  });
});
