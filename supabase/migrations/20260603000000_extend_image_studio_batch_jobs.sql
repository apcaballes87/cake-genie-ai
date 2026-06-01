ALTER TABLE public.cakegenie_image_studio_batch_jobs
    ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'studio',
    ADD COLUMN IF NOT EXISTS error TEXT,
    ADD COLUMN IF NOT EXISTS completed_requests INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS failed_requests INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.cakegenie_image_studio_batch_jobs
    DROP CONSTRAINT IF EXISTS cakegenie_image_studio_batch_jobs_stage_check;

ALTER TABLE public.cakegenie_image_studio_batch_jobs
    ADD CONSTRAINT cakegenie_image_studio_batch_jobs_stage_check
    CHECK (stage IN ('studio', 'mask', 'complete'));

CREATE TABLE IF NOT EXISTS public.cakegenie_image_studio_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_job_id UUID NOT NULL
        REFERENCES public.cakegenie_image_studio_batch_jobs(id) ON DELETE CASCADE,
    cache_id UUID NOT NULL
        REFERENCES public.cakegenie_analysis_cache(id) ON DELETE CASCADE,
    p_hash TEXT NOT NULL,
    slug TEXT,
    original_image_url TEXT NOT NULL,
    studio_edited_image_url TEXT,
    studio_status TEXT NOT NULL DEFAULT 'pending',
    mask_status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cakegenie_image_studio_batch_items_job_cache_uniq
        UNIQUE (batch_job_id, cache_id),
    CONSTRAINT cakegenie_image_studio_batch_items_studio_status_check
        CHECK (studio_status IN ('pending', 'submitted', 'completed', 'failed')),
    CONSTRAINT cakegenie_image_studio_batch_items_mask_status_check
        CHECK (mask_status IN ('pending', 'submitted', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_image_studio_batch_items_job
    ON public.cakegenie_image_studio_batch_items (batch_job_id);

ALTER TABLE public.cakegenie_image_studio_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users"
    ON public.cakegenie_image_studio_batch_items
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
