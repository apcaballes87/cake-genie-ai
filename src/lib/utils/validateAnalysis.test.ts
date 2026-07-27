import { describe, expect, it } from 'vitest';

import type { MainTopperUI, SupportElementUI } from '@/types';
import { validateAnalysis } from './validateAnalysis';

describe('validateAnalysis edible 2D complex placement', () => {
  it('accepts edible 2D complex as a main topper', () => {
    const result = validateAnalysis({
      mainToppers: [{
        id: 'roblox-face',
        type: 'edible_2d_complex',
        original_type: 'edible_2d_complex',
        description: 'layered Roblox character face with hair and headphones',
        material: 'edible_fondant',
        size: 'large',
        quantity: 1,
        classification: 'hero',
        isEnabled: true,
        price: 300,
      } as MainTopperUI],
      supportElements: [],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects edible 2D complex as a support element', () => {
    const result = validateAnalysis({
      mainToppers: [],
      supportElements: [{
        id: 'invalid-support',
        type: 'edible_2d_complex',
        original_type: 'edible_2d_complex',
        description: 'complex flat character plaque',
        material: 'edible_fondant',
        size: 'large',
        quantity: 1,
        isEnabled: true,
        price: 300,
      } as unknown as SupportElementUI],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        field: 'support_elements[0].type',
        value: 'edible_2d_complex',
      }),
    ]);
  });
});
