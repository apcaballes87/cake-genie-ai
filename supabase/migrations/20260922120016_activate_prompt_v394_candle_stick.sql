-- Activate v3.94 only after the compatible application release is available.
-- Historical prompt rows and analysis caches are not modified.
begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  target_prompt_count integer;
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count = 1 and active_prompt_version = '3.94' then
    if exists (
      select 1 from public.ai_prompts
      where version = '3.94'
        and is_active = true
        and prompt_text like '%### CANDLE AND CANDLE STICK CLASSIFICATION%'
        and prompt_text like '%`candle_stick`%'
        and prompt_text like '%candle_stick|candle|toy%'
    ) then
      return;
    end if;
    raise exception 'Cannot activate v3.94: active prompt has unexpected content';
  end if;

  if active_prompt_count <> 1 or active_prompt_version <> '3.92' then
    raise exception 'Cannot activate v3.94: expected exactly one active v3.92 prompt, found count=% version=%', active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.94'
    and is_active = false
    and prompt_text like '%### CANDLE AND CANDLE STICK CLASSIFICATION%'
    and prompt_text like '%`candle_stick`%'
    and prompt_text like '%candle_stick|candle|toy%';

  if target_prompt_count <> 1 then
    raise exception 'Cannot activate v3.94: expected one staged candle-split prompt, found %', target_prompt_count;
  end if;

  update public.ai_prompts
  set is_active = false, updated_at = now()
  where is_active = true;

  update public.ai_prompts
  set is_active = true, updated_at = now()
  where version = '3.94'
    and is_active = false
    and prompt_text like '%### CANDLE AND CANDLE STICK CLASSIFICATION%';
end;
$migration$;

commit;
