-- Activate v3.93 only after the compatible application release is live.
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

  if active_prompt_count = 1 and active_prompt_version = '3.93' then
    if exists (
      select 1 from public.ai_prompts
      where version = '3.93' and is_active = true
        and prompt_text like '%### PIPED BOTANICAL TREATMENT — CONSTRUCTION AND GEOMETRY SCOPE (BINDING)%'
        and prompt_text like '%geometry_scope: "unit"%'
        and prompt_text like '%coverage band is authoritative for the fixed cluster price%'
        and prompt_text not like '%Do not create one box covering the entire repeated arrangement unless%'
    ) then
      return;
    end if;
    raise exception 'Cannot activate v3.93: active prompt has unexpected content';
  end if;

  if active_prompt_count <> 1 or active_prompt_version <> '3.92' then
    raise exception 'Cannot activate v3.93: expected exactly one active v3.92 prompt, found count=% version=%', active_prompt_count, coalesce(active_prompt_version, '<none>');
  end if;

  select count(*) into target_prompt_count
  from public.ai_prompts
  where version = '3.93'
    and is_active = false
    and prompt_text like '%### PIPED BOTANICAL TREATMENT — CONSTRUCTION AND GEOMETRY SCOPE (BINDING)%'
    and prompt_text like '%geometry_scope: "unit"%'
    and prompt_text like '%coverage band is authoritative for the fixed cluster price%'
    and prompt_text not like '%Do not create one box covering the entire repeated arrangement unless%';

  if target_prompt_count <> 1 then
    raise exception 'Cannot activate v3.93: expected one staged scope-contract prompt, found %', target_prompt_count;
  end if;

  update public.ai_prompts
  set is_active = false, updated_at = now()
  where is_active = true;

  update public.ai_prompts
  set is_active = true, updated_at = now()
  where version = '3.93' and is_active = false
    and prompt_text like '%### PIPED BOTANICAL TREATMENT — CONSTRUCTION AND GEOMETRY SCOPE (BINDING)%';
end;
$migration$;

commit;
