import { describe, expect, it } from 'vitest';

import {
  buildSearchAnalysisResponseSchema,
  postProcessSearchAnalysisResult,
  SEARCH_ANALYSIS_COLOR_TYPES,
  SEARCH_ANALYSIS_ICING_BASES,
  SEARCH_ANALYSIS_REJECTION_REASONS,
} from './searchAnalysisContract';

describe('search analysis contract', () => {
  it('includes the canonical rejection reasons and enums used by the prompt', () => {
    const schema = buildSearchAnalysisResponseSchema({
      mainTopperTypes: [
        'printout',
        'icing_doodle',
        'icing_doodle_intricate',
        'icing_doodle_intricate_top',
        'edible_photo_top',
      ],
      supportElementTypes: [
        'sprinkles',
        'fresh_flowers',
        'edible_flowers',
        'icing_doodle',
        'icing_doodle_intricate_side',
      ],
    }) as Record<string, any>;

    expect(SEARCH_ANALYSIS_REJECTION_REASONS).toContain('payment_receipt');
    expect(SEARCH_ANALYSIS_REJECTION_REASONS).toContain('selfie');
    expect(schema.properties.rejection.properties.reason.enum).toContain('payment_receipt');
    expect(schema.properties.rejection.properties.reason.enum).toContain('selfie');
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
    expect(schema.properties.main_toppers.items.properties.type.enum).toContain('icing_doodle_intricate_top');
    expect(schema.properties.main_toppers.items.properties.type.enum).not.toContain('icing_doodle_intricate');
    expect(schema.properties.support_elements.items.properties.type.enum).toContain('icing_doodle_intricate_side');
    expect(schema.properties).not.toHaveProperty('is_tall_proportion');
    expect(schema.properties.icing_design.required).toContain('gumpasteBaseBoard');
    expect(schema.properties.icing_design.properties.gumpasteBaseBoard.type).toBeDefined();
  });

  it('keeps the model-provided thickness without fabricating coordinates', () => {
    const result = postProcessSearchAnalysisResult({
      cakeThickness: '6 in',
      is_tall_proportion: true,
      main_toppers: [{}],
      support_elements: [{}],
      cake_messages: [{}],
    });

    expect(result.cakeThickness).toBe('6 in');
    expect(result).not.toHaveProperty('is_tall_proportion');
    expect(result.main_toppers).toEqual([{}]);
    expect(result.support_elements).toEqual([{}]);
    expect(result.cake_messages).toEqual([{}]);
  });
});
