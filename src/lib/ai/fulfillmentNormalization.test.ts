import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRINTOUT_SOURCE_TYPES,
  normalizeAnalysisForDefaultFulfillment,
} from './fulfillmentNormalization';
import type { HybridAnalysisResult, MainTopperType } from '@/types';

function analysisWithTopper(type: MainTopperType): HybridAnalysisResult {
  return {
    cakeType: '1 Tier',
    cakeThickness: '4 in',
    main_toppers: [{
      type,
      material: 'plastic',
      description: `${type} character`,
      size: 'medium',
      quantity: 1,
      group_id: type,
      classification: 'hero',
    }],
    support_elements: [],
    cake_messages: [],
    icing_design: {
      base: 'soft_icing',
      color_type: 'single',
      colors: { side: '#FFFFFF', top: '#FFFFFF' },
      border_top: false,
      border_base: false,
      drip: false,
      gumpasteBaseBoard: false,
    },
  };
}

describe('default fulfillment normalization', () => {
  it.each(DEFAULT_PRINTOUT_SOURCE_TYPES)(
    'converts raw %s to a printout while preserving source provenance',
    (sourceType) => {
      const raw = analysisWithTopper(sourceType);
      const normalized = normalizeAnalysisForDefaultFulfillment(raw);

      expect(normalized.main_toppers[0]).toMatchObject({
        type: 'printout',
        original_type: sourceType,
        printout_source_type: sourceType,
      });
      expect(raw.main_toppers[0]).toMatchObject({
        type: sourceType,
      });
      expect(raw.main_toppers[0]).not.toHaveProperty('printout_source_type');
    },
  );

  it('leaves an explicit paid physical selection unchanged', () => {
    const raw = analysisWithTopper('toy');
    const normalized = normalizeAnalysisForDefaultFulfillment(raw);
    const explicitlyPhysical = {
      ...normalized.main_toppers[0],
      type: 'toy' as const,
    };

    expect(explicitlyPhysical).toMatchObject({
      type: 'toy',
      original_type: 'toy',
      printout_source_type: 'toy',
    });
  });
});
