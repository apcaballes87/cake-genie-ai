-- Apply only after the compatible verifier release is deployed and validated.
begin;

do $migration$
declare
  active_count integer;
  target_count integer;
  v388_md5 constant text := 'c4afb9b84576b1c37501e9a56fd379f6';
  v389_md5 constant text := '7522fb1ba49ee59513d3cefddba8444c';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*) into active_count
  from public.ai_prompts
  where is_active = true;
  if active_count <> 1 then
    raise exception 'Cannot activate v3.89: expected exactly one active prompt, found %', active_count;
  end if;

  if not exists (
    select 1
    from public.ai_prompts
    where version = '3.88'
      and is_active = true
      and md5(prompt_text) = v388_md5
  ) then
    raise exception 'Cannot activate v3.89: verified v3.88 must still be active';
  end if;

  select count(*) into target_count
  from public.ai_prompts
  where version = '3.89'
    and is_active = false
    and md5(prompt_text) = v389_md5;
  if target_count <> 1 then
    raise exception 'Cannot activate v3.89: expected one verified inactive v3.89 target, found %', target_count;
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  update public.ai_prompts
  set is_active = true
  where version = '3.89'
    and is_active = false
    and md5(prompt_text) = v389_md5;

  select count(*) into active_count
  from public.ai_prompts
  where is_active = true
    and version = '3.89'
    and md5(prompt_text) = v389_md5;
  if active_count <> 1 or (select count(*) from public.ai_prompts where is_active = true) <> 1 then
    raise exception 'Cannot activate v3.89: active-prompt invariant failed';
  end if;
end;
$migration$;

commit;
