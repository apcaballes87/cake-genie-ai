-- Insert prompt v3.19 by deriving it from the current active prompt.
-- Cleans up the contract wording, aligns canonical enums, and adds
-- payment_receipt as a first-class rejection reason.

DO $migration$
DECLARE
  source_prompt TEXT;
  next_prompt TEXT;
BEGIN
  SELECT prompt_text
  INTO source_prompt
  FROM public.ai_prompts
  WHERE is_active = TRUE
  ORDER BY updated_at DESC NULLS LAST, prompt_id DESC
  LIMIT 1;

  IF source_prompt IS NULL THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.19: no active source prompt found';
  END IF;

  next_prompt := source_prompt;

  next_prompt := replace(
    next_prompt,
    '**v3.18 Version - Cake Height Ratio Guide**',
    '**v3.19 Version - Prompt Contract Cleanup**'
  );

  next_prompt := replace(
    next_prompt,
    $$## OUTPUT RULES

- ✅ Valid JSON only
- ✅ All keys lowercase
- ✅ Empty arrays allowed; missing keys ❌
- ✅ Colors: **only from approved palette** (see end)
- ✅ **`icing_design.colors.side` is REQUIRED — never null, never omitted** (see CATEGORY 5 defaulting chain)$$,
    $$## OUTPUT RULES

- ✅ Valid JSON only
- ✅ Use the exact field names shown in the JSON skeleton below
- ✅ Enum values must match the listed casing exactly
- ✅ Empty arrays allowed; required keys must still be present
- ✅ Colors: **only from approved palette** (see end)
- ✅ **`icing_design.colors.side` is REQUIRED — never null, never omitted** (see CATEGORY 5 defaulting chain)$$
  );

  next_prompt := replace(
    next_prompt,
    $$| `selfie` | "This is a selfie or portrait photo of humans. Let's make an edible photo cake!" |$$,
    $$| `selfie` | "This is a selfie or portrait photo of humans. Let's make an edible photo cake!" |
| `payment_receipt` | "This looks like a payment receipt or screenshot. Please upload a cake design image instead." |$$
  );

  next_prompt := replace(
    next_prompt,
    $$**Note on portraits, selfies, and receipts:** If the main subject is a payment receipt/screenshot, classify as `payment_receipt` and reject. If the main subject is a person, pet, selfie, or portrait of humans (with no cake or cupcakes present), classify as `selfie` and reject. If the main subject is any other non-food object or scene, classify as `not_a_cake` and reject. Do NOT describe, classify, or price it as a cake.$$,
    $$**Note on portraits, selfies, and receipts:** If the main subject is a payment receipt or payment screenshot, classify as `payment_receipt`. If the main subject is a person, pet, selfie, or portrait of humans with no cake or cupcakes present, classify as `selfie`. If the main subject is any other non-food object or scene, classify as `not_a_cake`. Do NOT describe, classify, or price it as a cake.$$
  );

  next_prompt := replace(
    next_prompt,
    $$**→ If reject, output ONLY the rejection object. You MUST fill `reason` with the matching label from the table above and `message` with that row's EXACT message text. Never leave `message` empty.**

```json
{"rejection":{"isRejected":true,"reason":"not_a_cake","message":"This image doesn't appear to be a cake. Please upload a cake image."}}
```

---

## STEP 2: ACCEPTED IMAGE — REQUIRED TOP-LEVEL KEYS

```json
{
  "cakeType": "...",
  "cakeThickness": "...",
  "main_toppers": [...],
  "support_elements": [...],
  "cake_messages": [...],
  "icing_design": {...},
  "keyword": "..."
}
```

---

## VISUAL FORENSIC LIBRARY (Material Identification)$$,
    $$**→ If reject, keep every top-level key present. Set all arrays to empty arrays, set free-text accepted-cake fields to empty strings, use the default `icing_design` object shown below, and fill `rejection.reason` and `rejection.message` with the exact table values above. Never leave `message` empty.**

```json
{
  "cakeType": "",
  "cakeThickness": "",
  "main_toppers": [],
  "support_elements": [],
  "cake_messages": [],
  "icing_design": {
    "base": "soft_icing",
    "color_type": "single",
    "colors": {
      "side": "#FFFFFF",
      "top": "#FFFFFF"
    },
    "drip": false,
    "border_top": false,
    "border_base": false,
    "gumpasteBaseBoard": false
  },
  "keyword": "",
  "alt_text": "",
  "seo_title": "",
  "seo_description": "",
  "rejection": {
    "isRejected": true,
    "reason": "not_a_cake",
    "message": "This image doesn't appear to be a cake. Please upload a cake image."
  }
}
```

---

## STEP 2: ACCEPTED IMAGE — REQUIRED TOP-LEVEL KEYS

```json
{
  "rejection": {
    "isRejected": false,
    "reason": "",
    "message": ""
  },
  "cakeType": "...",
  "cakeThickness": "...",
  "main_toppers": [...],
  "support_elements": [...],
  "cake_messages": [...],
  "icing_design": {...},
  "keyword": "...",
  "alt_text": "...",
  "seo_title": "...",
  "seo_description": "..."
}
```

---

## OUTPUT ORDER

Apply rules in this order:
1. Rejection
2. Cake type and tier counting
3. Material and placement
4. Main topper vs support classification
5. Size
6. Colors and icing
7. SEO copy

## VISUAL FORENSIC LIBRARY (Material Identification)$$
  );

  next_prompt := replace(
    next_prompt,
    $$### EDIBLE PHOTO TOP VS EDIBLE PHOTO PRINT

Use `edible_photo_top` when an edible image/photo/printed graphic covers the top surface of the cake, even if it is anime, cartoon, character art, or a full printed scene.

Use `edible_photo_print` only for smaller edible printed cutouts or printed pieces placed on the side of the cake, not for a full top panel and not for a full side wrap.

If the image is the main flat printed design on the cake top, choose `edible_photo_top`, not `edible_photo_print` and not `printout`.$$,
    $$### EDIBLE PHOTO TOP VS EDIBLE PHOTO PRINT

Decide placement before material:
- full edible image covering the cake top -> `edible_photo_top`
- edible print placed on the cake side as a side panel or wrap -> `edible_photo_side`
- smaller edible printed cutouts or printed pieces placed on the side -> `edible_photo_print`
- freestanding paper, acrylic, wood, cardstock, or photopaper cutouts -> classify with `printout`, `cardstock`, or `toy` using the visual forensics rules below

Use `edible_photo_top` when an edible image/photo/printed graphic covers the top surface of the cake, even if it is anime, cartoon, character art, or a full printed scene.

Use `edible_photo_print` only for smaller edible printed cutouts or printed pieces placed on the side of the cake, not for a full top panel and not for a full side wrap.

If the image is the main flat printed design on the cake top, choose `edible_photo_top`, not `edible_photo_print` and not `printout`.$$
  );

  next_prompt := replace(
    next_prompt,
    $$- do not classify it as an edible 3d complex if a character,  animal or human (head or whole body) is only flat 2d edible topper and only lying down on the cake - you can classify it as "edible_2d_support"$$,
    $$- do not classify it as an edible 3d complex if a character,  animal or human (head or whole body) is only flat 2d edible topper and only lying down on the cake - you can classify it as "edible_2d_support"
- Facial features alone are not enough for `edible_3d_complex` if the item is clearly molded, stamped, flat-backed, shallow-relief, or a simple repeated decorative shape.

#### MOLDED CELESTIAL / SYMBOL TOPPERS

Do NOT classify a topper as `edible_3d_complex` only because it has a face,
expression, ridges, embossed details, or decorative surface texture.

If the item appears to be made from a mold, cutter, stamp, or shallow relief
shape, classify it as `edible_3d_ordinary`, even if it has simple facial
features.

Common `edible_3d_ordinary` molded items include:
- sun faces
- moon faces
- stars
- shells
- crosses
- hearts
- clouds
- bows
- crowns
- plaques
- medallions
- simple molded animals or icons without detailed sculpted bodies

Use `edible_3d_complex` only when the item requires clear hand-sculpted
character work, such as a detailed full body, limbs, clothing, pose,
multi-part anatomy, expressive character modeling, or non-repeating custom
sculpture.

For celestial toppers:
- molded sun with face = `edible_3d_ordinary`
- molded moon with face = `edible_3d_ordinary`
- molded stars = `edible_3d_ordinary` or `edible_2d_support` depending depth or placement
- only a fully sculpted sun or moon character figure with body, limbs, or pose should be `edible_3d_complex`$$
  );

  next_prompt := replace(
    next_prompt,
    $$  "type": "candle|toy|cardstock|edible_photo_top|edible_photo_side|printout|edible_2d_shapes|edible_3d_ordinary|edible_3d_complex|plastic_ball",$$,
    $$  "type": "candle|toy|cardstock|edible_photo_top|printout|edible_2d_shapes|edible_flowers|edible_3d_ordinary|edible_3d_complex|figurine|icing_doodle|icing_palette_knife|icing_brush_stroke|icing_splatter|icing_minimalist_spread|meringue_pop|plastic_ball",$$
  );

  next_prompt := replace(
    next_prompt,
    $$### Message Types

| Type | Description |
|------|-------------|
| `gumpaste_letters` | 3D fondant/gumpaste letters |
| `icing_text` | Piped icing text |
| `edible_print_text` | Printed text on edible paper |
| `cardstock_text` | Cardstock banner/letters |

### Message JSON Format

```json
{
  "x": 50,
  "y": 80,
  "text": "Happy Birthday",
  "type": "gumpaste_letters|icing_text|edible_print_text|cardstock_text",
  "color": "#HEXCODE",
  "position": "top|side|base_board"
}
```$$,
    $$### Message Types

| Type | Description |
|------|-------------|
| `gumpaste_letters` | 3D fondant/gumpaste letters |
| `icing_script` | Piped icing text |
| `printout` | Printed text on edible paper or printed topper text |
| `cardstock` | Cardstock, acrylic, or wooden banner/letters |

### Message JSON Format

```json
{
  "x": 50,
  "y": 80,
  "text": "Happy Birthday",
  "type": "gumpaste_letters|icing_script|printout|cardstock",
  "color": "#HEXCODE",
  "position": "top|side|base_board"
}
```$$
  );

  next_prompt := replace(
    next_prompt,
    $$```json
{
  "base": "soft-icing|fondant|naked|semi-naked",
  "color_type": "single|gradient|multicolor",
  "colors": {
    "side": "#HEXCODE",
    "top": "#HEXCODE",
    "gumpasteBaseBoardColor": "#HEXCODE"
  },
  "drip": true|false,
  "border_top": true|false,
  "border_base": true|false,
  "gumpasteBaseBoard": true|false
}
```$$,
    $$```json
{
  "base": "soft_icing|fondant",
  "color_type": "single|gradient|multicolor",
  "colors": {
    "side": "#HEXCODE",
    "top": "#HEXCODE",
    "gumpasteBaseBoardColor": "#HEXCODE"
  },
  "drip": true|false,
  "border_top": true|false,
  "border_base": true|false,
  "gumpasteBaseBoard": true|false
}
```$$
  );

  next_prompt := replace(
    next_prompt,
    $$Do NOT use a separate invented type like `icing_doodle_intricate` unless it is
explicitly present in the schema enum. If the doodle is intricate, keep
`type: "icing_doodle"` and explain the complexity in `description`.

Examples:
- piped "30" on top -> `cake_messages`, type `icing_text`$$,
    $$If the doodle is intricate, keep `type: "icing_doodle"` and explain the
complexity in `description`. Do not invent a new output type.

Examples:
- piped "30" on top -> `cake_messages`, type `icing_script`$$
  );

  next_prompt := replace(
    next_prompt,
    $$2. **If `top` is also not determinable**, infer from the **leading 1–3 word color phrase in `alt_text`** (e.g., "Navy blue wedding cake" → `side: "#000080"`). The alt_text lead color is extracted by the pipeline; you do not compute it — just apply the same logic.
3. **If neither source yields a color**, pick the closest palette match by visual dominance (the color covering the most visible icing area).$$,
    $$2. **If `top` is also not determinable**, choose the closest palette match from the dominant visible icing color.
3. **If neither source yields a color**, pick the closest palette match by visual dominance (the color covering the most visible icing area).$$
  );

  UPDATE public.ai_prompts
  SET is_active = FALSE
  WHERE is_active = TRUE;

  IF EXISTS (SELECT 1 FROM public.ai_prompts WHERE version = '3.19') THEN
    UPDATE public.ai_prompts
    SET
      prompt_text = next_prompt,
      is_active = TRUE,
      description = 'v3.19 - Prompt contract cleanup with canonical enums and payment receipt rejection',
      updated_at = NOW()
    WHERE version = '3.19';
  ELSE
    INSERT INTO public.ai_prompts (version, prompt_text, is_active, description, updated_at)
    VALUES (
      '3.19',
      next_prompt,
      TRUE,
      'v3.19 - Prompt contract cleanup with canonical enums and payment receipt rejection',
      NOW()
    );
  END IF;
END $migration$;
