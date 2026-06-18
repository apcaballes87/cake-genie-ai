import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { getAnalysisPromptWithFallback, loadFallbackAnalysisPrompt } from './promptLoader';

const rootDir = process.cwd();

function readPrompt(path: string) {
  return readFileSync(join(rootDir, path), 'utf8');
}

describe('cake analysis prompt rules', () => {
  it('keeps the whole-head cake exception in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('WHOLE HEAD CAKES / ANIMAL FACE CAKES');
    expect(prompt).toContain('Piped, flat, or painted icing eyes, nose, smile, fur, whiskers, eyebrows, or facial outlines should be `icing_decorations`');
    expect(prompt).toContain('Fondant/gumpaste tongue, ears, bow, nose, or eyes should be `edible_3d_ordinary`');
  });

  it('keeps the Bento visible-container rule in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('Bento vs 1 Tier — Visible Container Rule');
    expect(prompt).toContain('A flat white square/round cake board, baseboard, cardboard cake pad, plate, tray, or flat surface is NOT a bento box.');
    expect(prompt).toContain('Do not use cake size alone to choose "Bento". Use the visible container:');
  });

  it('keeps the cake height ratio guide in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('cakeThickness Ratio Guide (Required for cake height)');
    expect(prompt).toContain('Do not infer or output the cake diameter or serving size from the image.');
    expect(prompt).toContain('| About 2.00:1 | 6 in diameter x 3 in tall | `"3 in"` |');
    expect(prompt).toContain('| About 1.50:1 | 6 in diameter x 4 in tall | `"4 in"` |');
    expect(prompt).toContain('| About 1.20:1 | 6 in diameter x 5 in tall | `"5 in"` |');
    expect(prompt).toContain('| About 1.00:1 | 6 in diameter x 6 in tall | `"6 in"` |');
    expect(prompt).toContain('Keep cupcakes on their explicit cupcake rule of `"2 in"`.');
  });

  it('keeps non-design branding exclusions in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('IGNORE NON-DESIGN BRANDING / WATERMARKS / PACKAGING TEXT');
    expect(prompt).toContain('Do NOT include bakery logos, shop marks, watermarks, stamps, printed labels, social media handles, or brand text');
    expect(prompt).toContain('If a logo/text appears near the cake but not on the cake itself, do not output it as `printout`, `cake_messages`, `support_elements`, or `main_toppers`');
  });

  it('keeps fabric bow and ribbon deduplication in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('FABRIC BOW / RIBBON DEDUPLICATION');
    expect(prompt).toContain('Do NOT also create a separate `edible_3d_ordinary` fondant bow for the same bow.');
    expect(prompt).toContain('Do NOT create `satin_ribbon_wrap` unless there is an actual ribbon band wrapping around the cake side.');
  });

  it('keeps candle classification in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('CANDLES ARE ALWAYS CANDLE TYPE');
    expect(prompt).toContain('classify it as `candle` with material `wax`');
    expect(prompt).toContain('Do NOT classify candles as `edible_3d_ordinary`, `edible_3d_complex`, `toy`, `gumpaste`, or fondant.');
  });

  it('keeps edible photo top versus edible photo print rules in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('EDIBLE PHOTO TOP VS EDIBLE PHOTO PRINT');
    expect(prompt).toContain('Use `edible_photo_top` when an edible image/photo/printed graphic covers the top surface of the cake');
    expect(prompt).toContain('Use `edible_photo_print` only for smaller edible printed cutouts or printed pieces placed on the side of the cake');
  });

  it('loads the fallback prompt used when Supabase prompt fetch fails', () => {
    const prompt = loadFallbackAnalysisPrompt();

    expect(prompt).toContain('GENIE.PH MASTER CAKE ANALYSIS PROMPT');
    expect(prompt).toContain('Bento vs 1 Tier — Visible Container Rule');
  });

  it('returns the fallback prompt when the active Supabase prompt cannot be fetched', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: () => ({
              single: async () => ({ data: null, error: new Error('database unavailable') }),
            }),
          }),
        }),
      }),
    };

    const prompt = await getAnalysisPromptWithFallback(supabase);

    expect(prompt).toContain('GENIE.PH MASTER CAKE ANALYSIS PROMPT');
    expect(prompt).toContain('Bento vs 1 Tier — Visible Container Rule');
  });

  it('does not keep a stale root prompt snapshot beside the fallback prompt', () => {
    expect(existsSync(join(rootDir, 'prompt_v3.8.txt'))).toBe(false);
  });
});
