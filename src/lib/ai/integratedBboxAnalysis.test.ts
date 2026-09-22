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
  supportElementTypes: ['edible_flowers_filler', 'edible_flowers', 'edible_2d_support', 'icing_decorations', 'piped_flowers_side'],
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

function acceptedV2Envelope(overrides: Record<string, unknown> = {}) {
  return {
    analysis: acceptedAnalysis(),
    geometry: {
      geometry_version: 'integrated_bbox_v2',
      cake_diameter_line: { start: [300, 100], end: [300, 200] },
      cake_height_line: { start: [300, 150], end: [400, 150] },
    },
    ...overrides,
  };
}

function processV2(result: unknown) {
  return postProcessSearchAnalysisResult(result, typeEnums, 'integrated_bbox_v2');
}

describe('integrated_bbox_v1 analysis', () => {
  it('uses one Gemini envelope and requires row-attached geometry without model-owned size', () => {
    expect(getAnalysisGenerationSizeSchema('3.92')).toBe('integrated_bbox_v1');
    const config = buildSearchAnalysisGenerationConfig(typeEnums, 'integrated_bbox_v1');
    expect(config.responseSchema.required).toEqual(['analysis', 'geometry']);
    expect(config.systemInstruction).toContain('V3.92 INTEGRATED BOUNDING-BOX PRECEDENCE');
    expect(config.systemInstruction).toContain('Never emit a model-owned size');
    expect(config.systemInstruction).toContain('cake_area = diameter_width * diameter_width');
    expect(config.systemInstruction).toContain('Small when area_ratio_percent <= 15');
    expect(config.systemInstruction).toContain('accepts either endpoint order');
    expect(config.systemInstruction).toContain('return one tight box per clearly visible unit');
    expect(config.systemInstruction).toContain('up to min(quantity, 5) boxes');
    expect(config.systemInstruction).toContain('never use one arrangement-wide box');
    expect(config.systemInstruction).toContain('BOX SCOPE POLICY');
    expect(config.systemInstruction).toContain('Aggregate treatment scope is allowed only for these explicit types');
    expect(config.systemInstruction).toContain('sand-like texture');
    expect(config.systemInstruction).toContain('FINAL CARDINALITY CHECK BEFORE JSON');
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
    const integratedProperties = analysisSchema.properties.main_toppers.items.properties as Record<string, { description?: string; maxItems?: number }>;
    expect(integratedProperties.box_2d.description).toContain('One tight normalized box per visible discrete unit');
    expect(integratedProperties.box_2d.maxItems).toBe(5);
    expect(integratedProperties.bbox_confidence.description).toContain('One confidence from 0 through 1 for each box');
    expect(integratedProperties.type.description).toContain('capped at 5 boxes');
    expect(analysisSchema.properties.main_toppers.items.required).toEqual(expect.arrayContaining([
      'box_2d', 'bbox_confidence',
    ]));
    expect(analysisSchema.properties.cake_messages.items.required).toEqual(expect.arrayContaining([
      'box_2d', 'bbox_confidence',
    ]));
    expect((config.responseSchema as unknown as {
      properties: { analysis: { properties: { icing_design: { properties: { colors: { required: string[] } } } } } };
    }).properties.analysis.properties.icing_design.properties.colors.required)
      .toEqual(['side', 'top', 'gumpasteBaseBoardColor']);
  });

  it('keeps an accepted board-covering analysis usable when Gemini omits the conditional board color', () => {
    const result = process(acceptedEnvelope({
      analysis: acceptedAnalysis({
        icing_design: {
          base: 'soft_icing',
          color_type: 'single',
          colors: { side: '#FFFFFF', top: '#FFFFFF' },
          drip: false,
          border_top: false,
          border_base: false,
          gumpasteBaseBoard: true,
        },
      }),
    }));

    expect(result.icing_design.colors.gumpasteBaseBoardColor).toBe('#FFFFFF');
  });

  it('calculates the exact 15% and 70% boundaries, including filler and piped support rows', () => {
    const result = process(acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [{
          type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'hero', classification: 'hero',
          quantity: 1, description: 'fondant figure', box_2d: [250, 125, 350, 140], bbox_confidence: 0.9,
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

  it('requires one box per discrete unit up to five and sizes from the largest unit', () => {
    const unitBoxes = [
      [250, 100, 350, 170],
      [400, 200, 420, 220],
    ];
    const result = process(acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [
          {
            type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'gems', classification: 'support',
            quantity: 2, description: 'two gemstones', box_2d: unitBoxes, bbox_confidence: [0.91, 0.88],
          },
          {
            type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'stars', classification: 'support',
            quantity: 6, description: 'six stars capped at five boxes',
            box_2d: [
              [400, 200, 420, 220], [430, 230, 450, 250], [460, 260, 480, 280],
              [490, 290, 510, 310], [520, 320, 540, 340],
            ],
            bbox_confidence: [0.8, 0.8, 0.8, 0.8, 0.8],
          },
        ],
        support_elements: [{
          type: 'edible_flowers_filler', material: 'edible_fondant', group_id: 'filler', color: '#FFFFFF',
          quantity: 5, description: 'five filler flowers',
          box_2d: [
            [500, 500, 515, 515], [520, 520, 535, 535], [540, 540, 555, 555],
            [560, 560, 575, 575], [580, 580, 595, 595],
          ],
          bbox_confidence: [0.7, 0.7, 0.7, 0.7, 0.7],
        }],
      }),
    }));

    expect(result.main_toppers[0].box_2d).toEqual(unitBoxes);
    expect(result.main_toppers[0].bbox_confidence).toEqual([0.91, 0.88]);
    expect(result.main_toppers[0].size).toBe('medium');
    expect((result.main_toppers[1].box_2d as unknown[]).length).toBe(5);
    expect(result.main_toppers[1].quantity).toBe(6);
    expect((result.support_elements[0].box_2d as unknown[]).length).toBe(5);
    expect(result.support_elements[0].size).toBe('small');
  });

  it('keeps aggregate treatments at one regional box', () => {
    const result = process(acceptedEnvelope({
      analysis: acceptedAnalysis({
        support_elements: [{
          type: 'piped_flowers_side', material: 'icing', group_id: 'piped', color: '#FFFFFF', coverage: 'medium',
          quantity: 1, description: 'one continuous piped flower treatment',
          box_2d: [[200, 100, 700, 900]], bbox_confidence: [0.94],
        }],
      }),
    }));

    expect(result.support_elements[0].box_2d).toEqual([[200, 100, 700, 900]]);
    expect(result.support_elements[0].size).toBe('large');
  });

  it('sets variable-height cake thickness from the measured aspect-ratio bands', () => {
    const result = process(acceptedEnvelope({
      analysis: acceptedAnalysis({ cakeType: '1 Tier', cakeThickness: '6 in' }),
      geometry: {
        geometry_version: 'integrated_bbox_v1',
        cake_diameter_line: { start: [300, 100], end: [300, 200] },
        cake_height_line: { start: [300, 150], end: [350, 150] },
      },
    }));

    expect(result.cakeThickness).toBe('3 in');
  });

  it('uses diameter squared for topper area even when the height line length changes', () => {
    const result = process(acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [{
          type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'hero', classification: 'hero',
          quantity: 1, description: 'fondant figure', box_2d: [250, 125, 350, 140], bbox_confidence: 0.9,
        }],
        support_elements: [{
          type: 'edible_flowers_filler', material: 'edible_fondant', group_id: 'filler', color: '#FFFFFF',
          quantity: 1, description: 'filler flowers', box_2d: [250, 100, 350, 170], bbox_confidence: 0.8,
        }],
      }),
      geometry: {
        geometry_version: 'integrated_bbox_v1',
        cake_diameter_line: { start: [300, 100], end: [300, 200] },
        cake_height_line: { start: [300, 150], end: [900, 150] },
      },
    }));

    expect(result.main_toppers[0].size).toBe('small');
    expect(result.support_elements[0].size).toBe('medium');
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
        cake_diameter_line: { start: [300, 100], end: [500, 120] },
        cake_height_line: { start: [300, 110], end: [400, 110] },
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

    const undercountedDiscreteRow = acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [{
          type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'gems', classification: 'support',
          quantity: 2, description: 'two gemstones', box_2d: [[250, 125, 350, 145]], bbox_confidence: [0.9],
        }],
      }),
    });
    const undercountedResult = process(undercountedDiscreteRow);
    expect(undercountedResult.main_toppers[0].box_2d).toEqual([[250, 125, 350, 145]]);

    const tooManyDiscreteBoxes = acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [{
          type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'gems', classification: 'support',
          quantity: 2, description: 'two gemstones',
          box_2d: [[250, 125, 350, 145], [400, 125, 450, 175], [500, 125, 550, 175]],
          bbox_confidence: [0.9, 0.9, 0.9],
        }],
      }),
    });
    expect(() => process(tooManyDiscreteBoxes)).toThrow(/at most 2 boxes/);

    const scalarConfidenceForMultipleBoxes = acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [{
          type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'gems', classification: 'support',
          quantity: 2, description: 'two gemstones',
          box_2d: [[250, 125, 350, 145], [400, 125, 450, 175]], bbox_confidence: 0.9,
        }],
      }),
    });
    const scalarConfidenceResult = process(scalarConfidenceForMultipleBoxes);
    expect(scalarConfidenceResult.main_toppers[0].bbox_confidence).toEqual([0.9, 0.9]);

    const tooManyBoxes = acceptedEnvelope({
      analysis: acceptedAnalysis({
        main_toppers: [{
          type: 'edible_3d_complex', material: 'edible_fondant', group_id: 'gems', classification: 'support',
          quantity: 6, description: 'six gemstones',
          box_2d: [
            [100, 100, 110, 110], [120, 120, 130, 130], [140, 140, 150, 150],
            [160, 160, 170, 170], [180, 180, 190, 190], [200, 200, 210, 210],
          ],
          bbox_confidence: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
        }],
      }),
    });
    expect(() => process(tooManyBoxes)).toThrow(/1 through 5 boxes/);
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

  it('accepts a strongly perspective-slanted left-to-right diameter line', () => {
    const result = process(acceptedEnvelope({
      geometry: {
        geometry_version: 'integrated_bbox_v1',
        cake_diameter_line: { start: [377, 290], end: [849, 715] },
        cake_height_line: { start: [377, 500], end: [871, 500] },
      },
    }));

    expect(result.geometry.cake_diameter_line).toEqual({
      start: [377, 290],
      end: [849, 715],
    });
  });

  it('canonicalizes reversed diameter and height endpoints before validation', () => {
    const result = process(acceptedEnvelope({
      geometry: {
        geometry_version: 'integrated_bbox_v1',
        cake_diameter_line: { start: [361, 881], end: [312, 225] },
        cake_height_line: { start: [879, 553], end: [312, 553] },
      },
    }));

    expect(result.geometry).toEqual({
      geometry_version: 'integrated_bbox_v1',
      cake_diameter_line: { start: [312, 225], end: [361, 881] },
      cake_height_line: { start: [312, 553], end: [879, 553] },
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

  it('v2 sizes repeated flowers and leaves from individual unit boxes, never their arrangement span', () => {
    expect(getAnalysisGenerationSizeSchema('3.93')).toBe('integrated_bbox_v2');
    const config = buildSearchAnalysisGenerationConfig(typeEnums, 'integrated_bbox_v2');
    expect(config.systemInstruction).toContain('FIRST CHOOSE ONE GEOMETRY SCOPE');
    expect(config.systemInstruction).not.toContain('unless row represents intentional continuous treatment');
    const v2Properties = (config.responseSchema as unknown as {
      properties: { analysis: { properties: { support_elements: { items: { properties: Record<string, unknown>; required: string[] } } } } };
    }).properties.analysis.properties.support_elements.items;
    expect(v2Properties.properties).toHaveProperty('geometry_scope');
    expect(v2Properties.required).toContain('geometry_scope');

    const smallFlowerBoxes = [
      [100, 100, 120, 120], [140, 140, 160, 160], [180, 180, 200, 200],
      [220, 220, 240, 240], [260, 260, 280, 280],
    ];
    const smallLeafBoxes = [
      [300, 100, 320, 125], [340, 140, 360, 165], [380, 180, 400, 205],
      [420, 220, 440, 245], [460, 260, 480, 285],
    ];
    const result = processV2(acceptedV2Envelope({
      analysis: acceptedAnalysis({
        support_elements: [
          {
            type: 'edible_flowers', material: 'edible_fondant', group_id: 'flowers', color: '#FFFFFF',
            geometry_scope: 'unit', quantity: 15, description: 'small fondant flowers',
            box_2d: smallFlowerBoxes, bbox_confidence: [0.9, 0.9, 0.9, 0.9, 0.9],
          },
          {
            type: 'edible_2d_support', material: 'edible_fondant', group_id: 'leaves', color: '#90EE90',
            geometry_scope: 'unit', quantity: 20, description: 'small fondant leaves',
            box_2d: smallLeafBoxes, bbox_confidence: [0.9, 0.9, 0.9, 0.9, 0.9],
          },
        ],
      }),
    }));

    expect(result.support_elements[0]).toMatchObject({ quantity: 15, geometry_scope: 'unit', size: 'small' });
    expect(result.support_elements[1]).toMatchObject({ quantity: 20, geometry_scope: 'unit', size: 'small' });
    expect(result.support_elements[0].box_2d).toHaveLength(5);
    expect(result.support_elements[1].box_2d).toHaveLength(5);
  });

  it('v2 keeps a cohesive piped cluster as one coverage-priced region', () => {
    const result = processV2(acceptedV2Envelope({
      analysis: acceptedAnalysis({
        support_elements: [{
          type: 'piped_flowers_side', material: 'icing', group_id: 'side_cluster', color: '#FFFFFF',
          geometry_scope: 'piped_cluster', coverage: 'small', quantity: 1,
          description: 'one cohesive piped floral cluster',
          box_2d: [[100, 100, 900, 900]], bbox_confidence: [0.95],
        }],
      }),
    }));

    expect(result.support_elements[0]).toMatchObject({
      geometry_scope: 'piped_cluster', quantity: 1, coverage: 'small', size: 'small',
    });
    expect(result.support_elements[0].box_2d).toEqual([[100, 100, 900, 900]]);
  });

  it('v2 records separate piped blooms as locally sized icing decorations', () => {
    const result = processV2(acceptedV2Envelope({
      analysis: acceptedAnalysis({
        support_elements: [{
          type: 'icing_decorations', material: 'icing', group_id: 'individual_piped_blooms', color: '#FF69B4',
          geometry_scope: 'unit', quantity: 3, description: 'three separate piped blooms',
          box_2d: [[100, 100, 120, 120], [150, 150, 170, 170], [200, 200, 220, 220]],
          bbox_confidence: [0.95, 0.95, 0.95],
        }],
      }),
    }));

    expect(result.support_elements[0]).toMatchObject({
      type: 'icing_decorations', geometry_scope: 'unit', quantity: 3, size: 'small',
    });
  });

  it('v2 rejects under-counted unit boxes and invalid piped-cluster fields', () => {
    const underCountedUnits = acceptedV2Envelope({
      analysis: acceptedAnalysis({
        support_elements: [{
          type: 'edible_flowers', material: 'edible_fondant', group_id: 'flowers', color: '#FFFFFF',
          geometry_scope: 'unit', quantity: 2, description: 'two flowers',
          box_2d: [[100, 100, 120, 120]], bbox_confidence: [0.9],
        }],
      }),
    });
    expect(() => processV2(underCountedUnits)).toThrow(/exactly 2 boxes/);

    const countedCluster = acceptedV2Envelope({
      analysis: acceptedAnalysis({
        support_elements: [{
          type: 'piped_flowers_side', material: 'icing', group_id: 'cluster', color: '#FFFFFF',
          geometry_scope: 'piped_cluster', coverage: 'medium', quantity: 2, description: 'cluster',
          box_2d: [[100, 100, 200, 200]], bbox_confidence: [0.9],
        }],
      }),
    });
    expect(() => processV2(countedCluster)).toThrow(/must be 1 for a piped_cluster/);

    const coverageLessCluster = acceptedV2Envelope({
      analysis: acceptedAnalysis({
        support_elements: [{
          type: 'piped_flowers_side', material: 'icing', group_id: 'cluster', color: '#FFFFFF',
          geometry_scope: 'piped_cluster', quantity: 1, description: 'cluster',
          box_2d: [[100, 100, 200, 200]], bbox_confidence: [0.9],
        }],
      }),
    });
    expect(() => processV2(coverageLessCluster)).toThrow(/coverage/);

    const incorrectlyAggregatedIcingDecorations = acceptedV2Envelope({
      analysis: acceptedAnalysis({
        support_elements: [{
          type: 'icing_decorations', material: 'icing', group_id: 'individual_piped_blooms', color: '#FF69B4',
          geometry_scope: 'treatment', quantity: 3, description: 'three separate piped blooms',
          box_2d: [[100, 100, 220, 220]], bbox_confidence: [0.9],
        }],
      }),
    });
    expect(() => processV2(incorrectlyAggregatedIcingDecorations)).toThrow(/treatment is not allowed for this type/);
  });
});
