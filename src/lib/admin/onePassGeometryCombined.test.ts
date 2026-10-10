import { describe, expect, it } from 'vitest';

import {
  ONE_PASS_GEOMETRY_COMBINED_MODE,
  ONE_PASS_GEOMETRY_COMBINED_PROMPT,
  attachCombinedGeometryToAnalysis,
  combinedGeometryResponseSchema,
  validateOnePassGeometryCombinedResponse,
  type CombinedGeometry,
} from './onePassGeometryCombined';

const analysis = { rejection: { isRejected: false, reason: '', message: '' } };
const geometry = {
  geometry_version: ONE_PASS_GEOMETRY_COMBINED_MODE,
  cake_diameter_line: { start: [400, 100], end: [400, 900] },
  cake_height_line: { start: [400, 500], end: [850, 500] },
  elements: [{
    element_id: 'gold_number_candle', label: 'Gold number candle', category: 'candle', description: 'One gold number candle.',
    belongs_to_cake_design: true, visible_count: 1, box_2d: [100, 420, 390, 570], confidence: 0.95,
  }],
};

describe('true one-pass geometry contract', () => {
  it('validates one response containing analysis and exhaustive geometry', () => {
    expect(validateOnePassGeometryCombinedResponse({ analysis, geometry })).toEqual({ analysis, geometry });
    expect(ONE_PASS_GEOMETRY_COMBINED_PROMPT).toContain('one JSON object with two fields');
    expect(ONE_PASS_GEOMETRY_COMBINED_PROMPT).toContain('valid size string');
    expect(ONE_PASS_GEOMETRY_COMBINED_PROMPT).toContain('front-center vertical axis');
  });

  it('rejects duplicate, malformed, off-center, and out-of-range geometry', () => {
    expect(() => validateOnePassGeometryCombinedResponse({ analysis, geometry: { ...geometry, elements: [geometry.elements[0], geometry.elements[0]] } })).toThrow(/duplicate/i);
    expect(() => validateOnePassGeometryCombinedResponse({ analysis, geometry: { ...geometry, cake_height_line: { start: [400, 800], end: [850, 800] } } })).toThrow(/front-center/i);
    expect(() => validateOnePassGeometryCombinedResponse({ analysis, geometry: { ...geometry, elements: [{ ...geometry.elements[0], box_2d: [0, 0, 1001, 100] }] } })).toThrow(/0–1000/i);
    expect(() => validateOnePassGeometryCombinedResponse({ analysis, geometry: { ...geometry, elements: [{ ...geometry.elements[0], box_2d: [300, 400, 100, 500] }] } })).toThrow(/positive ordered/i);
  });

  it('canonicalizes reversed measurement endpoints without changing the measured segments', () => {
    const result = validateOnePassGeometryCombinedResponse({
      analysis,
      geometry: {
        ...geometry,
        cake_diameter_line: { start: [400, 900], end: [400, 100] },
        cake_height_line: { start: [850, 500], end: [400, 500] },
      },
    });
    expect(result.geometry.cake_diameter_line).toEqual({ start: [400, 100], end: [400, 900] });
    expect(result.geometry.cake_height_line).toEqual({ start: [400, 500], end: [850, 500] });
  });

  it('requires direct-sizing model output to include main sizes while preserving filler exception', () => {
    const schema = combinedGeometryResponseSchema({
      mainTopperTypes: ['edible_3d_complex'],
      supportElementTypes: ['edible_3d_ordinary', 'edible_flowers_filler'],
      subtypesByType: {},
    } as never, 'ai_diameter_anchor') as unknown as { properties: { analysis: { properties: Record<string, { items?: { required?: string[]; anyOf?: Array<{ required?: string[] }> } }> } } };
    const analysisSchema = schema.properties.analysis.properties;
    expect(analysisSchema.main_toppers.items?.required).toContain('size');
    expect(analysisSchema.support_elements.items?.anyOf?.some((branch) => branch.required?.includes('size'))).toBe(true);
    expect(analysisSchema.support_elements.items?.anyOf?.some((branch) => !branch.required?.includes('size'))).toBe(true);
  });

  it('requires empty geometry for a rejected analysis', () => {
    const rejected = { rejection: { isRejected: true, reason: 'multiple_cakes', message: 'Use one cake.' } };
    expect(validateOnePassGeometryCombinedResponse({ analysis: rejected, geometry: { geometry_version: ONE_PASS_GEOMETRY_COMBINED_MODE, elements: [] } }).geometry.elements).toEqual([]);
    expect(() => validateOnePassGeometryCombinedResponse({ analysis: rejected, geometry })).toThrow(/contain exactly/i);
  });

  it('requires the nested analysis to declare an accepted or rejected state', () => {
    expect(() => validateOnePassGeometryCombinedResponse({ analysis: {}, geometry })).toThrow(/analysis\.rejection must be an object/i);
    expect(() => validateOnePassGeometryCombinedResponse({ analysis: { rejection: { isRejected: 'false' } }, geometry })).toThrow(/isRejected.*boolean/i);
  });

  it('attaches matched geometry to analysis rows while preserving unmatched geometry-only elements', () => {
    const analysisWithRows = {
      ...analysis,
      main_toppers: [{ group_id: 'female_figurine', description: 'Female figurine' }],
      support_elements: [{ group_id: 'logo_plaque', description: 'Logo plaque' }],
    };
    const geometryWithRows = {
      ...geometry,
      elements: [
        { ...geometry.elements[0], element_id: 'female_figurine_elem', label: 'female_figurine', category: 'main_toppers', description: 'Female figurine' },
        { ...geometry.elements[0], element_id: 'logo_plaque_elem', label: 'logo_plaque', category: 'support_elements', description: 'Logo plaque' },
        geometry.elements[0],
      ],
    };
    const attached = attachCombinedGeometryToAnalysis(analysisWithRows, geometryWithRows as unknown as CombinedGeometry);
    expect((attached.main_toppers as Record<string, unknown>[])[0].geometry).toMatchObject({ element_id: 'female_figurine_elem', box_2d: geometry.elements[0].box_2d });
    expect((attached.support_elements as Record<string, unknown>[])[0].geometry).toMatchObject({ element_id: 'logo_plaque_elem', confidence: geometry.elements[0].confidence });
    expect(attached).toMatchObject({ main_toppers: [{ group_id: 'female_figurine' }], support_elements: [{ group_id: 'logo_plaque' }] });
    expect(geometryWithRows.elements).toHaveLength(3);
  });
});
