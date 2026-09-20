-- Make the existing cache usage_count the canonical visible PDQ hit counter.
-- Existing ledger events were recorded before this behavior was added, so
-- reconcile them once before future RPC calls increment the field atomically.

update public.cakegenie_analysis_cache as cache_row
set usage_count = cache_row.usage_count + hit_counts.hit_count
from (
  select cache_id, count(*)::integer as hit_count
  from public.cakegenie_pdq_cache_hit_events
  group by cache_id
) as hit_counts
where cache_row.id = hit_counts.cache_id;

create or replace function public.record_pdq_cache_hit(
  p_cache_id uuid,
  p_incoming_pdq_hash text,
  p_pdq_quality integer,
  p_pdq_pipeline text,
  p_request_id uuid,
  p_source text default 'unknown'
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  matched_cache public.cakegenie_analysis_cache%rowtype;
  normalized_incoming_hash text;
  normalized_source text;
  matched_distance integer;
  recorded_event_id uuid;
begin
  normalized_incoming_hash := lower(btrim(p_incoming_pdq_hash));
  normalized_source := left(coalesce(nullif(btrim(p_source), ''), 'unknown'), 64);

  if p_cache_id is null
     or p_request_id is null
     or normalized_incoming_hash !~ '^[0-9a-f]{64}$'
     or p_pdq_quality is null
     or p_pdq_quality < 50
     or p_pdq_quality > 100
     or p_pdq_pipeline is null
     or btrim(p_pdq_pipeline) = '' then
    return false;
  end if;

  select *
  into matched_cache
  from public.cakegenie_analysis_cache
  where id = p_cache_id;

  if not found
     or matched_cache.pdq_status <> 'ready'
     or matched_cache.pdq_hash is null
     or matched_cache.pdq_hash !~ '^[0-9a-f]{64}$'
     or matched_cache.pdq_quality is null
     or matched_cache.pdq_quality < 50
     or matched_cache.pdq_pipeline <> btrim(p_pdq_pipeline)
     or matched_cache.analysis_json is null
     or coalesce(matched_cache.analysis_json ->> '__studio_edit_placeholder', 'false') = 'true' then
    return false;
  end if;

  matched_distance := public.pdq_hamming_distance(matched_cache.pdq_hash, normalized_incoming_hash);
  if matched_distance > 35 then
    return false;
  end if;

  insert into public.cakegenie_pdq_cache_hit_events (
    cache_id,
    matched_p_hash,
    incoming_pdq_hash,
    pdq_quality,
    pdq_pipeline,
    pdq_distance,
    source,
    request_id
  ) values (
    matched_cache.id,
    matched_cache.p_hash,
    normalized_incoming_hash,
    p_pdq_quality,
    matched_cache.pdq_pipeline,
    matched_distance,
    normalized_source,
    p_request_id
  )
  on conflict (request_id, cache_id) do nothing
  returning id into recorded_event_id;

  if recorded_event_id is not null then
    update public.cakegenie_analysis_cache
    set usage_count = usage_count + 1
    where id = matched_cache.id;
  end if;

  return true;
end;
$$;

revoke all on function public.record_pdq_cache_hit(uuid, text, integer, text, uuid, text)
  from public;
grant execute on function public.record_pdq_cache_hit(uuid, text, integer, text, uuid, text)
  to anon, authenticated, service_role;
