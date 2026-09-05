-- Deploy this schema before the compatible application; activate analysis-only prompt last.
-- Existing completed products are grandfathered. New analysis never implies publication.
BEGIN;
ALTER TABLE public.cakegenie_analysis_cache
  ADD COLUMN seo_status text NOT NULL DEFAULT 'pending' CHECK (seo_status IN ('pending','processing','failed','published')),
  ADD COLUMN seo_published_at timestamptz,
  ADD COLUMN analysis_ready_at timestamptz,
  ADD COLUMN seo_analysis_revision text;

CREATE TABLE public.cakegenie_seo_batch_runs (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting','submitted','importing','completed','completed_with_errors','failed')),
  prompt_version text NOT NULL,
  input_file_uri text,
  output_file_uri text,
  gemini_job_name text,
  completed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  usage_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cakegenie_seo_single_active_run ON public.cakegenie_seo_batch_runs ((true))
  WHERE status IN ('collecting','submitted','importing');

CREATE TABLE public.cakegenie_seo_batch_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_id uuid NOT NULL REFERENCES public.cakegenie_analysis_cache(id) ON DELETE CASCADE,
  analysis_revision text NOT NULL,
  analysis_json jsonb NOT NULL,
  availability text,
  keywords text,
  tags jsonb,
  slug text,
  eligible_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','completed','retryable','failed','superseded')),
  run_id uuid REFERENCES public.cakegenie_seo_batch_runs(id),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  usage_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  notification_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cache_id, analysis_revision)
);
CREATE INDEX cakegenie_seo_due_jobs ON public.cakegenie_seo_batch_jobs (eligible_at, id)
  WHERE status IN ('pending','retryable');
CREATE INDEX cakegenie_seo_run_items ON public.cakegenie_seo_batch_jobs (run_id,status);
CREATE INDEX cakegenie_seo_public_cache ON public.cakegenie_analysis_cache (created_at DESC) WHERE seo_status = 'published';
ALTER TABLE public.cakegenie_seo_batch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cakegenie_seo_batch_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cakegenie_seo_batch_runs, public.cakegenie_seo_batch_jobs FROM anon, authenticated;
GRANT ALL ON public.cakegenie_seo_batch_runs, public.cakegenie_seo_batch_jobs TO service_role;

