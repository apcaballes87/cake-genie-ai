-- Apply only after the compatible application release is deployed and validated.
begin;

do $migration$
declare
  active_count integer;
  target_count integer;
  sized_rule_count integer;
  v386_md5 constant text := '64542a47d0e7f19b51db22a6209ed0e4';
  v388_md5 constant text := 'c4afb9b84576b1c37501e9a56fd379f6';
  genie_merchant_id constant uuid := 'd29d384c-3265-4d96-9637-86888a8f649d';
begin
  lock table public.ai_prompts in share row exclusive mode;
  lock table public.pricing_rules in share row exclusive mode;

  select count(*) into active_count from public.ai_prompts where is_active = true;
  if active_count <> 1 then
    raise exception 'Cannot activate v3.88: expected exactly one active prompt, found %', active_count;
  end if;

  if not exists (
    select 1
    from public.ai_prompts
    where version = '3.86'
      and is_active = true
      and md5(prompt_text) = v386_md5
  ) then
    raise exception 'Cannot activate v3.88: verified v3.86 must still be active';
  end if;

  select count(*) into target_count
  from public.ai_prompts
  where version = '3.88'
    and is_active = false
    and md5(prompt_text) = v388_md5;
  if target_count <> 1 then
    raise exception 'Cannot activate v3.88: expected one verified inactive v3.88 target, found %', target_count;
  end if;

  select count(*) into sized_rule_count
  from public.pricing_rules
  where item_key in (
      'edible_flowers_filler_small',
      'edible_flowers_filler_medium',
      'edible_flowers_filler_large'
    )
    and item_type = 'edible_flowers_filler'
    and classification = 'support'
    and size in ('small', 'medium', 'large')
    and price = 5
    and category = 'support_element'
    and quantity_rule = 'per_piece'
    and merchant_id = genie_merchant_id
    and is_active = true;
  if sized_rule_count <> 3 then
    raise exception 'Cannot activate v3.88: expected three active ₱5 sized filler rules, found %', sized_rule_count;
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  update public.ai_prompts
  set is_active = true
  where version = '3.88'
    and is_active = false
    and md5(prompt_text) = v388_md5;

  select count(*) into active_count
  from public.ai_prompts
  where is_active = true
    and version = '3.88'
    and md5(prompt_text) = v388_md5;
  if active_count <> 1 or (select count(*) from public.ai_prompts where is_active = true) <> 1 then
    raise exception 'Cannot activate v3.88: active-prompt invariant failed';
  end if;
end;
$migration$;

commit;
