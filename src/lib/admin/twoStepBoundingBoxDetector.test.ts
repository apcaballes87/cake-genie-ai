import { describe, expect, it } from 'vitest';

import {
  TWO_STEP_BOUNDING_BOXES_MODE,
  detectorGeometryRequestParts,
  validateDetectorGeometry,
  validateDetectorIdentification,
} from './twoStepBoundingBoxDetector';

const identification = validateDetectorIdentification({
  identification_version: TWO_STEP_BOUNDING_BOXES_MODE,
  elements: [{ element_id: 'gold_number_candle', label: 'Gold number candle', category: 'candle', description: 'One gold number candle on the top surface.', belongs_to_cake_design: true, visible_count: 1 }],
  rejection: { isRejected: false, reason: '', message: '' },
});

const geometry = {
  geometry_version: TWO_STEP_BOUNDING_BOXES_MODE,
  cake_diameter_line: { start: [400, 150], end: [400, 850] },
  cake_height_line: { start: [400, 500], end: [900, 500] },
  toppers: [{ element_id: 'gold_number_candle', label: 'Gold number candle', category: 'candle', box_2d: [160, 430, 390, 570], confidence: 0.94 }],
};

describe('two-step bounding-box detector contract', () => {
  it('requires exact Step 1 manifest coverage and normalized tuple geometry', () => {
    expect(validateDetectorGeometry(geometry, identification)).toEqual(geometry);
    expect(() => validateDetectorGeometry({ ...geometry, toppers: [] }, identification)).toThrow(/cover every Step 1 element/i);
    expect(() => validateDetectorGeometry({ ...geometry, cake_diameter_line: { start: [400, 850], end: [400, 150] } }, identification)).toThrow(/horizontal/i);
    expect(() => validateDetectorGeometry({ ...geometry, cake_height_line: { start: [400, 800], end: [900, 800] } }, identification)).toThrow(/front-center/i);
    expect(() => validateDetectorGeometry({ ...geometry, toppers: [{ ...geometry.toppers[0], box_2d: [390, 430, 160, 570] }] }, identification)).toThrow(/positive ordered extents/i);
    expect(() => validateDetectorGeometry({ ...geometry, toppers: [{ ...geometry.toppers[0], confidence: 1.1 }] }, identification)).toThrow(/between 0 and 1/i);
  });

  it('describes the front-center height reference in the geometry prompt', async () => {
    const { BOUNDING_BOX_GEOMETRY_PROMPT } = await import('./twoStepBoundingBoxDetector');
    expect(BOUNDING_BOX_GEOMETRY_PROMPT).toContain('front-center vertical axis');
    expect(BOUNDING_BOX_GEOMETRY_PROMPT).toContain('top FRONT edge');
  });

  it('rejects duplicate, malformed, and rejected-manifest elements', () => {
    expect(() => validateDetectorIdentification({ ...identification, elements: [identification.elements[0], identification.elements[0]] })).toThrow(/duplicate element_id/i);
    expect(() => validateDetectorIdentification({ ...identification, elements: [{ ...identification.elements[0], element_id: 'Gold Number' }] })).toThrow(/snake_case/i);
    expect(() => validateDetectorIdentification({ ...identification, rejection: { isRejected: true, reason: 'multiple cakes', message: 'Use one cake.' } })).toThrow(/must not emit elements/i);
    expect(() => validateDetectorGeometry({ ...geometry, toppers: [{ ...geometry.toppers[0], element_id: 'invented' }] }, identification)).toThrow(/not present in Step 1/i);
  });

  it('sends the original image and immutable identification manifest to geometry', () => {
    const parts = detectorGeometryRequestParts('image/png', 'image-bytes', 'Locate boxes.', identification);
    expect(parts).toEqual(expect.arrayContaining([expect.objectContaining({ inlineData: { mimeType: 'image/png', data: 'image-bytes' } })]));
    expect(parts[1].text).toContain(JSON.stringify(identification));
  });
});
