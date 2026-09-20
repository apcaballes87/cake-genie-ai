import { describe, expect, it } from 'vitest';

import {
  ONE_PASS_GEOMETRY_REFINED_MODE,
  buildRefinedGeometryManifest,
  refinedGeometryRequestParts,
  validateRefinedGeometry,
} from './onePassGeometryRefinement';

const analysis = {
  main_toppers: [{ group_id: 'hero_candle', type: 'number_candle', description: 'Gold number candle.' }],
  support_elements: [{ group_id: 'pearl_border', type: 'icing_border', description: 'White pearl border.' }],
};

describe('one-pass precise geometry refinement contract', () => {
  it('freezes validated priced rows into stable geometry targets', () => {
    expect(buildRefinedGeometryManifest(analysis)).toEqual({
      elements: [
        expect.objectContaining({ element_id: 'main_toppers__hero_candle', role: 'main_toppers', group_id: 'hero_candle' }),
        expect.objectContaining({ element_id: 'support_elements__pearl_border', role: 'support_elements', group_id: 'pearl_border' }),
      ],
    });
  });

  it('requires exact frozen-manifest coverage and leaves valid tuples untouched', () => {
    const manifest = buildRefinedGeometryManifest(analysis);
    const geometry = {
      geometry_version: ONE_PASS_GEOMETRY_REFINED_MODE,
      cake_diameter_line: { start: [400, 100], end: [400, 900] },
      cake_height_line: { start: [400, 500], end: [850, 500] },
      elements: manifest.elements.map((element, index) => ({ ...element, box_2d: index ? [700, 200, 730, 240] : [130, 420, 390, 570], confidence: 0.9 })),
    };
    expect(validateRefinedGeometry(geometry, manifest)).toEqual(geometry);
    expect(() => validateRefinedGeometry({ ...geometry, elements: geometry.elements.slice(0, 1) }, manifest)).toThrow(/cover every frozen/i);
    expect(() => validateRefinedGeometry({ ...geometry, elements: [{ ...geometry.elements[0], role: 'support_elements' }, geometry.elements[1]] }, manifest)).toThrow(/must match/i);
    expect(() => validateRefinedGeometry({ ...geometry, elements: [{ ...geometry.elements[0], box_2d: [600, 420, 390, 570] }, geometry.elements[1]] }, manifest)).toThrow(/positive ordered/i);
  });

  it('accepts small perspective drift without rewriting the returned endpoints', () => {
    const manifest = buildRefinedGeometryManifest(analysis);
    const geometry = {
      geometry_version: ONE_PASS_GEOMETRY_REFINED_MODE,
      cake_diameter_line: { start: [400, 100], end: [415, 900] },
      cake_height_line: { start: [400, 500], end: [850, 515] },
      elements: manifest.elements.map((element, index) => ({ ...element, box_2d: index ? [700, 200, 730, 240] : [130, 420, 390, 570], confidence: 0.9 })),
    };
    expect(validateRefinedGeometry(geometry, manifest).cake_diameter_line).toEqual(geometry.cake_diameter_line);
    expect(validateRefinedGeometry(geometry, manifest).cake_height_line).toEqual(geometry.cake_height_line);
    expect(() => validateRefinedGeometry({ ...geometry, cake_diameter_line: { start: [400, 100], end: [600, 900] } }, manifest)).toThrow(/predominantly horizontal/i);
    expect(() => validateRefinedGeometry({ ...geometry, cake_height_line: { start: [400, 800], end: [850, 800] } }, manifest)).toThrow(/front-center/i);
  });

  it('describes the front-center height reference in the geometry prompt', async () => {
    const { ONE_PASS_GEOMETRY_REFINEMENT_PROMPT } = await import('./onePassGeometryRefinement');
    expect(ONE_PASS_GEOMETRY_REFINEMENT_PROMPT).toContain('front-center vertical axis');
    expect(ONE_PASS_GEOMETRY_REFINEMENT_PROMPT).toContain('top FRONT edge');
  });

  it('sends the untouched image and frozen manifest to the geometry model', () => {
    const manifest = buildRefinedGeometryManifest(analysis);
    const parts = refinedGeometryRequestParts('image/png', 'original-image-bytes', 'Locate the rows.', manifest);
    expect(parts).toEqual(expect.arrayContaining([expect.objectContaining({ inlineData: { mimeType: 'image/png', data: 'original-image-bytes' } })]));
    expect(parts[1].text).toContain(JSON.stringify(manifest));
  });
});
