-- Apply only after the compatible v3.91 source release is deployed and validated.
begin;

do $migration$
declare
  active_count integer;
  target_count integer;
  v390_md5 constant text := 'ac7f65da35135d3d4e42e90b7c82e655';
  v391_md5 constant text := 'fede0545b650c86737631e714bd918ee';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*) into active_count
  from public.ai_prompts
  where is_active = true;
  if active_count <> 1 then
    raise exception 'Cannot activate v3.91: expected exactly one active prompt, found %', active_count;
  end if;

  if not exists (
    select 1
    from public.ai_prompts
    where version = '3.90'
      and is_active = true
      and md5(prompt_text) = v390_md5
  ) then
    raise exception 'Cannot activate v3.91: verified v3.90 must still be active';
  end if;

  select count(*) into target_count
  from public.ai_prompts
  where version = '3.91'
    and is_active = false
    and md5(prompt_text) = v391_md5;
  if target_count <> 1 then
    raise exception 'Cannot activate v3.91: expected one verified inactive v3.91 target, found %', target_count;
  end if;

  update public.ai_prompts
  set is_active = false
  where is_active = true;

  update public.ai_prompts
  set is_active = true
  where version = '3.91'
    and is_active = false
    and md5(prompt_text) = v391_md5;

  select count(*) into active_count
  from public.ai_prompts
  where is_active = true
    and version = '3.91'
    and md5(prompt_text) = v391_md5;
  if active_count <> 1 or (select count(*) from public.ai_prompts where is_active = true) <> 1 then
    raise exception 'Cannot activate v3.91: active-prompt invariant failed';
  end if;
end;
$migration$;

commit;
