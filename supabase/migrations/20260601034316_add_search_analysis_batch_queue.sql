CREATE TABLE public.cakegenie_search_analysis_batch_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gemini_job_name TEXT,
    status TEXT NOT NULL DEFAULT 'collecting'
        CHECK (status IN ('collecting', 'submitted', 'completed', 'completed_with_errors', 'failed')),
    is_compatibility_probe BOOLEAN NOT NULL DEFAULT false,
    input_file_uri TEXT,
    output_file_uri TEXT,
    submitted_count INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    retryable_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cakegenie_search_analysis_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.cakegenie_search_analysis_batch_runs(id) ON DELETE SET NULL,
    p_hash TEXT NOT NULL UNIQUE,
    fingerprint_pipeline TEXT,
    source_image_url TEXT,
    normalized_image_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    source_usage_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'submitted', 'completed', 'failed', 'retryable', 'rejected')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    submission_ordinal INTEGER,
    cache_id UUID REFERENCES public.cakegenie_analysis_cache(id) ON DELETE SET NULL,
    error TEXT,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_analysis_batch_items_eligible
    ON public.cakegenie_search_analysis_batch_items (source_usage_count DESC, queued_at ASC, id ASC)
    WHERE status IN ('queued', 'retryable');

CREATE INDEX idx_search_analysis_batch_items_run
    ON public.cakegenie_search_analysis_batch_items (run_id, submission_ordinal);

ALTER TABLE public.cakegenie_search_analysis_batch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cakegenie_search_analysis_batch_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cakegenie_search_analysis_batch_runs FROM anon, authenticated;
REVOKE ALL ON public.cakegenie_search_analysis_batch_items FROM anon, authenticated;
