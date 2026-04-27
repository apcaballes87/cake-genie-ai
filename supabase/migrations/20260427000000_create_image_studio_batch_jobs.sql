CREATE TABLE public.cakegenie_image_studio_batch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gemini_job_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input_file_uri TEXT,
    output_file_uri TEXT,
    total_requests INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.cakegenie_image_studio_batch_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON public.cakegenie_image_studio_batch_jobs
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.cakegenie_analysis_cache 
ADD COLUMN IF NOT EXISTS batch_job_id UUID REFERENCES public.cakegenie_image_studio_batch_jobs(id) ON DELETE SET NULL;
