ALTER TABLE public.cakegenie_analysis_cache
ADD COLUMN IF NOT EXISTS fingerprint_pipeline text;

CREATE INDEX IF NOT EXISTS idx_analysis_cache_fingerprint_pipeline
ON public.cakegenie_analysis_cache(fingerprint_pipeline)
WHERE fingerprint_pipeline IS NOT NULL;

COMMENT ON COLUMN public.cakegenie_analysis_cache.fingerprint_pipeline IS
'Versioned image normalization/hash pipeline used to generate p_hash.';

CREATE OR REPLACE FUNCTION public.find_similar_analysis_by_fingerprint(
  new_hash text DEFAULT NULL,
  new_pipeline text DEFAULT NULL,
  legacy_hashes text[] DEFAULT '{}'::text[]
)
RETURNS SETOF public.cakegenie_analysis_cache
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  IF new_hash IS NOT NULL AND new_pipeline IS NOT NULL THEN
    RETURN QUERY
    SELECT c.*
    FROM public.cakegenie_analysis_cache c
    WHERE c.p_hash IS NOT NULL
      AND c.fingerprint_pipeline = new_pipeline
      AND public.hamming_distance(c.p_hash, new_hash) BETWEEN 0 AND 3
    ORDER BY public.hamming_distance(c.p_hash, new_hash) ASC, c.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF legacy_hashes IS NOT NULL AND array_length(legacy_hashes, 1) > 0 THEN
    RETURN QUERY
    SELECT c.*
    FROM public.cakegenie_analysis_cache c
    CROSS JOIN LATERAL (
      SELECT MIN(public.hamming_distance(c.p_hash, legacy_hash)) AS distance
      FROM unnest(legacy_hashes) AS legacy_hash
      WHERE legacy_hash IS NOT NULL
    ) d
    WHERE c.p_hash IS NOT NULL
      AND d.distance BETWEEN 0 AND 3
    ORDER BY d.distance ASC, c.created_at DESC
    LIMIT 1;
  END IF;
END;
$function$;
