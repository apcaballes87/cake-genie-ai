ALTER TABLE public.cakegenie_analysis_cache
ADD COLUMN IF NOT EXISTS fingerprint_status text,
ADD COLUMN IF NOT EXISTS fingerprint_error text,
ADD COLUMN IF NOT EXISTS fingerprinted_at timestamptz,
ADD COLUMN IF NOT EXISTS orb_index_status text,
ADD COLUMN IF NOT EXISTS orb_index_error text,
ADD COLUMN IF NOT EXISTS orb_index_attempted_at timestamptz,
ADD COLUMN IF NOT EXISTS orb_indexed_at timestamptz;

UPDATE public.cakegenie_analysis_cache
SET
  fingerprint_status = CASE
    WHEN p_hash IS NOT NULL AND p_hash ~* '^[0-9a-f]{16}$' THEN 'ready'
    ELSE 'missing'
  END,
  fingerprint_error = CASE
    WHEN p_hash IS NOT NULL AND p_hash ~* '^[0-9a-f]{16}$' THEN NULL
    ELSE COALESCE(fingerprint_error, 'Missing or invalid p_hash.')
  END,
  fingerprinted_at = CASE
    WHEN p_hash IS NOT NULL AND p_hash ~* '^[0-9a-f]{16}$' THEN COALESCE(fingerprinted_at, created_at, now())
    ELSE fingerprinted_at
  END
WHERE fingerprint_status IS NULL;

UPDATE public.cakegenie_analysis_cache
SET
  orb_index_status = CASE
    WHEN COALESCE(original_image_url, '') <> '' THEN 'pending'
    ELSE 'missing_source'
  END,
  orb_index_error = CASE
    WHEN COALESCE(original_image_url, '') <> '' THEN NULL
    ELSE COALESCE(orb_index_error, 'No original_image_url available for ORB indexing.')
  END
WHERE orb_index_status IS NULL;

UPDATE public.cakegenie_analysis_cache AS cache
SET
  orb_index_status = 'ready',
  orb_index_error = NULL,
  orb_indexed_at = COALESCE(cache.orb_indexed_at, features.created_at, cache.created_at, now())
FROM public.cakegenie_image_features AS features
WHERE features.id = cache.id;

ALTER TABLE public.cakegenie_analysis_cache
ALTER COLUMN fingerprint_status SET DEFAULT 'ready',
ALTER COLUMN fingerprint_status SET NOT NULL,
ALTER COLUMN orb_index_status SET DEFAULT 'pending',
ALTER COLUMN orb_index_status SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_cache_fingerprint_status
ON public.cakegenie_analysis_cache (fingerprint_status);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_orb_index_status
ON public.cakegenie_analysis_cache (orb_index_status);
