-- Migration: Deploy prompt v3.46 — schema compatibility and determinism fixes
-- Fixes contract violations (bow subtype, photo side/print placement, missing
-- support colors), stabilizes identification rules (flower sizing table, toy
-- cue count, sprinkles ordering, number-cake fondant exception, border dual
-- output), and reserves `figurine` with the new `ceramic` material.
--
-- Deploy AFTER the code change that adds 'ceramic' to
-- GENERATED_ANALYSIS_MATERIALS (src/lib/ai/generatedAnalysisContract.ts).

DO $migration$
DECLARE
  source_prompt TEXT;
  next_prompt   TEXT;
BEGIN
  SELECT prompt_text
    INTO source_prompt
    FROM public.ai_prompts
    WHERE is_active = TRUE
    ORDER BY updated_at DESC NULLS LAST, prompt_id DESC
    LIMIT 1;

  IF source_prompt IS NULL THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.46: no active source prompt found';
  END IF;

  IF source_prompt NOT LIKE '%**v3.45 Version - Individual Flower Piece Counting**%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.46: active prompt is not v3.45';
  END IF;

  next_prompt := source_prompt;

  -- E1 header
  next_prompt := replace(next_prompt,
    '**v3.45 Version - Individual Flower Piece Counting**',
    '**v3.46 Version - Schema Compatibility And Determinism Fixes**');

  -- E2 tuxedo bow
  next_prompt := replace(next_prompt,
    '- Bow → `edible_3d_ordinary`, `small`, subtype: "bow"',
    '- Bow → `edible_3d_ordinary`, `small` (thick fondant bow; never use a subtype here)');

  -- E3 photo placement contract
  next_prompt := replace(next_prompt,
    '- freestanding paper, acrylic, wood, cardstock, or photopaper cutouts -> classify with `printout`, `cardstock`, or `toy` using the visual forensics rules below',
    '- freestanding paper, acrylic, wood, cardstock, or photopaper cutouts -> classify with `printout`, `cardstock`, or `toy` using the visual forensics rules below

Placement contract: `edible_photo_top` is a main-topper type and is emitted in
`main_toppers`. `edible_photo_side` and `edible_photo_print` are support-only
types and are ALWAYS emitted in `support_elements`, never in `main_toppers`.');

  -- E4 quick glance C3
  next_prompt := replace(next_prompt,
    '| C3 flowers | <0.10 | 0.10 to <0.30 | 0.30 to <0.50 | 0.50 to <0.90 | 0.90 to <1.20 | ≥1.20 |',
    '| C3 flowers | <0.10 | 0.10 to <0.30 | 0.30 to <0.50 | 0.50 to <0.80 | 0.80 to <1.00 | ≥1.00 |');

  -- E5 flower support carve-out
  next_prompt := replace(next_prompt,
    'Do NOT classify fondant/gumpaste flowers as `edible_3d_ordinary`, even when
they are simple, molded, small, gold-painted, or low-detail.',
    'Do NOT classify fondant/gumpaste flowers as `edible_3d_ordinary`, even when
they are simple, molded, small, gold-painted, or low-detail.

Flower placement: `edible_flowers` blooms sized `tiny`, `xsmall`, or `small`
are always emitted in `support_elements` at every size, mirroring
`edible_2d_support`; the hero criteria never promote them to `main_toppers`.
Only `medium`, `large`, or `xlarge` blooms may appear in `main_toppers`.');

  -- E6 support table flower row
  next_prompt := replace(next_prompt,
    '| `edible_flowers` | edible_fondant | Count individual flowers. Sizes: tiny, xsmall, small, medium, large, xlarge. Tiny/small = support |',
    '| `edible_flowers` | edible_fondant | Count individual flowers. Sizes: tiny, xsmall, small, medium, large, xlarge. tiny/xsmall/small = always support |');

  -- E7+E20 candles and icing technique types
  next_prompt := replace(next_prompt,
    'Candles should be placed in `main_toppers` by default because `candle` is a main topper type in the schema.
Group visually similar candles together with quantity.',
    'Candles are always emitted in `main_toppers` because `candle` is a
main-topper-only type in the schema. Use `classification: "hero"` only when the
candle arrangement is the dominant focal point of the whole design; otherwise
use `classification: "support"`.
Group visually similar candles together with quantity.

### ICING TECHNIQUE DECORATION TYPES

- `icing_brush_stroke`: artistic painted brush-stroke texture visibly applied
  with a brush across the icing surface
- `icing_splatter`: splattered or flicked icing speckles scattered across the
  icing surface
- `icing_minimalist_spread`: a deliberately spread, swiped, or rustic minimal
  icing texture treatment

All three use material `icing`. Emit one in `main_toppers` when the technique
is the dominant design feature of the cake; otherwise emit it in
`support_elements`. Use `quantity: 1` for the treated region. Simple piped
dots, borders, rosettes, and swirls stay `icing_decorations`.');

  -- E8 toy cue count
  next_prompt := replace(next_prompt,
    'These material cues are alternatives, not an ALL-required checklist. Do not
require a visible seam or glossy finish when distance, image resolution, or',
    'Require at least two compatible cues from this list before settling `toy`;
the cues are alternatives to each other, so do not require every cue. Do not
require a visible seam or glossy finish when distance, image resolution, or');

  -- E9 molded animal item
  next_prompt := replace(next_prompt,
    '- simple molded animals or icons without detailed sculpted bodies',
    '- simple molded animal or icon forms with flat-stamped or shallow faces and no modeled expression (a freestanding animal-head set with modeled ears, eyes, and mouth stays `edible_3d_complex` above)');

  -- E10 freestanding override wording
  next_prompt := replace(next_prompt,
    'Use `edible_3d_ordinary` in `support_elements` for figure-like decorations
only when they are simple molded non-character forms or simple animal/icon
forms without detailed sculpted anatomy. Do not use a description alone to',
    'Use `edible_3d_ordinary` in `support_elements` for figure-like decorations
only when they are simple molded non-character forms or simple animal/icon
forms with flat-stamped faces and no modeled expression. Do not use a description alone to');

  -- E11 sprinkles metallic ordering
  next_prompt := replace(next_prompt,
    'overall scatter application. This is a fulfillment classification override:
it applies even when the tiny pieces look matte, satiny, hand-rolled, or like
fondant.',
    'overall scatter application. This is a fulfillment classification override:
it applies even when the tiny pieces look matte, satiny, hand-rolled, or like
fondant. It also applies when the tiny scattered pearls look metallic:
sprinkle-scale scattered metallic pearls remain `sprinkles`. Reserve
`premium_sprinkles` for round metallic or pearl sprinkles covering 50% or
more of the icing surface, and never reclassify a scattered pearl application
as `premium_sprinkles` merely because the pearls are gold or silver.');

  -- E12 number cake fondant exception
  next_prompt := replace(next_prompt,
    'For every number-shaped cake, emit `cakeType: "Rectangle"` (not `1 Tier`,
`Square`, `Bento`, or `Rectangle Fondant`) and select the visible height from
the allowed `Rectangle` thicknesses: `"3 in"` or `"4 in"`.

Examples:
- a cake shaped like `2`, `7`, or `0` -> `Rectangle`
- a curved or hollow number cake shaped like `8` -> `Rectangle`
- a birthday cake arranged as `18`, `21`, or `2026` -> `Rectangle`',
    'For every number-shaped cake, emit `cakeType: "Rectangle"` (not `1 Tier`,
`Square`, or `Bento`) and select the visible height from the allowed
`Rectangle` thicknesses: `"3 in"` or `"4 in"`.

Fondant exception: when the number cake body is visibly covered in fondant
(sheet-like smooth surface, rounded edges), emit `cakeType: "Rectangle Fondant"`
instead, with thickness `"5 in"` or `"6 in"` and
`icing_design.base: "fondant"`, following the icing contract.

Examples:
- a cake shaped like `2`, `7`, or `0` -> `Rectangle`
- a curved or hollow number cake shaped like `8` -> `Rectangle`
- a birthday cake arranged as `18`, `21`, or `2026` -> `Rectangle`
- a fondant-covered number cake arranged as `21` -> `Rectangle Fondant`');

  -- E13 matrix additions
  next_prompt := replace(next_prompt,
    '| Wax object with visible wick | `candle` | `wax` | main topper | C6 |
| Large fabric wrap or band | `satin_ribbon` | `non-edible` | support element | fixed whole feature |',
    '| Wax object with visible wick | `candle` | `wax` | main topper | C6 |
| Popular character/human figure with ceramic-like breakable look | `figurine` | `ceramic` | main topper | toy-specific table |
| Meringue pop on a stick | `meringue_pop` | `candy` | main topper | per piece |
| Meringue kiss without a stick | `meringue` | `candy` | support element | per piece |
| Simple flat edible shape as the sole focal decoration | `edible_2d_shapes` | `edible_fondant` | main topper | C5 |
| Large fabric wrap or band | `satin_ribbon` | `non-edible` | support element | fixed whole feature |');

  -- E14 figurine section
  next_prompt := replace(next_prompt,
    '**TOY EXAMPLES:**

- Actual plastic Mickey Mouse figurine
- Action figures placed on cake
- Plastic toy cars (Hot Wheels style)',
    '**TOY EXAMPLES:**

- Actual plastic Mickey Mouse figurine
- Action figures placed on cake
- Plastic toy cars (Hot Wheels style)

#### FIGURINE — CERAMIC-LOOK CHARACTER FIGURES (RESERVED)

Use `figurine` with material `ceramic` only for a physically 3D popular
character or human figure that looks like a breakable ceramic porcelain
figurine: a smooth glazed ceramic-like surface, rigid cast construction, and a
recognized popular character likeness or standard human figurine subject such
as Mickey Mouse, Avengers, Superman, Spiderman, baby figurines, old man
figurines, or groom and bride figurines.

- A popular character or human figure that looks like plain molded or matte
  factory plastic, not glazed ceramic, stays `toy` with material `plastic`.
- A handmade edible figure stays `edible_3d_complex` or `edible_3d_ordinary`
  under their usual rules.
- Non-character decorative sculptures do not use `figurine`; classify them as
  `toy` or the compatible edible type by their construction.
- `figurine` is a main-topper-only type. Size it with the TOY-SPECIFIC SIZING
  PRECEDENCE table.

Precedence for a physically 3D character figure: check `figurine` first
(popular character/human subject with a ceramic-like breakable look), then
`toy` (rigid manufactured cues), then the edible 3D types (handmade edible
cues).');

  -- E15a toy table authority
  next_prompt := replace(next_prompt,
    'This toy-specific table is authoritative for `toy` and `plastic_crown` and overrides the generic C1',
    'This toy-specific table is authoritative for `toy`, `plastic_crown`, and `figurine` and overrides the generic C1');

  -- E15b quickref toy line
  next_prompt := replace(next_prompt,
    '   → Toy or `plastic_crown`? Measure HEIGHT and use TOY-SPECIFIC SIZING PRECEDENCE',
    '   → Toy, `plastic_crown`, or `figurine`? Measure HEIGHT and use TOY-SPECIFIC SIZING PRECEDENCE');

  -- E15c quickref step 4
  next_prompt := replace(next_prompt,
    '4. For `toy` or `plastic_crown`, use TOY-SPECIFIC SIZING PRECEDENCE; otherwise look up the correct per-type table (C1-C7)',
    '4. For `toy`, `plastic_crown`, or `figurine`, use TOY-SPECIFIC SIZING PRECEDENCE; otherwise look up the correct per-type table (C1-C7)');

  -- E16 logo boundary
  next_prompt := replace(next_prompt,
    '- `medium`: noticeable logo panel or wordmark, about 25-50% of the visible tier width/face
- `large`: dominant logo panel or wordmark, more than 50% of the visible tier width/face',
    '- `medium`: noticeable logo panel or wordmark, 25% to under 50% of the visible tier width/face
- `large`: dominant logo panel or wordmark, 50% or more of the visible tier width/face');

  -- E17 border dual output
  next_prompt := replace(next_prompt,
    '  "gumpasteBaseBoard": true|false
}
```

### INTRICATE ICING DOODLE PLACEMENT AND PRICING PRECEDENCE',
    '  "gumpasteBaseBoard": true|false
}
```

### BORDER REPRESENTATION (DUAL OUTPUT — REQUIRED)

When a piped border (shells, beads, dollops, rosettes, or swirls) runs along
the top edge or the base edge of the cake, always represent it twice:
1. Set `icing_design.border_top` and/or `icing_design.border_base` to `true`.
2. Also emit one `icing_decorations` support row for that border run
   (`material: "icing"`, `quantity: 1`, size by its visible band).

Freestanding piped dots, rosettes, or swirls elsewhere on the cake emit their
own `icing_decorations` rows and never set the border booleans. Never emit a
border only once: the boolean and the row always travel together.

### INTRICATE ICING DOODLE PLACEMENT AND PRICING PRECEDENCE');

  -- E18 group_id softening
  next_prompt := replace(next_prompt,
    '**CRITICAL: The size prefix in group_id MUST match the actual size classification from the ratio-based sizing framework (Step C tables C1-C7). Do NOT use "large" in group_id if the element is classified as "medium" or "small". The group_id size descriptor must be consistent with the `size` field value.**',
    'If a size descriptor is included in a group_id, it MUST match the item''s actual `size` value from the ratio-based sizing framework (Step C tables C1-C7). Do NOT use "large" in group_id if the element is classified as "medium" or "small". Omitting size descriptors from group_id is allowed.');

  -- E19 lollipop and photo support rows
  next_prompt := replace(next_prompt,
    '| `marshmallows` | candy | Marshmallow decorations |',
    '| `marshmallows` | candy | Marshmallow decorations |
| `edible_lollipops` | candy | Edible lollipop decorations. Count individually |
| `edible_photo_side` | waferpaper | Full edible image side panel or wrap covering a cake side. Size by side coverage: tiny (narrow strip), small (<40%), medium (40% to <80%), large (≥80%). Use quantity 1 per covered side region |
| `edible_photo_print` | waferpaper | Smaller edible printed cutouts placed on the cake side. Size each cutout and count per piece |');

  -- E21 forbid artificial flowers
  next_prompt := replace(next_prompt,
    '- Do not describe a flower as fresh, silk, cloth, fabric, or non-edible. Describe
  it as an edible fondant or gumpaste flower instead.',
    '- Do not describe a flower as fresh, silk, cloth, fabric, or non-edible. Describe
  it as an edible fondant or gumpaste flower instead.
- Never output the type `artificial_flowers`; it exists only for legacy rows.
  Every visible flower is `edible_flowers` under this override.');

  -- E22 material enum ceramic
  next_prompt := replace(next_prompt,
    '  "material": "wax|plastic|cardstock|photopaper|waferpaper|edible_fondant|icing|candy|non-edible",',
    '  "material": "wax|plastic|cardstock|photopaper|waferpaper|edible_fondant|icing|candy|non-edible|ceramic",');

  -- E23 2d shapes split
  next_prompt := replace(next_prompt,
    '4. Plain stars, dots, hearts, leaves, geometric pieces, and other simple flat
   cut shapes remain `edible_2d_shapes` or `edible_2d_support`.',
    '4. Plain stars, dots, hearts, leaves, geometric pieces, and other simple flat
   cut shapes remain `edible_2d_shapes` (only when one such shape is the sole
   focal decoration, emitted in `main_toppers`) or `edible_2d_support` (all
   other cases, emitted in `support_elements` at every size).');

  -- E24 meringue support row
  next_prompt := replace(next_prompt,
    '| `meringue` | candy | Meringue kisses, count individually |',
    '| `meringue` | candy | Meringue kisses without sticks, count individually. Meringue pops on sticks are `meringue_pop` main toppers |');

  -- E25a bear clouds color
  next_prompt := replace(next_prompt,
    '    {
      "type": "edible_3d_ordinary",
      "material": "edible_fondant",
      "size": "small",
      "description": "separate white molded cloud shapes",',
    '    {
      "type": "edible_3d_ordinary",
      "material": "edible_fondant",
      "color": "#FFFFFF",
      "size": "small",
      "description": "separate white molded cloud shapes",');

  -- E25b bear stars color
  next_prompt := replace(next_prompt,
    '    {
      "type": "edible_2d_support",
      "material": "edible_fondant",
      "size": "xsmall",
      "description": "gold stars",',
    '    {
      "type": "edible_2d_support",
      "material": "edible_fondant",
      "color": "#FFD700",
      "size": "xsmall",
      "description": "gold stars",');

  -- E26 final checklist figurine
  next_prompt := replace(next_prompt,
    '✅ **CROWNS & TIARAS: Metal/Plastic/Rhinestone = plastic_crown; fondant/gumpaste = edible_crown**',
    '✅ **CROWNS & TIARAS: Metal/Plastic/Rhinestone = plastic_crown; fondant/gumpaste = edible_crown**
✅ **Ceramic-look popular character/human figures = figurine (material ceramic); plain plastic figures = toy**');

  -- E27 support includes flowers
  next_prompt := replace(next_prompt,
    '- Tiny and small sized edible flowers (edible_flowers)',
    '- tiny, xsmall, and small sized edible flowers (edible_flowers)');

  -- E28 matrix flower role
  next_prompt := replace(next_prompt,
    '| Fondant/gumpaste flower | `edible_flowers` | `edible_fondant` | main or support by role | C3 |',
    '| Fondant/gumpaste flower | `edible_flowers` | `edible_fondant` | support for tiny/xsmall/small; main for medium or larger | C3 |');

  IF position('**v3.46 Version - Schema Compatibility And Determinism Fixes**' IN next_prompt) = 0 THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.46: version header was not applied';
  END IF;

  IF position('#### FIGURINE — CERAMIC-LOOK CHARACTER FIGURES (RESERVED)' IN next_prompt) = 0 THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.46: figurine section was not applied';
  END IF;

  IF position('icing|candy|non-edible|ceramic"' IN next_prompt) = 0 THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.46: ceramic material enum was not applied';
  END IF;

  IF position('### BORDER REPRESENTATION (DUAL OUTPUT — REQUIRED)' IN next_prompt) = 0 THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.46: border dual output was not applied';
  END IF;

  IF position('Placement contract: `edible_photo_top` is a main-topper type' IN next_prompt) = 0 THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.46: photo placement contract was not applied';
  END IF;

  IF position('subtype: "bow"' IN next_prompt) > 0 THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.46: bow subtype still present';
  END IF;

  UPDATE public.ai_prompts
  SET is_active = FALSE
  WHERE is_active = TRUE;

  IF EXISTS (SELECT 1 FROM public.ai_prompts WHERE version = '3.46') THEN
    UPDATE public.ai_prompts
    SET
      prompt_text = next_prompt,
      is_active = TRUE,
      description = 'v3.46 — Contract fixes (bow subtype, photo side/print support placement, example colors) and identification determinism (C3 table, flower/candle placement, toy cues, sprinkles ordering, Rectangle Fondant number cakes, border dual output, figurine/ceramic).',
      updated_at = NOW()
    WHERE version = '3.46';
  ELSE
    INSERT INTO public.ai_prompts (version, prompt_text, is_active, description, updated_at)
    VALUES (
      '3.46',
      next_prompt,
      TRUE,
      'v3.46 — Contract fixes (bow subtype, photo side/print support placement, example colors) and identification determinism (C3 table, flower/candle placement, toy cues, sprinkles ordering, Rectangle Fondant number cakes, border dual output, figurine/ceramic).',
      NOW()
    );
  END IF;
END $migration$;
