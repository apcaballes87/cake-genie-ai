import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(rootDir, path), 'utf8');
}

describe('v3.91 one-color object and flat-flower gates retained in v3.96', () => {
  it('keeps a standalone one-color bridal dress ordinary without downgrading complete figures', () => {
    const prompt = readProjectFile('src/services/prompts/fallback-prompt.txt');
    const fixture = JSON.parse(readProjectFile(
      'src/services/prompts/fixtures/bridal-shower-one-color-dress-ordinary.json',
    )) as {
      observed_construction: string[];
      expected_main_topper: Record<string, unknown>;
      forbidden_type: string;
      non_qualifying_inference: string;
      qualifying_counterexample: string;
    };

    expect(prompt).toContain('**v3.96 Version - Side-Positioned Edible Character Figures**');
    expect(prompt).toContain('#### ONE-COLOR NON-CHARACTER OBJECT GATE (BINDING)');
    expect(prompt).toContain('one visibly distinct color is a\ndisqualifier for `edible_3d_complex`');
    expect(prompt).toContain('Do not infer a bride, person, or\nfigurine from a bridal/wedding theme');
    expect(prompt).toContain('This gate does not downgrade a genuinely complete freestanding animal figure');
    expect(fixture.observed_construction).toHaveLength(3);
    expect(fixture.expected_main_topper).toEqual({
      type: 'edible_3d_ordinary',
      material: 'edible_fondant',
      quantity: 1,
      group_id: 'standalone_white_fondant_dress',
      classification: 'hero',
    });
    expect(fixture.forbidden_type).toBe('edible_3d_complex');
    expect(fixture.non_qualifying_inference).toContain('does not establish a bride figurine');
    expect(fixture.qualifying_counterexample).toContain('regardless of color');
  });

  it('maps focal flat fondant daisies to edible 2D shapes rather than edible flowers', () => {
    const prompt = readProjectFile('src/services/prompts/fallback-prompt.txt');
    const fixture = JSON.parse(readProjectFile(
      'src/services/prompts/fixtures/mom-my-hero-flat-daisies-2d-shapes.json',
    )) as {
      observed_construction: string[];
      expected_main_topper: Record<string, unknown>;
      forbidden_type: string;
      non_qualifying_cues: string[];
      qualifying_counterexample: string;
    };

    expect(prompt).toContain('### FLAT EDIBLE FLOWER DEPTH GATE (BINDING)');
    expect(prompt).toContain('Use `edible_2d_shapes` for a focal flat flower or a focal group on the top;');
    expect(prompt).toContain('A flat daisy with a yellow center is `edible_2d_shapes` when it is a focal top\nmotif.');
    expect(fixture.observed_construction).toHaveLength(3);
    expect(fixture.expected_main_topper).toEqual({
      type: 'edible_2d_shapes',
      material: 'edible_fondant',
      quantity: 6,
      group_id: 'top_white_daisy_flowers',
      classification: 'hero',
    });
    expect(fixture.forbidden_type).toBe('edible_flowers');
    expect(fixture.non_qualifying_cues).toEqual(['yellow centers', 'flower identity', 'slight cast shadows']);
    expect(fixture.qualifying_counterexample).toContain('visible petal side surfaces');
  });

  it('keeps the fallback byte-identical to active v3.96 and verifies its guarded migrations', () => {
    const prompt = readProjectFile('src/services/prompts/fallback-prompt.txt');
    const historicalStageMigration = readProjectFile(
      'supabase/migrations/20260917100000_stage_prompt_v391_one_color_non_character_3d_gate.sql',
    );
    const historicalActivateMigration = readProjectFile(
      'supabase/migrations/20260917101000_activate_prompt_v391_one_color_non_character_3d_gate.sql',
    );
    const stageMigration = readProjectFile(
      'supabase/migrations/20260923130801_stage_prompt_v396_side_positioned_edible_characters.sql',
    );
    const activateMigration = readProjectFile(
      'supabase/migrations/20260923142826_activate_prompt_v396_side_positioned_edible_characters.sql',
    );

    expect(createHash('md5').update(prompt).digest('hex')).toBe('afc7a90e525fcc74fa7c018f6d47d1ea');
    expect(prompt).toContain('**v3.96 Version - Side-Positioned Edible Character Figures**');
    expect(prompt).toContain('Require construction-first grouping for piped flowers');
    expect(historicalStageMigration).toContain("v390_md5 constant text := 'ac7f65da35135d3d4e42e90b7c82e655'");
    expect(historicalStageMigration).toContain("v391_md5 constant text := 'fede0545b650c86737631e714bd918ee'");
    expect(historicalStageMigration).toContain("source_version <> '3.90'");
    expect(historicalStageMigration).toContain("values (\n    '3.91',\n    next_prompt,\n    false,");
    expect(historicalStageMigration).not.toContain('update public.ai_prompts\n  set is_active = false');
    expect(historicalActivateMigration).toContain("where version = '3.90'");
    expect(historicalActivateMigration).toContain("where version = '3.91'");
    expect(historicalActivateMigration).toContain('update public.ai_prompts\n  set is_active = false');
    expect(stageMigration).toContain("v395_md5 constant text := 'd53fd769dcd1e258c04c5f9beec3be29'");
    expect(stageMigration).toContain("v396_md5 constant text := 'afc7a90e525fcc74fa7c018f6d47d1ea'");
    expect(stageMigration).toContain("where version = '3.96'");
    expect(stageMigration).not.toContain('update public.ai_prompts\n  set is_active = false');
    expect(activateMigration).toContain("v395_md5 constant text := 'd53fd769dcd1e258c04c5f9beec3be29'");
    expect(activateMigration).toContain("v396_md5 constant text := 'afc7a90e525fcc74fa7c018f6d47d1ea'");
    expect(activateMigration).toContain('update public.ai_prompts\n  set is_active = false');
  });
});
