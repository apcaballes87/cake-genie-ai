-- PENDING EXPLICIT ACCEPTANCE: this file lives outside supabase/migrations so
-- routine migration deployment cannot apply it. Do not apply it until the v3.92
-- staged checksum, fallback parity, build, and approved fixture inference pass.
-- It deliberately does not touch historical analysis caches or pricing rules.

begin;

do $migration$
declare
  active_prompt_count integer;
  active_prompt_version text;
  staged_prompt_count integer;
  v391_md5 constant text := '388e050b2c43655b289bcbe9aa7fc125';
  v392_md5 constant text := '6ff4cfe33b293eddc5861db4eccec7f8';
begin
  select count(*), min(version::text)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count = 1 and active_prompt_version = '3.92' then
    if exists (
      select 1 from public.ai_prompts
      where is_active = true and version = '3.92' and md5(prompt_text) = v392_md5
    ) then
      return;
    end if;
    raise exception 'Cannot activate v3.92: active v3.92 prompt has an unexpected checksum';
  end if;

  if active_prompt_count <> 1 or active_prompt_version <> '3.91' then
    raise exception 'Cannot activate v3.92: expected exactly one active v3.91 prompt, found count=% version=%', active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  if not exists (
    select 1 from public.ai_prompts
    where is_active = true and version = '3.91' and md5(prompt_text) = v391_md5
  ) then
    raise exception 'Cannot activate v3.92: active v3.91 prompt checksum is unexpected';
  end if;

  select count(*) into staged_prompt_count
  from public.ai_prompts
  where version = '3.92' and is_active = false and md5(prompt_text) = v392_md5;

  if staged_prompt_count <> 1 then
    raise exception 'Cannot activate v3.92: expected exactly one checksum-matched inactive v3.92 prompt, found %', staged_prompt_count;
  end if;

  update public.ai_prompts
  set is_active = false,
      updated_at = now()
  where is_active = true;

  update public.ai_prompts
  set is_active = true,
      updated_at = now()
  where version = '3.92'
    and md5(prompt_text) = v392_md5;

  if (select count(*) from public.ai_prompts where is_active = true) <> 1
    or not exists (
      select 1 from public.ai_prompts
      where is_active = true and version = '3.92' and md5(prompt_text) = v392_md5
    ) then
    raise exception 'Cannot activate v3.92: post-activation active-prompt invariant failed';
  end if;
end;
$migration$;

commit;
