-- Deploy prompt v3.61. Price a verified wafer-paper wave by the number of
-- directly visible wave-covered tiers, never the cake's total tier count.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.60 Version - Direct Wafer-Sheet and Copy Reconciliation**';
  new_heading constant text := '**v3.61 Version - Wave-Covered Tier Quantity**';
  old_wave_quantity_block constant text := $anchor$`conditioned_waferpaper_vertical_wave_side_wrap`. These are bakery
fulfillment/pricing units, not a count of every visible ripple or sheet edge:
- 1 Tier -> quantity `1`
- 2 Tier -> quantity `3`
- 3 Tier -> quantity `4`$anchor$;
  new_wave_quantity_block constant text := $anchor$`conditioned_waferpaper_vertical_wave_side_wrap`. Determine the number of
visibly wave-covered tiers from direct image evidence before setting
`quantity`. Count only distinct cake tiers that visibly bear the verified
conditioned wafer-paper wave; never use the cake's total tier count and never
infer hidden coverage.

Map covered-tier count to bakery fulfillment quantity:
- 1 covered tier -> quantity `1`
- 2 covered tiers -> quantity `3`
- 3 covered tiers -> quantity `4`

A 2 Tier or 3 Tier cake with waves on only one tier MUST use quantity `1`,
whether the covered tier is top, middle, or bottom. These are fulfillment
units, not a count of every visible ripple or sheet edge.$anchor$;
  old_common_support_row constant text := $anchor$| `edible_photo_side_wave` | waferpaper | Conditioned unprinted wafer-paper strips shaped into loose upright waves around a cake side. Always large. Quantity is 1 for 1 Tier, 3 for 2 Tier, and 4 for 3 Tier bakery fulfillment/pricing units; do not count individual ripples. |$anchor$;
  new_common_support_row constant text := $anchor$| `edible_photo_side_wave` | waferpaper | Conditioned unprinted wafer-paper strips shaped into loose upright waves around a cake side. Always large. Determine quantity from the number of directly visible cake tiers bearing the verified wave—not the cake's total tier count: 1 covered tier -> 1, 2 -> 3, 3 -> 4. A 2 Tier or 3 Tier cake with waves on one tier uses 1. Do not count individual ripples or infer hidden coverage. |$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.61: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.61';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.61'
        and is_active = true
        and md5(prompt_text) = '534c740b503f0ed052092bd19f650f98'
    ) then
      raise exception 'Cannot record ai_prompts v3.61: an unexpected v3.61 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> '2138fbe4b74fefe239280a1f226c24cf' then
    raise exception 'Cannot create ai_prompts v3.61: active prompt does not match the v3.60 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_wave_quantity_block in source_prompt) = 0
    or position(old_common_support_row in source_prompt) = 0 then
    raise exception 'Cannot create ai_prompts v3.61: expected v3.60 wave-quantity anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_wave_quantity_block, new_wave_quantity_block);
  next_prompt := replace(next_prompt, old_common_support_row, new_common_support_row);

  if position(new_heading in next_prompt) = 0
    or position('visibly wave-covered tiers from direct image evidence' in next_prompt) = 0
    or position('A 2 Tier or 3 Tier cake with waves on only one tier MUST use quantity `1`' in next_prompt) = 0
    or position('bearing the verified wave—not the cake''s total tier count' in next_prompt) = 0
    or md5(next_prompt) <> '534c740b503f0ed052092bd19f650f98' then
    raise exception 'Cannot create ai_prompts v3.61: wave-covered tier quantity rule was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.61',
    next_prompt,
    true,
    'v3.61 — Set verified wafer-wave quantity from directly visible wave-covered tiers.',
    now()
  );
end;
$migration$;

commit;
