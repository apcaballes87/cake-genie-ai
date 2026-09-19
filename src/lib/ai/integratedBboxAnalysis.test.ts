import { describe, expect, it } from 'vitest';

import { GeneratedAnalysisContractError } from '@/lib/ai/generatedAnalysisContract';
import {
  buildSearchAnalysisGenerationConfig,
  getAnalysisGenerationSizeSchema,
  postProcessSearchAnalysisResult,
} from '@/lib/admin/searchAnalysisContract';
import type { HybridAnalysisResult } from '@/types';
import { hasBoundingBoxData, needsCoordinateEnrichment } from '@/lib/utils/analysisUtils';

const typeEnums = {
  mainTopperTypes: ['edible_3d_complex', 'piped_flowers_top'],
  supportElementTypes: ['edible_flowers_filler', 'piped_flowers_side'],
};

function acceptedAnalysis(overrides: Record<string, unknown> = {}) {
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
    rejection: { isRejected: false, reason: '', message: '' },
    ...overrides,
  };
}

function acceptedEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    analysis: acceptedAnalysis(),
    geometry: {
      geometry_version: 'integrated_bbox_v1',
      cake_diameter_line: { start: [300, 100], end: [300, 200] },
      cake_height_line: { start: [300, 150], end: [400, 150] },
    },
    ...overrides,
  };
}

function process(result: unknown) {
  return postProcessSearchAnalysisResult(result, typeEnums, 'integrated_bbox_v1');
}

