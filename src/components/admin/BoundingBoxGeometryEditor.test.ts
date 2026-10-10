import { describe, expect, it } from 'vitest';

import { boxMetrics, updateBoxForPointer } from './BoundingBoxGeometryEditor';

describe('BoundingBoxGeometryEditor geometry helpers', () => {
  it('maps move and every edge constraint into a valid 0–1000 tuple', () => {
    const box: [number, number, number, number] = [100, 200, 300, 400];
    expect(updateBoxForPointer(box, 'move', { x: 950, y: 950 }, { x: 300, y: 200 })).toEqual([800, 800, 1000, 1000]);
    expect(updateBoxForPointer(box, 'se', { x: -5, y: -5 }, { x: 0, y: 0 })).toEqual([100, 200, 101, 201]);
  });

  it.each([
    ['n', [150, 200, 300, 400]], ['ne', [150, 200, 300, 250]], ['e', [100, 200, 300, 250]], ['se', [100, 200, 150, 250]],
    ['s', [100, 200, 150, 400]], ['sw', [100, 250, 150, 400]], ['w', [100, 250, 300, 400]], ['nw', [150, 250, 300, 400]],
  ] as const)('resizes the %s handle in normalized [y, x] order', (handle, expected) => {
    expect(updateBoxForPointer([100, 200, 300, 400], handle, { x: 250, y: 150 }, { x: 0, y: 0 })).toEqual(expected);
  });

  it('calculates width and area ratios from [y, x] geometry', () => {
    expect(boxMetrics([100, 250, 300, 500], { start: [400, 0], end: [400, 1000] })).toEqual({ widthRatio: 0.25, areaRatio: expect.closeTo(0.0636619772) });
  });
});
