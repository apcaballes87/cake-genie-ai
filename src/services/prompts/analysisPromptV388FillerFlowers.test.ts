import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(rootDir, path), 'utf8');
}

describe('v3.88 sized filler flower support normalization', () => {
  it('pins generic filler and baby’s-breath flowers to the sized per-piece support type', () => {
    const prompt = readProjectFile('src/services/prompts/fallback-prompt.txt');
    const fixture = JSON.parse(readProjectFile(
      'src/services/prompts/fixtures/filler-flowers-support-normalization.json',
    )) as {
      examples: string[];
      expected_support_element: Record<string, string>;
      forbidden_fields: string[];
      unit_price_php: number;
      counterexample: string;
    };

    expect(prompt).toContain('### FILLER FLOWER AND BABY\'S-BREATH NORMALIZATION (BINDING)');
    expect(prompt).toContain('`edible_flowers_filler` must emit exactly one direct-diameter `size`: `small`,');
    expect(prompt).toContain('Small generic filler flowers and all baby\'s-breath flowers (`edible_flowers_filler`, per visible flower, direct-diameter size)');
    expect(prompt).toMatch(/a main topper or\s+`edible_flowers`; its price remains ₱5 per visible flower in every size band\./);
    expect(prompt).toContain('emit one `small`, `medium`, or `large` size for every topper and support row');
    expect(fixture.examples).toHaveLength(4);
    expect(fixture.expected_support_element).toEqual({
      type: 'edible_flowers_filler',
      material: 'edible_fondant',
      size: 'small',
      group_id: 'matching_visible_appearance_and_color',
    });
    expect(fixture.forbidden_fields).toEqual(['size_line', 'bbox', 'coverage']);
    expect(fixture.unit_price_php).toBe(5);
    expect(fixture.counterexample).toContain('distinct ordinary or intricate bloom');
  });

  it('preserves historical v3.88 staging while v3.90 owns the active fallback', () => {
    const prompt = readProjectFile('src/services/prompts/fallback-prompt.txt');
    const stageMigration = readProjectFile(
      'supabase/migrations/20260915110000_stage_prompt_v388_sized_filler_flower_support.sql',
    );
    const activateMigration = readProjectFile(
      'supabase/migrations/20260915111000_activate_prompt_v388_sized_filler_flower_support.sql',
    );
    const v387Migration = readProjectFile(
      'supabase/migrations/20260914100000_stage_prompt_v387_filler_flower_support.sql',
    );
    const v390StageMigration = readProjectFile(
      'supabase/migrations/20260916100000_stage_prompt_v390_piped_botanical_soft_icing_gate.sql',
    );

    expect(createHash('md5').update(prompt).digest('hex')).toBe('ac7f65da35135d3d4e42e90b7c82e655');
    expect(stageMigration).toContain("v386_md5 constant text := '64542a47d0e7f19b51db22a6209ed0e4'");
    expect(stageMigration).toContain("v388_md5 constant text := 'c4afb9b84576b1c37501e9a56fd379f6'");
    expect(stageMigration).toContain("source_version <> '3.86'");
    expect(stageMigration).toContain("values (\n    '3.88',\n    next_prompt,\n    false,");
    expect(stageMigration).toContain("'edible_flowers_filler_small'");
    expect(stageMigration).toContain("'edible_flowers_filler_medium'");
    expect(stageMigration).toContain("'edible_flowers_filler_large'");
    expect(stageMigration).toContain("'per_piece'");
    expect(stageMigration).toContain('and grouping rules. Do not use it for a distinct ordinary or intricate bloom');
    expect(stageMigration).not.toContain('update public.ai_prompts\n  set is_active = false');
    expect(activateMigration).toContain("where version = '3.88'");
    expect(activateMigration).toContain('update public.ai_prompts\n  set is_active = false');
    expect(v387Migration).toContain("'3.87'");
    expect(v387Migration).toContain("v387_md5 constant text := '22c733920762d8f558495342083442bd'");
    expect(v390StageMigration).toContain("v389_md5 constant text := '7522fb1ba49ee59513d3cefddba8444c'");
    expect(v390StageMigration).toContain("v390_md5 constant text := 'ac7f65da35135d3d4e42e90b7c82e655'");
  });
});
