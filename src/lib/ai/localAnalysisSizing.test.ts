import { describe, expect, it } from 'vitest';

import {
  applyLocalBboxAreaSizing,
  applyLocalLineRatioSizing,
  calculateLocalCakeMeasurementGeometry,
  calculateLocalBboxAreaRatio,
  calculateLocalLineRatio,
  calculateNormalizedLineLength,
  calculateTopTierReferenceArea,
  classifyLocalBboxAreaSize,
  classifyLocalLineRatioSize,
  inferLocalCakeThickness,
  LOCAL_BBOX_AREA_REFERENCE_FACTOR,
  LocalAnalysisSizingError,
} from './localAnalysisSizing';

const measurements = {
  diameter: {
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
  },
  height: {
    start: { x: 0, y: 0 },
    end: { x: 0, y: 100 },
  },
};

describe('local bbox-area sizing', () => {
  it('calculates Euclidean lengths for slanted normalized lines', () => {
    expect(calculateNormalizedLineLength({
      start: { x: 10, y: 20 },
      end: { x: 13, y: 24 },
    })).toBe(5);
  });

  it('uses slanted measurement lengths and the 0.90 top-tier factor', () => {
    const area = calculateTopTierReferenceArea({
      diameter: { start: { x: 0, y: 0 }, end: { x: 3, y: 4 } },
      height: { start: { x: 10, y: 10 }, end: { x: 16, y: 18 } },
    });

    expect(LOCAL_BBOX_AREA_REFERENCE_FACTOR).toBe(0.90);
    expect(area).toBe(45);
  });

  it('uses the measured height at exactly a 2:1 ratio and corrects higher raw ratios', () => {
    const exact = calculateLocalCakeMeasurementGeometry({
      diameter: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      height: { start: { x: 0, y: 0 }, end: { x: 0, y: 50 } },
    });
    const corrected = calculateLocalCakeMeasurementGeometry({
      diameter: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      height: { start: { x: 0, y: 0 }, end: { x: 0, y: 40 } },
    });

    expect(exact).toMatchObject({
      rawAspectRatio: 2,
      effectiveHeightLength: 50,
      effectiveAspectRatio: 2,
      usedHighAngleCorrection: false,
    });
    expect(corrected).toMatchObject({
      rawAspectRatio: 2.5,
      measuredHeightLength: 40,
      effectiveHeightLength: 50,
      effectiveAspectRatio: 2,
      usedHighAngleCorrection: true,
    });
    expect(calculateTopTierReferenceArea({
      diameter: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      height: { start: { x: 0, y: 0 }, end: { x: 0, y: 40 } },
    })).toBe(4500);
  });

  it('maps nearest aspect references and breaks exact ties toward the shorter height', () => {
    const lineForRatio = (height: number) => ({
      diameter: { start: { x: 0, y: 0 }, end: { x: 6, y: 0 } },
      height: { start: { x: 0, y: 0 }, end: { x: 0, y: height } },
    });

    expect(inferLocalCakeThickness('1 Tier', lineForRatio(3))).toBe('3 in');
    expect(inferLocalCakeThickness('1 Tier', lineForRatio(4))).toBe('4 in');
    expect(inferLocalCakeThickness('1 Tier', lineForRatio(5))).toBe('5 in');
    expect(inferLocalCakeThickness('1 Tier', lineForRatio(6))).toBe('6 in');
    expect(inferLocalCakeThickness('1 Tier', {
      diameter: { start: { x: 0, y: 0 }, end: { x: 700, y: 0 } },
      height: { start: { x: 0, y: 0 }, end: { x: 0, y: 400 } },
    })).toBe('3 in');
  });

  it('respects cake-type thickness candidates while inferring locally', () => {
    const lineForRatio = (height: number) => ({
      diameter: { start: { x: 0, y: 0 }, end: { x: 6, y: 0 } },
      height: { start: { x: 0, y: 0 }, end: { x: 0, y: height } },
    });

    expect(inferLocalCakeThickness('1 Tier Fondant', lineForRatio(3))).toBe('5 in');
    expect(inferLocalCakeThickness('Square', lineForRatio(5))).toBe('4 in');
    expect(inferLocalCakeThickness('Square Fondant', lineForRatio(3))).toBe('5 in');
    expect(inferLocalCakeThickness('Slab Cake', lineForRatio(3))).toBeNull();
  });

  it('calculates an element area ratio from its representative bbox', () => {
    expect(calculateLocalBboxAreaRatio({ x: 10, y: 20, width: 30, height: 60 }, 9000))
      .toBe(0.2);
  });

  it('rounds exact boundaries up to the larger size', () => {
    expect(classifyLocalBboxAreaSize('edible_3d_complex', 0.30)).toBe('medium');
    expect(classifyLocalBboxAreaSize('edible_3d_complex', 0.90)).toBe('large');
    expect(classifyLocalBboxAreaSize('toy', 0.50)).toBe('medium');
    expect(classifyLocalBboxAreaSize('toy', 1.10)).toBe('large');
  });

  it('uses the prompt family bands and explicit fulfillment overrides locally', () => {
    expect(classifyLocalBboxAreaSize('edible_flowers', 0.79)).toBe('medium');
    expect(classifyLocalBboxAreaSize('edible_flowers', 0.80)).toBe('large');
    expect(classifyLocalBboxAreaSize('edible_3d_ordinary', 0.79, 'rainbow topper')).toBe('medium');
    expect(classifyLocalBboxAreaSize('edible_3d_ordinary', 0.80, 'rainbow topper')).toBe('large');
    expect(classifyLocalBboxAreaSize('candle', 0.15)).toBe('medium');
    expect(classifyLocalBboxAreaSize('gumpaste_panel', 0.40)).toBe('medium');
    expect(classifyLocalBboxAreaSize('edible_2d_complex', 0.50)).toBe('large');
    expect(classifyLocalBboxAreaSize('edible_logo_2d', 0.25)).toBe('medium');
    expect(classifyLocalBboxAreaSize('sprinkles', 0.99)).toBe('small');
    expect(classifyLocalBboxAreaSize('edible_photo_side_wave', 0.01)).toBe('large');
  });

  it('replaces AI sizes without changing bboxes, messages, or item fields', () => {
    const analysis = {
      cake_measurements: measurements,
      main_toppers: [{
        type: 'edible_3d_complex',
        size: 'large',
        bbox: { x: 20, y: 30, width: 30, height: 60 },
        quantity: 3,
        description: 'three identical figures',
      }],
      support_elements: [{
        type: 'sprinkles',
        size: 'large',
        bbox: { x: 100, y: 120, width: 900, height: 900 },
        quantity: 1,
        description: 'sprinkle scatter',
      }],
      cake_messages: [{
        text: 'Happy Birthday',
        bbox: { x: 1, y: 2, width: 3, height: 4 },
      }],
    };

    const sized = applyLocalBboxAreaSizing(analysis);

    expect(sized.main_toppers?.[0]).toMatchObject({
      size: 'small',
      bbox: { x: 20, y: 30, width: 30, height: 60 },
      quantity: 3,
      description: 'three identical figures',
    });
    expect(sized.support_elements?.[0]).toMatchObject({
      size: 'small',
      bbox: { x: 100, y: 120, width: 900, height: 900 },
    });
    expect(sized.cake_messages).toEqual(analysis.cake_messages);
  });

  it('overwrites eligible AI cake thickness using effective geometry and preserves endpoints', () => {
    const analysis = {
      cakeType: '1 Tier',
      cakeThickness: '6 in',
      cake_measurements: {
        diameter: { start: { x: 100, y: 300 }, end: { x: 900, y: 300 } },
        height: { start: { x: 480, y: 180 }, end: { x: 500, y: 500 } },
      },
      main_toppers: [{
        type: 'toy',
        size: 'large',
        bbox: { x: 20, y: 30, width: 30, height: 60 },
        quantity: 2,
        role: 'hero',
        description: 'two toys',
      }],
      support_elements: [],
    };

    const sized = applyLocalBboxAreaSizing(analysis);

    expect(sized.cakeThickness).toBe('3 in');
    expect(sized.cake_measurements).toEqual(analysis.cake_measurements);
    expect(sized.main_toppers).toEqual(analysis.main_toppers.map((item) => ({
      ...item,
      size: 'small',
    })));
  });

  it('leaves fixed-height and multi-tier cake thickness unchanged', () => {
    const fixed = applyLocalBboxAreaSizing({
      cakeType: 'Slab Cake',
      cakeThickness: '6 in',
      cake_measurements: measurements,
      main_toppers: [],
      support_elements: [],
    });
    const multiTier = applyLocalBboxAreaSizing({
      cakeType: '2 Tier',
      cakeThickness: '5 in',
      cake_measurements: measurements,
      main_toppers: [],
      support_elements: [],
    });

    expect(fixed.cakeThickness).toBe('6 in');
    expect(multiTier.cakeThickness).toBe('5 in');
  });

  it('fails rather than using an AI size when local geometry is missing', () => {
    expect(() => applyLocalBboxAreaSizing({
      main_toppers: [{ type: 'toy', size: 'large' }],
      support_elements: [],
    })).toThrow(/cake_measurements is required/i);

    expect(() => applyLocalBboxAreaSizing({
      cake_measurements: measurements,
      main_toppers: [{ type: 'toy', size: 'large' }],
      support_elements: [],
    })).toThrow(/bbox is required/i);

    expect(() => applyLocalBboxAreaSizing({
      cakeType: '1 Tier',
      cakeThickness: '6 in',
      cake_measurements: {
        diameter: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
        height: { start: { x: 0, y: 0 }, end: { x: 0, y: 100 } },
      },
      main_toppers: [],
      support_elements: [],
    })).toThrow(LocalAnalysisSizingError);
  });
});

