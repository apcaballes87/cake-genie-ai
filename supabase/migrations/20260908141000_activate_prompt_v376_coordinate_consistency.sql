-- Activate v3.76 only after the compatible application release is live.
-- This is intentionally separate from staging so prompt activation remains explicit.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  target_prompt_count integer;
  v375_md5 constant text := '01e4f5bc6268af25e31a903f9117585b';
  v376_md5 constant text := 'a8a54c8a30ea629283bd2d9f161a05c7';
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count = 1 and active_prompt_version = '3.76' then
    if exists (
      select 1
      from public.ai_prompts
      where is_active = true
        and version = '3.76'
        and md5(prompt_text) = v376_md5
    ) then
      return;
    end if;
    raise exception 'Cannot activate v3.76: active v3.76 prompt has an unexpected checksum';
  end if;

  if active_prompt_count <> 1
    or active_prompt_version <> '3.75' then
    raise exception 'Cannot activate v3.76: expected exactly one active v3.75 prompt, found count=% version=%', active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  if exists (
    select 1
    from public.ai_prompts
    where is_active = true
      and version = '3.75'
      and md5(prompt_text) <> v375_md5
  ) then
    raise exception 'Cannot activate v3.76: active v3.75 prompt checksum is unexpected';
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.76';

  if target_prompt_count <> 1 then
    raise exception 'Cannot activate v3.76: expected exactly one staged v3.76 prompt, found %', target_prompt_count;
  end if;

  if not exists (
    select 1
    from public.ai_prompts
    where version = '3.76'
      and md5(prompt_text) = v376_md5
  ) then
    raise exception 'Cannot activate v3.76: staged v3.76 prompt checksum is unexpected';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  update public.ai_prompts
  set is_active = true,
      updated_at = now()
  where version = '3.76'
    and md5(prompt_text) = v376_md5;
end;
$migration$;

commit;
