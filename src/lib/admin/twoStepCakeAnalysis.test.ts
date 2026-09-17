import { describe, expect, it } from 'vitest';

import {
  assertCompiledAnalysisMatchesInventory,
  buildSchemaCompilerInput,
  textOnlyCompilerRequestParts,
  TWO_STEP_SCHEMA_COMPILER_PROMPT,
  TWO_STEP_V385_MODE,
  TWO_STEP_VISUAL_INVENTORY_PROMPT,
  validateVisualInventory,
  visualInventoryResponseSchema,
} from './twoStepCakeAnalysis';
import { GRID_SIZING_VERSION, assertGridSizingPreserved, buildGridSizingPayload } from './gridSizing';

const frozenInventory = validateVisualInventory({
  inventory_version: TWO_STEP_V385_MODE,
  cake: {
    form_and_body: 'Single-tier round cake with vertical sides.',
    body_tier_evidence: 'One continuous cake body with no second physical body.',
    icing_base_and_finish: 'White textured soft icing.',
    top_surface: 'White iced top with an ice-shard structure.',
    side_surface: 'White iced side wall with a central Elsa image panel.',
  },
  observed_groups: [{
    group_id: 'elsa_figure',
    description: 'Printed Elsa image set flush into the front side of the cake.',
    belongs_to_cake_design: true,
    surface: 'cake_side',
    attachment: 'flush_applied',
    extent: 'full_side_region',
    physical_form: 'printed_full_panel',
    visible_count: 1,
    count_uncertain: false,
    observed_scale: 'large',
    colors: ['blue', 'white', 'blonde'],
    material_evidence: ['flat printed edible-sheet appearance'],
    material_uncertain: true,
    requires_priced_row: true,
    evidence_summary: 'The panel occupies the front vertical cake wall and does not cover the top surface.',
  }],
  messages: [],
  board_and_surroundings: 'White board and stand.',
  uncertainties: [],
  rejection: { isRejected: false, reason: '', message: '' },
});

function compiledElsa(type: string) {
  return {
    main_toppers: [],
    support_elements: [{
      type,
      material: 'waferpaper',
      group_id: 'elsa_figure',
      color: '#87CEEB',
      size: 'large',
      quantity: 1,
      description: 'Flat printed Elsa panel applied to the front cake side.',
    }],
    rejection: { isRejected: false, reason: '', message: '' },
  };
}

describe('two-step v3.85 cake analysis', () => {
  it('carries grid measurements through the immutable visual inventory contract', () => {
    const gridSizing = {
      version: GRID_SIZING_VERSION,
      cake_top_diameter: { start: { x: 4, y: 8 }, end: { x: 16, y: 8 } },
      cake_top_height: { start: { x: 5, y: 8 }, end: { x: 5, y: 12 } },
    };
    const inventory = validateVisualInventory({
      ...frozenInventory,
      grid_sizing: gridSizing,
      observed_groups: [{
        ...frozenInventory.observed_groups[0],
        grid_sizing: {
          bbox: { top_left: { x: 9, y: 8 }, bottom_right: { x: 11, y: 14 } },
        },
      }],
    });
    const normalizedInventoryGrid = buildGridSizingPayload(gridSizing, inventory.observed_groups.map((group) => ({
      source_group_id: group.group_id,
      role: null,
      description: group.description,
      measurement: group.grid_sizing,
    })));
    const compilerGrid = buildGridSizingPayload(gridSizing, [{
      source_group_id: 'elsa_figure',
      role: 'support_elements',
      description: 'Printed Elsa image panel.',
      measurement: {
        bbox: { top_left: { x: 9, y: 8 }, bottom_right: { x: 11, y: 14 } },
      },
    }]);
    const schema = visualInventoryResponseSchema(true) as { required: string[] };

    expect(inventory.grid_sizing).toEqual(gridSizing);
    expect(inventory.observed_groups[0].grid_sizing).toMatchObject({
      bbox: { top_left: { x: 9, y: 8 }, bottom_right: { x: 11, y: 14 } },
    });
    expect(schema.required).toContain('grid_sizing');
    expect(() => assertGridSizingPreserved(normalizedInventoryGrid, compilerGrid)).not.toThrow();
  });

  it('keeps a side-mounted Elsa panel in support_elements as edible_photo_side', () => {
    const compiled = compiledElsa('edible_photo_side');

    expect(() => assertCompiledAnalysisMatchesInventory(frozenInventory, compiled)).not.toThrow();
    expect(compiled.main_toppers).toEqual([]);
    expect(compiled.support_elements[0]).toMatchObject({
      type: 'edible_photo_side', group_id: 'elsa_figure', quantity: 1, material: 'waferpaper',
    });
  });

  it('rejects a compiler attempt to move a side panel onto the cake top', () => {
    expect(() => assertCompiledAnalysisMatchesInventory(frozenInventory, {
      ...compiledElsa('edible_photo_side'),
      main_toppers: [{
        type: 'edible_photo_top', material: 'waferpaper', group_id: 'elsa_figure', classification: 'hero', size: 'large', quantity: 1, description: 'Elsa image.',
      }],
      support_elements: [],
    })).toThrow(/edible_photo_top requires inventory surface cake_top|omits required inventory group/);
  });

  it('uses a strict evidence-only first-stage schema and a text-only compiler payload', () => {
    const schema = visualInventoryResponseSchema() as { properties: Record<string, unknown> };
    const compilerInput = buildSchemaCompilerInput(
      TWO_STEP_SCHEMA_COMPILER_PROMPT,
      frozenInventory,
      'v3.85 taxonomy reference',
    );

    expect(TWO_STEP_VISUAL_INVENTORY_PROMPT).toContain('Do not use canonical enum names');
    expect(TWO_STEP_SCHEMA_COMPILER_PROMPT).toContain('exclusive visual authority');
    expect(schema.properties).toHaveProperty('observed_groups');
    expect(compilerInput).toContain('BEGIN IMMUTABLE VISUAL INVENTORY');
    expect(compilerInput).toContain('elsa_figure');
    expect(compilerInput).not.toContain('inlineData');
    expect(compilerInput).not.toContain('data:image');
    expect(textOnlyCompilerRequestParts(
      TWO_STEP_SCHEMA_COMPILER_PROMPT,
      frozenInventory,
      'v3.85 taxonomy reference',
    )).toEqual([{ text: compilerInput }]);
  });

  it('refuses malformed step-one output before it can be compiled or priced', () => {
    expect(() => validateVisualInventory({
      ...frozenInventory,
      observed_groups: [{ ...frozenInventory.observed_groups[0], surface: 'front_of_cake' }],
    })).toThrow(/surface must be one of/);
  });
});
