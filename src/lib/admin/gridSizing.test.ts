import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  GRID_SIZING_VERSION,
  applyGridSizingToAnalysis,
  addGridSizingToResponseSchema,
  calculateGridSizing,
  createGridOverlay,
  gridSizingResponseSchema,
  validateGridSizing,
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
      group_id: 'size_free_group', type: 'edible_flowers_filler', quantity: 3, description: 'Filler flowers', size: 'small',
    }]);
    expect(result.gridSizing.items[0].category).toBe('medium');
  });

  it('uses type-aware local bbox-area bands instead of a model-provided size', () => {
    const result = applyGridSizingToAnalysis({
      rejection: { isRejected: false },
      main_toppers: [{
        group_id: 'main_group', type: 'candle', quantity: 1, description: 'Tall candle',
      }],
      support_elements: [],
    }, payload());

    expect((result.analysis.main_toppers[0] as { size?: string }).size).toBe('medium');
  });

  it('rejects missing, unmatched, or zero-area representative geometry', () => {
    expect(() => applyGridSizingToAnalysis({
      rejection: { isRejected: false }, main_toppers: [{ group_id: 'main_group', type: 'toy', quantity: 1, size: 'small' }], support_elements: [],
    }, { ...payload(), items: [] })).toThrow(/missing its representative grid bbox/);
    expect(() => calculateGridSizing({
      ...payload({ top_left: point(4, 4), bottom_right: point(4, 9) }),
    })).toThrow(/positive horizontal width/);
    expect(() => validateGridSizing({
      ...payload(), cake_top_height: { start: point(5, 8), end: point(5, 8) },
    })).not.toThrow();
    expect(() => calculateGridSizing({
      ...payload(), cake_top_height: { start: point(5, 8), end: point(5, 8) },
    })).toThrow(/cake_top_height must have positive length/);
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

  it('embeds one local bbox object per row with no top-level items schema', () => {
    const anchorSchema = gridSizingResponseSchema() as { properties: Record<string, unknown> };
    const responseSchema = addGridSizingToResponseSchema({
      type: 'object',
      properties: {
        main_toppers: { type: 'array', items: { type: 'object', properties: { group_id: { type: 'string' } }, required: ['group_id'] } },
        support_elements: { type: 'array', items: { type: 'object', properties: { group_id: { type: 'string' } }, required: ['group_id'] } },
      },
      required: ['main_toppers', 'support_elements'],
    }) as { properties: Record<string, unknown> };
    const main = responseSchema.properties.main_toppers as { items: { properties: Record<string, unknown>; required: string[] } };

    expect(anchorSchema.properties).toHaveProperty('cake_top_height');
    expect(anchorSchema.properties).not.toHaveProperty('items');
    expect(main.items.properties.grid_sizing).toMatchObject({ type: 'OBJECT' });
    expect(main.items.properties).not.toHaveProperty('size');
    expect(main.items.required).toContain('grid_sizing');
  });
});