CREATE FUNCTION public.cakegenie_seo_revision(p_analysis jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT md5((coalesce(p_analysis,'{}'::jsonb) - ARRAY['alt_text','seo_title','seo_description','tags'])::text)
$$;

-- Preserve completed historical pages; Studio placeholders and rejected analyses stay pending.
UPDATE public.cakegenie_analysis_cache SET
  seo_status = 'published', seo_published_at = coalesce(created_at,now()),
  analysis_ready_at = coalesce(created_at,now()), seo_analysis_revision = public.cakegenie_seo_revision(analysis_json)
WHERE nullif(btrim(slug),'') IS NOT NULL
  AND nullif(btrim(seo_title),'') IS NOT NULL
  AND nullif(btrim(seo_description),'') IS NOT NULL
  AND nullif(btrim(alt_text),'') IS NOT NULL
  AND nullif(analysis_json->>'cakeType','') IS NOT NULL
  AND created_at <= now() - interval '48 hours'
  AND coalesce(analysis_json->>'__studio_edit_placeholder','false') <> 'true'
  AND coalesce(analysis_json #>> '{rejection,isRejected}','false') <> 'true';

-- Recently created legacy rows must follow the new wait, rather than becoming
-- public merely because the old inline prompt happened to populate SEO fields.
UPDATE public.cakegenie_analysis_cache SET
  analysis_ready_at = coalesce(created_at, now()),
  seo_analysis_revision = public.cakegenie_seo_revision(analysis_json)
WHERE seo_status = 'pending'
  AND nullif(analysis_json->>'cakeType','') IS NOT NULL
  AND coalesce(analysis_json->>'__studio_edit_placeholder','false') <> 'true'
  AND coalesce(analysis_json #>> '{rejection,isRejected}','false') <> 'true';

-- Public cache access is also used by the uploader. Keep that path working, but no
-- browser/anonymous write may control the publication gate or replace published copy.
CREATE FUNCTION public.cakegenie_prepare_seo_state() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_revision text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.seo_status := 'pending'; NEW.seo_published_at := NULL;
    NEW.analysis_ready_at := NULL; NEW.seo_analysis_revision := NULL;
    NEW.seo_title := NULL; NEW.seo_description := NULL; NEW.alt_text := NULL;
  ELSE
    IF coalesce(auth.role(),'') IN ('anon','authenticated') THEN
      NEW.seo_status := OLD.seo_status; NEW.seo_published_at := OLD.seo_published_at;
      NEW.seo_title := OLD.seo_title; NEW.seo_description := OLD.seo_description; NEW.alt_text := OLD.alt_text;
    END IF;
    NEW.analysis_ready_at := OLD.analysis_ready_at;
    -- Keep a published URL stable on cache refreshes and duplicate uploads.
    IF OLD.seo_status = 'published' THEN NEW.slug := OLD.slug; END IF;
  END IF;
  v_revision := public.cakegenie_seo_revision(NEW.analysis_json);
  NEW.seo_analysis_revision := v_revision;
  IF nullif(NEW.analysis_json->>'cakeType','') IS NOT NULL
    AND coalesce(NEW.analysis_json->>'__studio_edit_placeholder','false') <> 'true'
    AND coalesce(NEW.analysis_json #>> '{rejection,isRejected}','false') <> 'true' THEN
    NEW.analysis_ready_at := coalesce(NEW.analysis_ready_at,now());
    IF TG_OP = 'UPDATE' AND OLD.seo_status <> 'published' AND OLD.seo_analysis_revision IS DISTINCT FROM v_revision THEN
      NEW.seo_status := 'pending'; NEW.seo_published_at := NULL;
      NEW.seo_title := NULL; NEW.seo_description := NULL; NEW.alt_text := NULL;
    END IF;
  ELSE
    NEW.seo_status := 'pending'; NEW.seo_published_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cakegenie_prepare_seo_state BEFORE INSERT OR UPDATE ON public.cakegenie_analysis_cache
  FOR EACH ROW EXECUTE FUNCTION public.cakegenie_prepare_seo_state();

CREATE FUNCTION public.cakegenie_enqueue_seo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.seo_status = 'published' THEN RETURN NEW; END IF;
  UPDATE public.cakegenie_seo_batch_jobs SET status='superseded', updated_at=now()
    WHERE cache_id=NEW.id AND analysis_revision IS DISTINCT FROM NEW.seo_analysis_revision
      AND status IN ('pending','retryable','submitted');
  IF NEW.analysis_ready_at IS NOT NULL
    AND nullif(NEW.analysis_json->>'cakeType','') IS NOT NULL
    AND coalesce(NEW.analysis_json->>'__studio_edit_placeholder','false') <> 'true'
    AND coalesce(NEW.analysis_json #>> '{rejection,isRejected}','false') <> 'true' THEN
    INSERT INTO public.cakegenie_seo_batch_jobs(cache_id,analysis_revision,analysis_json,availability,keywords,tags,slug,eligible_at)
      VALUES(NEW.id, NEW.seo_analysis_revision, NEW.analysis_json, NEW.availability, NEW.keywords,
        to_jsonb(NEW.tags), NEW.slug, NEW.analysis_ready_at + interval '48 hours')
      ON CONFLICT(cache_id,analysis_revision) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cakegenie_enqueue_seo AFTER INSERT OR UPDATE OF analysis_json ON public.cakegenie_analysis_cache
  FOR EACH ROW EXECUTE FUNCTION public.cakegenie_enqueue_seo();

CREATE FUNCTION public.claim_seo_batch(p_run_id uuid,p_limit integer,p_prompt_version text)
RETURNS SETOF public.cakegenie_seo_batch_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cakegenie-seo-batch'));
  IF EXISTS(SELECT 1 FROM public.cakegenie_seo_batch_runs WHERE status IN ('collecting','submitted','importing')) THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.cakegenie_seo_batch_jobs j JOIN public.cakegenie_analysis_cache c ON c.id=j.cache_id
    WHERE j.status IN ('pending','retryable') AND j.attempt_count<3 AND j.eligible_at<=now()
      AND c.seo_status<>'published' AND c.seo_analysis_revision=j.analysis_revision
      AND nullif(c.slug,'') IS NOT NULL AND nullif(c.original_image_url,'') IS NOT NULL) THEN RETURN; END IF;
  INSERT INTO public.cakegenie_seo_batch_runs(id,prompt_version) VALUES(p_run_id,p_prompt_version);
  RETURN QUERY WITH selected AS (
    SELECT j.id FROM public.cakegenie_seo_batch_jobs j JOIN public.cakegenie_analysis_cache c ON c.id=j.cache_id
    WHERE j.status IN ('pending','retryable') AND j.attempt_count<3 AND j.eligible_at<=now()
      AND c.seo_status<>'published' AND c.seo_analysis_revision=j.analysis_revision
      AND nullif(c.slug,'') IS NOT NULL AND nullif(c.original_image_url,'') IS NOT NULL
    ORDER BY j.eligible_at,j.id LIMIT least(greatest(coalesce(p_limit,1000),1),1000) FOR UPDATE OF j SKIP LOCKED
  ) UPDATE public.cakegenie_seo_batch_jobs j SET status='submitted',run_id=p_run_id,
    attempt_count=j.attempt_count+1,updated_at=now() FROM selected s WHERE j.id=s.id RETURNING j.*;
  UPDATE public.cakegenie_analysis_cache c SET seo_status='processing'
    FROM public.cakegenie_seo_batch_jobs j WHERE j.run_id=p_run_id AND j.cache_id=c.id AND c.seo_status<>'published';
END $$;

CREATE FUNCTION public.fail_seo_batch_item(p_job_id uuid,p_run_id uuid,p_error text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job public.cakegenie_seo_batch_jobs;
BEGIN
  SELECT * INTO v_job FROM public.cakegenie_seo_batch_jobs WHERE id=p_job_id AND run_id=p_run_id FOR UPDATE;
  IF NOT FOUND OR v_job.status<>'submitted' THEN RETURN false; END IF;
  UPDATE public.cakegenie_seo_batch_jobs SET status=CASE WHEN attempt_count>=3 THEN 'failed' ELSE 'retryable' END,
    error=left(p_error,2000),updated_at=now() WHERE id=p_job_id;
  UPDATE public.cakegenie_analysis_cache SET seo_status=CASE WHEN v_job.attempt_count>=3 THEN 'failed' ELSE 'pending' END
    WHERE id=v_job.cache_id AND seo_status<>'published' AND seo_analysis_revision=v_job.analysis_revision;
  UPDATE public.cakegenie_seo_batch_runs SET failed_count=failed_count+1,updated_at=now() WHERE id=p_run_id;
  RETURN true;
END $$;

CREATE FUNCTION public.finalize_seo_batch_item(p_job_id uuid,p_run_id uuid,p_analysis_revision text,
  p_seo_title text,p_seo_description text,p_alt_text text,p_tags jsonb,p_usage_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job public.cakegenie_seo_batch_jobs; v_cache public.cakegenie_analysis_cache;
BEGIN
  SELECT * INTO v_job FROM public.cakegenie_seo_batch_jobs WHERE id=p_job_id AND run_id=p_run_id FOR UPDATE;
  IF NOT FOUND OR v_job.status<>'submitted' THEN RETURN false; END IF;
  SELECT * INTO v_cache FROM public.cakegenie_analysis_cache WHERE id=v_job.cache_id FOR UPDATE;
  IF NOT FOUND OR v_cache.seo_status='published' OR v_job.analysis_revision<>p_analysis_revision
    OR v_cache.seo_analysis_revision<>p_analysis_revision THEN
    UPDATE public.cakegenie_seo_batch_jobs SET status='superseded',updated_at=now() WHERE id=p_job_id;
    RETURN false;
  END IF;
  IF v_job.eligible_at>now() OR v_cache.analysis_ready_at + interval '48 hours'>now() THEN
    RAISE EXCEPTION 'SEO publication is not yet eligible';
  END IF;
  IF length(btrim(p_seo_title))<3 OR length(btrim(p_seo_description))<80
    OR length(btrim(p_alt_text)) NOT BETWEEN 18 AND 160 OR jsonb_typeof(p_tags)<>'array'
    OR p_seo_title IS NULL OR p_seo_description IS NULL OR p_alt_text IS NULL OR p_tags IS NULL THEN
    RAISE EXCEPTION 'Invalid SEO publication metadata';
  END IF;
  UPDATE public.cakegenie_analysis_cache SET seo_title=p_seo_title,seo_description=p_seo_description,alt_text=p_alt_text,
    tags=ARRAY(SELECT jsonb_array_elements_text(p_tags)), seo_status='published',seo_published_at=now(),
    analysis_json=analysis_json || jsonb_build_object('seo_title',p_seo_title,'seo_description',p_seo_description,'alt_text',p_alt_text,'tags',p_tags)
    WHERE id=v_cache.id;
  UPDATE public.cakegenie_seo_batch_jobs SET status='completed',usage_metadata=coalesce(p_usage_metadata,'{}'::jsonb),
    slug=v_cache.slug,error=NULL,updated_at=now() WHERE id=p_job_id;
  UPDATE public.cakegenie_seo_batch_runs SET completed_count=completed_count+1,updated_at=now(),
    usage_metadata=jsonb_build_object(
      'promptTokenCount', coalesce((usage_metadata->>'promptTokenCount')::bigint,0)+coalesce((p_usage_metadata->>'promptTokenCount')::bigint,0),
      'candidatesTokenCount',coalesce((usage_metadata->>'candidatesTokenCount')::bigint,0)+coalesce((p_usage_metadata->>'candidatesTokenCount')::bigint,0),
      'totalTokenCount',coalesce((usage_metadata->>'totalTokenCount')::bigint,0)+coalesce((p_usage_metadata->>'totalTokenCount')::bigint,0))
    WHERE id=p_run_id;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_seo_batch(uuid,integer,text), public.fail_seo_batch_item(uuid,uuid,text),
  public.finalize_seo_batch_item(uuid,uuid,text,text,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_seo_batch(uuid,integer,text), public.fail_seo_batch_item(uuid,uuid,text),
  public.finalize_seo_batch_item(uuid,uuid,text,text,text,text,jsonb,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.cakegenie_prepare_seo_state(),public.cakegenie_enqueue_seo() FROM PUBLIC,anon,authenticated;

-- Preserve existing search algorithms and signatures, restricting their source rows.
-- Fail if the known source seam changes instead of silently leaving an RPC unguarded.
DO $$
DECLARE v_fn record; v_definition text; v_updated text;
BEGIN
  FOR v_fn IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace
    AND proname IN ('search_products','search_products_count','search_collection_products','search_collection_products_count') LOOP
    v_definition := pg_get_functiondef(v_fn.oid);
    v_updated := regexp_replace(v_definition, '(WHERE c\.original_image_url IS NOT NULL)',
      E'WHERE c.seo_status = ''published'' AND c.original_image_url IS NOT NULL', 'gi');
    IF v_updated=v_definition THEN RAISE EXCEPTION 'Unrecognized public search source: %',v_fn.proname; END IF;
    EXECUTE v_updated;
  END LOOP;
END $$;
COMMIT;
