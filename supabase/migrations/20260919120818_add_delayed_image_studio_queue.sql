-- Delayed Image Studio jobs are intentionally separate from cake analysis and SEO.
-- This migration adds future enqueueing only; it does not backfill existing rows.
BEGIN;

CREATE TABLE public.cakegenie_studio_edit_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_id uuid NOT NULL REFERENCES public.cakegenie_analysis_cache(id) ON DELETE CASCADE,
  source_revision text NOT NULL,
  source_image_url text NOT NULL,
  p_hash text NOT NULL,
  eligible_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'batch_submitted', 'completed', 'retryable', 'failed', 'superseded')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  run_id uuid,
  batch_run_id uuid,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cache_id, source_revision)
);

CREATE INDEX cakegenie_studio_edit_due_jobs
  ON public.cakegenie_studio_edit_jobs (eligible_at, id)
  WHERE status IN ('pending', 'retryable', 'processing', 'batch_submitted');

CREATE TABLE public.cakegenie_studio_edit_batch_runs (
  id uuid PRIMARY KEY,
  provider_job_name text UNIQUE,
  input_file_uri text,
  output_file_uri text,
  status text NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting', 'submitted', 'importing', 'completed', 'failed')),
  total_jobs integer NOT NULL DEFAULT 0,
  imported_jobs integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The delayed queue has one active provider batch at a time. This keeps the
-- hourly worker idempotent and prevents two cron invocations from submitting
-- overlapping work.
CREATE UNIQUE INDEX cakegenie_studio_edit_one_active_batch
  ON public.cakegenie_studio_edit_batch_runs ((1))
  WHERE status IN ('collecting', 'submitted', 'importing');

ALTER TABLE public.cakegenie_studio_edit_batch_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cakegenie_studio_edit_batch_runs FROM anon, authenticated;
GRANT ALL ON public.cakegenie_studio_edit_batch_runs TO service_role;

ALTER TABLE public.cakegenie_studio_edit_jobs
  ADD CONSTRAINT cakegenie_studio_edit_jobs_batch_run_fk
  FOREIGN KEY (batch_run_id)
  REFERENCES public.cakegenie_studio_edit_batch_runs(id)
  ON DELETE SET NULL;

ALTER TABLE public.cakegenie_studio_edit_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cakegenie_studio_edit_jobs FROM anon, authenticated;
GRANT ALL ON public.cakegenie_studio_edit_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.cakegenie_studio_source_revision(
  p_hash text,
  p_original_image_url text
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT md5(concat_ws('|',
    coalesce(p_hash, ''),
    coalesce(p_original_image_url, '')
  ))
$$;

CREATE OR REPLACE FUNCTION public.cakegenie_enqueue_studio_edit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_revision text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       OLD.original_image_url IS DISTINCT FROM NEW.original_image_url
     ) THEN
    UPDATE public.cakegenie_analysis_cache
    SET studio_edited_image_url = NULL,
        studio_edit_status = 'not_started',
        studio_edit_error = NULL,
        studio_edit_started_at = NULL,
        studio_edited_at = NULL
    WHERE id = NEW.id;
  END IF;

  UPDATE public.cakegenie_studio_edit_jobs
  SET status = 'superseded', batch_run_id = NULL, updated_at = now(), error = 'Source analysis or image revision changed.'
  WHERE cache_id = NEW.id
    AND status <> 'superseded'
    AND (
      nullif(btrim(NEW.original_image_url), '') IS NULL
      OR NEW.analysis_ready_at IS NULL
      OR NEW.analysis_ready_at + interval '48 hours' <= now()
      OR nullif(btrim(NEW.analysis_json->>'cakeType'), '') IS NULL
      OR coalesce(NEW.analysis_json->>'__studio_edit_placeholder', 'false') = 'true'
      OR coalesce(NEW.analysis_json #>> '{rejection,isRejected}', 'false') = 'true'
      OR source_revision <> public.cakegenie_studio_source_revision(
        NEW.p_hash, NEW.original_image_url
      )
    );

  IF nullif(btrim(NEW.original_image_url), '') IS NULL
     OR NEW.analysis_ready_at IS NULL
     OR NEW.analysis_ready_at + interval '48 hours' <= now()
     OR nullif(btrim(NEW.analysis_json->>'cakeType'), '') IS NULL
     OR coalesce(NEW.analysis_json->>'__studio_edit_placeholder', 'false') = 'true'
     OR coalesce(NEW.analysis_json #>> '{rejection,isRejected}', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  v_revision := public.cakegenie_studio_source_revision(
    NEW.p_hash, NEW.original_image_url
  );

  INSERT INTO public.cakegenie_studio_edit_jobs(
    cache_id, source_revision, source_image_url, p_hash, eligible_at
  ) VALUES (
    NEW.id, v_revision, NEW.original_image_url, NEW.p_hash,
    NEW.analysis_ready_at + interval '48 hours'
  ) ON CONFLICT (cache_id, source_revision) DO UPDATE
    SET source_image_url = EXCLUDED.source_image_url,
        p_hash = EXCLUDED.p_hash,
        eligible_at = EXCLUDED.eligible_at,
        status = 'pending',
        attempt_count = 0,
        run_id = NULL,
        batch_run_id = NULL,
        error = NULL,
        started_at = NULL,
        completed_at = NULL,
        updated_at = now()
    WHERE public.cakegenie_studio_edit_jobs.status = 'superseded';

  RETURN NEW;
END $$;

CREATE TRIGGER cakegenie_enqueue_studio_edit
AFTER INSERT OR UPDATE OF analysis_json, original_image_url
ON public.cakegenie_analysis_cache
FOR EACH ROW EXECUTE FUNCTION public.cakegenie_enqueue_studio_edit();

CREATE OR REPLACE FUNCTION public.claim_studio_edit_jobs(
  p_run_id uuid,
  p_limit integer DEFAULT 1
) RETURNS SETOF public.cakegenie_studio_edit_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job public.cakegenie_studio_edit_jobs;
  v_limit integer := least(greatest(coalesce(p_limit, 1), 1), 25);
BEGIN
  UPDATE public.cakegenie_studio_edit_jobs j
  SET status = 'superseded', updated_at = now(), error = 'Source image revision changed.'
  FROM public.cakegenie_analysis_cache c
  WHERE c.id = j.cache_id
    AND j.status <> 'superseded'
    AND j.source_revision <> public.cakegenie_studio_source_revision(
      c.p_hash, c.original_image_url
    );

  FOR v_job IN
    SELECT j.*
    FROM public.cakegenie_studio_edit_jobs j
    JOIN public.cakegenie_analysis_cache c ON c.id = j.cache_id
    WHERE (
      j.status IN ('pending', 'retryable')
      OR (
        j.status = 'processing'
        AND j.started_at < now() - interval '2 hours'
        AND j.attempt_count < 3
      )
    )
      AND j.eligible_at <= now()
      AND j.attempt_count < 3
      AND c.original_image_url = j.source_image_url
      AND j.source_revision = public.cakegenie_studio_source_revision(
        c.p_hash, c.original_image_url
      )
      AND (c.studio_edit_status IS DISTINCT FROM 'processing' OR j.status = 'processing')
      AND (c.studio_edit_status IS DISTINCT FROM 'completed' OR c.studio_edited_image_url IS NULL)
      AND nullif(btrim(c.analysis_json->>'cakeType'), '') IS NOT NULL
      AND coalesce(c.analysis_json->>'__studio_edit_placeholder', 'false') <> 'true'
      AND coalesce(c.analysis_json #>> '{rejection,isRejected}', 'false') <> 'true'
    ORDER BY j.eligible_at, j.id
    LIMIT v_limit
    FOR UPDATE OF j SKIP LOCKED
  LOOP
    UPDATE public.cakegenie_studio_edit_jobs
    SET status = 'processing',
        attempt_count = attempt_count + 1,
        run_id = p_run_id,
        started_at = now(),
        error = NULL,
        updated_at = now()
    WHERE id = v_job.id
    RETURNING * INTO v_job;

    UPDATE public.cakegenie_analysis_cache
    SET studio_edit_status = 'processing',
        studio_edit_error = NULL,
        studio_edit_started_at = now()
    WHERE id = v_job.cache_id;

    RETURN NEXT v_job;
  END LOOP;
END $$;

-- Claim a future-only slice for one asynchronous Vertex Batch request. The
-- run row is created inside the same transaction as the claim, so concurrent
-- cron invocations cannot submit overlapping batches.
CREATE OR REPLACE FUNCTION public.claim_studio_edit_batch_jobs(
  p_run_id uuid,
  p_limit integer DEFAULT 100
) RETURNS SETOF public.cakegenie_studio_edit_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job public.cakegenie_studio_edit_jobs;
  v_limit integer := least(greatest(coalesce(p_limit, 1), 1), 1000);
  v_existing_status text;
  v_active_run uuid;
  v_claimed integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('cakegenie-delayed-studio-batch', 0));

  SELECT status INTO v_existing_status
  FROM public.cakegenie_studio_edit_batch_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF v_existing_status IS NOT NULL AND v_existing_status <> 'collecting' THEN
    RETURN QUERY
      SELECT j.* FROM public.cakegenie_studio_edit_jobs j
      WHERE j.batch_run_id = p_run_id
      ORDER BY j.id;
    RETURN;
  END IF;

  SELECT id INTO v_active_run
  FROM public.cakegenie_studio_edit_batch_runs
  WHERE status IN ('collecting', 'submitted', 'importing')
    AND id <> p_run_id
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_active_run IS NOT NULL THEN
    RETURN;
  END IF;

  IF v_existing_status IS NULL THEN
    INSERT INTO public.cakegenie_studio_edit_batch_runs(id, status)
    VALUES (p_run_id, 'collecting');
  END IF;

  UPDATE public.cakegenie_studio_edit_jobs j
  SET status = 'superseded', batch_run_id = NULL, updated_at = now(), error = 'Source image revision changed.'
  FROM public.cakegenie_analysis_cache c
  WHERE c.id = j.cache_id
    AND j.status <> 'superseded'
    AND j.source_revision <> public.cakegenie_studio_source_revision(c.p_hash, c.original_image_url);

  FOR v_job IN
    SELECT j.*
    FROM public.cakegenie_studio_edit_jobs j
    JOIN public.cakegenie_analysis_cache c ON c.id = j.cache_id
    WHERE j.status IN ('pending', 'retryable')
      AND j.eligible_at <= now()
      AND j.attempt_count < 3
      AND c.original_image_url = j.source_image_url
      AND j.source_revision = public.cakegenie_studio_source_revision(c.p_hash, c.original_image_url)
      AND (c.studio_edit_status IS DISTINCT FROM 'completed' OR c.studio_edited_image_url IS NULL)
      AND nullif(btrim(c.analysis_json->>'cakeType'), '') IS NOT NULL
      AND coalesce(c.analysis_json->>'__studio_edit_placeholder', 'false') <> 'true'
      AND coalesce(c.analysis_json #>> '{rejection,isRejected}', 'false') <> 'true'
    ORDER BY j.eligible_at, j.id
    LIMIT v_limit
    FOR UPDATE OF j SKIP LOCKED
  LOOP
    UPDATE public.cakegenie_studio_edit_jobs
    SET status = 'batch_submitted',
        attempt_count = attempt_count + 1,
        run_id = p_run_id,
        batch_run_id = p_run_id,
        started_at = now(),
        error = NULL,
        updated_at = now()
    WHERE id = v_job.id
    RETURNING * INTO v_job;

    UPDATE public.cakegenie_analysis_cache
    SET studio_edit_status = 'processing',
        studio_edit_error = NULL,
        studio_edit_started_at = now()
    WHERE id = v_job.cache_id;

    v_claimed := v_claimed + 1;
    RETURN NEXT v_job;
  END LOOP;

  UPDATE public.cakegenie_studio_edit_batch_runs
  SET total_jobs = v_claimed, updated_at = now(),
      status = CASE WHEN v_claimed = 0 THEN 'completed' ELSE status END
  WHERE id = p_run_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_studio_edit_batch_submission(
  p_run_id uuid,
  p_provider_job_name text,
  p_input_file_uri text,
  p_output_file_uri text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.cakegenie_studio_edit_batch_runs
  SET provider_job_name = p_provider_job_name,
      input_file_uri = p_input_file_uri,
      output_file_uri = p_output_file_uri,
      status = 'submitted',
      error = NULL,
      updated_at = now()
  WHERE id = p_run_id AND status = 'collecting';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.mark_studio_edit_batch_importing(
  p_run_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.cakegenie_studio_edit_batch_runs
  SET status = 'importing', updated_at = now()
  WHERE id = p_run_id AND status IN ('submitted', 'importing');
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.finish_studio_edit_batch(
  p_run_id uuid,
  p_imported_jobs integer DEFAULT 0
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.cakegenie_studio_edit_batch_runs
  SET status = 'completed', imported_jobs = greatest(coalesce(p_imported_jobs, 0), 0), updated_at = now()
  WHERE id = p_run_id AND status IN ('importing', 'submitted');
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.fail_studio_edit_batch(
  p_run_id uuid,
  p_error text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job public.cakegenie_studio_edit_jobs;
  v_status text;
  v_failed integer := 0;
BEGIN
  FOR v_job IN
    SELECT * FROM public.cakegenie_studio_edit_jobs
    WHERE batch_run_id = p_run_id AND status IN ('batch_submitted', 'processing')
    FOR UPDATE
  LOOP
    v_status := CASE WHEN v_job.attempt_count >= 3 THEN 'failed' ELSE 'retryable' END;
    UPDATE public.cakegenie_studio_edit_jobs
    SET status = v_status,
        error = left(coalesce(p_error, 'Studio batch failed.'), 2000),
        updated_at = now()
    WHERE id = v_job.id;
    UPDATE public.cakegenie_analysis_cache
    SET studio_edit_status = CASE WHEN v_status = 'failed' THEN 'failed' ELSE 'not_started' END,
        studio_edit_error = left(coalesce(p_error, 'Studio batch failed.'), 500)
    WHERE id = v_job.cache_id;
    v_failed := v_failed + 1;
  END LOOP;

  UPDATE public.cakegenie_studio_edit_batch_runs
  SET status = 'failed', error = left(coalesce(p_error, 'Studio batch failed.'), 2000), updated_at = now()
  WHERE id = p_run_id;
  RETURN v_failed;
END $$;

CREATE OR REPLACE FUNCTION public.complete_studio_edit_job(
  p_job_id uuid,
  p_run_id uuid,
  p_source_revision text,
  p_studio_edited_image_url text,
  p_image_width integer,
  p_image_height integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job public.cakegenie_studio_edit_jobs;
  v_cache public.cakegenie_analysis_cache;
BEGIN
  SELECT * INTO v_job
  FROM public.cakegenie_studio_edit_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_job.status NOT IN ('processing', 'batch_submitted')
     OR v_job.run_id IS DISTINCT FROM p_run_id
     OR v_job.source_revision <> p_source_revision THEN
    RETURN false;
  END IF;

  SELECT * INTO v_cache
  FROM public.cakegenie_analysis_cache
  WHERE id = v_job.cache_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_cache.original_image_url <> v_job.source_image_url
    OR public.cakegenie_studio_source_revision(
      v_cache.p_hash, v_cache.original_image_url
    ) <> v_job.source_revision THEN
    UPDATE public.cakegenie_studio_edit_jobs
    SET status = 'superseded', batch_run_id = NULL, error = 'Source image revision changed before completion.', updated_at = now()
    WHERE id = v_job.id;
    RETURN false;
  END IF;

  UPDATE public.cakegenie_analysis_cache
  SET studio_edited_image_url = p_studio_edited_image_url,
      studio_edit_status = 'completed',
      studio_edit_error = NULL,
      studio_edited_at = now(),
      image_width = coalesce(p_image_width, image_width),
      image_height = coalesce(p_image_height, image_height)
  WHERE id = v_cache.id;

  UPDATE public.cakegenie_studio_edit_jobs
  SET status = 'completed', batch_run_id = NULL, completed_at = now(), error = NULL, updated_at = now()
  WHERE id = v_job.id;

  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.skip_studio_edit_job(
  p_job_id uuid,
  p_run_id uuid,
  p_reason text DEFAULT 'Studio image already exists.'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.cakegenie_studio_edit_jobs
  SET status = 'completed', batch_run_id = NULL, completed_at = now(), error = left(p_reason, 2000), updated_at = now()
  WHERE id = p_job_id AND run_id IS NOT DISTINCT FROM p_run_id
    AND status IN ('processing', 'batch_submitted', 'pending', 'retryable');
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.supersede_studio_edit_job(
  p_job_id uuid,
  p_run_id uuid,
  p_reason text DEFAULT 'Studio source revision changed.'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.cakegenie_studio_edit_jobs
  SET status = 'superseded', batch_run_id = NULL, error = left(p_reason, 2000), updated_at = now()
  WHERE id = p_job_id AND run_id IS NOT DISTINCT FROM p_run_id AND status <> 'superseded';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.fail_studio_edit_job(
  p_job_id uuid,
  p_run_id uuid,
  p_error text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job public.cakegenie_studio_edit_jobs;
  v_status text;
BEGIN
  SELECT * INTO v_job
  FROM public.cakegenie_studio_edit_jobs
  WHERE id = p_job_id AND run_id IS NOT DISTINCT FROM p_run_id
  FOR UPDATE;

  IF NOT FOUND OR v_job.status NOT IN ('processing', 'batch_submitted') THEN
    RETURN 'ignored';
  END IF;

  v_status := CASE WHEN v_job.attempt_count >= 3 THEN 'failed' ELSE 'retryable' END;
  UPDATE public.cakegenie_studio_edit_jobs
  SET status = v_status, batch_run_id = NULL, error = left(coalesce(p_error, 'Studio edit failed.'), 2000), updated_at = now()
  WHERE id = v_job.id;

  UPDATE public.cakegenie_analysis_cache
  SET studio_edit_status = CASE WHEN v_status = 'failed' THEN 'failed' ELSE 'not_started' END,
      studio_edit_error = left(coalesce(p_error, 'Studio edit failed.'), 500)
  WHERE id = v_job.cache_id;

  RETURN v_status;
END $$;

REVOKE ALL ON FUNCTION public.cakegenie_studio_source_revision(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cakegenie_enqueue_studio_edit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_studio_edit_jobs(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_studio_edit_batch_jobs(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_studio_edit_batch_submission(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_studio_edit_batch_importing(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_studio_edit_batch(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_studio_edit_batch(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_studio_edit_job(uuid, uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.skip_studio_edit_job(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.supersede_studio_edit_job(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_studio_edit_job(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_studio_edit_jobs(uuid, integer), public.claim_studio_edit_batch_jobs(uuid, integer), public.set_studio_edit_batch_submission(uuid, text, text, text), public.mark_studio_edit_batch_importing(uuid), public.finish_studio_edit_batch(uuid, integer), public.fail_studio_edit_batch(uuid, text), public.complete_studio_edit_job(uuid, uuid, text, text, integer, integer), public.skip_studio_edit_job(uuid, uuid, text), public.supersede_studio_edit_job(uuid, uuid, text), public.fail_studio_edit_job(uuid, uuid, text) TO service_role;

COMMIT;
