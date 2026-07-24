import { describe, expect, it, vi } from 'vitest';

import { getDynamicTypeEnums } from './utils';

describe('getDynamicTypeEnums', () => {
  it('recovers canonical types from item_key and sub_item_type when item_type is null', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        {
          item_type: null,
          item_key: 'support_printout',
          category: 'support_element',
          sub_item_type: null,
        },
        {
          item_type: null,
          item_key: null,
          category: 'main_topper',
          sub_item_type: 'icing_doodle_intricate',
        },
      ],
      error: null,
    });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq,
        })),
      })),
    };

    const result = await getDynamicTypeEnums(supabase);

    expect(result.supportElementTypes).toContain('support_printout');
    expect(result.mainTopperTypes).toContain('icing_doodle');
    expect(result.subtypesByType.icing_doodle).toEqual(['icing_doodle_intricate']);
  });

  it('maps fresh flower pricing aliases to edible flowers for analyzer enums', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        {
          item_type: 'fresh_flowers',
          item_key: 'fresh_flowers',
          category: 'support_element',
          sub_item_type: null,
        },
      ],
      error: null,
    });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq,
        })),
      })),
    };

    const result = await getDynamicTypeEnums(supabase);

    expect(result.supportElementTypes).toContain('edible_flowers');
    expect(result.supportElementTypes).not.toContain('fresh_flowers');
  });

  it('keeps placement-specific intricate doodle pricing types in their matching analyzer enums', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        {
          item_type: 'icing_doodle_intricate_top',
          item_key: 'icing_doodle_intricate_top',
          category: 'main_topper',
          sub_item_type: null,
        },
        {
          item_type: 'icing_doodle_intricate_side',
          item_key: 'icing_doodle_intricate_side',
          category: 'support_element',
          sub_item_type: null,
        },
      ],
      error: null,
    });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq,
        })),
      })),
    };

    const result = await getDynamicTypeEnums(supabase);

    expect(result.mainTopperTypes).toContain('icing_doodle_intricate_top');
    expect(result.mainTopperTypes).not.toContain('icing_doodle_intricate_side');
    expect(result.supportElementTypes).toContain('icing_doodle_intricate_side');
    expect(result.supportElementTypes).not.toContain('icing_doodle_intricate_top');
  });
});
