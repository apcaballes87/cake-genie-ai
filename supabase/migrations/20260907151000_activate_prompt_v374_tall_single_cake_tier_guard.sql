-- Activate only after the compatible application release is live. This is
-- intentionally separate from staging so prompt activation remains explicit.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  target_prompt_count integer;
  v373_md5 constant text := '723880c54943a81680941dd32edbb5d2';
  v374_md5 constant text := 'a9129171141ce260312f10ff52b353fa';
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count = 1 and active_prompt_version = '3.74' then
    if exists (
      select 1
      from public.ai_prompts
      where is_active = true
        and version = '3.74'
        and md5(prompt_text) = v374_md5
    ) then
      return;
    end if;
    raise exception 'Cannot activate v3.74: active v3.74 prompt has an unexpected checksum';
  end if;

  if active_prompt_count <> 1
    or active_prompt_version <> '3.73' then
    raise exception 'Cannot activate v3.74: expected exactly one active v3.73 prompt, found count=% version=%', active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  if exists (
    select 1
    from public.ai_prompts
    where is_active = true
      and version = '3.73'
      and md5(prompt_text) <> v373_md5
  ) then
    raise exception 'Cannot activate v3.74: active v3.73 prompt checksum is unexpected';
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.74'
    and md5(prompt_text) = v374_md5;

  if target_prompt_count <> 1 then
    raise exception 'Cannot activate v3.74: expected exactly one staged v3.74 prompt, found %', target_prompt_count;
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  update public.ai_prompts
  set is_active = true,
      updated_at = now()
  where version = '3.74'
    and md5(prompt_text) = v374_md5;
end;
$migration$;

commit;
