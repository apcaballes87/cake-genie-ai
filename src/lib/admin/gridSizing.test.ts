import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  CARTESIAN_SIZING_VERSION,
  GRID_SIZING_VERSION,
  GRID_SIZING_EDITABLE_PROMPT,
  applyGridSizingToAnalysis,
  addGridSizingToResponseSchema,
  buildGridSizingPayload,
  buildGridSizingPayloadFromCalibratedLocator,
  buildGridSizingPayloadFromLocator,
  calculateGridSizing,
  classifyGridSizingAreaRatio,
  createGridOverlay,
  createCartesianOverlay,
  gridSizingAnchorLocatorResponseSchema,
  gridSizingLocatorResponseSchema,
  gridSizingRowLocatorPrompt,
  gridSizingRowLocatorResponseSchema,
  gridSizingResponseSchema,
  validateGridSizing,
  CARTESIAN_SIZING_EDITABLE_PROMPT,
  gridSizingMeasurementResponseSchema,
} from './gridSizing';

const point = (x: number, y: number) => ({ x, y });

function payload(bbox = { top_left: point(9, 4), bottom_right: point(13, 9) }) {
  return {
    version: GRID_SIZING_VERSION,
    cake_top_diameter: { start: point(4, 8), end: point(16, 8) },
    cake_top_height: { start: point(5, 8), end: point(5, 12) },
    items: [{
      source_group_id: 'main_group',
      role: 'main_toppers' as const,
      description: 'Acrylic topper',
      bbox,
    }],
  };
}

