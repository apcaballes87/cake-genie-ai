import { describe, expect, it } from 'vitest';

import { MAIN_TOPPER_TYPES, SUBTYPES_BY_TYPE, SUPPORT_ELEMENT_TYPES } from '@/constants/pricingEnums';
import { buildSearchAnalysisResponseSchema, postProcessSearchAnalysisResult } from './searchAnalysisContract';

const typeEnums = {
  mainTopperTypes: [...MAIN_TOPPER_TYPES],
  supportElementTypes: [...SUPPORT_ELEMENT_TYPES],
  subtypesByType: Object.fromEntries(Object.entries(SUBTYPES_BY_TYPE).map(([type, subtypes]) => [type, [...subtypes]])),
};

function analysisWithSupport(type: string) {
  return {
    cakeType: 'Bento',
    cakeThickness: '2 in',
    cake_measurements: {
      diameter: { start: { x: 100, y: 300 }, end: { x: 500, y: 300 } },
      height: { start: { x: 300, y: 300 }, end: { x: 300, y: 500 } },
    },
    main_toppers: [],
    support_elements: [{
      type,
      material: 'edible_fondant',
      group_id: 'separate_decorative_pieces',
      color: '#FFFFFF',
      quantity: 3,
      size_line: { start: { x: 600, y: 300 }, end: { x: 600, y: 400 } },
      description: type === 'cupcake_topper' ? 'three individual cupcakes beside the bento' : 'separate decorative gumpaste letter shapes',
    }],
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
    rejection: { isRejected: false, reason: '', message: '' },
  };
}

describe('v3.83 support element contract', () => {
  it.each(['cupcake_topper', 'gumpaste_letters'])('filters and rejects deferred support type %s', (type) => {
    const dynamicEnums = {
      ...typeEnums,
      supportElementTypes: [...typeEnums.supportElementTypes, type],
    };
    const schema = buildSearchAnalysisResponseSchema(dynamicEnums, 'local_line_ratio');
    expect(schema.properties.support_elements.items.properties.type.enum).not.toContain(type);
    expect(() => postProcessSearchAnalysisResult(
      analysisWithSupport(type), dynamicEnums, 'local_line_ratio',
    )).toThrow(/support_elements\[0\]\.type/);
  });

  it('rejects an invented support type even if supplied by a dynamic pricing enum', () => {
    const dynamicEnums = {
      ...typeEnums,
      supportElementTypes: [...typeEnums.supportElementTypes, 'invented_cupcake_decoration'],
    };
    const schema = buildSearchAnalysisResponseSchema(dynamicEnums, 'local_line_ratio');
    expect(schema.properties.support_elements.items.properties.type.enum).not.toContain('invented_cupcake_decoration');
    expect(() => postProcessSearchAnalysisResult(
      analysisWithSupport('invented_cupcake_decoration'), dynamicEnums, 'local_line_ratio',
    )).toThrow(/support_elements\[0\]\.type/);
  });
});
