-- Migration: Deploy prompt v3.37 — Plastic Crown as Separate Type
-- Physical 3D crowns/tiaras are now classified as `plastic_crown` (not `toy`).
-- Pricing rules for plastic_crown mirror the existing toy rules via
-- 20260806000000_add_plastic_crown_pricing.sql.

DO $migration$
DECLARE
  source_prompt TEXT;
  next_prompt   TEXT;
BEGIN
  -- Fetch the current active prompt
  SELECT prompt_text
  INTO source_prompt
  FROM public.ai_prompts
  WHERE is_active = TRUE
  ORDER BY updated_at DESC NULLS LAST, prompt_id DESC
  LIMIT 1;

  IF source_prompt IS NULL THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.37: no active source prompt found';
  END IF;

  next_prompt := source_prompt;

  -- 1. Bump version
  next_prompt := replace(
    next_prompt,
    '**v3.36 Version - Physical Depth and Printout Evidence Precedence**',
    '**v3.37 Version - Plastic Crown as Separate Type**'
  );

  -- 2. Update the global normalization rule for crowns
  next_prompt := replace(
    next_prompt,
    '- physical metal, rhinestone, or plastic crowns/tiaras -> `toy`, material',
    '- physical metal, rhinestone, or plastic crowns/tiaras -> `plastic_crown`, material'
  );

  -- 3. Update the CROWNS & TIARAS section header
  next_prompt := replace(
    next_prompt,
    '#### CROWNS & TIARAS (type: "toy", material: "plastic")',
    '#### CROWNS & TIARAS (type: "plastic_crown", material: "plastic")'
  );

  -- 4. Update the CROWNS & TIARAS body — "always classify as" instruction
  next_prompt := replace(
    next_prompt,
    '**ALWAYS classify physical 3D Crowns and Tiaras as "toy".**',
    '**ALWAYS classify physical 3D Crowns and Tiaras as "plastic_crown".**'
  );

  -- 5. Add explicit DO NOT classify as toy (if the clause is still missing)
  IF next_prompt NOT LIKE '%DO NOT%classify these as "toy". Crowns and tiaras are always%' THEN
    next_prompt := replace(
      next_prompt,
      '- **EXCEPTION:** Only classify as "cardstock" if it is visibly a flat glitter paper cutout.',
      '- **DO NOT** classify these as "toy". Crowns and tiaras are always `plastic_crown`, never `toy`.
- **EXCEPTION:** Only classify as "cardstock" if it is visibly a flat glitter paper cutout.'
    );
  END IF;

  -- 6. Remove crown example from TOY EXAMPLES
  next_prompt := replace(
    next_prompt,
    '- **Metal or Plastic Crowns / Tiaras (Gold, Silver, Rhinestone)**
- Actual plastic Mickey Mouse figurine',
    '- Actual plastic Mickey Mouse figurine'
  );

  -- 7. Add plastic_crown to the main topper JSON type enum
  next_prompt := replace(
    next_prompt,
    '"type": "candle|toy|cardstock|edible_photo_top|edible_logo_2d|edible_2d_complex|printout',
    '"type": "candle|toy|plastic_crown|cardstock|edible_photo_top|edible_logo_2d|edible_2d_complex|printout'
  );

  -- 8. Update toy-specific sizing header to include plastic_crown
  next_prompt := replace(
    next_prompt,
    '### TOY-SPECIFIC SIZING PRECEDENCE (OVERRIDES C1 FOR `toy`)',
    '### TOY-SPECIFIC SIZING PRECEDENCE (OVERRIDES C1 FOR `toy` AND `plastic_crown`)'
  );

  -- 9. Update sizing flow text
  next_prompt := replace(
    next_prompt,
    'This toy-specific table is authoritative for `toy` and overrides the generic C1',
    'This toy-specific table is authoritative for `toy` and `plastic_crown` and overrides the generic C1'
  );

  next_prompt := replace(
    next_prompt,
    '→ Toy? Measure HEIGHT and use TOY-SPECIFIC SIZING PRECEDENCE',
    '→ Toy or `plastic_crown`? Measure HEIGHT and use TOY-SPECIFIC SIZING PRECEDENCE'
  );

  next_prompt := replace(
    next_prompt,
    '4. For `toy`, use TOY-SPECIFIC SIZING PRECEDENCE; otherwise look up the correct per-type table (C1-C7)',
    '4. For `toy` or `plastic_crown`, use TOY-SPECIFIC SIZING PRECEDENCE; otherwise look up the correct per-type table (C1-C7)'
  );

  -- 10. Update checklist line for crowns (if it exists in this prompt version)
  next_prompt := replace(
    next_prompt,
    'CROWNS & TIARAS: Metal/Plastic/Rhinestone = TOY',
    'CROWNS & TIARAS: Metal/Plastic/Rhinestone = plastic_crown'
  );

  -- 11. Update final checklist reminder
  next_prompt := replace(
    next_prompt,
    'Classify physical 3D crowns as **TOY**, never cardstock.',
    'Classify physical 3D crowns as **plastic_crown**, never cardstock, never toy.'
  );

  -- ---- Validation checks ----
  IF next_prompt NOT LIKE '%plastic_crown%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.37: plastic_crown was not introduced into the prompt';
  END IF;

  IF next_prompt LIKE '%physical metal, rhinestone, or plastic crowns/tiaras -> `toy`%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.37: crown normalization still points to toy';
  END IF;

  IF next_prompt LIKE '%CROWNS & TIARAS (type: "toy"%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.37: CROWNS section header still says toy';
  END IF;

  IF next_prompt LIKE '%ALWAYS classify physical 3D Crowns and Tiaras as "toy"%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.37: crown body still says classify as toy';
  END IF;

  IF next_prompt LIKE '%Metal or Plastic Crowns / Tiaras (Gold, Silver, Rhinestone)**
%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.37: crown example still in TOY EXAMPLES';
  END IF;

  IF next_prompt NOT LIKE '%candle|toy|plastic_crown|cardstock%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.37: plastic_crown not in type enum';
  END IF;

  -- ---- Deploy ----
  UPDATE public.ai_prompts
  SET is_active = FALSE
  WHERE is_active = TRUE;

  IF EXISTS (SELECT 1 FROM public.ai_prompts WHERE version = '3.37') THEN
    UPDATE public.ai_prompts
    SET
      prompt_text = next_prompt,
      is_active = TRUE,
      description = 'v3.37 — Physical 3D crowns/tiaras classified as plastic_crown type (not toy). Prices mirror toy rules via plastic_crown pricing_rules.',
      updated_at = NOW()
    WHERE version = '3.37';
  ELSE
    INSERT INTO public.ai_prompts (version, prompt_text, is_active, description, updated_at)
    VALUES (
      '3.37',
      next_prompt,
      TRUE,
      'v3.37 — Physical 3D crowns/tiaras classified as plastic_crown type (not toy). Prices mirror toy rules via plastic_crown pricing_rules.',
      NOW()
    );
  END IF;
END $migration$;
