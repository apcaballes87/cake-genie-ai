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

  it('keeps the Bento cake-board priority rule in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('Bento vs 1 Tier — Cake Board Priority Rule');
    expect(prompt).toContain('Do NOT classify a cake as `Bento` just because it is inside a box.');
    expect(prompt).toContain('cake board inside box -> NOT Bento.');
    expect(prompt).not.toContain('raised clamshell/container walls around cake -> "Bento"');
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
    expect(prompt).toContain('thin_fabric_ribbon_bows (FREE THIN FABRIC ACCENTS)');
    expect(prompt).toContain('Do NOT use `satin_ribbon` for thin decorative side bows, small bow knots, dangling ribbon strands, or small ribbon streamers placed around the side of the cake.');
    expect(prompt).toContain('If a visible bow is made from thin fabric, satin, organza, or sheer ribbon, classify it as one `thin_fabric_ribbon_bows` item');
    expect(prompt).toContain('Do NOT also create a separate `edible_3d_ordinary` fondant bow for the same bow.');
    expect(prompt).toContain('Do NOT create `satin_ribbon_wrap` unless there is an actual ribbon band wrapping around the cake side.');
    expect(prompt).toContain('| `thin_fabric_ribbon_bows` | non-edible | Small/thin satin, organza, or sheer fabric bow accents, dangling ribbon tails, and narrow streamers.');
  });

  it('classifies fresh-looking flowers as edible flowers in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('Genie.ph does not put fresh flowers on cakes because they are not safe or hygienic for our food workflow.');
    expect(prompt).toContain('IF a flower appears fresh, natural, realistic, or edible, classify it as "edible_flowers".');
    expect(prompt).toContain('Do not output `fresh_flowers`.');
    expect(prompt).not.toContain('IT IS "fresh_flowers"');
    expect(prompt).not.toContain('| `fresh_flowers` |');
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

  it('keeps edible 2D logo craft classification in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('EDIBLE 2D LOGO CRAFT TOPPERS');
    expect(prompt).toContain('Use `edible_logo_2d` for flat or shallow-relief edible logo/name/brand panels made from gumpaste or fondant craft');
    expect(prompt).toContain('matte fondant Yonex logo letters on a side panel -> `edible_logo_2d`');
    expect(prompt).toContain('"type": "candle|toy|cardstock|edible_photo_top|edible_logo_2d|printout');
  });

  it('keeps edible Lego brick classification in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('EDIBLE LEGO BRICKS / BUILDING BLOCKS');
    expect(prompt).toContain('Use `edible_lego_bricks` for small edible fondant/gumpaste toy-brick or building-block decorations with visible studs.');
    expect(prompt).toContain('Do NOT classify edible Lego-style bricks as generic `edible_3d_ordinary`');
    expect(prompt).toContain('| `edible_lego_bricks` | edible_fondant | Small edible Lego-style brick or building-block pieces with studs. Count per piece |');
  });

  it('keeps the accepted output skeleton and payment receipt rejection in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('"rejection": {');
    expect(prompt).toContain('"isRejected": false');
    expect(prompt).toContain('"alt_text": "..."');
    expect(prompt).toContain('"seo_title": "..."');
    expect(prompt).toContain('"seo_description": "..."');
    expect(prompt).toContain('| `payment_receipt` | "This looks like a payment receipt or screenshot. Please upload a cake design image instead." |');
  });

  it('uses canonical prompt enums and removes stale aliases from the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('"type": "gumpaste_letters|icing_script|printout|cardstock"');
    expect(prompt).toContain('"base": "soft_icing|fondant"');
    expect(prompt).toContain('"color_type": "single|gradient|multicolor"');
    expect(prompt).not.toContain('All keys lowercase');
    expect(prompt).not.toContain('output ONLY the rejection object');
    expect(prompt).not.toContain('soft-icing');
    expect(prompt).not.toContain('icing_text');
    expect(prompt).not.toContain('edible_print_text');
    expect(prompt).not.toContain('cardstock_text');
  });

  it('loads the fallback prompt used when Supabase prompt fetch fails', () => {
    const prompt = loadFallbackAnalysisPrompt();

    expect(prompt).toContain('GENIE.PH MASTER CAKE ANALYSIS PROMPT');
    expect(prompt).toContain('Bento vs 1 Tier — Cake Board Priority Rule');
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
    expect(prompt).toContain('Bento vs 1 Tier — Cake Board Priority Rule');
  });

  it('does not keep a stale root prompt snapshot beside the fallback prompt', () => {
    expect(existsSync(join(rootDir, 'prompt_v3.8.txt'))).toBe(false);
  });
});
