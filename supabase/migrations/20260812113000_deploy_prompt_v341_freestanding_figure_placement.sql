begin;

do $$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  placement_anchor constant text := $anchor$- a freestanding unicorn head set with horn, two ears, and two eyes, or a
  freestanding bunny head set with ears, eyes, and mouth; treat each coordinated
  head set as one item$anchor$;
  placement_override constant text := $rule$

#### FREESTANDING FIGURE PLACEMENT OVERRIDE (REQUIRED)

After confirming a qualifying `edible_3d_complex` figure, emit it as one
`main_toppers` row with `classification: "hero"`. `edible_3d_complex` is a
main-topper-only generated type.

This applies even when the figure is small, placed at the front, side, or base
of the cake, partly behind another decoration, or visually secondary. Do NOT
place a qualifying freestanding animal, person, character, or complete
animal-head figurine in `support_elements` because of its size or position.

For example, a small fondant elephant, zebra, or giraffe-head figurine with a
modeled face, ears or horns, neck/body, limbs, or other recognizable anatomy is
one `edible_3d_complex` hero in `main_toppers` when it has visible all-around
depth. It remains a separately priced figure even when arranged along the
lower cake edge.

Use `edible_3d_ordinary` in `support_elements` for figure-like decorations
only when they are simple molded non-character forms or simple animal/icon
forms without detailed sculpted anatomy. Do not use a description alone to
promote an item; the visible construction is authoritative.$rule$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.41: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true;

  if md5(source_prompt) <> '844e56ce2c003ef828be7068e6fe1b60' then
    raise exception 'Cannot create ai_prompts v3.41: active prompt does not match the v3.40 baseline';
  end if;

  if exists (select 1 from public.ai_prompts where version = '3.41') then
    raise exception 'Cannot create ai_prompts v3.41: version 3.41 already exists';
  end if;

  if position(placement_anchor in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.41: freestanding-figure anchor not found';
  end if;

  if (length(source_prompt) - length(replace(source_prompt, placement_anchor, '')))
    / length(placement_anchor) <> 1 then
    raise exception 'Cannot create ai_prompts v3.41: freestanding-figure anchor is not unique';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.40 Version - Number-Shaped Cakes Are Rectangles**',
    '**v3.41 Version - Number-Shaped Cakes and Freestanding Figures**'
  );

  if next_prompt = source_prompt then
    raise exception 'Cannot create ai_prompts v3.41: version header was not replaced';
  end if;

  next_prompt := replace(
    next_prompt,
    placement_anchor,
    placement_anchor || placement_override
  );

  if position('#### FREESTANDING FIGURE PLACEMENT OVERRIDE (REQUIRED)' in next_prompt) = 0
    or position('one `edible_3d_complex` hero in `main_toppers`' in next_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.41: figure-placement wording was not inserted';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.41',
    next_prompt,
    true,
    'v3.41 — Qualifying small, side, and base freestanding edible figures are paid edible_3d_complex main toppers, not support elements.',
    now()
  );
end;
$$;

commit;
