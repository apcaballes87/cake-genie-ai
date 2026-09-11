-- Activate v3.78 only after the compatible application type/schema release is live.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  target_prompt_count integer;
  v377_md5 constant text := '84cdb815fd837b37e37431cc75a550ac';
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count = 1 and active_prompt_version = '3.78' then
    if exists (
      select 1 from public.ai_prompts
      where is_active = true
        and version = '3.78'
        and position('PIPED ICING FLOWERS — GROUPED COVERAGE PRICING' in prompt_text) > 0
    ) then
      return;
    end if;
    raise exception 'Cannot activate v3.78: active v3.78 prompt is unexpected';
  end if;

  if active_prompt_count <> 1 or active_prompt_version <> '3.77' then
    raise exception 'Cannot activate v3.78: expected exactly one active v3.77 prompt, found count=% version=%', active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  if not exists (
    select 1 from public.ai_prompts
    where is_active = true and version = '3.77' and md5(prompt_text) = v377_md5
  ) then
    raise exception 'Cannot activate v3.78: active v3.77 prompt checksum is unexpected';
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.78'
    and position('PIPED ICING FLOWERS — GROUPED COVERAGE PRICING' in prompt_text) > 0
    and position('"piped_flowers_top"' in prompt_text) > 0
    and position('"piped_flowers_side"' in prompt_text) > 0;

  if target_prompt_count <> 1 then
    raise exception 'Cannot activate v3.78: expected exactly one valid staged v3.78 prompt, found %', target_prompt_count;
  end if;

  if (select count(*) from public.pricing_rules
      where is_active = true
        and merchant_id is null
        and item_key in (
          'piped_flowers_top_small', 'piped_flowers_top_medium', 'piped_flowers_top_large',
          'piped_flowers_side_small', 'piped_flowers_side_medium', 'piped_flowers_side_large'
        )
        and quantity_rule = 'fixed'
        and price in (50.00, 100.00, 150.00)) <> 6 then
    raise exception 'Cannot activate v3.78: expected six active global piped-flower pricing rules';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  update public.ai_prompts
  set is_active = true,
      updated_at = now()
  where version = '3.78'
    and position('PIPED ICING FLOWERS — GROUPED COVERAGE PRICING' in prompt_text) > 0;
end;
$migration$;

commit;
