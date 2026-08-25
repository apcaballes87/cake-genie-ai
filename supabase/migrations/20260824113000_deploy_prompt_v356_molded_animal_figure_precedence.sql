-- Deploy prompt v3.56. Prevent freestanding molded animal figures from being
-- downgraded to ordinary support elements because of molded wording or board-side placement.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.55 Version - Evidence-Gated Wafer Waves, Intricate Flowers, and Output Reconciliation**';
  new_heading constant text := '**v3.56 Version - Freestanding Molded Animal Figure Precedence**';
  old_animal_tail constant text := $anchor$For example, a small fondant elephant, zebra, or giraffe-head figurine with a
modeled face, ears or horns, neck/body, limbs, or other recognizable anatomy is
one `edible_3d_complex` hero in `main_toppers` when it has visible all-around
depth. It remains a separately priced figure even when arranged along the
lower cake edge.

Use `edible_3d_ordinary` in `support_elements` for figure-like decorations
only when they are simple molded non-character forms or simple animal/icon
forms with flat-stamped faces and no modeled expression. Do not use a description alone to
promote an item; the visible construction is authoritative.$anchor$;
  new_animal_tail constant text := $anchor$For example, a small fondant elephant, zebra, or giraffe-head figurine with a
modeled face, ears or horns, neck/body, limbs, or other recognizable anatomy is
one `edible_3d_complex` hero in `main_toppers` when it has visible all-around
depth. It remains a separately priced figure even when arranged along the
lower cake edge.

#### MOLDED ANIMAL FIGURE HARD RULE (REQUIRED)

The word `molded` alone never makes a volumetric animal ordinary. Any cake-member
fondant or gumpaste animal with visible all-around depth and modeled anatomy—such
as a head, face, ears, horns, trunk, neck, body, limbs, feet, tail, or pose—MUST
be `edible_3d_complex` in `main_toppers` with `classification: "hero"`, even when
it is small or medium, rests on the cake board, or stands beside the cake tier.
Treat "beside the cake" as placement only when the figure is visibly resting on
the cake board as part of the design. Emit each non-identical animal as its own
main-topper row with `quantity: 1` and its independently sized figure type.

Use `edible_3d_ordinary` for an animal-shaped decoration only when it is a flat,
shallow, stamped, or simple icon-like form with no modeled anatomy or expression.
Do not downgrade a freestanding animal figure to ordinary or support because its
description says "molded," because it is beside the tier, or because it is not
the central top figure.

Use `edible_3d_ordinary` in `support_elements` for figure-like decorations
only when they are simple molded non-character forms or simple animal/icon
forms with flat-stamped faces and no modeled expression. Do not use a description alone to
promote an item; the visible construction is authoritative.$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.56: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.56';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.56'
        and is_active = true
        and md5(prompt_text) = 'fa54f0f373a0bc6e6ec79096e45322bf'
    ) then
      raise exception 'Cannot record ai_prompts v3.56: an unexpected v3.56 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '60078bd99205397259224b6f933fc3b6' then
    raise exception 'Cannot create ai_prompts v3.56: active prompt does not match the v3.55 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_animal_tail in source_prompt) = 0
    or position('MOLDED ANIMAL FIGURE HARD RULE' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.56: expected v3.55 animal-classification anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_animal_tail, new_animal_tail);

  if position(new_heading in next_prompt) = 0
    or position('The word `molded` alone never makes a volumetric animal ordinary.' in next_prompt) = 0
    or position('rests on the cake board, or stands beside the cake tier.' in next_prompt) = 0
    or md5(next_prompt) <> 'fa54f0f373a0bc6e6ec79096e45322bf' then
    raise exception 'Cannot create ai_prompts v3.56: molded animal figure precedence was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.56',
    next_prompt,
    true,
    'v3.56 — Prevent freestanding molded animal figures from being downgraded by wording or board-side placement.',
    now()
  );
end;
$migration$;

commit;
