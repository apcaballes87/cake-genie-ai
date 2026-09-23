-- Activate only the verified staged v3.96 character-placement prompt.
-- Preserve v3.95 as an immutable inactive row and do not touch cache/pricing.
begin;

do $migration$
declare
  active_count integer;
  active_version text;
  active_md5 text;
  staged_count integer;
  activated_count integer;
  v395_md5 constant text := 'd53fd769dcd1e258c04c5f9beec3be29';
  v396_md5 constant text := 'afc7a90e525fcc74fa7c018f6d47d1ea';
begin
  lock table public.ai_prompts in share row exclusive mode;

  select count(*), min(version::text), min(md5(prompt_text))
    into active_count, active_version, active_md5
  from public.ai_prompts
  where is_active = true;

  if active_count = 1 and active_version = '3.96' then
    if active_md5 = v396_md5 and exists (
      select 1 from public.ai_prompts
      where version = '3.96' and merchant_id is null and is_active = true
        and md5(prompt_text) = v396_md5
    ) then
      return;
    end if;
    raise exception 'Cannot activate v3.96: active v3.96 prompt checksum or scope is unexpected';
  end if;

  if active_count <> 1 or active_version <> '3.95' or active_md5 <> v395_md5 then
    raise exception 'Cannot activate v3.96: expected one active v3.95 prompt with checksum %, found count=% version=% checksum=%',
      v395_md5, active_count, coalesce(active_version, '<none>'), coalesce(active_md5, '<none>');
  end if;

  select count(*) into staged_count
  from public.ai_prompts
  where version = '3.96' and merchant_id is null and is_active = false
    and md5(prompt_text) = v396_md5;

  if staged_count <> 1 then
    raise exception 'Cannot activate v3.96: expected exactly one inactive staged v3.96 row with checksum %, found %',
      v396_md5, staged_count;
  end if;

  update public.ai_prompts
  set is_active = false, updated_at = now()
  where is_active = true;

  update public.ai_prompts
  set is_active = true, updated_at = now()
  where version = '3.96' and merchant_id is null and is_active = false
    and md5(prompt_text) = v396_md5;
  get diagnostics activated_count = row_count;

  if activated_count <> 1 then
    raise exception 'Cannot activate v3.96: expected to activate one staged row, updated %', activated_count;
  end if;
end;
$migration$;

commit;
