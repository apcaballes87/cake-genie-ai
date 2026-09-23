-- Stage v3.96 from the exact active v3.95 prompt. Insert one inactive
-- prompt version only; leave v3.95 active and do not touch cache or pricing.
begin;

do $migration$
declare
  active_count integer;
  active_version text;
  active_md5 text;
  source_prompt text;
  staged_prompt text;
  existing_count integer;
  existing_md5 text;
  v395_md5 constant text := 'd53fd769dcd1e258c04c5f9beec3be29';
  v396_md5 constant text := 'afc7a90e525fcc74fa7c018f6d47d1ea';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*), min(version), min(md5(prompt_text))
    into active_count, active_version, active_md5
  from public.ai_prompts
  where is_active = true and merchant_id is null;

  if active_count <> 1 or active_version <> '3.95' or active_md5 <> v395_md5 then
    raise exception 'Cannot stage v3.96: expected one active global v3.95 prompt with checksum %, found count=% version=% checksum=%',
      v395_md5, active_count, coalesce(active_version, '<none>'), coalesce(active_md5, '<none>');
  end if;

  select prompt_text into strict source_prompt
  from public.ai_prompts
  where version = '3.95' and is_active = true and merchant_id is null;

  staged_prompt := source_prompt;

  if position($old_mermaid$Use `edible_3d_complex` only for a complete freestanding sculpted mermaid
character or figure with visible all-around body depth and recognizable
character anatomy such as a face, head, torso, arms, hair, clothing,
expression, or pose.$old_mermaid$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: mermaid character precedence anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_mermaid$Use `edible_3d_complex` only for a complete freestanding sculpted mermaid
character or figure with visible all-around body depth and recognizable
character anatomy such as a face, head, torso, arms, hair, clothing,
expression, or pose.$old_mermaid$,
    $new_mermaid$A complete handmade edible mermaid character or figure with modeled 3D anatomy
and recognizable detail follows the binding character-figure override below;
it need not stand unsupported or expose all-around depth when attached to a
cake. An isolated tail without a complete character body remains
`edible_3d_ordinary`.$new_mermaid$);

  if position($old_title$**v3.95 Version - One-Color Object and Flat-Flower Gates**$old_title$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: v3.95 title anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_title$**v3.95 Version - One-Color Object and Flat-Flower Gates**$old_title$,
    $new_title$**v3.96 Version - Side-Positioned Edible Character Figures**$new_title$);

  if position($old_changelog$### CHANGELOG
$old_changelog$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: changelog anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_changelog$### CHANGELOG
$old_changelog$,
    $new_changelog$### CHANGELOG
- Detailed handmade edible character figures with modeled 3D anatomy are `edible_3d_complex` in `main_toppers` regardless of tier attachment or position; flat artwork, toys, and ceramic-look figures retain their existing precedence.
$new_changelog$);

  if position($old_matrix$| Freestanding detailed edible figure | `edible_3d_complex` | `edible_fondant` | main topper under the freestanding figure rule | representative `direct diameter-relative size` |$old_matrix$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: canonical family matrix anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_matrix$| Freestanding detailed edible figure | `edible_3d_complex` | `edible_fondant` | main topper under the freestanding figure rule | representative `direct diameter-relative size` |$old_matrix$,
    $new_matrix$| Detailed handmade edible character figure regardless of tier attachment, or another freestanding detailed edible figure | `edible_3d_complex` | `edible_fondant` | main topper under the character override / freestanding figure rule | representative `direct diameter-relative size` |$new_matrix$);

  if position($old_output$6. Only a genuinely freestanding hand-sculpted figure or object with visible
   all-around body depth may use `edible_3d_complex`.$old_output$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: OUTPUT ORDER step 6 anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_output$6. Only a genuinely freestanding hand-sculpted figure or object with visible
   all-around body depth may use `edible_3d_complex`.$old_output$,
    $new_output$6. A detailed, separate handmade edible human or fictional character figure
   with visibly modeled 3D anatomy is `edible_3d_complex` even when the cake
   supports or partly obscures it. Emit it in `main_toppers` regardless of
   placement, under the binding character-figure rule. Other figures and
   non-character objects require freestanding construction with visible
   all-around body depth to use `edible_3d_complex`.$new_output$);

  if position($old_definition$Classify as `edible_3d_complex` only when the item is a genuinely freestanding
hand-sculpted figure or object with visible all-around body depth AND
recognizable character, animal, human, anatomical, expression, clothing, or
pose complexity. Supporting cues include:$old_definition$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: complex-type definition anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_definition$Classify as `edible_3d_complex` only when the item is a genuinely freestanding
hand-sculpted figure or object with visible all-around body depth AND
recognizable character, animal, human, anatomical, expression, clothing, or
pose complexity. Supporting cues include:$old_definition$,
    $new_definition$For animals and non-character objects, use `edible_3d_complex` only when the
item is a genuinely freestanding hand-sculpted figure or object with visible
all-around body depth AND modeled anatomical or construction complexity.
Detailed handmade edible human or fictional character figures follow the
binding override below; they need not stand unsupported or expose every side.
Supporting cues include:$new_definition$);

  if position($old_rule_anchor$#### ONE-COLOR NON-CHARACTER OBJECT GATE (BINDING)
$old_rule_anchor$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: character-rule insertion anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_rule_anchor$#### ONE-COLOR NON-CHARACTER OBJECT GATE (BINDING)
$old_rule_anchor$,
    $character_rule$#### HANDMADE EDIBLE CHARACTER FIGURE OVERRIDE (BINDING)

This character-specific rule overrides generic requirements elsewhere for a
figure to be freestanding or to show all-around body depth, and overrides any
role or position wording that would place a qualifying figure in
`support_elements`.

When direct image evidence shows a separately identifiable, handmade edible
fondant/gumpaste human or fictional character figure with visible modeled 3D
body volume, recognizable anatomy (such as a head and torso with one or more
modeled limbs), and character detail (such as a recognizable likeness, costume,
mask, modeled expression, hair/accessories, or an animated pose), classify it
as `edible_3d_complex`, material `edible_fondant`, in `main_toppers` with
`classification: "hero"`. A complete back surface need not be visible when the
figure is attached to or supported by the cake.

Position never changes this classification. A qualifying figure remains one
`edible_3d_complex` main topper whether it is on the top, front, side, rear,
or board, or is attached to, leaning against, crawling on, climbing, sitting
against, or partly obscured by a cake tier. Never classify a qualifying
character figure as an ordinary support because of its position, pose, tier
contact, or secondary visual prominence. For example, fully modeled fondant
Spider-Man figures crawling on or sitting against a tier are each
`edible_3d_complex` rows in `main_toppers`.

This rule does not apply to a printed, painted, piped, thin cutout, plaque,
flat-backed illustration, or shallow-relief character image; use its
appropriate 2D type. A simple molded icon or face without recognizable
character anatomy remains ordinary. Preserve construction/material precedence:
rigid manufactured characters remain `toy` with material `plastic`, and
glazed ceramic-look breakable figures remain `figurine` with material
`ceramic`. Do not infer hidden figure anatomy or edible construction from
theme, text, or image alone.

#### ONE-COLOR NON-CHARACTER OBJECT GATE (BINDING)
$character_rule$);

  if position($old_garment$complete freestanding human/character figure with recognizable anatomy such
as a head, torso, arms, legs, face, or pose.$old_garment$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: standalone-garment guard anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_garment$complete freestanding human/character figure with recognizable anatomy such
as a head, torso, arms, legs, face, or pose.$old_garment$,
    $new_garment$complete modeled human/character figure with recognizable anatomy such as a
head, torso, arms, legs, face, or pose, including a figure supported by or
attached to the cake; apply the binding character-figure override.$new_garment$);

  if position($old_color_gate$This gate does not downgrade a genuinely complete freestanding human or animal
figure with visible all-around depth and modeled anatomy. Those figure rules
remain governed by their positive anatomy, expression, clothing, and pose
evidence; color alone neither promotes nor downgrades them.$old_color_gate$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: one-color figure carveout anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_color_gate$This gate does not downgrade a genuinely complete freestanding human or animal
figure with visible all-around depth and modeled anatomy. Those figure rules
remain governed by their positive anatomy, expression, clothing, and pose
evidence; color alone neither promotes nor downgrades them.$old_color_gate$,
    $new_color_gate$This gate does not downgrade a genuinely complete freestanding animal figure
with visible all-around depth and modeled anatomy, or a handmade edible human
or fictional character figure that meets the binding override above. Judge a
character figure from its visible modeled anatomy, identity, clothing,
expression, and pose; color alone neither promotes nor downgrades it.$new_color_gate$);

  if position($old_placement$place a qualifying freestanding animal, person, character, or complete
animal-head figurine in `support_elements` because of its size or position.$old_placement$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: figure-placement anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_placement$place a qualifying freestanding animal, person, character, or complete
animal-head figurine in `support_elements` because of its size or position.$old_placement$,
    $new_placement$place a qualifying freestanding animal or a qualifying handmade edible human
or fictional character figure in `support_elements` because of its size or
position. Attached character figures follow the binding character-figure
override above.$new_placement$);

  if position($old_whole_head$- Only use `edible_3d_complex` for a separate physical sculpted 3D animal/character topper or figurine sitting on the cake.$old_whole_head$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: whole-head cake guard anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_whole_head$- Only use `edible_3d_complex` for a separate physical sculpted 3D animal/character topper or figurine sitting on the cake.$old_whole_head$,
    $new_whole_head$- Only use `edible_3d_complex` for a separate physical sculpted 3D animal/character figure; the whole cake body is not a topper. Handmade edible human/fictional character figures follow the binding character-figure override whether the tier supports them or not.$new_whole_head$);

  if position($old_example$- Freestanding Disney/cartoon character sculptures made from fondant$old_example$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: complex-character example anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_example$- Freestanding Disney/cartoon character sculptures made from fondant$old_example$,
    $new_example$- Freestanding Disney/cartoon character sculptures made from fondant
- Fully modeled handmade edible characters crawling on, climbing, or sitting against a tier, such as Spider-Man, with visible anatomy and costume detail$new_example$);

  if position($old_example2$- Freestanding character figurines with expressions$old_example2$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: character-figure example anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_example2$- Freestanding character figurines with expressions$old_example2$,
    $new_example2$- Freestanding character figurines with expressions
- A detailed handmade edible character figure attached to the front or side of a tier, with visible modeled anatomy and costume detail$new_example2$);

  if position($old_multiple$3. **CLASSIFY based on depth and complexity** - Use edible_3d_complex only for
   freestanding figures with all-around body depth and recognizable
   character/anatomical complexity beyond a simple molded face$old_multiple$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: multiple-figure rule anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_multiple$3. **CLASSIFY based on depth and complexity** - Use edible_3d_complex only for
   freestanding figures with all-around body depth and recognizable
   character/anatomical complexity beyond a simple molded face$old_multiple$,
    $new_multiple$3. **CLASSIFY based on depth and complexity** - Use the binding character-
   figure override for detailed handmade edible characters, including attached
   figures; other figures require freestanding all-around depth and modeled
   complexity beyond a simple molded face$new_multiple$);

  if position($old_checklist$✅ **Freestanding complex 3D figures with all-around depth = edible_3d_complex**$old_checklist$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: final-checklist anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_checklist$✅ **Freestanding complex 3D figures with all-around depth = edible_3d_complex**$old_checklist$,
    $new_checklist$✅ **Detailed handmade edible character figures with modeled 3D anatomy, including tier-attached figures, = edible_3d_complex in main_toppers**
✅ **Other complex edible figures/objects require freestanding all-around depth**$new_checklist$);

  if position($old_reminder$- Freestanding recognizable animals/characters with all-around body depth plus modeled anatomy, expression, clothing, or pose complexity → **edible_3d_complex**$old_reminder$ in staged_prompt) = 0 then
    raise exception 'Cannot stage v3.96: critical-reminder anchor is missing';
  end if;
  staged_prompt := replace(staged_prompt,
    $old_reminder$- Freestanding recognizable animals/characters with all-around body depth plus modeled anatomy, expression, clothing, or pose complexity → **edible_3d_complex**$old_reminder$,
    $new_reminder$- Detailed handmade edible human/fictional character figures with modeled 3D anatomy and character detail, including figures attached to or supported by a tier → **edible_3d_complex** in `main_toppers`, regardless of position
    - Other qualifying animals/figures/objects require freestanding all-around depth plus modeled complexity$new_reminder$);

  if md5(staged_prompt) <> v396_md5 then
    raise exception 'Cannot stage v3.96: assembled prompt checksum is unexpected; expected %, received %',
      v396_md5, md5(staged_prompt);
  end if;

  select count(*), min(md5(prompt_text))
    into existing_count, existing_md5
  from public.ai_prompts
  where version = '3.96' and merchant_id is null;

  if existing_count > 1 then
    raise exception 'Cannot stage v3.96: multiple global rows already use version 3.96';
  elsif existing_count = 1 then
    if exists (
      select 1 from public.ai_prompts
      where version = '3.96' and merchant_id is null
        and is_active = false and md5(prompt_text) = v396_md5
    ) then
      return;
    end if;
    raise exception 'Cannot stage v3.96: existing target row is active or differs from the generated prompt';
  end if;

  insert into public.ai_prompts (
    version, prompt_text, is_active, description, created_at, updated_at, merchant_id
  ) values (
    '3.96', staged_prompt, false,
    'Detailed handmade edible character figures remain complex main toppers regardless of tier attachment or position.',
    now(), now(), null
  );
end;
$migration$;

commit;
