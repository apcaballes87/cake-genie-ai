import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { getAnalysisPromptWithFallback, loadFallbackAnalysisPrompt } from './promptLoader';
import floralPinkPeonyFixture from './fixtures/floral-pink-pink-1-tier-cake-1931.json';
import minimalistSugarPearlFixture from './fixtures/minimalist-birthday-ivory-1-tier-cake-717c.json';
import safariJungleFigureFixture from './fixtures/safari-jungle-mint-1-tier-cake-4d4a.json';
import snowWhiteFlowerFixture from './fixtures/snow-white-blue-2-tier-cake-074d.json';

const rootDir = process.cwd();

function readPrompt(path: string) {
  return readFileSync(join(rootDir, path), 'utf8');
}

describe('cake analysis prompt rules', () => {
  it('classifies every item through construction, material, type, and description consistency', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');
    const fenceCount = prompt.match(/^```/gm)?.length ?? 0;

    expect(prompt).toContain('**v3.46 Version - Flower Fulfillment Unit Boundaries**');
    expect(prompt).toContain('GLOBAL ITEM CLASSIFICATION PIPELINE — CONSTRUCTION → MATERIAL → TYPE → DESCRIPTION');
    expect(prompt).toContain('3. Visible construction of each item');
    expect(prompt).toContain('5. Type compatible with that construction and material');
    expect(prompt).toContain('8. Item description and construction/material/type reconciliation');
    expect(prompt).toContain('Apply the 2-CUE MATERIAL RULE only when material remains ambiguous and no');
    expect(prompt).toContain('Named decisive cues such as a visible wick,');
    expect(prompt).toContain('unsupported semi-3D human/pet portrait relief -> `edible_photo_top`');
    expect(prompt).toContain('every flower-shaped decoration, including fresh-looking, natural, silk,');
    expect(prompt).toContain('Only an actual piped buttercream\n  rosette with visible piping ridges and soft peaks uses');
    expect(prompt).toContain('this named flower fulfillment\n  override wins over visible fabric cues');
    expect(prompt).toContain('physical metal, rhinestone, or plastic crowns/tiaras -> `plastic_crown`');
    expect(prompt).toContain('standalone molded, rolled, cut, or hand-sculpted fondant/gumpaste crowns/tiaras ->');
    expect(prompt).toContain('#### CROWNS & TIARAS — MATERIAL-SPECIFIC TYPES');
    expect(prompt).toContain('ALWAYS classify a standalone 3D crown or tiara by its visible construction and material.');
    expect(prompt).toContain('fondant/gumpaste crowns and tiaras → `edible_crown`');
    expect(prompt).toContain('standalone edible crowns as `edible_3d_ordinary` or `edible_3d_complex`');
    expect(prompt).toContain('always use `edible_crown`, material `edible_fondant`, before the generic');
    expect(prompt).not.toContain('Metal or Plastic Crowns / Tiaras (Gold, Silver, Rhinestone)');
    expect(prompt).toContain('CROWNS & TIARAS: Metal/Plastic/Rhinestone = plastic_crown');
    expect(prompt).toContain('Classify physical 3D crowns as **plastic_crown**');
    expect(prompt).toContain('acrylic or wooden toppers -> `cardstock`');
    expect(prompt).toContain('Do not select a type from the item\'s name, motif, shape, or apparent');
    expect(prompt).toContain('A noun such as cloud, flower, star,');
    expect(prompt).toContain('never determines\n   material or type by itself');
    expect(prompt).toContain('If the description uses a\n   construction or material term supported by positive image cues');
    expect(prompt).toContain('The image evidence is authoritative.');
    expect(prompt).toContain('do not let unsupported\n   description wording override the image');
    expect(prompt).toContain('deposited, piped, drawn, spread, or palette-knife icing -> material');
    expect(prompt).toContain('molded, rolled, cut, layered, or hand-sculpted fondant/gumpaste ->');
    expect(prompt).toContain('solid non-printed glitter or metallic cardstock');
    expect(prompt).toContain('piped cloud-, heart-, or star-shaped dollops with piping ridges and soft');
    expect(prompt).toContain('separate smooth matte clay-like molded cloud, heart, or star shapes');
    expect(prompt).toContain('"description": "separate white molded cloud shapes"');
    expect(prompt).toContain('A piped cloud motif would\ninstead remain in the compatible icing family');
    expect(prompt).not.toContain('Clouds are simple shapes →');
    expect(prompt).toContain('CRITICAL CLASSIFICATION WITHIN PRINTOUT vs CARDSTOCK vs TOY');
    expect(prompt).toContain('Subject matter alone does not establish a printout');
    expect(prompt).not.toContain('This rule overrides all other considerations.');
    expect(prompt).toContain('"material": "wax|plastic|cardstock|photopaper|waferpaper|edible_fondant|icing|candy|non-edible"');
    expect(prompt).toContain('"description": "brief object-focused description"');
    expect(prompt).toContain('Visible construction words are allowed when they help identify');
    expect(fenceCount).toBeGreaterThan(0);
    expect(fenceCount % 2).toBe(0);

    expect(SYSTEM_INSTRUCTION).toContain('determine visible construction first, assign the compatible material second, choose a compatible type third, and write the description last');
    expect(SYSTEM_INSTRUCTION).toContain('If the description uses a construction or material term supported by positive image cues');
    expect(SYSTEM_INSTRUCTION).toContain('On conflict, the image is authoritative');
    expect(SYSTEM_INSTRUCTION).toContain('CRITICAL CLASSIFICATION WITHIN THE NON-EDIBLE PRINTOUT vs CARDSTOCK FAMILY');
    expect(SYSTEM_INSTRUCTION).toContain('It does not override positive evidence of icing, fondant/gumpaste, an edible printed sheet, candy, wax, or fabric');
    expect(SYSTEM_INSTRUCTION).not.toContain('This is the HIGHEST PRIORITY rule and overrides all other considerations');
    expect(SYSTEM_INSTRUCTION).toContain('If you are unsure and there are no positive construction or material cues');
    expect(SYSTEM_INSTRUCTION).toContain('STRICT GENERATED CONTRACT');
    expect(SYSTEM_INSTRUCTION).toContain('Do not generate x/y coordinates, bounding boxes, icing_surfaces, candle digits, is_tall_proportion');
    expect(SYSTEM_INSTRUCTION).toContain('Accepted results require blank reason and message');
    expect(SYSTEM_INSTRUCTION).toContain('When gumpasteBaseBoard is true, include colors.gumpasteBaseBoardColor');
    expect(SYSTEM_INSTRUCTION).toContain('Use the active analysis prompt as the only source for sizing boundaries');
    expect(SYSTEM_INSTRUCTION).toContain('Use plastic_ball only for one dominant focal plastic sphere');
    expect(SYSTEM_INSTRUCTION).toContain('Every item row must represent one primary priced object');
  });

  it('keeps primary priced objects aligned with type and material before emission', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('ONE PRIMARY PRICED OBJECT PER ROW — DESCRIPTION/TYPE CONSISTENCY (REQUIRED)');
    expect(prompt).toContain('Begin `description` with that primary object');
    expect(prompt).toContain('visible image evidence and named fulfillment normalizations\nremain authoritative');
    for (const connector of [
      '`with`',
      '`topped with`',
      '`covered in`',
      '`covered with`',
      '`decorated with`',
      '`finished with`',
      '`featuring`',
    ]) {
      expect(prompt).toContain(connector);
    }
    expect(prompt).toContain('`colorful sprinkles scattered on top` -> `sprinkles`, material `candy`');
    expect(prompt).toContain('`fondant donut with sprinkles` -> `edible_3d_ordinary`, material');
    expect(prompt).toContain('`meringue kisses with sprinkles` -> `meringue`, material `candy`');
    expect(prompt).toContain('`piped icing dollops topped with sprinkles` -> `icing_decorations`, material');
    expect(prompt).toContain('If the secondary garnish is independently priced or countable, emit it as its');
    expect(prompt).not.toContain('| `icing sprinkles` |');
    expect(prompt).toContain('| `icing_decorations` | icing | Piped icing elements such as dots, rosettes, swirls, and borders.');
  });

  it('requires positive flat-paper evidence and prevents volumetric figurines from becoming printouts', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('PHYSICAL DEPTH GATE — HIGHEST PRECEDENCE BEFORE PRINTOUT');
    expect(prompt).toContain('`printout` with material `photopaper` is allowed only when positive image');
    expect(prompt).toContain('Character identity,\n   franchise familiarity, multicolor artwork, CGI styling');
    expect(prompt).toContain('Physical depth prohibits printout.');
    expect(prompt).toContain('projecting muzzle, ears, arms, legs, feet, tail, or torso');
    expect(prompt).toContain('In that case, `printout` and\n   material `photopaper` are prohibited.');
    expect(prompt).toContain('alternative compatible cues under the 2-CUE MATERIAL RULE');
    expect(prompt).toContain('do not require a visible seam or gloss when distance,');
    expect(prompt).toContain('never fall back to\n   `printout`');
    expect(prompt).toContain('Never invent `printed`, `paper`,\n   `cutout`, or `on a stick`');
    expect(prompt).toContain('The same character as a freestanding\n   volumetric figurine follows the physical 3D rule.');
    expect(prompt).toContain('IF an already-established separate flat paper piece shows CHARACTER IMAGES');
    expect(prompt).toContain('These material cues are alternatives, not an ALL-required checklist.');
    expect(prompt).toContain('a seam or glossy finish is not mandatory');
    expect(prompt).toContain('lack of a visible seam alone does not establish edible construction.');
    expect(prompt).toContain('WITHIN AN ESTABLISHED FLAT PRINTED FAMILY');
    expect(prompt).not.toContain('- IF item shows CHARACTER IMAGES, GRAPHICS, MULTI-COLOR designs');
    expect(prompt).not.toContain('**ONLY classify as toy if ALL of these are true:**');
    expect(prompt).not.toContain('Paw Patrol pups, Bluey, Baby Shark on sticks');
    expect(prompt).not.toContain('PRINTOUT (type: "printout", material: "photopaper") — MOST COMMON');

    expect(SYSTEM_INSTRUCTION).toContain('Physical Depth Gate Before Printout');
    expect(SYSTEM_INSTRUCTION).toContain('only after positive image evidence establishes a separate flat printed piece');
    expect(SYSTEM_INSTRUCTION).toContain('Independently modeled body surfaces, projecting anatomy');
    expect(SYSTEM_INSTRUCTION).toContain('never fall back to printout merely because a seam or glossy finish is not visible');
    expect(SYSTEM_INSTRUCTION).toContain('Never invent "printed", "paper", "cutout", or "on a stick"');
    expect(SYSTEM_INSTRUCTION).toContain('Examples of PRINTOUTS after flat paper is visually established');
    expect(SYSTEM_INSTRUCTION).not.toContain('Examples of PRINTOUTS (very common)');
  });

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
    expect(prompt).toContain('`satin_ribbon` is the only canonical type');
    expect(prompt).not.toContain('satin_ribbon_wrap');
    expect(prompt).toContain('| `thin_fabric_ribbon_bows` | non-edible | Small/thin satin, organza, or sheer fabric bow accents, dangling ribbon tails, and narrow streamers.');
  });

  it('classifies every flower style as edible flowers in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('Protocol 4: THE "FLOWER" CHECK (Required Edible Flower Fulfillment Rule)');
    expect(prompt).toContain('Genie.ph fulfills every visible flower as edible because non-edible flowers');
    expect(prompt).toContain('IF a flower appears fresh, natural, realistic, silk, cloth, fabric-textured,');
    expect(prompt).toContain('artificial, or edible, classify it as `edible_flowers` with material');
    expect(prompt).toContain('visible fabric texture, or\n  fraying threads.');
    expect(prompt).toContain('FLOWER TYPE PRECEDENCE');
    expect(prompt).toContain('Do NOT classify fondant/gumpaste flowers as `edible_3d_ordinary`');
    expect(prompt).toContain('small gold fondant flowers on a mahjong cake -> `edible_flowers`');
    expect(prompt).toContain('### C3. FLOWERS — edible_flowers');
    expect(prompt).not.toContain('fresh_flowers');
    expect(prompt).not.toContain('artificial_flowers');
    expect(prompt).not.toContain('Basic roses without fine detail');
  });

  it('splits full intricate icing doodles into flat top and side regions', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('INTRICATE ICING DOODLE PLACEMENT AND PRICING PRECEDENCE');
    expect(prompt).toContain('Use `icing_doodle_intricate_top` when an intricate drawing is the dominant artwork on the cake top.');
    expect(prompt).toContain('Use `icing_doodle_intricate_side` when coordinated intricate drawings cover a substantial portion of the cake sides');
    expect(prompt).toContain('one `icing_doodle_intricate_top` item and one `icing_doodle_intricate_side` item');
    expect(prompt).toContain('Always use `quantity: 1` for each qualifying top or side region.');
    expect(prompt).toContain('Recognizable portraits, objects, scenes, or coordinated line-art compositions take precedence over `icing_decorations`.');
    expect(prompt).toContain('large portrait of a person using an inhaler on the cake top -> `icing_doodle_intricate_top`');
    expect(prompt).toContain('many coordinated hobby icons covering the cake sides -> `icing_doodle_intricate_side`');
    expect(prompt).not.toContain('If the doodle is intricate, keep `type: "icing_doodle"`');
  });

  it('classifies isolated edible mermaid tails as ordinary and groups them by size', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('MERMAID TAIL CLASSIFICATION AND PRICING PRECEDENCE');
    expect(prompt).toContain('complete character body must be');
    expect(prompt).toContain('classified as `edible_3d_ordinary`');
    expect(prompt).toContain('overrides the generic `edible_3d_complex` cues for irregular shape');
    expect(prompt).toContain('multiple colors, metallic accents, scales, ridges, fins');
    expect(prompt).toContain('Use `edible_3d_complex` only for a complete freestanding sculpted mermaid');
    expect(prompt).toContain('Printed, paper, acrylic, plastic, or toy mermaid tails must still follow the');
    expect(prompt).toContain('Count every physical mermaid tail.');
    expect(prompt).toContain('Never combine visibly');
    expect(prompt).toContain('Create separate groups for each visible size band');
    expect(prompt).toContain('An isolated');
    expect(prompt).toContain('decorative motif such as a standalone mermaid tail is allowed under its');
    expect(prompt).not.toContain('- NO distinct body parts');
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

  it('normalizes unsupported semi-3D portrait reliefs to an edible photo on top', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('UNSUPPORTED SEMI-3D PORTRAIT RELIEF TO EDIBLE PHOTO TOP');
    expect(prompt).toContain('This is a business fulfillment normalization that overrides the literal material and depth rules below.');
    expect(prompt).toContain('a recognizable human or pet likeness');
    expect(prompt).toContain('a flat-backed, low-relief, bas-relief, embossed, or semi-3D portrait attached to or lying across the cake top');
    expect(prompt).toContain('modeled nose, cheeks, lips, eyelids, ears, hair strands or curls, facial likeness, neck, shoulders, or clothing');
    expect(prompt).toContain('classify the whole portrait as one `edible_photo_top` item');
    expect(prompt).toContain('Use `material: "waferpaper"`, `classification: "hero"`, `size: "large"`, and `quantity: 1`.');
    expect(prompt).toContain('Do NOT output the portrait as `edible_3d_complex`, `edible_3d_ordinary`, `edible_2d_complex`, `edible_2d_shapes`, `edible_2d_support`, or `edible_logo_2d`.');
    expect(prompt).toContain('Do not itemize the portrait hair, eyes, nose, mouth, ears, face, neck, or clothing as separate decorations.');
    expect(prompt).toContain('A true freestanding, fully sculpted figurine with visible all-around body depth may remain `edible_3d_complex`.');
    expect(prompt).toContain('Describe the fulfillable result as an edible photo portrait on top, not as a sculpted fondant portrait.');
  });

  it('classifies detailed flat-backed edible artwork as edible 2D complex without stealing adjacent types', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('EDIBLE 2D COMPLEX ARTWORK — FLAT-BACKED OR SHALLOW RELIEF');
    expect(prompt).toContain('Use `edible_2d_complex` for detailed handmade edible artwork made from fondant');
    expect(prompt).toContain('Do not place\n`edible_2d_complex` in `support_elements`.');
    expect(prompt).toContain('A recognizable human or pet likeness in unsupported detailed relief remains');
    expect(prompt).toContain('A logo, wordmark, brand name, or decorative brand lettering remains\n   `edible_logo_2d`.');
    expect(prompt).toContain('Plain stars, dots, hearts, leaves, geometric pieces, and other simple flat');
    expect(prompt).toContain('Only a genuinely freestanding hand-sculpted figure or object with visible');
    expect(prompt).toContain('Treat one coordinated character plaque as one item with `quantity: 1`.');
    expect(prompt).toContain('layered fondant Roblox character face with hair and headphones lying flat on');
    expect(prompt).toContain('`classification: "hero"`, `size: "large"`, `quantity: 1`');
    expect(prompt).toContain('separate red fondant ROBLOX wordmark on the cake side -> one');
    expect(prompt).toContain('`edible_logo_2d`, not `edible_2d_complex`, not `edible_lego_bricks`');
    expect(prompt).toContain('Size `edible_2d_complex` by surface span, not by the 3D figure height table.');
    expect(prompt).toContain('| `tiny` | under 10% |');
    expect(prompt).toContain('| `xsmall` | 10% to under 20% |');
    expect(prompt).toContain('| `small` | 20% to under 35% |');
    expect(prompt).toContain('| `medium` | 35% to under 50% |');
    expect(prompt).toContain('| `large` | 50% to under 75% |');
    expect(prompt).toContain('| `xlarge` | 75% or greater |');
    expect(prompt).toContain('"type": "candle|toy|plastic_crown|edible_crown|cardstock|edible_photo_top|edible_logo_2d|edible_2d_complex|printout');

    expect(SYSTEM_INSTRUCTION).toContain('flat-backed, attached flush to a cake surface, or built only from shallow layered pieces MUST be classified as "edible_2d_complex"');
    expect(SYSTEM_INSTRUCTION).toContain('Use "edible_3d_complex" only for a genuinely freestanding hand-sculpted figure or object with visible all-around body depth.');
    expect(SYSTEM_INSTRUCTION).toContain('Do not classify handmade layered fondant/gumpaste character artwork as a printout merely because it depicts a character');
  });

  it('separates non-identical subjects in composite 3D hero assemblies', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('**v3.46 Version - Flower Fulfillment Unit Boundaries**');
    expect(prompt).toContain('COMPOSITE HERO ASSEMBLY COUNTING PRECEDENCE');
    expect(prompt).toContain('Count each independently sculpted major subject before grouping.');
    expect(prompt).toContain('A separately sculpted major vehicle or mount—such as a scooter, motorcycle,');
    expect(prompt).toContain('Output non-identical major subjects as separate `main_toppers` rows.');
    expect(prompt).toContain('row `quantity: 1`, its own descriptive `group_id`');
    expect(prompt).toContain('Only truly identical repeated pieces with the same type, material, size,');
    expect(prompt).toContain('Size each separate major subject independently with the correct sizing table.');
    expect(prompt).toContain('wheels, mirrors, handlebars, seats, or a delivery box');
    expect(prompt).toContain('two people plus one scooter = 3 separate `main_toppers` rows');
    expect(prompt).toContain('three people inside or on one sculpted car plus the car = 4 separate');
    expect(prompt).toContain('MULTIPLE IDENTICAL FIGURE COUNTING');
    expect(prompt).toContain('Composite hero assemblies: count major subjects before grouping; separate and independently size non-identical subjects');
    expect(prompt).toContain('SPLIT COMPOSITE HERO ASSEMBLIES');
    expect(prompt).toContain('For any rider, mount, or vehicle composition, apply COMPOSITE HERO ASSEMBLY');
    expect(prompt).not.toContain('count it as 2 quantity toppers or 2 separate toppers');
  });

  it('uses toy-specific sizing for miniature molded toys', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('**v3.46 Version - Flower Fulfillment Unit Boundaries**');
    expect(prompt).toContain('TOY-SPECIFIC SIZING PRECEDENCE (OVERRIDES C1 FOR `toy` AND `plastic_crown`)');
    expect(prompt).toContain('overrides the generic C1\n3D-figure bands and the Ratio Quick Glance table');
    expect(prompt).toContain('| `tiny` | under 0.10 |');
    expect(prompt).toContain('| `xsmall` | 0.10 to under 0.50 |');
    expect(prompt).toContain('| `small` | 0.50 to under 0.80 |');
    expect(prompt).toContain('| `medium` | 0.80 to under 1.10 |');
    expect(prompt).toContain('| `large` | 1.10 to under 1.40 |');
    expect(prompt).toContain('| `xlarge` | 1.40 or greater |');
    expect(prompt).toContain('Miniature molded army men, miniature soldiers, and similarly scaled mini action');
    expect(prompt).toContain('figures that are each at least 0.10 and less than 0.50 of the reference-tier');
    expect(prompt).toContain('Toys below 0.10 remain `tiny`.');
    expect(prompt).toContain('For toys, compensate for perspective by estimating the toy\'s true visible');
    expect(prompt).toContain('This replaces the global perspective `+1`\nrule for toys.');
    expect(prompt).toContain('Do not apply any additional category bump after using the\ntoy-specific table.');
    expect(prompt).toContain('Count every physical toy.');
    expect(prompt).toContain('Size each toy independently.');
    expect(prompt).toContain('Never measure the footprint, height, or visual\nimpact of the whole toy scene or cluster.');
    expect(prompt).toContain('material, size, color, pose, and appearance may share one `group_id`');
    expect(prompt).toContain('### C1. EDIBLE 3D FIGURES — edible_3d_complex, edible_3d_ordinary, edible_crown');
    expect(prompt).not.toContain('### C1. 3D FIGURES — edible_3d_complex, edible_3d_ordinary, toy');
    expect(prompt).toContain('→ Toy or `plastic_crown`? Measure HEIGHT and use TOY-SPECIFIC SIZING PRECEDENCE');
    expect(prompt).toContain('→ Edible 3D figure or `edible_crown`? Measure HEIGHT and use C1');
    expect(prompt).toContain('For `toy` or `plastic_crown`, use TOY-SPECIFIC SIZING PRECEDENCE; otherwise look up the correct per-type table (C1-C7)');
  });

  it('uses one canonical six-band sizing contract and matching quick reference', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');
    const canonicalSixBands = [
      '| `tiny` | **< 0.10**',
      '| `xsmall` | **0.10 to < 0.30**',
      '| `small` | **0.30 to < 0.50**',
      '| `medium` | **0.50 to < 0.90**',
      '| `large` | **0.90 to < 1.20**',
      '| `xlarge` | **≥ 1.20**',
    ];

    expect(prompt).toContain('CANONICAL ITEM FAMILY MATRIX — AUTHORITATIVE');
    for (const band of canonicalSixBands) {
      expect(prompt).toContain(band);
    }
    expect(prompt).toContain('Ratio Quick Glance (exact mirror of the authoritative tables)');
    expect(prompt).toContain('The general C1-C5 families share one six-band ratio scale');
    expect(prompt).toContain('Flat toppers use the same canonical six ratio bands as C1');
    expect(prompt).toContain('### C4. SPHERES & BALLS — plastic_ball, plastic_ball_regular, edible round elements');
    expect(prompt).toContain('A **small gap**? → `tiny`, `xsmall`, or `small`.');
    expect(prompt).toContain('| C1 edible 3D | <0.10 | 0.10 to <0.30 | 0.30 to <0.50 | 0.50 to <0.90 | 0.90 to <1.20 | ≥1.20 |');
    expect(prompt).toContain('| C5 edible 2D support | <0.10 | 0.10 to <0.30 | 0.30 to <0.50 | 0.50 to <0.90 | 0.90 to <1.20 | ≥1.20 |');
    expect(prompt).toContain('`edible_2d_support` remains in `support_elements` at every size.');
    expect(prompt).toContain('set `quantity` to the\nactual piece count, and price per piece');
    expect(prompt).toContain('| `medium` | **40% to < 80%** |');
    expect(prompt).toContain('| `large` | **≥ 80%** |');
    expect(prompt).toContain('panels use `<40%`, `40% to <80%`, and `≥80%` side coverage');
    expect(prompt).not.toContain('reclassify as main topper');
    expect(prompt).not.toMatch(/Panels:\s+<35%/);
    expect(prompt).not.toContain('35–60%');
  });

  it('classifies exact sizing boundaries with the v3.36 half-open intervals', () => {
    const classifyByUpperBounds = (
      value: number,
      sizes: string[],
      exclusiveUpperBounds: number[],
    ) => sizes[exclusiveUpperBounds.findIndex((upper) => value < upper)] ?? sizes.at(-1);

    const classifyCanonical = (ratio: number) => classifyByUpperBounds(
      ratio,
      ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'],
      [0.10, 0.30, 0.50, 0.90, 1.20],
    );
    const classifyEdible2dComplex = (coverage: number) => classifyByUpperBounds(
      coverage,
      ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'],
      [0.10, 0.20, 0.35, 0.50, 0.75],
    );
    const classifyToy = (ratio: number) => classifyByUpperBounds(
      ratio,
      ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'],
      [0.10, 0.50, 0.80, 1.10, 1.40],
    );
    const classifyCandle = (ratio: number) => classifyByUpperBounds(
      ratio,
      ['tiny', 'small', 'medium', 'large'],
      [0.15, 0.35, 0.60],
    );
    const classifyPanel = (coverage: number) => classifyByUpperBounds(
      coverage,
      ['small', 'medium', 'large'],
      [0.40, 0.80],
    );

    expect([
      classifyCanonical(0.0999),
      classifyCanonical(0.10),
      classifyCanonical(0.30),
      classifyCanonical(0.40),
      classifyCanonical(0.50),
      classifyCanonical(0.90),
      classifyCanonical(1.20),
    ]).toEqual(['tiny', 'xsmall', 'small', 'small', 'medium', 'large', 'xlarge']);
    expect([
      classifyEdible2dComplex(0.0999),
      classifyEdible2dComplex(0.10),
      classifyEdible2dComplex(0.20),
      classifyEdible2dComplex(0.35),
      classifyEdible2dComplex(0.50),
      classifyEdible2dComplex(0.75),
    ]).toEqual(['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge']);
    expect([
      classifyToy(0.05),
      classifyToy(0.40),
      classifyToy(0.50),
      classifyToy(0.80),
      classifyToy(1.10),
      classifyToy(1.40),
      classifyToy(1.50),
    ]).toEqual(['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge', 'xlarge']);
    expect([
      classifyCandle(0.1499),
      classifyCandle(0.15),
      classifyCandle(0.35),
      classifyCandle(0.60),
    ]).toEqual(['tiny', 'small', 'medium', 'large']);
    expect([
      classifyPanel(0.3999),
      classifyPanel(0.40),
      classifyPanel(0.70),
      classifyPanel(0.80),
    ]).toEqual(['small', 'medium', 'medium', 'large']);
  });

  it('keeps complex and ordinary 3D face rules consistent', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('visible all-around body depth AND');
    expect(prompt).toContain('recognizable character or\nanatomical complexity beyond a simple molded/stamped decorative face');
    expect(prompt).toContain('Facial features, multiple colors, metallic accents, or an irregular outline\nalone are not enough for `edible_3d_complex`.');
    expect(prompt).toContain('A simple molded smiley, sun,\nmoon, icon, medallion, or other non-likeness decorative face remains\n`edible_3d_ordinary`.');
    expect(prompt).toContain('Any face is a simple molded, stamped, or non-likeness decorative face rather');
    expect(prompt.match(/#### MOLDED CELESTIAL \/ SYMBOL TOPPERS/g)).toHaveLength(1);
    expect(prompt).not.toContain('- NO facial features');
    expect(prompt).not.toContain('has **ANY** of these');
  });

  it('scopes printed gloss, named normalizations, plastic balls, and connected signs', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('Apply this check only after the item is established as a separate flat,');
    expect(prompt).toContain('Gloss alone never overrides positive\nevidence of icing, an edible printed sheet, waferpaper, fondant/gumpaste,');
    expect(prompt).toContain('Named normalization exception');
    expect(prompt).toContain('Acrylic toppers and wooden toppers are\nalways structured as `type: "cardstock"` and `material: "cardstock"`');
    expect(prompt).toContain('Use `plastic_ball` for one\n  dominant focal sphere or physical 3D balloon in `main_toppers`.');
    expect(prompt).toContain('Use\n  `plastic_ball_regular` for repeated, background, or supporting plastic');
    expect(prompt).toContain('If the letters are physically connected to one sign, plaque, banner, printed');
    expect(prompt).toContain('keep the whole carrier as\none physical topper/support row with `quantity: 1`');
    expect(prompt).toContain('individual loose gumpaste, fondant, cardstock, acrylic, or printed letters');
  });

  it('uses one-row quantity grouping and a generated-only contract', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('output\none `edible_flowers` row with `quantity: 5`');
    expect(prompt).toContain('Do not emit five duplicate rows.');
    expect(prompt).toContain('Different sizes, colors, poses, or appearances require separate rows.');
    expect(prompt).toContain('`subtype` is optional.');
    expect(prompt).not.toMatch(/"x"\s*:/);
    expect(prompt).not.toMatch(/"y"\s*:/);
    expect(prompt).not.toContain('"digits"');
    expect(prompt).not.toContain('## ICING SURFACES');
  });

  it('defines accepted set exceptions, rejection invariants, and complete icing output', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('A tray, box, or close-up of\nindividual cupcakes with no larger cake is one accepted `Cupcake` design');
    expect(prompt).toContain('Exactly one bento cake plus five cupcakes in holders inside\nthe same box is one accepted `Bento Cupcake Set`');
    expect(prompt).toContain('`complex_sculpture` boundary');
    expect(prompt).toContain('extreme gravity-defying cake\nsculpture');
    expect(prompt).toContain('For an accepted image use `isRejected: false`\n  with blank `reason` and `message`');
    expect(prompt).toContain('`icing_design` is always complete');
    expect(prompt).toContain('"drip": false');
    expect(prompt).toContain('"border_top": false');
    expect(prompt).toContain('"border_base": false');
    expect(prompt).toContain('"gumpasteBaseBoard": false');
  });

  it('constrains cake type, icing base, thickness, and SEO title examples', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');
    const seoTitles = [
      'Unicorn 2-Tier Birthday Cake Delivery Cebu | Genie.ph',
      '70th Birthday Fondant Cake For Dad Cebu | Genie.ph',
      'Chocolate Drip Birthday Cake Design Cebu | Genie.ph',
      "Father's Day Trophy Celebration Cake Cebu | Genie.ph",
    ];

    expect(prompt).toContain('cakeType, Icing Base, and cakeThickness Contract');
    expect(prompt).toContain('A `Fondant` cakeType\nrequires `icing_design.base: "fondant"`.');
    expect(prompt).toContain('| `1 Tier` | `"3 in"`, `"4 in"`, `"5 in"`, `"6 in"` |');
    expect(prompt).toContain('| `2 Tier`, `3 Tier` | `"4 in"`, `"5 in"` |');
    expect(prompt).toContain('| `Square`, `Rectangle` | `"3 in"`, `"4 in"` |');
    expect(prompt).toContain('| `1 Tier Fondant`, `2 Tier Fondant`, `3 Tier Fondant` | `"5 in"`, `"6 in"` |');
    expect(prompt).toContain('| `Bento`, `Cupcake`, `Bento Cupcake Set` | `"2 in"` |');

    for (const title of seoTitles) {
      expect(prompt).toContain(`- \`${title}\``);
      expect(title.length).toBeGreaterThanOrEqual(50);
      expect(title.length).toBeLessThanOrEqual(65);
    }
  });

  it('keeps qualifying small Safari animal figures as complex main toppers', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');
    const expectedFigures = safariJungleFigureFixture.expected_main_toppers;

    expect(safariJungleFigureFixture.slug).toBe('safari-jungle-mint-1-tier-cake-4d4a');
    expect(expectedFigures.map((figure) => figure.group_id)).toEqual([
      'giraffe_head',
      'elephant_figure',
      'zebra_figure',
    ]);
    expect(expectedFigures.every((figure) => (
      figure.type === 'edible_3d_complex'
      && figure.classification === 'hero'
      && figure.size === 'small'
    ))).toBe(true);
    expect(safariJungleFigureFixture.expected_support_group_ids).toEqual(['tropical_leaves']);
    expect(safariJungleFigureFixture.forbidden_support_group_ids).toEqual(
      expectedFigures.map((figure) => figure.group_id),
    );

    expect(prompt).toContain('FREESTANDING FIGURE PLACEMENT OVERRIDE (REQUIRED)');
    expect(prompt).toContain('`edible_3d_complex` is a\nmain-topper-only generated type.');
    expect(prompt).toContain('small, placed at the front, side, or base\nof the cake, partly behind another decoration, or visually secondary.');
    expect(prompt).toContain('a small fondant elephant, zebra, or giraffe-head figurine');
    expect(prompt).toContain('one `edible_3d_complex` hero in `main_toppers`');
    expect(prompt).toContain('Use `edible_3d_ordinary` in `support_elements` for figure-like decorations\nonly when they are simple molded non-character forms');
  });

  it('keeps the Snow White rose cluster as paid edible flowers', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(snowWhiteFlowerFixture.slug).toBe('snow-white-blue-2-tier-cake-074d');
    expect(snowWhiteFlowerFixture.expected_support_element).toMatchObject({
      group_id: 'red_flower_cluster',
      type: 'edible_flowers',
      material: 'edible_fondant',
      size: 'small',
      quantity: 3,
    });
    expect(prompt).toContain('Every visible flower, including fresh-looking, natural-looking, silk, cloth,');
    expect(prompt).toContain('is fulfilled and priced as edible flowers.');
    expect(prompt).not.toContain('artificial_flowers');
  });

  it('counts mixed-size top peonies as individual main-topper flower pieces', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');
    const expectedFlowers = floralPinkPeonyFixture.expected_main_toppers;

    expect(floralPinkPeonyFixture.slug).toBe('floral-pink-pink-1-tier-cake-1931');
    expect(expectedFlowers).toEqual([
      {
        group_id: 'large_pink_peony_flowers',
        type: 'edible_flowers',
        material: 'edible_fondant',
        classification: 'hero',
        size: 'large',
        quantity: 3,
        description: 'three large pink peony flowers on top',
      },
      {
        group_id: 'medium_pink_peony_flower',
        type: 'edible_flowers',
        material: 'edible_fondant',
        classification: 'hero',
        size: 'medium',
        quantity: 1,
        description: 'one medium pink peony flower on top',
      },
    ]);
    expect(floralPinkPeonyFixture.forbidden_grouping).toEqual({
      description: 'large pink peony flower cluster on top',
      quantity: 1,
      subtype: 'flower_cluster',
    });
    expect(prompt).toContain('FLOWER PIECE COUNTING AND SIZE PRECEDENCE (BOTH MAIN AND SUPPORT — REQUIRED)');
    expect(prompt).toContain('A bouquet, cluster, spray, or arrangement describes placement only.');
    expect(prompt).toContain('Count each clearly\nvisible bloom or flower head as one physical flower piece');
    expect(prompt).toContain('Different sizes or\nappearances require separate rows.');
    expect(prompt).toContain('do not use `subtype: "flower_cluster"` as a substitute');
    expect(prompt).toContain('VISIBLE FLOWER UNIT BOUNDARY AND BAKERY FULFILLMENT IDENTITY');
    expect(prompt).toContain('applies only\nwhen the PEONY-STYLE TOP SET OVERRIDE signature below is satisfied');
    expect(prompt).toContain('touching flowers\nwith independently bounded outer petals remain separate pieces');
    expect(prompt).toContain('genuinely\nmixed flower identities remain separate product rows');
    expect(prompt).toContain('one continuous outer petal boundary');
    expect(prompt).toContain('Use bakery fulfillment identity rather than strict botanical taxonomy.');
    expect(prompt).toContain('normalize\nall of those top flowers to the dominant peony fulfillment identity');
    expect(prompt).toContain('PEONY-STYLE TOP SET OVERRIDE (HIGHEST FLOWER-COUNTING PRIORITY)');
    expect(prompt).toContain('treat it as one standardized peony-style top set');
    expect(prompt).toContain('output exactly these two `main_toppers` flower rows');
    expect(prompt).toContain('quantity `3`, described\n  as three large pink peony flowers on top');
    expect(prompt).toContain('quantity `1`, described\n  as one medium pink peony flower on top');
    expect(prompt).toContain('These two rows exhaust the entire\ntop arrangement.');
    expect(prompt).toContain('in another\nrow in either array.');
    expect(prompt).toContain('below the top rim on the cake side');
    expect(prompt).toContain('description must not say top or top\nedge');
    expect(prompt).toContain('three large pink peonies and one medium pink peony');
    expect(prompt).toContain('Tiny/xsmall scattered or repeated sugar pearls, sugar beads,');
  });

  it('makes tiny scattered sugar pearls and beads grouped candy sprinkles', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(minimalistSugarPearlFixture.slug).toBe('minimalist-birthday-ivory-1-tier-cake-717c');
    expect(minimalistSugarPearlFixture.expected_support_element).toMatchObject({
      group_id: 'tiny_white_sugar_pearls',
      type: 'sprinkles',
      material: 'candy',
      size: 'tiny',
      quantity: 1,
    });
    expect(minimalistSugarPearlFixture.forbidden_types).toEqual([
      'edible_3d_ordinary',
      'plastic_ball_regular',
      'premium_sprinkles',
    ]);
    expect(prompt).toContain('TINY SUGAR PEARLS / BEADS / NONPAREILS — `sprinkles` PRECEDENCE (REQUIRED)');
    expect(prompt).toContain('Before applying the generic SPHERE CHECK');
    expect(prompt).toContain('`type: "sprinkles"`, `material: "candy"`, and `quantity: 1`');
    expect(prompt).toContain('This is a fulfillment classification override');
    expect(prompt).toContain('Do NOT emit these tiny scattered/repeated pearls or beads as');
    expect(prompt).toContain('every tiny/xsmall scattered or repeated sugar pearl');
  });

  it('makes every number-shaped cake a Rectangle before tier and footprint defaults', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('### NUMBER-SHAPED CAKE PRECEDENCE — ALWAYS `Rectangle`');
    expect(prompt).toContain('numeral (`0`-`9`) or a multi-digit number, `cakeType` MUST be `Rectangle`');
    expect(prompt).toContain('This rule overrides generic `1 Tier`, `Square`, Bento, and ordinary footprint\nheuristics.');
    expect(prompt).toContain('curved,\nopen, looped, hollow, or irregular digit outlines are still number-shaped cakes.');
    expect(prompt).toContain('one accepted number-cake design, not `multiple_cakes`');
    expect(prompt).toContain('`Square`, `Bento`, or `Rectangle Fondant`) and select the visible height from\nthe allowed `Rectangle` thicknesses: `"3 in"` or `"4 in"`.');
    expect(prompt).toContain('a birthday cake arranged as `18`, `21`, or `2026` -> `Rectangle`');
  });

  it('detects continuous gumpaste-covered baseboards without excluding colors', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('Judge the board from visible construction cues in the image.');
    expect(prompt).toContain('do not use the board color as the deciding');
    expect(prompt).toContain('The covering may be white, ivory, gold, silver, black, pastel, or any other');
    expect(prompt).toContain('White, gold, and silver do NOT automatically mean a standard uncovered');
    expect(prompt).toContain('reflective foil cake drum');
    expect(prompt).toContain('When evidence of a smooth continuous covering is visible, prefer');
    expect(prompt).toContain('Whenever `gumpasteBaseBoard` is true, set');
    expect(prompt).not.toContain('Only true if board is colored (NOT white/gold/silver)');
  });

  it('keeps edible 2D logo craft classification in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('EDIBLE 2D LOGO CRAFT TOPPERS');
    expect(prompt).toContain('Use `edible_logo_2d` for flat or shallow-relief edible logo/name/brand panels made from gumpaste or fondant craft');
    expect(prompt).toContain('matte fondant Yonex logo letters on a side panel -> `edible_logo_2d`');
    expect(prompt).toContain('"type": "candle|toy|plastic_crown|edible_crown|cardstock|edible_photo_top|edible_logo_2d|edible_2d_complex|printout');
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

  it('keeps the selfie edible-photo interception rule in the fallback prompt source', () => {
    const prompt = readPrompt('src/services/prompts/fallback-prompt.txt');

    expect(prompt).toContain('| `selfie` | "This is a selfie or portrait photo of humans. Let\'s make an edible photo cake!" |');
    expect(prompt).toContain('If the main subject is a person, pet, selfie, or portrait of humans with no cake or cupcakes present, classify as `selfie`.');
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
