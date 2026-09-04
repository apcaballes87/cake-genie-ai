-- Add a material-evidence gate before the existing cardstock surface-finish
-- criteria. This does not alter pricing or historical cache rows.

begin;

do $migration$
declare
  source_prompt_version text;
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  v369_md5 constant text := '0555b82678768fe6aab07a5810e87952';
  v370_md5 constant text := 'e5d69eeaac907ff5bec3079f5808c60d';
  v369_heading constant text := '**v3.69 Version - Flat 2D Composition Complexity Boundary**';
  v370_heading constant text := '**v3.70 Version - Cardstock Material Evidence Gate**';
begin
  select count(*) into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot deploy v3.70: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.70';

  if target_prompt_count > 0 then
    if target_prompt_count = 1
      and exists (
        select 1
        from public.ai_prompts
        where version = '3.70'
          and is_active = true
          and md5(prompt_text) = v370_md5
      ) then
      return;
    end if;
    raise exception 'Cannot deploy v3.70: an unexpected v3.70 prompt already exists';
  end if;

  select version::text, prompt_text into source_prompt_version, source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if source_prompt_version <> '3.69'
    or md5(source_prompt) <> v369_md5
    or position(v369_heading in source_prompt) = 0 then
    raise exception 'Cannot deploy v3.70: active prompt must be verified v3.69 (%), found version % md5 %', v369_md5, source_prompt_version, md5(source_prompt);
  end if;

  next_prompt := source_prompt;
  next_prompt := replace(next_prompt, v369_heading, v370_heading);
  next_prompt := replace(next_prompt,
    $old$   - solid non-printed glitter or metallic cardstock, plus acrylic or wooden
     toppers under their named fulfillment normalization -> material
     `cardstock` and type `cardstock`$old$,
    $new$   - visibly non-edible solid non-printed glitter or metallic cardstock, plus
     acrylic or wooden toppers under their named fulfillment normalization -> material
     `cardstock` and type `cardstock`$new$);
  next_prompt := replace(next_prompt,
    '| Solid glitter/metallic cardstock, acrylic, or wood | `cardstock` | `cardstock` | main topper | C2 |',
    '| Verified non-edible solid glitter/metallic cardstock, acrylic, or wood | `cardstock` | `cardstock` | main topper | C2 |');
  next_prompt := replace(next_prompt,
    $old$### Protocol 2: THE "EDGE" CHECK (Cardstock vs Photopaper)

- IF item has visible GLITTER, METALLIC finish, or foil → IT IS "cardstock" (only if single-color with NO graphics).
- IF an already-established separate flat paper piece shows CHARACTER IMAGES,
  GRAPHICS, or MULTI-COLOR printed designs → IT IS `printout`. The subject or
  colors alone do not establish that the item is flat paper.$old$,
    $new$### Protocol 2: THE "EDGE" CHECK (Cardstock vs Photopaper)

Apply this check only after the construction/material pipeline positively
establishes a separate non-edible rigid paper, acrylic, or wooden cutout.
Flatness, a support stick, gold color, glitter, metallic, or foil appearance
alone does not establish cardstock: fondant/gumpaste can use edible lustre dust,
edible glitter, metallic paint, airbrush, or leaf. If material remains
ambiguous, apply the 2-CUE MATERIAL RULE before choosing a type.

- IF that positively established non-edible cutout is solid single-color with
  visible GLITTER, METALLIC finish, or foil and NO graphics → IT IS `cardstock`.
- IF an already-established separate flat paper piece shows CHARACTER IMAGES,
  GRAPHICS, or MULTI-COLOR printed designs → IT IS `printout`. The subject or
  colors alone do not establish that the item is flat paper.$new$);
  next_prompt := replace(next_prompt,
    $old$#### Cardstock Glitter Toppers:

- SINGLE color toppers, with a message, usually "Happy Birthday *Name*". Sometimes its XXth.
- Texture is Glittery, metallic, or foil finish
- NO printed graphics, photos, or character images$old$,
    $new$#### Cardstock Glitter Toppers:

Apply this section only after positive evidence establishes a separate
non-edible rigid paper, acrylic, or wooden cutout. Do not infer cardstock from
flatness, a support stick, gold color, glitter, metallic, or foil appearance
alone; those finishes can also be edible fondant/gumpaste decoration.

- SINGLE color toppers, with a message, usually "Happy Birthday *Name*". Sometimes its XXth.
- Texture is Glittery, metallic, or foil finish
- NO printed graphics, photos, or character images$new$);
  next_prompt := replace(next_prompt,
    $old$Apply this rule only after the global construction pipeline establishes that
the item is a non-edible printed/cardstock piece or a rigid physical prop. It
does not override positive evidence of piped icing, edible fondant/gumpaste,
an edible printed sheet, candy, wax, or fabric. Apply Protocol 3 from Visual
Forensics within this established construction family.$old$,
    $new$Apply this rule only after the global construction pipeline establishes that
the item is a non-edible printed/cardstock piece or a rigid physical prop. A
flat, gold, glittery, metallic, or foil-looking item is not thereby non-edible:
fondant/gumpaste can have those finishes. It does not override positive evidence
of piped icing, edible fondant/gumpaste, an edible printed sheet, candy, wax,
or fabric. Apply Protocol 3 from Visual Forensics within this established
construction family.$new$);
  next_prompt := replace(next_prompt,
    $old$For ordinary paper/cardstock pieces, **ONLY classify as cardstock if ALL of
these are true:**

1. Solid SINGLE color (no multi-color)
2. Glitter, metallic, or foil finish
3. NO printed graphics, photos, or character images
4. NO multi-color text or gradients
5. Plain letters, numbers, or shapes ONLY
6. **NOT a Crown or Tiara (unless flat paper)**$old$,
    $new$For ordinary paper/cardstock pieces, **ONLY classify as cardstock if ALL of
these are true:**

0. Positive evidence establishes a separate non-edible rigid paper, acrylic,
   or wooden cutout, rather than fondant/gumpaste. A paper/card edge, rigid
   uniform sheet visibly separate from icing, acrylic transparency or laser-cut
   edge, or wood grain is such evidence. Glitter, metallic, foil, gold color,
   flatness, or a support stick alone is not.
1. Solid SINGLE color (no multi-color)
2. Glitter, metallic, or foil finish
3. NO printed graphics, photos, or character images
4. NO multi-color text or gradients
5. Plain letters, numbers, or shapes ONLY
6. **NOT a Crown or Tiara (unless flat paper)**

If the visible construction instead supports fondant/gumpaste, keep the item
in its compatible edible branch even when it is flat, gold, glittery, metallic,
or foil-looking: loose message letters are `gumpaste_letters`; readable
name/logo panels are `edible_logo_2d`; simple focal shapes use
`edible_2d_shapes`; detailed composed flat artwork uses `edible_2d_complex`.$new$);

  if md5(next_prompt) <> v370_md5
    or position(v370_heading in next_prompt) = 0
    or position(v369_heading in next_prompt) <> 0
    or position('Flatness, a support stick, gold color, glitter, metallic, or foil appearance' in next_prompt) = 0
    or position('fondant/gumpaste can use edible lustre dust' in next_prompt) = 0
    or position('0. Positive evidence establishes a separate non-edible rigid paper, acrylic,' in next_prompt) = 0 then
    raise exception 'Cannot deploy v3.70: cardstock material evidence gate did not produce the verified prompt';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.70',
    next_prompt,
    true,
    'v3.70 — Require positive non-edible construction evidence before using cardstock; retain valid glitter, metallic, acrylic, and wooden toppers.',
    now()
  );
end;
$migration$;

commit;