describe('integrated_bbox_v1 analysis', () => {
  it('uses one Gemini envelope and requires row-attached geometry without model-owned size', () => {
    expect(getAnalysisGenerationSizeSchema('3.92')).toBe('integrated_bbox_v1');
    const config = buildSearchAnalysisGenerationConfig(typeEnums, 'integrated_bbox_v1');
    expect(config.responseSchema.required).toEqual(['analysis', 'geometry']);
    expect(config.systemInstruction).toContain('V3.92 INTEGRATED BOUNDING-BOX PRECEDENCE');
    expect(config.systemInstruction).toContain('Never emit a model-owned size');
    const analysisSchema = (config.responseSchema as unknown as {
      properties: {
        analysis: {
          properties: {
            main_toppers: { items: { properties: Record<string, unknown>; required: string[] } };
            cake_messages: { items: { required: string[] } };
          };
        };
      };
    }).properties.analysis;
    expect(analysisSchema.properties.main_toppers.items.properties).not.toHaveProperty('size');
    expect(analysisSchema.properties.main_toppers.items.required).toEqual(expect.arrayContaining([
      'box_2d', 'bbox_confidence',
    ]));
    expect(analysisSchema.properties.cake_messages.items.required).toEqual(expect.arrayContaining([
      'box_2d', 'bbox_confidence',
    ]));
  });

  it('calculates the exact 20% and 70% boundaries, including filler and piped support rows', () => {
    const result = process(acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [{
          type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'hero', classification: 'hero',
          quantity: 1, description: 'fondant figure', box_2d: [250, 125, 350, 145], bbox_confidence: 0.9,
        }],
        support_elements: [
          {
            type: 'edible_flowers_filler', material: 'edible_fondant', group_id: 'filler', color: '#FFFFFF',
            quantity: 12, description: 'twelve filler flowers', box_2d: [250, 100, 350, 170], bbox_confidence: 0.8,
          },
          {
            type: 'piped_flowers_side', material: 'icing', group_id: 'piped', color: '#FFFFFF', coverage: 'small',
            quantity: 1, description: 'continuous piped flower side treatment', box_2d: [250, 100, 350, 171], bbox_confidence: 1,
          },
        ],
        cake_messages: [{
          text: 'Happy Birthday', type: 'icing_script', color: '#FFFFFF', position: 'top',
          box_2d: [275, 125, 285, 175], bbox_confidence: 0.7,
        }],
      }),
    }));

    expect(result.main_toppers[0].size).toBe('small');
    expect(result.support_elements[0].size).toBe('medium');
    expect(result.support_elements[1].size).toBe('large');
    expect(result.support_elements[0].quantity).toBe(12);
    expect(result.support_elements[1].coverage).toBe('small');
    expect(result.cake_messages[0]).not.toHaveProperty('size');
    expect(result.geometry).toEqual(acceptedEnvelope().geometry);
  });

  it('fails closed on missing or invalid boxes, invalid lines, and model-owned sizes', () => {
    const missingBox = acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [{
          type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'hero', classification: 'hero',
          quantity: 1, description: 'fondant figure', bbox_confidence: 0.9,
        }],
      }),
    });
    expect(() => process(missingBox)).toThrow(GeneratedAnalysisContractError);

    const modelSize = acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [{
          type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'hero', classification: 'hero', size: 'small',
          quantity: 1, description: 'fondant figure', box_2d: [250, 125, 350, 145], bbox_confidence: 0.9,
        }],
      }),
    });
    expect(() => process(modelSize)).toThrow(/must not be model-generated/);

    const offCenterLine = acceptedEnvelope({
      geometry: {
        geometry_version: 'integrated_bbox_v1',
        cake_diameter_line: { start: [300, 100], end: [300, 200] },
        cake_height_line: { start: [300, 260], end: [400, 260] },
      },
    });
    expect(() => process(offCenterLine)).toThrow(/align with the cake diameter midpoint/);

    const nonHorizontalDiameter = acceptedEnvelope({
      geometry: {
        geometry_version: 'integrated_bbox_v1',
        cake_diameter_line: { start: [300, 100], end: [350, 200] },
        cake_height_line: { start: [300, 150], end: [400, 150] },
      },
    });
    expect(() => process(nonHorizontalDiameter)).toThrow(/predominantly horizontal/);

    const invalidBox = acceptedEnvelope({
      analysis: acceptedAnalysis({
        cake_messages: [{
          text: 'Happy Birthday', type: 'icing_script', color: '#FFFFFF', position: 'top',
          box_2d: [20, 20, 20, 30], bbox_confidence: 0.7,
        }],
      }),
    });
    expect(() => process(invalidBox)).toThrow(/positive ordered extents/);
  });

  it('accepts a perspective-skewed rim when the horizontal axis remains dominant', () => {
    const result = process(acceptedEnvelope({
      geometry: {
        geometry_version: 'integrated_bbox_v1',
        cake_diameter_line: { start: [316, 281], end: [431, 849] },
        cake_height_line: { start: [566, 566], end: [830, 566] },
      },
    }));

    expect(result.geometry).toEqual({
      geometry_version: 'integrated_bbox_v1',
      cake_diameter_line: { start: [316, 281], end: [431, 849] },
      cake_height_line: { start: [566, 566], end: [830, 566] },
    });
  });

  it('accepts the canonical rejected envelope only when it has no measurement lines or item geometry', () => {
    const rejected = {
      analysis: acceptedAnalysis({
        cakeType: '', cakeThickness: '', keyword: '',
        rejection: {
          isRejected: true,
          reason: 'not_a_cake',
          message: "This image doesn't appear to be a cake. Please upload a cake image.",
        },
      }),
      geometry: { geometry_version: 'integrated_bbox_v1' },
    };
    expect(process(rejected).rejection.isRejected).toBe(true);

    expect(() => process({
      ...rejected,
      geometry: {
        ...rejected.geometry,
        cake_diameter_line: { start: [300, 100], end: [300, 200] },
      },
    })).toThrow(/must contain exactly/);
  });

  it('marks integrated geometry complete so no second coordinate detector is requested', () => {
    const result = {
      ...process(acceptedEnvelope()),
      analysis_size_schema: 'integrated_bbox_v1',
    };

    const analysis = result as unknown as HybridAnalysisResult;
    expect(hasBoundingBoxData(analysis)).toBe(true);
    expect(needsCoordinateEnrichment(analysis)).toBe(false);
  });
});