describe('local line-ratio sizing', () => {
  it('calculates a topper primary-dimension ratio from Euclidean line lengths', () => {
    expect(calculateLocalLineRatio({
      start: { x: 10, y: 20 },
      end: { x: 13, y: 24 },
    }, 10)).toBe(0.5);
  });

  it('uses the existing half-open bands and fixed overrides', () => {
    expect(classifyLocalLineRatioSize('edible_3d_complex', 0.30)).toBe('medium');
    expect(classifyLocalLineRatioSize('edible_3d_complex', 0.90)).toBe('large');
    expect(classifyLocalLineRatioSize('toy', 0.50)).toBe('medium');
    expect(classifyLocalLineRatioSize('toy', 1.10)).toBe('large');
    expect(classifyLocalLineRatioSize('edible_crown', 0.50)).toBe('medium');
    expect(classifyLocalLineRatioSize('edible_flowers', 0.80)).toBe('large');
    expect(classifyLocalLineRatioSize('candle', 0.60)).toBe('large');
    expect(classifyLocalLineRatioSize('gumpaste_panel', 0.40)).toBe('medium');
    expect(classifyLocalLineRatioSize('edible_2d_complex', 0.50)).toBe('large');
    expect(classifyLocalLineRatioSize('edible_logo_2d', 0.25)).toBe('medium');
    expect(classifyLocalLineRatioSize('sprinkles', 999)).toBe('small');
    expect(classifyLocalLineRatioSize('edible_photo_side_wave', 0.01)).toBe('large');
  });

  it('sizes from the representative line, ignores AI size, removes priced bboxes, and preserves fields', () => {
    const analysis = {
      cakeType: '1 Tier',
      cakeThickness: '6 in',
      cake_measurements: measurements,
      main_toppers: [{
        type: 'edible_3d_complex',
        size: 'large',
        size_line: { start: { x: 20, y: 20 }, end: { x: 20, y: 50 } },
        bbox: { x: 20, y: 30, width: 30, height: 60 },
        quantity: 3,
        group_id: 'figures',
        classification: 'hero',
        description: 'three identical figures',
        material: 'edible_fondant',
      }],
      support_elements: [{
        type: 'sprinkles',
        size: 'large',
        quantity: 1,
        group_id: 'sprinkles',
        color: '#FFD700',
        description: 'sprinkle scatter',
        material: 'candy',
      }],
      cake_messages: [{
        text: 'Happy Birthday',
        bbox: { x: 1, y: 2, width: 3, height: 4 },
      }],
    };

    const sized = applyLocalLineRatioSizing(analysis);

    expect(sized.main_toppers?.[0]).toMatchObject({
      size: 'medium',
      size_line: { start: { x: 20, y: 20 }, end: { x: 20, y: 50 } },
      quantity: 3,
      group_id: 'figures',
      description: 'three identical figures',
    });
    expect(sized.main_toppers?.[0]).not.toHaveProperty('bbox');
    expect(sized.support_elements?.[0].size).toBe('small');
    expect(sized.cake_messages).toEqual(analysis.cake_messages);
    expect(sized.cakeThickness).toBe('6 in');
  });

  it('fails closed for missing, invalid, or zero-length size lines', () => {
    expect(() => applyLocalLineRatioSizing({
      cake_measurements: measurements,
      main_toppers: [{ type: 'toy', size: 'large' }],
      support_elements: [],
    })).toThrow(/size_line is required/i);

    expect(() => applyLocalLineRatioSizing({
      cake_measurements: measurements,
      main_toppers: [{ type: 'toy', size_line: { start: { x: 1 }, end: { x: 2, y: 3 } } }],
      support_elements: [],
    })).toThrow(LocalAnalysisSizingError);

    expect(() => applyLocalLineRatioSizing({
      cake_measurements: measurements,
      main_toppers: [{
        type: 'toy',
        size_line: { start: { x: -1, y: 10 }, end: { x: 10, y: 10 } },
      }],
      support_elements: [],
    })).toThrow(/integer from 0 through 1000/i);

    expect(() => applyLocalLineRatioSizing({
      cake_measurements: measurements,
      main_toppers: [{
        type: 'toy',
        size_line: { start: { x: 10, y: 10 }, end: { x: 10, y: 10 } },
      }],
      support_elements: [],
    })).toThrow(/positive length/i);
  });
});
