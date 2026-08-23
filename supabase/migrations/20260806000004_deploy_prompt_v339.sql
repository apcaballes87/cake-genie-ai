-- Migration: Deploy prompt v3.39 — Crown precedence refinement
-- Crown-specific edible classification must win over the later generic molded
-- symbol rule so standalone fondant crowns do not remain edible_3d_ordinary.

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
    RAISE EXCEPTION 'Cannot create ai_prompts v3.39: no active source prompt found';
  END IF;

  next_prompt := replace(
    source_prompt,
    '**v3.38 Version - Edible and Plastic Crown Types**',
    '**v3.39 Version - Edible and Plastic Crown Types**'
  );

  next_prompt := replace(
    next_prompt,
    '#### MOLDED CELESTIAL / SYMBOL TOPPERS',
    '#### STANDALONE CROWN PRECEDENCE

Standalone molded, rolled, cut, or hand-sculpted fondant/gumpaste crowns and
tiaras always use `edible_crown`, material `edible_fondant`, before the generic
molded-symbol rule below. A crown worn by or attached to a larger character or
animal remains part of that larger figure unless it is a distinct separately
modeled topper.

#### MOLDED CELESTIAL / SYMBOL TOPPERS'
  );

  next_prompt := replace(
    next_prompt,
    '- molded fondant clouds
    '- molded fondant clouds
  );

  IF next_prompt NOT LIKE '%v3.39 Version - Edible and Plastic Crown Types%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.39: version header was not updated';
  END IF;

  IF next_prompt NOT LIKE '%always use `edible_crown`, material `edible_fondant`, before the generic%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.39: crown precedence was not added';
  END IF;

  IF next_prompt LIKE '%- bows
    RAISE EXCEPTION 'Cannot create ai_prompts v3.39: generic crown rule still overrides edible_crown';
  END IF;

  UPDATE public.ai_prompts
  SET is_active = FALSE
  WHERE is_active = TRUE;

  IF EXISTS (SELECT 1 FROM public.ai_prompts WHERE version = '3.39') THEN
    UPDATE public.ai_prompts
    SET
      prompt_text = next_prompt,
      is_active = TRUE,
      description = 'v3.39 — Crown-specific edible precedence prevents standalone fondant crowns from falling back to edible_3d_ordinary.',
      updated_at = NOW()
    WHERE version = '3.39';
  ELSE
    INSERT INTO public.ai_prompts (version, prompt_text, is_active, description, updated_at)
    VALUES (
      '3.39',
      next_prompt,
      TRUE,
      'v3.39 — Crown-specific edible precedence prevents standalone fondant crowns from falling back to edible_3d_ordinary.',
      NOW()
    );
  END IF;
END $migration$;
