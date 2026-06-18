-- Insert prompt v3.18 by deriving it from the current v3.17 prompt.
-- Adds explicit cake-body diameter:height ratio guidance for cakeThickness.

DO $$
DECLARE
  source_prompt TEXT;
  next_prompt TEXT;
  thickness_anchor TEXT := $anchor$### cakeThickness (Required string)

Must be one of: `"2 in"`, `"3 in"`, `"4 in"`, `"5 in"`, `"6 in"`
$anchor$;
  ratio_guide TEXT := $guide$### cakeThickness Ratio Guide (Required for cake height)

Use visual cake-body proportions to choose `cakeThickness`. Do not infer or output the cake diameter or serving size from the image. `cakeType` should stay as the form/tier label, such as `"1 Tier"`, while `cakeThickness` stores the estimated vertical cake height.

Estimate the ratio of visible cake-body diameter or widest horizontal cake-body width to visible cake-body height. Exclude toppers, candles, flowers, platforms, cake boards, boxes, plates, shadows, and camera background. For multi-tier cakes, use the typical visible height of an actual cake tier, not the combined stack height.

Choose the nearest guide value:

| Visual diameter:height ratio | Example body proportion | Output `cakeThickness` |
|------------------------------|-------------------------|-------------------------|
| About 2.00:1 | 6 in diameter x 3 in tall | `"3 in"` |
| About 1.50:1 | 6 in diameter x 4 in tall | `"4 in"` |
| About 1.20:1 | 6 in diameter x 5 in tall | `"5 in"` |
| About 1.00:1 | 6 in diameter x 6 in tall | `"6 in"` |

If the cake is between two ratios, choose the closest height. If perspective makes the diameter uncertain, compare the front visible cake width to the visible side height and choose the nearest supported height. Keep cupcakes on their explicit cupcake rule of `"2 in"`.
$guide$;
BEGIN
  SELECT prompt_text
  INTO source_prompt
  FROM public.ai_prompts
  WHERE version = '3.17'
  ORDER BY updated_at DESC NULLS LAST, prompt_id DESC
  LIMIT 1;

  IF source_prompt IS NULL THEN
    SELECT prompt_text
    INTO source_prompt
    FROM public.ai_prompts
    WHERE is_active = TRUE
    ORDER BY updated_at DESC NULLS LAST, prompt_id DESC
    LIMIT 1;
  END IF;

  IF source_prompt IS NULL THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.18: no source prompt found';
  END IF;

  next_prompt := replace(
    source_prompt,
    '**v3.17 Version - Platform Topper vs 2Tier topper**',
    '**v3.18 Version - Cake Height Ratio Guide**'
  );

  IF position('### cakeThickness Ratio Guide (Required for cake height)' IN next_prompt) = 0 THEN
    IF position(thickness_anchor IN next_prompt) = 0 THEN
      RAISE EXCEPTION 'Cannot create ai_prompts v3.18: cakeThickness anchor not found';
    END IF;

    next_prompt := replace(next_prompt, thickness_anchor, thickness_anchor || E'\n' || ratio_guide);
  END IF;

  UPDATE public.ai_prompts
  SET is_active = FALSE
  WHERE is_active = TRUE;

  IF EXISTS (SELECT 1 FROM public.ai_prompts WHERE version = '3.18') THEN
    UPDATE public.ai_prompts
    SET
      prompt_text = next_prompt,
      is_active = TRUE,
      description = 'v3.18 - Add ratio-based cake height guide for cakeThickness',
      updated_at = NOW()
    WHERE version = '3.18';
  ELSE
    INSERT INTO public.ai_prompts (version, prompt_text, is_active, description, updated_at)
    VALUES (
      '3.18',
      next_prompt,
      TRUE,
      'v3.18 - Add ratio-based cake height guide for cakeThickness',
      NOW()
    );
  END IF;
END $$;
