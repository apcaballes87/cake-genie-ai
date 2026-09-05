-- Apply only after the compatible delayed-SEO application release is live.
-- Keep this separate from staging so rollout can be stopped safely before activation.
begin;

do $$
declare
  active_prompt_count integer;
  active_prompt_version text;
begin
  select count(*), min(version)
  into active_prompt_count, active_prompt_version
  from public.ai_prompts
  where is_active = true;

  if active_prompt_count <> 1 or active_prompt_version <> '3.72' then
    raise exception
      'Cannot activate ai_prompts v3.73: expected exactly one active v3.72 prompt, found count=% version=%',
      active_prompt_count,
      coalesce(active_prompt_version, '<none>');
  end if;

  if not exists (
    select 1
    from public.ai_prompts
    where version = '3.73'
      and prompt_text like '%v3.73 Version - Analysis Only; Deferred Product Copy%'
  ) then
    raise exception 'Cannot activate ai_prompts v3.73: staged analysis-only prompt was not found';
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  update public.ai_prompts
  set is_active = true,
      updated_at = now()
  where version = '3.73';
end
$$;

commit;
