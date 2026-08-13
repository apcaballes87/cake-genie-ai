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
    'edible_3d_ordinary',
    'plastic_ball',
  ],
  supportElementTypes: [
    'sprinkles',
    'fresh_flowers',
    'artificial_flowers',
    'edible_flowers',
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
    expect(schema.properties.support_elements.items.properties.type.enum).not.toContain('fresh_flowers');
    expect(schema.properties.support_elements.items.properties.type.enum).not.toContain('artificial_flowers');
    expect(schema.properties.main_toppers.items.properties.type.enum).toContain('icing_doodle_intricate_top');
    expect(schema.properties.main_toppers.items.properties.type.enum).not.toContain('icing_doodle_intricate');
    expect(schema.properties.main_toppers.items.properties.type.enum).not.toContain('icing_palette_knife_intricate');
    expect(schema.properties.main_toppers.items.properties.type.enum).not.toContain('edible_photo_print');
    expect(schema.properties.main_toppers.items.properties.type.enum).toContain('edible_2d_complex');
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
    expect(schema.properties.cakeThickness.description).toContain('6 in');
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
