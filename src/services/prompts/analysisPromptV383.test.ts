import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENERATED_SUPPORT_ELEMENT_TYPES } from '@/lib/ai/generatedAnalysisContract';
import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';

const prompt = readFileSync('src/services/prompts/fallback-prompt.txt', 'utf8');
const section = (start: string, end: string) => {
  const from = prompt.indexOf(start);
  const to = prompt.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return prompt.slice(from, to);
};

describe('v3.83 prompt contracts', () => {
  it('orders the gates once and physically puts membership before item classification', () => {
    const order = section('## OUTPUT ORDER', '## CATEGORY 1:');
    expect([...order.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1])))
      .toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    const headings = [
      '## CATEGORY 1:',
      '### CAKE-OBJECT MEMBERSHIP GATE',
      '### COMPOSITION UNIT BEFORE ITEMIZATION',
      '### PHYSICAL DEPTH GATE',
      '### GLOBAL ITEM CLASSIFICATION PIPELINE',
      '### PRE-EMISSION UPRIGHT WAFER-PAPER SIDE CHECKPOINT',
      '## VISUAL FORENSIC LIBRARY',
    ];
    const positions = headings.map((heading) => prompt.indexOf(heading));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(prompt).not.toMatch(/HIGHEST PRECEDENCE|REQUIRED BEFORE EVERY ITEM RULE/i);
    for (const match of prompt.matchAll(/^(?:#{2,4} |\*\*)[^\n]*PRECEDENCE[^\n]*\n/gm)) {
      expect(prompt.slice(match.index! + match[0].length).trimStart())
        .toMatch(/^See OUTPUT ORDER step (?:[1-9]|1[0-2])\./);
    }
  });

  it('has one thickness owner explanation and preserves fixed-type matrix values', () => {
    expect(prompt.match(/provisional/g)).toHaveLength(1);
    expect(prompt.match(/ignored/g)).toHaveLength(1);
    const thickness = section('### cakeThickness Ratio Guide', '### keyword');
    expect(thickness).toContain('required **`cake_measurements.diameter`**');
    expect(thickness).toContain('always output for an accepted image');
    expect(thickness).toContain("`'5 in'` for soft icing, `'6 in'` for Fondant");
    expect(thickness).toContain("fixed-height types keep their fixed value");
    expect(thickness).toContain('| `Slab Cake` | `"6 in"` |');
    expect(thickness).toContain('| `Bento`, `Cupcake`, `Bento Cupcake Set` | `"2 in"` |');
    expect(prompt).not.toMatch(/diameter\/footprint|footprint\/diameter|in diameter|then lets just assume/i);
  });

  it('keeps both support enum declarations, table, and generated schema compatible', () => {
    const support = section('## CATEGORY 3:', '## CATEGORY 4:');
    const enums = [...support.matchAll(/"type": "([^"\n]+\|[^"\n]+)"/g)]
      .map((match) => match[1].split('|'));
    expect(enums).toHaveLength(2);
    expect(enums[0]).toEqual(enums[1]);
    expect(new Set(enums[0]).size).toBe(enums[0].length);
    const table = [...support.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
    expect(new Set(table).size).toBe(table.length);
    expect([...table].sort()).toEqual([...enums[0]].sort());
    for (const type of enums[0]) expect(GENERATED_SUPPORT_ELEMENT_TYPES).toContain(type);
    expect(enums[0]).toEqual(expect.arrayContaining([
      'piped_flowers_side', 'icing_brush_stroke', 'icing_splatter',
      'icing_minimalist_spread', 'icing_doodle',
    ]));
    expect(enums[0]).not.toEqual(expect.arrayContaining(['cupcake_topper', 'gumpaste_letters']));
    expect(support).toContain('Never emit a **`support_elements.type`** value outside this enum.');
    expect(support).toContain('Readable\nletters remain exclusively in `cake_messages`');
    expect(support).toContain('`premium_sprinkles` remains a support element even at full coverage');
    const main = section('### MAIN TOPPER JSON FORMAT', '## CATEGORY 3:');
    expect(main.match(/"type": "([^"]+)"/)![1].split('|')).not.toContain('premium_sprinkles');
    expect(main).toContain('"coverage": "small|medium|large"');
    expect(main).toContain('required\nfor that type and must be omitted from every other main-topper row');
    expect(support).toContain('required\nfor that type and must be omitted from every other support row');
  });

  it('accepts non-five same-box cupcakes as Bento while deferring all cupcake item rows', () => {
    const rejection = section('## STEP 1:', '## STEP 2:');
    const membership = section('### CAKE-OBJECT MEMBERSHIP GATE', '### COMPOSITION UNIT');
    const cake = section('### Bento Cupcake Set Classification Rule', '### cakeThickness (');
    expect(rejection).toContain('With any other visible cupcake count in that same box, accept `Bento`');
    expect(rejection).toMatch(/emit the accompanying cupcakes as item\s+rows/);
    expect(SYSTEM_INSTRUCTION).toContain('master analysis prompt in its OUTPUT ORDER');
    expect(SYSTEM_INSTRUCTION).toContain('does not emit those cupcakes or decorations located exclusively on them as item rows');
    expect(cake).toContain('AND 5 individual cupcakes');
    expect(cake).toContain('the count is not exactly 5');
    expect(cake).toContain('Do not emit those\ncupcakes in `main_toppers` or `support_elements`');
    expect(membership).toContain('does not emit those\ncupcakes as priced item rows');
    expect(prompt).not.toContain('cupcake_topper');
  });

  it('omits accepted-image geometry from the rejection shape', () => {
    const rejection = section('## STEP 1:', '## STEP 2:');
    expect(rejection).toContain('output only the top-level keys shown in the rejection skeleton');
    expect(rejection).toContain('Do not include `cake_measurements`, `cake_bbox`');
    expect(rejection).not.toContain('"cake_measurements"');
    expect(SYSTEM_INSTRUCTION).toContain('must omit `cake_measurements`, `cake_bbox`');
  });

  it('defines shape-aware cake lines and one-motif border sizing', () => {
    expect(prompt).toContain('The field name `diameter` is used for every accepted cake shape');
    expect(prompt).toContain('widest uninterrupted visible cake-body span at one level');
    expect(prompt).toContain('must use that same cupcake');
    expect(prompt).toMatch(/measure the\s+bento cake body/);
    expect(prompt).toContain('one typical visible shell, bead,\n   dollop, rosette, or swirl');
    expect(prompt).toContain('not the full perimeter or\n   the full border run');
    expect(SYSTEM_INSTRUCTION).toContain('same TOP TIER, reference body, or representative cupcake');
    expect(SYSTEM_INSTRUCTION).toContain('never the full perimeter or border run');
  });

  it('retains depth conditions when resolving rainbow and stylized portrait ambiguities', () => {
    expect(prompt).toContain('rainbow toppers only when visibly molded/domed with 3D depth');
    expect(prompt).toContain('a flat fondant rainbow arc is edible_2d_shapes');
    const portrait = section('### UNSUPPORTED SEMI-3D PORTRAIT RELIEF', '### EDIBLE 2D COMPLEX ARTWORK');
    expect(portrait).toContain('specific real person or pet');
    expect(portrait).toContain('invented/fictional character');
    expect(portrait).toContain('use `edible_2d_complex` instead');
    expect(portrait).toContain('retains the flat-backed/shallow-relief edible-artwork conditions');
  });

  it('preserves live piped-flower and flower scale grouping with compatible geometry exceptions', () => {
    expect(prompt).toContain('a clearly visible representative bloom');
    expect(prompt).toContain('assign each bloom to exactly one output row');
    expect(prompt).toContain('Piped-band non-structural override');
    expect(prompt).toContain('`coverage` band for `piped_flowers_top` and `piped_flowers_side`');
    expect(prompt).not.toContain('size label, a coverage band');
    expect(prompt).not.toContain('piped buttercream rosettes -> `icing_decorations`');
  });

  it('stages exactly the fallback from verified v3.82 without activating or writing prices/cache', () => {
    const migration = readFileSync('supabase/migrations/20260912170000_stage_prompt_v383_ordered_contract.sql', 'utf8');
    const embedded = migration.match(/target_prompt constant text := \$v383_prompt\$([\s\S]*?)\$v383_prompt\$;/)![1];
    expect(embedded).toBe(prompt);
    expect(migration).toContain(`v383_md5 constant text := '${createHash('md5').update(prompt).digest('hex')}'`);
    expect(migration).toContain("v382_md5 constant text := 'b7ef36a5e817946699cf875f3e2e96f4'");
    expect(migration).toContain("active_prompt_version <> '3.82'");
    expect(migration).toContain("values ('3.83', target_prompt, false,");
    const sqlWithoutPrompt = migration.replace(embedded, '');
    expect(sqlWithoutPrompt).not.toMatch(/set is_active\s*=\s*true/i);
    expect(sqlWithoutPrompt).not.toMatch(/(?:insert into|update|delete from)\s+(?:public\.)?(?:pricing_rules|cakegenie_analysis_cache)/i);
  });
});
