-- Keep the analysis-cache rerun write scoped to analysis_json without
-- invoking SEO, search-vector, Studio, or webhook side effects.
--
-- The internal flag is transaction-local and is set only by the
-- service_role-only SECURITY DEFINER RPC below. Normal writes do not set it.

create or replace function public.cakegenie_prepare_seo_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_revision text;
begin
  if TG_OP = 'UPDATE'
     and current_setting('genie.analysis_json_only', true) = 'on' then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW.seo_status := 'pending'; NEW.seo_published_at := NULL;
    NEW.analysis_ready_at := NULL; NEW.seo_analysis_revision := NULL;
    NEW.seo_title := NULL; NEW.seo_description := NULL; NEW.alt_text := NULL;
  else
    if coalesce(auth.role(),'') in ('anon','authenticated') then
      NEW.seo_status := OLD.seo_status; NEW.seo_published_at := OLD.seo_published_at;
      NEW.seo_title := OLD.seo_title; NEW.seo_description := OLD.seo_description; NEW.alt_text := OLD.alt_text;
    end if;
    NEW.analysis_ready_at := OLD.analysis_ready_at;
    if OLD.seo_status = 'published' then NEW.slug := OLD.slug; end if;
  end if;
  v_revision := public.cakegenie_seo_revision(NEW.analysis_json);
  NEW.seo_analysis_revision := v_revision;
  if nullif(NEW.analysis_json->>'cakeType','') is not null
    and coalesce(NEW.analysis_json->>'__studio_edit_placeholder','false') <> 'true'
    and coalesce(NEW.analysis_json #>> '{rejection,isRejected}','false') <> 'true' then
    NEW.analysis_ready_at := coalesce(NEW.analysis_ready_at,now());
    if TG_OP = 'UPDATE' and OLD.seo_status <> 'published' and OLD.seo_analysis_revision is distinct from v_revision then
      NEW.seo_status := 'pending'; NEW.seo_published_at := NULL;
      NEW.seo_title := NULL; NEW.seo_description := NULL; NEW.alt_text := NULL;
    end if;
  else
    NEW.seo_status := 'pending'; NEW.seo_published_at := NULL;
  end if;
  return NEW;
end $$;

create or replace function public.update_cake_search_vector()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE'
     and current_setting('genie.analysis_json_only', true) = 'on' then
    return NEW;
  end if;

  NEW.search_vector := build_cake_search_vector(NEW.keywords, NEW.alt_text, NEW.slug, NEW.analysis_json);
  NEW.searchable_text := build_searchable_text(NEW.keywords, NEW.alt_text, NEW.slug, NEW.analysis_json);
  NEW.icing_colors := public.extract_icing_colors(NEW.analysis_json);
  return NEW;
end $$;

create or replace function public.cakegenie_enqueue_seo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE'
     and current_setting('genie.analysis_json_only', true) = 'on' then
    return NEW;
  end if;

  if NEW.seo_status = 'published' then return NEW; end if;
  update public.cakegenie_seo_batch_jobs set status='superseded', updated_at=now()
    where cache_id=NEW.id and analysis_revision is distinct from NEW.seo_analysis_revision
      and status in ('pending','retryable','submitted');
  if NEW.analysis_ready_at is not null
    and nullif(NEW.analysis_json->>'cakeType','') is not null
    and coalesce(NEW.analysis_json->>'__studio_edit_placeholder','false') <> 'true'
    and coalesce(NEW.analysis_json #>> '{rejection,isRejected}','false') <> 'true' then
    insert into public.cakegenie_seo_batch_jobs(cache_id,analysis_revision,analysis_json,availability,keywords,tags,slug,eligible_at)
      values(NEW.id, NEW.seo_analysis_revision, NEW.analysis_json, NEW.availability, NEW.keywords,
        to_jsonb(NEW.tags), NEW.slug, NEW.analysis_ready_at + interval '48 hours')
      on conflict(cache_id,analysis_revision) do nothing;
  end if;
  return NEW;
end $$;

create or replace function public.cakegenie_enqueue_studio_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision text;
begin
  if TG_OP = 'UPDATE'
     and current_setting('genie.analysis_json_only', true) = 'on' then
    return NEW;
  end if;

  if TG_OP = 'UPDATE'
     and OLD.original_image_url is distinct from NEW.original_image_url then
    update public.cakegenie_analysis_cache
    set studio_edited_image_url = NULL,
        studio_edit_status = 'not_started',
        studio_edit_error = NULL,
        studio_edit_started_at = NULL,
        studio_edited_at = NULL
    where id = NEW.id;
  end if;

  update public.cakegenie_studio_edit_jobs
  set status = 'superseded', batch_run_id = NULL, updated_at = now(), error = 'Source analysis or image revision changed.'
  where cache_id = NEW.id
    and status <> 'superseded'
    and (
      nullif(btrim(NEW.original_image_url), '') is null
      or NEW.analysis_ready_at is null
      or NEW.analysis_ready_at + interval '48 hours' <= now()
      or nullif(btrim(NEW.analysis_json->>'cakeType'), '') is null
      or coalesce(NEW.analysis_json->>'__studio_edit_placeholder', 'false') = 'true'
      or coalesce(NEW.analysis_json #>> '{rejection,isRejected}', 'false') = 'true'
      or source_revision <> public.cakegenie_studio_source_revision(
        NEW.p_hash, NEW.original_image_url
      )
    );

  if nullif(btrim(NEW.original_image_url), '') is null
     or NEW.analysis_ready_at is null
     or NEW.analysis_ready_at + interval '48 hours' <= now()
     or nullif(btrim(NEW.analysis_json->>'cakeType'), '') is null
     or coalesce(NEW.analysis_json->>'__studio_edit_placeholder', 'false') = 'true'
     or coalesce(NEW.analysis_json #>> '{rejection,isRejected}', 'false') = 'true' then
    return NEW;
  end if;

  v_revision := public.cakegenie_studio_source_revision(
    NEW.p_hash, NEW.original_image_url
  );

  insert into public.cakegenie_studio_edit_jobs(
    cache_id, source_revision, source_image_url, p_hash, eligible_at
  ) values (
    NEW.id, v_revision, NEW.original_image_url, NEW.p_hash,
    NEW.analysis_ready_at + interval '48 hours'
  ) on conflict (cache_id, source_revision) do update
    set source_image_url = excluded.source_image_url,
        p_hash = excluded.p_hash,
        eligible_at = excluded.eligible_at,
        status = 'pending',
        attempt_count = 0,
        run_id = NULL,
        batch_run_id = NULL,
        error = NULL,
        started_at = NULL,
        completed_at = NULL,
        updated_at = now()
    where public.cakegenie_studio_edit_jobs.status = 'superseded';

  return NEW;
end $$;

drop trigger if exists variant_pipeline on public.cakegenie_analysis_cache;
create trigger variant_pipeline
after insert or update on public.cakegenie_analysis_cache
for each row
when (current_setting('genie.analysis_json_only', true) is distinct from 'on')
execute function supabase_functions.http_request(
  'https://genie.ph/api/internal/variant-pipeline',
  'POST',
  '{"Content-type":"application/json","x-supabase-webhook-secret":"678e947720b811aefbafe3497711e431f71e14c271cf4b47d42189eb5ae307dd"}',
  '{}',
  '5000'
);

create or replace function public.cakegenie_update_analysis_json_only(
  p_cache_id uuid,
  p_analysis_json jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated boolean;
begin
  perform set_config('genie.analysis_json_only', 'on', true);
  update public.cakegenie_analysis_cache
  set analysis_json = p_analysis_json
  where id = p_cache_id;
  v_updated := found;
  return v_updated;
end;
$$;

revoke execute on function public.cakegenie_update_analysis_json_only(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.cakegenie_update_analysis_json_only(uuid, jsonb) to service_role;
