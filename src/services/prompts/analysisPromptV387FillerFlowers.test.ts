import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(rootDir, path), 'utf8');
}

describe('v3.87 filler flower support normalization', () => {
  it('pins generic filler and baby’s-breath flowers to the size-free per-piece support type', () => {
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
    expect(prompt).toContain('`edible_flowers_filler` is size-free: omit `size`, `size_line`, `bbox`, and');
    expect(prompt).toContain('Small generic filler flowers and all baby\'s-breath flowers (`edible_flowers_filler`, per visible flower, no size)');
    expect(prompt).toContain('a main topper or `edible_flowers`; its price is per visible flower');
    expect(fixture.examples).toHaveLength(4);
    expect(fixture.expected_support_element).toEqual({
      type: 'edible_flowers_filler',
      material: 'edible_fondant',
      group_id: 'matching_visible_appearance_and_color',
    });
    expect(fixture.forbidden_fields).toEqual(['size', 'size_line', 'bbox', 'coverage']);
    expect(fixture.unit_price_php).toBe(5);
    expect(fixture.counterexample).toContain('distinct ordinary or intricate bloom');
  });

  it('stages v3.87 from the verified live v3.86 prompt and creates the merchant’s ₱5 rule', () => {
    const prompt = readProjectFile('src/services/prompts/fallback-prompt.txt');
    const migration = readProjectFile(
      'supabase/migrations/20260914100000_stage_prompt_v387_filler_flower_support.sql',
    );

    expect(createHash('md5').update(prompt).digest('hex')).toBe('22c733920762d8f558495342083442bd');
    expect(migration).toContain("v386_md5 constant text := '64542a47d0e7f19b51db22a6209ed0e4'");
    expect(migration).toContain("v387_md5 constant text := '22c733920762d8f558495342083442bd'");
    expect(migration).toContain("source_version <> '3.86'");
    expect(migration).toContain("values (\n    '3.87',\n    next_prompt,\n    false,");
    expect(migration).toContain("'edible_flowers_filler'");
    expect(migration).toContain("'per_piece'");
    expect(migration).toContain("    5,\n    'support_element',");
    expect(migration).not.toContain('update public.ai_prompts set is_active = false');
  });
});
import { createHash } from 'crypto';
