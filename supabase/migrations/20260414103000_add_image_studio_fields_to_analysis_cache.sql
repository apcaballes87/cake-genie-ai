ALTER TABLE public.cakegenie_analysis_cache
ADD COLUMN IF NOT EXISTS studio_edited_image_url text;

ALTER TABLE public.cakegenie_analysis_cache
ADD COLUMN IF NOT EXISTS studio_edit_status text NOT NULL DEFAULT 'not_started';

ALTER TABLE public.cakegenie_analysis_cache
ADD COLUMN IF NOT EXISTS studio_edit_error text;

ALTER TABLE public.cakegenie_analysis_cache
ADD COLUMN IF NOT EXISTS studio_edit_started_at timestamptz;

ALTER TABLE public.cakegenie_analysis_cache
ADD COLUMN IF NOT EXISTS studio_edited_at timestamptz;

ALTER TABLE public.cakegenie_analysis_cache
DROP CONSTRAINT IF EXISTS cakegenie_analysis_cache_studio_edit_status_check;

ALTER TABLE public.cakegenie_analysis_cache
ADD CONSTRAINT cakegenie_analysis_cache_studio_edit_status_check
CHECK (studio_edit_status IN ('not_started', 'processing', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_analysis_cache_studio_edit_status
ON public.cakegenie_analysis_cache (studio_edit_status);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_studio_edited_at
ON public.cakegenie_analysis_cache (studio_edited_at DESC);

COMMENT ON COLUMN public.cakegenie_analysis_cache.studio_edited_image_url IS
'Public URL for the admin image-studio output with the pastel cyclorama background.';

COMMENT ON COLUMN public.cakegenie_analysis_cache.studio_edit_status IS
'Admin image-studio processing state: not_started, processing, completed, or failed.';

COMMENT ON COLUMN public.cakegenie_analysis_cache.studio_edit_error IS
'Last admin image-studio processing error message, if any.';
