begin;

do $$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  flower_type_anchor constant text := $anchor$Do NOT classify fondant/gumpaste flowers as `edible_3d_ordinary`, even when
they are simple, molded, small, gold-painted, or low-detail.$anchor$;
  flower_counting_rule constant text := $rule$### FLOWER PIECE COUNTING AND SIZE PRECEDENCE (BOTH MAIN AND SUPPORT — REQUIRED)

This rule applies to every `edible_flowers` item in both `main_toppers` and
`support_elements`. Apply it after flower type and material are established and
before hero/support placement, sizing, quantity, or generic grouping.

A bouquet, cluster, spray, or arrangement describes placement only. It is not
one flower and must never be used as the quantity unit. Count each clearly
visible bloom or flower head as one physical flower piece, including blooms
that touch or overlap. Count only visible blooms; do not infer fully hidden
flowers.

Size every visible bloom independently by bloom-face diameter using C3. Group
only flowers with the same flower identity, type, material, size, color, and
appearance, then set `quantity` to the visible piece count. Different sizes or
appearances require separate rows. Never output multiple visible blooms as one
`edible_flowers` cluster, bouquet, spray, or arrangement with `quantity: 1`,
and do not use `subtype: "flower_cluster"` as a substitute for the individual
flower count.

Example:
- a top arrangement with three large pink peonies and one medium pink peony ->
  two `main_toppers` rows: one `edible_flowers`, material `edible_fondant`,
  size `large`, quantity `3`; and one `edible_flowers`, material
  `edible_fondant`, size `medium`, quantity `1`

This flower-specific rule does not change intentionally grouped non-flower
support rules. Tiny/xsmall scattered or repeated sugar pearls, sugar beads,
pearl beads, and nonpareils remain one `sprinkles` support row with
`material: "candy"` and `quantity: 1` under their existing precedence rule.$rule$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.45: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.45';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.45'
        and is_active = true
        and md5(prompt_text) = 'c5b2386049bb9fa59f6651aa5ff7e6b2'
    ) then
      raise exception 'Cannot record ai_prompts v3.45: an unexpected v3.45 row already exists';
    end if;
    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> 'de59ce5203cddbf29332c45809c58839' then
    raise exception 'Cannot create ai_prompts v3.45: active prompt does not match the v3.44 baseline';
  end if;

  if position('**v3.44 Version - Primary Object Description-to-Type Consistency**' in source_prompt) = 0
    or position(flower_type_anchor in source_prompt) = 0
    or position('TINY SUGAR PEARLS / BEADS / NONPAREILS — `sprinkles` PRECEDENCE (REQUIRED)' in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.45: expected v3.44 flower/sprinkle anchors were not found';
  end if;

  next_prompt := replace(
    source_prompt,
    '**v3.44 Version - Primary Object Description-to-Type Consistency**',
    '**v3.45 Version - Individual Flower Piece Counting**'
  );
  next_prompt := replace(
    next_prompt,
    flower_type_anchor,
    flower_type_anchor || E'\n\n' || flower_counting_rule
  );

  if position('**v3.45 Version - Individual Flower Piece Counting**' in next_prompt) = 0
    or position('FLOWER PIECE COUNTING AND SIZE PRECEDENCE (BOTH MAIN AND SUPPORT — REQUIRED)' in next_prompt) = 0
    or position('three large pink peonies and one medium pink peony' in next_prompt) = 0
    or position('do not use `subtype: "flower_cluster"` as a substitute' in next_prompt) = 0
    or position('Tiny/xsmall scattered or repeated sugar pearls, sugar beads,' in next_prompt) = 0
    or md5(next_prompt) <> 'c5b2386049bb9fa59f6651aa5ff7e6b2' then
    raise exception 'Cannot create ai_prompts v3.45: flower-counting rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.45',
    next_prompt,
    true,
    'v3.45 — Count and independently size every visible flower piece across main and support roles; never collapse a multi-bloom arrangement to quantity one.',
    now()
  );
end;
$$;

commit;
