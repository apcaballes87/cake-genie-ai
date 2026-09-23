import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(rootDir, path), 'utf8');
}

describe('v3.86 edible leaf support normalization', () => {
  it('pins every discrete edible leaf/foliage piece to a small 2D support row', () => {
    const prompt = readProjectFile('src/services/prompts/fallback-prompt.txt');
    const fixture = JSON.parse(readProjectFile(
      'src/services/prompts/fixtures/edible-leaf-support-normalization.json',
    )) as {
      expected_support_element: Record<string, unknown>;
      forbidden_types: string[];
      non_qualifying_construction: string;
    };

    expect(prompt).toContain('### EDIBLE LEAF AND FOLIAGE NORMALIZATION (BINDING)');
    expect(prompt).toContain('be emitted only in `support_elements` as `type: "edible_2d_support"`,');
    expect(prompt).toContain('`material: "edible_fondant"`, and `size: "small"`.');
    expect(prompt).toContain('This leaf rule overrides every flower, flat-shape, focal-shape, complexity,');
    expect(prompt).toContain('| Any discrete edible fondant/gumpaste leaf or foliage piece | `edible_2d_support` | `edible_fondant` | support element only | fixed `small` |');
    expect(prompt).toContain('A\ndiscrete edible leaf or foliage piece is never a flower for this rule');
    expect(prompt).toContain('Discrete edible leaves and foliage use `edible_2d_support` instead.');
    expect(prompt).toContain('Every discrete edible leaf/foliage piece = `edible_2d_support`, support, `small`');
    expect(fixture.expected_support_element).toEqual({
      type: 'edible_2d_support',
      material: 'edible_fondant',
      size: 'small',
      group_id: 'foliage_leaves',
      quantity: 8,
    });
    expect(fixture.forbidden_types).toEqual([
      'edible_flowers',
      'gumpaste_bundle',
      'edible_2d_shapes',
      'edible_2d_complex',
      'edible_3d_ordinary',
    ]);
    expect(fixture.non_qualifying_construction).toContain('icing technique');
  });

  it('guards a transactional v3.86 release made from the verified live v3.85 prompt', () => {
    const migration = readProjectFile(
      'supabase/migrations/20260914090000_deploy_prompt_v386_edible_leaf_support_normalization.sql',
    );

    expect(migration).toContain("v385_md5 constant text := 'c98da2f592085f039e653eb938d9701a'");
    expect(migration).toContain("v386_md5 constant text := '64542a47d0e7f19b51db22a6209ed0e4'");
    expect(migration).toContain("source_version <> '3.85'");
    expect(migration).toContain("values ('3.86', next_prompt, true,");
    expect(migration).toContain('update public.ai_prompts set is_active = false');
    expect(migration).toContain('Every discrete edible leaf or foliage piece');
  });
});
