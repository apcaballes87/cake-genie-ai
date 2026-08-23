-- Migration: Deploy prompt v3.38 — Edible and Plastic Crown Types
-- Standalone fondant/gumpaste crowns are now `edible_crown`; physical crowns
-- remain `plastic_crown`.

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
    RAISE EXCEPTION 'Cannot create ai_prompts v3.38: no active source prompt found';
  END IF;

  next_prompt := source_prompt;

  next_prompt := replace(
    next_prompt,
    '**v3.37 Version - Plastic Crown as Separate Type**',
    '**v3.38 Version - Edible and Plastic Crown Types**'
  );

  next_prompt := replace(
    next_prompt,
    '- physical metal, rhinestone, or plastic crowns/tiaras -> `plastic_crown`, material
  `plastic`',
    '- physical metal, rhinestone, or plastic crowns/tiaras -> `plastic_crown`, material
  `plastic`
- standalone molded, rolled, cut, or hand-sculpted fondant/gumpaste crowns/tiaras ->
  `edible_crown`, material `edible_fondant`'
  );

  next_prompt := replace(
    next_prompt,
    '| Rigid factory-molded physical prop | `toy` | `plastic` | main topper | toy-specific table |',
    '| Rigid factory-molded physical prop | `toy` | `plastic` | main topper | toy-specific table |
| Standalone molded/cut fondant or gumpaste crown or tiara | `edible_crown` | `edible_fondant` | main topper | C1 |'
  );

  next_prompt := replace(
    next_prompt,
    '- **IF item is a CROWN or TIARA (metal, rhinestone, pearls, plastic) with physical 3D structure → IT IS "toy" (Plastic/Metal).**',
    '- **IF item is a CROWN or TIARA (metal, rhinestone, pearls, or plastic) with physical 3D structure → IT IS `plastic_crown` (material `plastic`).**
- **IF a standalone crown or tiara is visibly made from fondant/gumpaste with handmade edible cues → IT IS `edible_crown` (material `edible_fondant`).**'
  );

  next_prompt := replace(
    next_prompt,
    '- IF positive handmade edible cues are present, inspect physical depth: detailed',
    '- If positive handmade edible cues are present on a non-crown item, inspect physical depth: detailed'
  );

  next_prompt := replace(
    next_prompt,
    '### C1. EDIBLE 3D FIGURES — edible_3d_complex, edible_3d_ordinary',
    '### C1. EDIBLE 3D FIGURES — edible_3d_complex, edible_3d_ordinary, edible_crown'
  );

  next_prompt := replace(
    next_prompt,
    '→ Edible 3D figure? Measure HEIGHT and use C1',
    '→ Edible 3D figure or `edible_crown`? Measure HEIGHT and use C1'
  );

  next_prompt := replace(
    next_prompt,
    '#### CROWNS & TIARAS (type: "plastic_crown", material: "plastic") — NEW RULE',
    '#### CROWNS & TIARAS — MATERIAL-SPECIFIC TYPES'
  );
  next_prompt := replace(
    next_prompt,
    '**ALWAYS classify physical 3D Crowns and Tiaras as "plastic_crown".**',
    '**ALWAYS classify a standalone 3D crown or tiara by its visible construction and material.**'
  );
  next_prompt := replace(
    next_prompt,
    '- Includes: Rhinestone tiaras, Gold metal crowns, Pearl crowns, Plastic princess tiaras.',
    '- Physical 3D crowns and tiaras made from metal, rhinestones, pearls, or plastic → `plastic_crown`, material `plastic`.
- Molded, rolled, cut, or hand-sculpted fondant/gumpaste crowns and tiaras → `edible_crown`, material `edible_fondant`.
- Includes: rhinestone tiaras, gold metal crowns, pearl crowns, plastic princess tiaras, and fondant/gumpaste crowns.'
  );
  next_prompt := replace(
    next_prompt,
    '- **DO NOT** classify these as "cardstock" even if they are gold/metallic.',
    '- **DO NOT** classify physical crowns as `cardstock` even if they are gold/metallic.'
  );
  next_prompt := replace(
    next_prompt,
    '- **DO NOT** classify these as "edible_3d_ordinary" unless they are clearly made of soft fondant.',
    '- **DO NOT** classify standalone edible crowns as `edible_3d_ordinary` or `edible_3d_complex`; use `edible_crown`.'
  );
  next_prompt := replace(
    next_prompt,
    '- **DO NOT** classify these as "toy". Crowns and tiaras are always `plastic_crown`, never `toy`.',
    '- A crown worn by or attached to a larger character/animal is an accessory detail of that figure. Keep the larger figure''s appropriate type unless the crown is also a distinct separately modeled topper.'
  );
  next_prompt := replace(
    next_prompt,
    '- **EXCEPTION:** Only classify as "cardstock" if it is visibly a flat glitter paper cutout.',
    '- **EXCEPTION:** Only classify a crown as `cardstock` if it is visibly a flat glitter paper cutout.'
  );

  next_prompt := replace(
    next_prompt,
    '"type": "candle|toy|plastic_crown|cardstock|edible_photo_top|edible_logo_2d|edible_2d_complex|printout|',
    '"type": "candle|toy|plastic_crown|edible_crown|cardstock|edible_photo_top|edible_logo_2d|edible_2d_complex|printout|'
  );

  next_prompt := replace(
    next_prompt,
    '**Gold Rhinestone Tiara on top → `toy`, `hero` (physical 3D prop)**
- **Plastic Crown → `toy`, `hero`**',
    '**Gold Rhinestone Tiara on top → `plastic_crown`, `hero` (physical 3D prop)**
- **Plastic Crown → `plastic_crown`, `hero`**
- **Standalone fondant crown → `edible_crown`, `hero`**'
  );

  next_prompt := replace(
    next_prompt,
    '✅ **CROWNS & TIARAS: Metal/Plastic/Rhinestone = plastic_crown**',
    '✅ **CROWNS & TIARAS: Metal/Plastic/Rhinestone = plastic_crown; fondant/gumpaste = edible_crown**'
  );
  next_prompt := replace(
    next_prompt,
    '5. **CROWNS/TIARAS:** Classify physical 3D crowns as **plastic_crown**, never cardstock, never toy.',
    '5. **CROWNS/TIARAS:** Classify physical 3D crowns as **plastic_crown** and standalone edible fondant/gumpaste crowns as **edible_crown**; flat paper crowns are **cardstock**.'
  );

  IF next_prompt NOT LIKE '%edible_crown%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.38: edible_crown was not introduced into the prompt';
  END IF;

  IF next_prompt LIKE '%with physical 3D structure → IT IS "toy"%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.38: crown protocol still points to toy';
  END IF;

  IF next_prompt LIKE '%CROWNS & TIARAS (type: "plastic_crown"%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.38: crown section header was not updated';
  END IF;

  IF next_prompt NOT LIKE '%candle|toy|plastic_crown|edible_crown|cardstock%' THEN
    RAISE EXCEPTION 'Cannot create ai_prompts v3.38: edible_crown not in type enum';
  END IF;

  UPDATE public.ai_prompts
  SET is_active = FALSE
  WHERE is_active = TRUE;

  IF EXISTS (SELECT 1 FROM public.ai_prompts WHERE version = '3.38') THEN
    UPDATE public.ai_prompts
    SET
      prompt_text = next_prompt,
      is_active = TRUE,
      description = 'v3.38 — Standalone fondant/gumpaste crowns use edible_crown; physical crowns use plastic_crown.',
      updated_at = NOW()
    WHERE version = '3.38';
  ELSE
    INSERT INTO public.ai_prompts (version, prompt_text, is_active, description, updated_at)
    VALUES (
      '3.38',
      next_prompt,
      TRUE,
      'v3.38 — Standalone fondant/gumpaste crowns use edible_crown; physical crowns use plastic_crown.',
      NOW()
    );
  END IF;
END $migration$;
