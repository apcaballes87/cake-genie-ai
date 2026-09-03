import { describe, expect, it } from 'vitest';

import {
  ANALYSIS_SIZE_SCHEMA,
  getLegacySourceSizeForCanonicalSize,
  normalizeAnalysisForThreeBandSizing,
  normalizeLegacyAnalysisSize,
} from './analysisSize';
import type { HybridAnalysisResult } from '@/types';

const baseAnalysis = (size: 'tiny' | 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge') => ({
  cakeType: '1 Tier',
  cakeThickness: '4 in',
  main_toppers: [{
    type: 'edible_3d_ordinary',
    description: 'fondant topper',
    size,
    quantity: 1,
    group_id: 'fondant_topper',
    classification: 'hero',
  }],
  support_elements: [{
    type: 'edible_2d_support',
    description: 'fondant star',
    size,
    group_id: 'fondant_star',
  }],
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
}) satisfies HybridAnalysisResult;

describe('three-band analysis sizing', () => {
  it.each([
    ['tiny', 'small'],
    ['xsmall', 'small'],
    ['small', 'medium'],
    ['medium', 'medium'],
    ['large', 'large'],
    ['xlarge', 'large'],
  ] as const)('maps legacy %s to canonical %s', (legacy, canonical) => {
    expect(normalizeLegacyAnalysisSize(legacy)).toBe(canonical);
  });

  it('hydrates an unmarked cached analysis into a detached canonical copy', () => {
    const cached = baseAnalysis('small');

    const normalized = normalizeAnalysisForThreeBandSizing(cached);

    expect(normalized).not.toBe(cached);
    expect(normalized.analysis_size_schema).toBe(ANALYSIS_SIZE_SCHEMA);
    expect(normalized.main_toppers[0].size).toBe('medium');
    expect(normalized.support_elements[0].size).toBe('medium');
    expect(cached.analysis_size_schema).toBeUndefined();
    expect(cached.main_toppers[0].size).toBe('small');
    expect(cached.support_elements[0].size).toBe('small');
  });

  it('is idempotent for marked three-band analyses and preserves their meaning', () => {
    const fresh = {
      ...baseAnalysis('small'),
      analysis_size_schema: ANALYSIS_SIZE_SCHEMA,
    } satisfies HybridAnalysisResult;

    const normalized = normalizeAnalysisForThreeBandSizing(fresh);

    expect(normalized).toBe(fresh);
    expect(normalized.main_toppers[0].size).toBe('small');
    expect(normalized.support_elements[0].size).toBe('small');
  });

  it('uses the former higher legacy band only for the compatibility pricing path', () => {
    expect(getLegacySourceSizeForCanonicalSize('small')).toBe('xsmall');
    expect(getLegacySourceSizeForCanonicalSize('medium')).toBe('medium');
    expect(getLegacySourceSizeForCanonicalSize('large')).toBe('xlarge');
  });
});
