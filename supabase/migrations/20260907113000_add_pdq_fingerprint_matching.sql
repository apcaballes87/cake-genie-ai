-- Additive Facebook ThreatExchange PDQ storage and matching.
-- Legacy p_hash remains the stable cache identity and is intentionally untouched.

alter table public.cakegenie_analysis_cache
  add column if not exists pdq_hash text,
  add column if not exists pdq_quality integer,
  add column if not exists pdq_pipeline text,
  add column if not exists pdq_status text not null default 'pending',
  add column if not exists pdq_error text,
  add column if not exists pdq_computed_at timestamptz;

alter table public.cakegenie_analysis_cache
  drop constraint if exists cakegenie_analysis_cache_pdq_hash_format_check,
  drop constraint if exists cakegenie_analysis_cache_pdq_quality_range_check,
  drop constraint if exists cakegenie_analysis_cache_pdq_status_check;

alter table public.cakegenie_analysis_cache
  add constraint cakegenie_analysis_cache_pdq_hash_format_check
    check (pdq_hash is null or pdq_hash ~ '^[0-9a-f]{64}$'),
  add constraint cakegenie_analysis_cache_pdq_quality_range_check
    check (pdq_quality is null or pdq_quality between 0 and 100),
  add constraint cakegenie_analysis_cache_pdq_status_check
    check (pdq_status in ('pending', 'ready', 'low_quality', 'missing_source', 'failed'));

create index if not exists cakegenie_analysis_cache_pdq_ready_lookup_idx
  on public.cakegenie_analysis_cache (pdq_pipeline, pdq_hash)
  where pdq_status = 'ready' and pdq_hash is not null and pdq_quality >= 50;

alter table public.cakegenie_rejected_uploads
  add column if not exists pdq_hash text,
  add column if not exists pdq_quality integer,
  add column if not exists pdq_pipeline text,
  add column if not exists pdq_status text,
  add column if not exists pdq_error text,
  add column if not exists pdq_computed_at timestamptz;

alter table public.cakegenie_search_analysis_batch_items
  add column if not exists pdq_hash text,
  add column if not exists pdq_quality integer,
  add column if not exists pdq_pipeline text;

create or replace function public.pdq_hamming_distance(left_hash text, right_hash text)
returns integer
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  left_bytes bytea;
  right_bytes bytea;
begin
  if left_hash !~ '^[0-9a-f]{64}$' or right_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'PDQ hashes must be lowercase 64-character hexadecimal strings';
  end if;

  left_bytes := decode(left_hash, 'hex');
  right_bytes := decode(right_hash, 'hex');

  return (
    select count(*)::integer
    from generate_series(0, 255) as bit_index
    where get_bit(left_bytes, bit_index) <> get_bit(right_bytes, bit_index)
  );
end;
$$;

create or replace function public.find_similar_analysis_by_pdq(
  new_hash text,
  new_quality integer,
  new_pipeline text,
  max_distance integer default 35,
  min_quality integer default 50
)
returns setof public.cakegenie_analysis_cache
language plpgsql
stable
set search_path = public
as $$
declare
  bounded_distance integer := least(greatest(coalesce(max_distance, 35), 0), 256);
  bounded_quality integer := greatest(coalesce(min_quality, 50), 50);
begin
  if new_hash is null
     or new_hash !~ '^[0-9a-f]{64}$'
     or new_quality is null
     or new_quality < bounded_quality
     or new_quality > 100
     or new_pipeline is null
     or btrim(new_pipeline) = '' then
    return;
  end if;

  return query
  select c.*
  from public.cakegenie_analysis_cache c
  where c.pdq_status = 'ready'
    and c.pdq_hash is not null
    and c.pdq_hash ~ '^[0-9a-f]{64}$'
    and c.pdq_quality is not null
    and c.pdq_quality >= bounded_quality
    and c.pdq_pipeline = new_pipeline
    and public.pdq_hamming_distance(c.pdq_hash, new_hash) <= bounded_distance
  order by public.pdq_hamming_distance(c.pdq_hash, new_hash) asc,
           c.created_at desc nulls last,
           c.id asc
  limit 1;
end;
$$;

-- Restore the verified pre-recent-upload pHash tolerance for legacy callers.
create or replace function public.find_similar_analysis(new_hash text)
returns setof public.cakegenie_analysis_cache
language plpgsql
as $$
begin
  if new_hash is null or new_hash !~* '^[0-9a-f]{16}$' then
    return;
  end if;

  return query
  select c.*
  from public.cakegenie_analysis_cache c
  where c.p_hash is not null
    and c.p_hash ~* '^[0-9a-f]{16}$'
    and c.fingerprint_pipeline is not null
    and public.hamming_distance(c.p_hash, lower(new_hash)) between 0 and 1
  order by public.hamming_distance(c.p_hash, lower(new_hash)) asc
  limit 1;
end;
$$;

create or replace function public.find_similar_analysis_by_fingerprint(
  new_hash text default null,
  new_pipeline text default null,
  legacy_hashes text[] default '{}'
)
returns setof public.cakegenie_analysis_cache
language plpgsql
stable
as $$
begin
  if new_hash is not null then
    new_hash := lower(new_hash);
    if new_hash !~* '^[0-9a-f]{16}$' then
      new_hash := null;
      new_pipeline := null;
    end if;
  end if;

  if new_hash is null or new_pipeline is null then
    return;
  end if;

  return query
  select c.*
  from public.cakegenie_analysis_cache c
  where c.p_hash is not null
    and c.p_hash ~* '^[0-9a-f]{16}$'
    and c.fingerprint_pipeline = new_pipeline
    and public.hamming_distance(c.p_hash, new_hash) between 0 and 1
  order by public.hamming_distance(c.p_hash, new_hash) asc, c.created_at desc
  limit 1;
end;
$$;