describe('grid sizing', () => {
  it('calculates a centered Cartesian bbox with +y upward', () => {
    const result = calculateGridSizing({
      version: CARTESIAN_SIZING_VERSION,
      cake_top_diameter: { start: point(-6, 0), end: point(6, 0) },
      cake_top_height: { start: point(0, 5), end: point(0, -3) },
      items: [{
        source_group_id: 'main_group', role: 'main_toppers' as const, description: 'Acrylic topper',
        bbox: { top_left: point(-3, 4), bottom_right: point(2, -1) },
      }],
    }, 'cartesian_4q');

    expect(result).toMatchObject({
      coordinate_system: 'cartesian_4q',
      diameter_units: 12,
      height_units: 8,
      cake_reference_area_units: 96,
    });
    expect(result.items[0]).toMatchObject({
      bbox: { top_left: point(-3, 4), bottom_right: point(2, -1) },
      bbox_area_units: 25,
      ratio: 25 / 96,
    });
  });

  it('uses signed Cartesian bounds in the response schema and prompt', () => {
    const schema = gridSizingMeasurementResponseSchema('cartesian_4q') as { properties: { bbox: { properties: { top_left: { properties: { x: { minimum: number; maximum: number } } } } } } };
    expect(schema.properties.bbox.properties.top_left.properties.x).toMatchObject({ minimum: -10, maximum: 10 });
    expect(CARTESIAN_SIZING_EDITABLE_PROMPT).toContain('[0,0]');
    expect(CARTESIAN_SIZING_EDITABLE_PROMPT).toContain('+y points upward');
    expect(CARTESIAN_SIZING_EDITABLE_PROMPT).toContain('FRONT-CENTER');
    expect(GRID_SIZING_EDITABLE_PROMPT).toContain('FRONT-CENTER');
  });
  it('calculates bbox area against the exact top-tier cross-section area', () => {
    const result = calculateGridSizing(payload());

    expect(result).toMatchObject({
      diameter_units: 12,
      height_units: 4,
      cake_reference_area_units: 48,
    });
    expect(result.items[0]).toMatchObject({
      bbox_width_units: 4,
      bbox_height_units: 5,
      bbox_area_units: 20,
      ratio: 20 / 48,
    });
  });

  it('projects perspective-slanted cake endpoints to the horizontal and vertical reference axes', () => {
    const result = buildGridSizingPayload({
      version: GRID_SIZING_VERSION,
      cake_top_diameter: { start: point(16, 8), end: point(4, 4) },
      cake_top_height: { start: point(8, 12), end: point(5, 8) },
    }, [{
      source_group_id: 'main_group',
      role: 'main_toppers',
      description: 'Acrylic topper',
      measurement: { bbox: { top_left: point(9, 4), bottom_right: point(13, 9) } },
    }]);

    expect(result.cake_top_diameter).toEqual({ start: point(4, 6), end: point(16, 6) });
    expect(result.cake_top_height).toEqual({ start: point(6.5, 8), end: point(6.5, 12) });
    expect(calculateGridSizing(result)).toMatchObject({ diameter_units: 12, height_units: 4 });
  });

  it('snaps displayed and priced boxes outward to visible grid lines', () => {
    const result = calculateGridSizing(payload({
      top_left: point(2.7, 3.8),
      bottom_right: point(7.4, 10.3),
    }));

    expect(result.items[0]).toMatchObject({
      bbox: { top_left: point(2, 3), bottom_right: point(8, 11) },
      bbox_width_units: 6,
      bbox_height_units: 8,
      bbox_area_units: 48,
      ratio: 1,
    });
    expect(calculateGridSizing(payload({
      top_left: point(2.1, 3.1),
      bottom_right: point(2.2, 3.2),
    })).items[0]).toMatchObject({
      bbox: { top_left: point(2, 3), bottom_right: point(3, 4) },
      bbox_area_units: 1,
      ratio: 1 / 48,
    });
    expect(calculateGridSizing(payload({
      top_left: point(19.6, 18.3),
      bottom_right: point(20, 20),
    })).items[0].bbox).toEqual({ top_left: point(19, 18), bottom_right: point(20, 20) });
  });

  it('accepts one representative bbox for a repeated quantity and sizes the row once', () => {
    const result = applyGridSizingToAnalysis({
      rejection: { isRejected: false },
      main_toppers: [{
        group_id: 'main_group', type: 'edible_3d_ordinary', quantity: 6, description: 'Fondant pickleball',
      }],
      support_elements: [{
        group_id: 'size_free_group', type: 'edible_flowers_filler', quantity: 3, description: 'Filler flowers',
      }],
    }, {
      ...payload(),
      items: [
        payload().items[0],
        {
          source_group_id: 'size_free_group',
          role: 'support_elements',
          description: 'Filler flowers',
          bbox: { top_left: point(1.5, 2), bottom_right: point(2.5, 3) },
        },
      ],
    });

    expect(result.analysis.main_toppers).toEqual([{
      group_id: 'main_group', type: 'edible_3d_ordinary', quantity: 6, description: 'Fondant pickleball', size: 'medium',
    }]);
    expect(result.analysis.support_elements).toEqual([{
      group_id: 'size_free_group', type: 'edible_flowers_filler', quantity: 3, description: 'Filler flowers',
    }]);
    expect(result.gridSizing.items[0].category).toBe('medium');
    expect(result.gridSizing.items[1].category).toBeUndefined();
  });

  it('uses the exact grid area-ratio bands instead of a model-provided size', () => {
    const result = applyGridSizingToAnalysis({
      rejection: { isRejected: false },
      main_toppers: [{
        group_id: 'main_group', type: 'candle', quantity: 1, description: 'Tall candle',
      }],
      support_elements: [],
    }, payload());

    expect((result.analysis.main_toppers[0] as { size?: string }).size).toBe('medium');
    expect(classifyGridSizingAreaRatio(0.3333)).toBe('small');
    expect(classifyGridSizingAreaRatio(0.33330001)).toBe('medium');
    expect(classifyGridSizingAreaRatio(0.8333)).toBe('medium');
    expect(classifyGridSizingAreaRatio(0.83330001)).toBe('large');
  });

  it('requires a valid non-zero-area bbox for every priced row', () => {
    expect(() => applyGridSizingToAnalysis({
      rejection: { isRejected: false }, main_toppers: [{ group_id: 'main_group', type: 'toy', quantity: 1, size: 'small' }], support_elements: [],
    }, { ...payload(), items: [] })).toThrow(/missing its required representative grid bbox/);
    expect(() => calculateGridSizing({
      ...payload({ top_left: point(4, 4), bottom_right: point(4, 9) }),
    })).toThrow(/must span positive width and height/);
    expect(() => calculateGridSizing({
      ...payload(), items: [{
        ...payload().items[0],
        bbox: { top_left: point(4, 4) },
      }],
    })).toThrow(/bbox.bottom_right must be an object/);
    expect(() => calculateGridSizing({
      ...payload(), items: [{ ...payload().items[0], bbox: undefined }],
    })).toThrow(/bbox must be an object/);
    expect(() => validateGridSizing({
      ...payload(), cake_top_height: { start: point(5, 8), end: point(5, 8) },
    })).not.toThrow();
    expect(() => calculateGridSizing({
      ...payload(), cake_top_height: { start: point(5, 8), end: point(5, 8) },
    })).toThrow(/top-to-bottom across one vertical top-tier wall cross-section/);
    expect(() => calculateGridSizing({
      ...payload(), cake_top_diameter: { start: point(4, 8), end: point(16, 9) },
    })).toThrow(/horizontal top-tier cross-section/);
    expect(() => calculateGridSizing({
      ...payload(), cake_top_height: { start: point(5, 8), end: point(6, 12) },
    })).toThrow(/vertical top-tier wall cross-section/);
    expect(validateGridSizing({
      ...payload({ top_left: point(13, 9), bottom_right: point(9, 4) }),
    }).items[0].bbox).toEqual({ top_left: point(9, 4), bottom_right: point(13, 9) });
  });

  it('accepts only the frozen manifest rows from the dedicated coordinate pass', () => {
    const located = buildGridSizingPayloadFromLocator({
      grid_sizing: {
        version: GRID_SIZING_VERSION,
        cake_top_diameter: { start: point(4, 8), end: point(16, 8) },
        cake_top_height: { start: point(5, 8), end: point(5, 12) },
      },
      rows: [{
        group_id: 'main_group',
        grid_sizing: { bbox: { top_left: point(9, 4), bottom_right: point(13, 9) } },
      }],
    }, [{ source_group_id: 'main_group', role: 'main_toppers', description: 'Acrylic topper' }]);

    expect(located.items).toEqual([expect.objectContaining({
      source_group_id: 'main_group',
      role: 'main_toppers',
      bbox: { top_left: point(9, 4), bottom_right: point(13, 9) },
    })]);
    expect(() => buildGridSizingPayloadFromLocator({
      grid_sizing: located,
      rows: [{ group_id: 'unknown_group', grid_sizing: { bbox: { top_left: point(1, 1), bottom_right: point(2, 2) } } }],
    }, [{ source_group_id: 'main_group', role: 'main_toppers', description: 'Acrylic topper' }])).toThrow(/missing main_group/);
    expect(gridSizingLocatorResponseSchema()).toMatchObject({
      required: ['grid_sizing', 'rows'],
      properties: { rows: { type: 'ARRAY' } },
    });
  });

  it('combines a calibrated cake-geometry response with one isolated row locator per manifest row', () => {
    const bindings = [{ source_group_id: 'main_group', role: 'main_toppers' as const, description: 'Tall acrylic topper' }];
    const calibrated = buildGridSizingPayloadFromCalibratedLocator({
      grid_sizing: {
        version: GRID_SIZING_VERSION,
        cake_top_diameter: { start: point(4, 8), end: point(16, 8) },
        cake_top_height: { start: point(5, 8), end: point(5, 12) },
      },
    }, [{
      group_id: 'main_group',
      grid_sizing: { bbox: { top_left: point(9, 4), bottom_right: point(13, 9) } },
    }], bindings);

    expect(calibrated.items).toEqual([{
      source_group_id: 'main_group',
      role: 'main_toppers',
      description: 'Tall acrylic topper',
      bbox: { top_left: point(9, 4), bottom_right: point(13, 9) },
    }]);
    expect(gridSizingAnchorLocatorResponseSchema()).toMatchObject({
      required: ['grid_sizing'],
    });
    expect(gridSizingRowLocatorResponseSchema('main_group')).toMatchObject({
      required: ['group_id', 'grid_sizing'],
      properties: { group_id: { enum: ['main_group'] } },
    });
    expect(gridSizingRowLocatorPrompt(bindings[0], 1, 1)).toContain('Tall acrylic topper');
  });

  it('does not ask grid-mode cake messages for legacy pixel bboxes', () => {
    const schema = addGridSizingToResponseSchema({
      type: 'OBJECT',
      properties: {
        main_toppers: { type: 'ARRAY', items: { type: 'OBJECT', properties: {}, required: [] } },
        support_elements: { type: 'ARRAY', items: { type: 'OBJECT', properties: {}, required: [] } },
        cake_messages: {
          type: 'ARRAY',
          items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, bbox: { type: 'OBJECT' } }, required: ['text'] },
        },
      },
      required: [],
    });
    expect(schema.properties.cake_messages.items.properties).not.toHaveProperty('bbox');
  });

  it('creates a labeled overlay without changing the source dimensions', async () => {
    const source = await sharp({
      create: { width: 200, height: 120, channels: 3, background: { r: 220, g: 220, b: 220 } },
    }).png().toBuffer();
    const overlay = await createGridOverlay(source.toString('base64'));
    const metadata = await sharp(Buffer.from(overlay.imageData, 'base64')).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(120);
    expect(overlay.previewDataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('creates a centered Cartesian overlay without changing the source dimensions', async () => {
    const source = await sharp({
      create: { width: 200, height: 120, channels: 3, background: { r: 220, g: 220, b: 220 } },
    }).png().toBuffer();
    const overlay = await createCartesianOverlay(source.toString('base64'));
    const metadata = await sharp(Buffer.from(overlay.imageData, 'base64')).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(120);
    expect(overlay.previewDataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('embeds one local bbox object per row with no top-level items schema', () => {
    const anchorSchema = gridSizingResponseSchema() as { properties: Record<string, unknown> };
    const responseSchema = addGridSizingToResponseSchema({
      type: 'object',
      properties: {
        main_toppers: { type: 'array', items: { type: 'object', properties: { group_id: { type: 'string' }, size_line: { type: 'object' } }, required: ['group_id', 'size_line'] } },
        support_elements: { type: 'array', items: { type: 'object', properties: { group_id: { type: 'string' }, size_line: { type: 'object' } }, required: ['group_id', 'size_line'] } },
      },
      required: ['main_toppers', 'support_elements'],
    }) as { properties: Record<string, unknown> };
    const main = responseSchema.properties.main_toppers as { items: { properties: Record<string, unknown>; required: string[] } };

    expect(anchorSchema.properties).toHaveProperty('cake_top_height');
    expect(anchorSchema.properties).not.toHaveProperty('items');
    expect(main.items.properties.grid_sizing).toMatchObject({ type: 'OBJECT' });
    expect((main.items.properties.grid_sizing as { required: string[] }).required).toEqual(['bbox']);
    expect((main.items.properties.grid_sizing as { properties: Record<string, unknown> }).properties).not.toHaveProperty('size_line');
    expect(main.items.properties).not.toHaveProperty('size_line');
    expect(main.items.properties).not.toHaveProperty('size');
    expect(main.items.required).toContain('grid_sizing');
    expect(main.items.required).not.toContain('size_line');
  });
});
