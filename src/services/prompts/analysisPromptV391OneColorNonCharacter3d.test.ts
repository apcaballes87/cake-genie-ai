import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(rootDir, path), 'utf8');
}

describe('v3.91 one-color object and flat-flower gates', () => {
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

    expect(prompt).toContain('**v3.91 Version - One-Color Object and Flat-Flower Gates**');
    expect(prompt).toContain('#### ONE-COLOR NON-CHARACTER OBJECT GATE (BINDING)');
    expect(prompt).toContain('one visibly distinct color is a\ndisqualifier for `edible_3d_complex`');
    expect(prompt).toContain('Do not infer a bride, person, or\nfigurine from a bridal/wedding theme');
    expect(prompt).toContain('This gate does not downgrade a genuinely complete freestanding human or animal');
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

  it('keeps the staged v3.91 prompt byte-identical to the fallback', () => {
    const prompt = readProjectFile('src/services/prompts/fallback-prompt.txt');
    const stageMigration = readProjectFile(
      'supabase/migrations/20260917100000_stage_prompt_v391_one_color_non_character_3d_gate.sql',
    );
    const activateMigration = readProjectFile(
      'supabase/migrations/20260917101000_activate_prompt_v391_one_color_non_character_3d_gate.sql',
    );

    expect(createHash('md5').update(prompt).digest('hex')).toBe('fede0545b650c86737631e714bd918ee');
    expect(stageMigration).toContain("v390_md5 constant text := 'ac7f65da35135d3d4e42e90b7c82e655'");
    expect(stageMigration).toContain("v391_md5 constant text := 'fede0545b650c86737631e714bd918ee'");
    expect(stageMigration).toContain("source_version <> '3.90'");
    expect(stageMigration).toContain("values (\n    '3.91',\n    next_prompt,\n    false,");
    expect(stageMigration).not.toContain('update public.ai_prompts\n  set is_active = false');
    expect(activateMigration).toContain("where version = '3.90'");
    expect(activateMigration).toContain("where version = '3.91'");
    expect(activateMigration).toContain('update public.ai_prompts\n  set is_active = false');
  });
});
