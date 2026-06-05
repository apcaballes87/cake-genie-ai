CREATE TABLE IF NOT EXISTS public.cakegenie_rejected_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_route TEXT NOT NULL DEFAULT 'api/ai/analyze',
    source_context TEXT,
    rejection_reason TEXT,
    rejection_message TEXT,
    rejection_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    model_name TEXT,
    mime_type TEXT,
    image_size_bytes INTEGER,
    image_sha256 TEXT,
    p_hash TEXT,
    fingerprint_pipeline TEXT,
    storage_bucket TEXT,
    storage_path TEXT,
    prompt_version TEXT,
    user_agent TEXT,
    client_ip_hash TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cakegenie_rejected_uploads_created_at
    ON public.cakegenie_rejected_uploads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cakegenie_rejected_uploads_reason_created
    ON public.cakegenie_rejected_uploads (rejection_reason, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cakegenie_rejected_uploads_hash
    ON public.cakegenie_rejected_uploads (image_sha256);

CREATE INDEX IF NOT EXISTS idx_cakegenie_rejected_uploads_phash
    ON public.cakegenie_rejected_uploads (p_hash)
    WHERE p_hash IS NOT NULL;

ALTER TABLE public.cakegenie_rejected_uploads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cakegenie_rejected_uploads FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cakegenie-rejected-uploads',
    'cakegenie-rejected-uploads',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON TABLE public.cakegenie_rejected_uploads IS
    'Private audit log of AI cake-analysis uploads rejected by the analyzer. Do not expose in public product, feed, sitemap, or cache surfaces.';

COMMENT ON COLUMN public.cakegenie_rejected_uploads.client_ip_hash IS
    'SHA-256 hash of the best-effort client IP plus REJECTED_UPLOAD_IP_HASH_SALT when configured; never stores the raw IP address.';
