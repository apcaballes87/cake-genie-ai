-- Insert prompt v3.24 by deriving it from the current active prompt.
-- Genie.ph does not use fresh flowers on cakes; fresh-looking flowers should
-- classify and price as edible_flowers.

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
    RAISE EXCEPTION 'Cannot create ai_prompts v3.24: no active source prompt found';
  END IF;

  next_prompt := source_prompt;

  next_prompt := replace(
    next_prompt,
    '**v3.23 Version - Thin Fabric Ribbon Bow Classification**',
    '**v3.24 Version - Edible Flower Safety Classification**'
  );

  next_prompt := replace(
    next_prompt,
    $$### Protocol 4: THE "FLOWER" CHECK (Fresh vs. Sugar vs. Silk)

- IF petals have veins, natural imperfections, brown edges → IT IS "fresh_flowers" (removed before eating).
- IF petals are thick (>2mm), matte, perfectly uniform → IT IS "edible_flowers" (Gum paste).
- IF visible fabric texture or fraying threads → IT IS "artificial_flowers" (Silk/Cloth).$$,
    $$### Protocol 4: THE "FLOWER" CHECK (Edible Flower Safety Rule)

- Genie.ph does not put fresh flowers on cakes because they are not safe or hygienic for our food workflow.
- IF a flower appears fresh, natural, realistic, or edible, classify it as "edible_flowers".
- IF petals have veins, natural imperfections, brown edges, or fresh-flower styling → IT IS still "edible_flowers".
- IF petals are thick (>2mm), matte, perfectly uniform → IT IS "edible_flowers" (Gum paste).
- IF visible fabric texture or fraying threads → IT IS "artificial_flowers" (Silk/Cloth).$$
  );

  next_prompt := replace(
    next_prompt,
    $$| **Flowers** (edible_flowers, fresh, artificial) | **DIAMETER** of the bloom face |$$,
    $$| **Flowers** (edible_flowers, artificial) | **DIAMETER** of the bloom face |$$
  );

  next_prompt := replace(
    next_prompt,
    $$### C3. FLOWERS — edible_flowers, fresh_flowers, artificial_flowers$$,
    $$### C3. FLOWERS — edible_flowers, artificial_flowers$$
  );

  next_prompt := replace(
    next_prompt,
    $$| `fresh_flowers` | non-edible | Real flowers (not counted for pricing) |$$,
    $$| `edible_flowers` | edible_fondant | Fresh-looking, natural-looking, or realistic flowers must still be classified and priced as edible flowers. Do not output `fresh_flowers`. |$$
  );

  IF next_prompt NOT LIKE '%Genie.ph does not put fresh flowers on cakes because they are not safe or hygienic for our food workflow.%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.24: edible flower safety wording was not inserted';
  END IF;

  IF next_prompt LIKE '%IT IS "fresh_flowers"%' OR next_prompt LIKE '%| `fresh_flowers` |%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.24: fresh_flowers output guidance remains';
  END IF;

  UPDATE public.ai_prompts
  SET is_active = FALSE
  WHERE is_active = TRUE;

  IF EXISTS (SELECT 1 FROM public.ai_prompts WHERE version = '3.24') THEN
    UPDATE public.ai_prompts
    SET
      prompt_text = next_prompt,
      is_active = TRUE,
      description = 'v3.24 maps fresh-looking flowers to edible_flowers for safe classification and pricing.',
      updated_at = NOW()
    WHERE version = '3.24';
  ELSE
    INSERT INTO public.ai_prompts (version, prompt_text, is_active, description, updated_at)
    VALUES (
      '3.24',
      next_prompt,
      TRUE,
      'v3.24 maps fresh-looking flowers to edible_flowers for safe classification and pricing.',
      NOW()
    );
  END IF;
END $migration$;
