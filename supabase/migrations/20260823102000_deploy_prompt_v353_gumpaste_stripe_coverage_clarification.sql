-- Deploy prompt v3.53. Count only confirmed separate fondant/gumpaste strips
-- when sizing repeated side stripes; do not include the underlying icing base.

begin;

do $migration$
declare
  source_prompt text;
  next_prompt text;
  active_prompt_count integer;
  target_prompt_count integer;
  old_heading constant text := '**v3.52 Version - Repeated Gumpaste Side Stripes**';
  new_heading constant text := '**v3.53 Version - Gumpaste Stripe Coverage Clarification**';
  old_stripe_rule constant text := $anchor$### REPEATED VERTICAL GUMPASTE SIDE STRIPES

When separate opaque fondant/gumpaste vertical strips or bands repeat around a
cake side, emit one collective `gumpaste_panel` support row for the complete
stripe treatment—not one row per strip.

Use `material: "edible_fondant"`, `quantity: 1`, and size it by the combined
coverage of the tier side: `small` <40%, `medium` 40% to <80%, `large` ≥80%.
Do not classify visibly separate fondant/gumpaste strips as plain icing color.
Continuous piped, painted, or airbrushed stripes remain icing, not a
`gumpaste_panel`.$anchor$;
  new_stripe_rule constant text := $anchor$### REPEATED VERTICAL GUMPASTE SIDE STRIPES

When separate opaque fondant/gumpaste vertical strips or bands repeat around a
cake side, emit one collective `gumpaste_panel` support row for the complete
stripe treatment—not one row per strip.

Use `material: "edible_fondant"`, `quantity: 1`, and size it by the combined
coverage of the tier side: `small` <40%, `medium` 40% to <80%, `large` ≥80%.
Count coverage only from the confirmed separate fondant/gumpaste strips; never
include the icing base, underlying frosting, or merely alternate background
colors. Color contrast alone does not establish a physical panel.
Do not classify visibly separate fondant/gumpaste strips as plain icing color.
Continuous piped, painted, or airbrushed stripes remain icing, not a
`gumpaste_panel`.$anchor$;
begin
  select count(*)
  into active_prompt_count
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 then
    raise exception 'Cannot create ai_prompts v3.53: expected exactly one active prompt, found %', active_prompt_count;
  end if;

  select count(*)
  into target_prompt_count
  from public.ai_prompts
  where version = '3.53';

  if target_prompt_count > 0 then
    if target_prompt_count <> 1 or not exists (
      select 1
      from public.ai_prompts
      where version = '3.53'
        and is_active = true
        and md5(prompt_text) = '0c875ad5d112682a9bd93bcf7edf99cf'
    ) then
      raise exception 'Cannot record ai_prompts v3.53: an unexpected v3.53 row already exists';
    end if;

    return;
  end if;

  select prompt_text
  into source_prompt
  from public.ai_prompts
  where is_active = true
  for update;

  if md5(source_prompt) <> 'a54fb8a8359fcd6a0147c7ccc5161b25' then
    raise exception 'Cannot create ai_prompts v3.53: active prompt does not match the v3.52 baseline';
  end if;

  if position(old_heading in source_prompt) = 0
    or position(old_stripe_rule in source_prompt) = 0
    or position('Count coverage only from the confirmed separate fondant/gumpaste strips' in source_prompt) <> 0 then
    raise exception 'Cannot create ai_prompts v3.53: expected v3.52 stripe anchors were not found';
  end if;

  next_prompt := replace(source_prompt, old_heading, new_heading);
  next_prompt := replace(next_prompt, old_stripe_rule, new_stripe_rule);

  if position('Count coverage only from the confirmed separate fondant/gumpaste strips' in next_prompt) = 0
    or position('Color contrast alone does not establish a physical panel.' in next_prompt) = 0
    or md5(next_prompt) <> '0c875ad5d112682a9bd93bcf7edf99cf' then
    raise exception 'Cannot create ai_prompts v3.53: gumpaste stripe coverage clarification was not applied cleanly';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  insert into public.ai_prompts (version, prompt_text, is_active, description, updated_at)
  values (
    '3.53',
    next_prompt,
    true,
    'v3.53 — Size repeated fondant/gumpaste side stripes from confirmed strips only, excluding the icing base.',
    now()
  );
end;
$migration$;

commit;
