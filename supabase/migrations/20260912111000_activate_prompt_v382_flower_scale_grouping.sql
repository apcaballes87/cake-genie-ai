-- Activate only the verified v3.82 flower scale-grouping prompt after the
-- compatible application release has deployed.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  v381_md5 constant text := 'fa06f26eb0eac43e4dfe7aa314c56a3c';
  v382_md5 constant text := 'b7ef36a5e817946699cf875f3e2e96f4';
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count = 1 and active_prompt_version = '3.82' then
    if exists (
      select 1 from public.ai_prompts
      where version = '3.82' and is_active = true and md5(prompt_text) = v382_md5
    ) then
      return;
    end if;
    raise exception 'Cannot activate v3.82: active v3.82 prompt checksum is unexpected';
  end if;

  if active_prompt_count <> 1 or active_prompt_version <> '3.81' then
    raise exception 'Cannot activate v3.82: expected exactly one active v3.81 prompt, found count=% version=%',
      active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  if not exists (
    select 1 from public.ai_prompts
    where version = '3.81' and is_active = true and md5(prompt_text) = v381_md5
  ) then
    raise exception 'Cannot activate v3.82: active v3.81 prompt checksum is unexpected';
  end if;

  if not exists (
    select 1 from public.ai_prompts
    where version = '3.82' and is_active = false and md5(prompt_text) = v382_md5
  ) then
    raise exception 'Cannot activate v3.82: staged v3.82 prompt checksum is unexpected';
  end if;

  update public.ai_prompts set is_active = false where is_active = true;
  update public.ai_prompts
  set is_active = true, updated_at = now()
  where version = '3.82' and md5(prompt_text) = v382_md5;
end;
$migration$;

commit;
