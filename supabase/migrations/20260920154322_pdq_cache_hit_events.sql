-- Count accepted PDQ cache matches without mutating the analysis cache row.
-- One request may perform the same lookup more than once, so the request/cache
-- pair is the idempotency boundary for a hit event.

create table if not exists public.cakegenie_pdq_cache_hit_events (
  id uuid primary key default gen_random_uuid(),
  cache_id uuid not null references public.cakegenie_analysis_cache(id) on delete cascade,
  matched_p_hash text not null,
  incoming_pdq_hash text not null,
  pdq_quality integer not null,
  pdq_pipeline text not null,
  pdq_distance integer not null,
  source text not null default 'unknown',
  request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint cakegenie_pdq_cache_hit_events_incoming_hash_check
    check (incoming_pdq_hash ~ '^[0-9a-f]{64}$'),
  constraint cakegenie_pdq_cache_hit_events_quality_check
    check (pdq_quality between 50 and 100),
  constraint cakegenie_pdq_cache_hit_events_distance_check
    check (pdq_distance between 0 and 256),
  constraint cakegenie_pdq_cache_hit_events_source_check
    check (char_length(source) between 1 and 64),
  constraint cakegenie_pdq_cache_hit_events_request_cache_key
    unique (request_id, cache_id)
);

create index if not exists cakegenie_pdq_cache_hit_events_cache_idx
  on public.cakegenie_pdq_cache_hit_events (cache_id, created_at desc);

create index if not exists cakegenie_pdq_cache_hit_events_created_idx
  on public.cakegenie_pdq_cache_hit_events (created_at desc);

alter table public.cakegenie_pdq_cache_hit_events enable row level security;

-- The browser can record through the guarded RPC only; it cannot read or write
-- the ledger directly. Service-role access remains available for reporting.
revoke all on table public.cakegenie_pdq_cache_hit_events from public, anon, authenticated;
grant all on table public.cakegenie_pdq_cache_hit_events to service_role;

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
  on conflict (request_id, cache_id) do nothing;

  return true;
end;
$$;

revoke all on function public.record_pdq_cache_hit(uuid, text, integer, text, uuid, text)
  from public;
grant execute on function public.record_pdq_cache_hit(uuid, text, integer, text, uuid, text)
  to anon, authenticated, service_role;
