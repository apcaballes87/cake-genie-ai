-- Activate only the verified staged v3.81 prompt.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  v379_md5 constant text := '46c8c1a10be208eeb3d7fa1166140922';
  v381_md5 constant text := 'fa06f26eb0eac43e4dfe7aa314c56a3c';
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count = 1 and active_prompt_version = '3.81' then
    if exists (
      select 1 from public.ai_prompts
      where version = '3.81' and is_active = true and md5(prompt_text) = v381_md5
    ) then
      return;
    end if;
    raise exception 'Cannot activate v3.81: active v3.81 prompt checksum is unexpected';
  end if;

  if active_prompt_count <> 1 or active_prompt_version <> '3.79' then
    raise exception 'Cannot activate v3.81: expected exactly one active v3.79 prompt, found count=% version=%',
      active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  if not exists (
    select 1 from public.ai_prompts
    where version = '3.79' and is_active = true and md5(prompt_text) = v379_md5
  ) then
    raise exception 'Cannot activate v3.81: active v3.79 prompt checksum is unexpected';
  end if;

  if not exists (
    select 1 from public.ai_prompts
    where version = '3.81' and is_active = false and md5(prompt_text) = v381_md5
  ) then
    raise exception 'Cannot activate v3.81: staged v3.81 prompt checksum is unexpected';
  end if;

  update public.ai_prompts set is_active = false where is_active = true;
  update public.ai_prompts
  set is_active = true, updated_at = now()
  where version = '3.81' and md5(prompt_text) = v381_md5;
end;
$migration$;

commit;
