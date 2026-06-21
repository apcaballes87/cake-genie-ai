-- Migration: 20260621_tighten_phash_threshold_remove_legacy_fallback.sql
--
-- Changes:
--   1. Tighten find_similar_analysis threshold: BETWEEN 0 AND 1 (was 0 AND 2)
--   2. Remove legacy_hashes cross-pipeline fallback from find_similar_analysis_by_fingerprint
--      Now only matches within the same fingerprint_pipeline at distance ≤ 1
--   3. Delete all duplicate-of tombstone rows (they are no longer needed and
--      pollute fingerprint_pipeline GROUP BY queries)
--
-- Safe to run after the backfill-phash.ts script confirms 0 NULL-pipeline rows remain.

-- ---------------------------------------------------------------------------
-- 1. Tighten the simple legacy RPC to distance ≤ 1
--    (kept for any remaining callers; new code uses find_similar_analysis_by_fingerprint)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_similar_analysis(new_hash text)
 RETURNS SETOF cakegenie_analysis_cache
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF new_hash IS NULL OR new_hash !~* '^[0-9a-f]{16}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM cakegenie_analysis_cache
  WHERE p_hash IS NOT NULL
    AND p_hash ~* '^[0-9a-f]{16}$'
    AND fingerprint_pipeline IS NOT NULL
    AND public.hamming_distance(p_hash, lower(new_hash)) BETWEEN 0 AND 1
  ORDER BY public.hamming_distance(p_hash, lower(new_hash)) ASC
  LIMIT 1;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Remove legacy_hashes fallback — only pipeline-matched lookups at ≤ 1
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_similar_analysis_by_fingerprint(
  new_hash text DEFAULT NULL,
  new_pipeline text DEFAULT NULL,
  legacy_hashes text[] DEFAULT '{}'::text[]  -- kept in signature for backwards compat, now ignored
)
RETURNS SETOF public.cakegenie_analysis_cache
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  -- Sanitize and validate the incoming hash
  IF new_hash IS NOT NULL THEN
    new_hash := lower(new_hash);
    IF new_hash !~* '^[0-9a-f]{16}$' THEN
      new_hash := NULL;
      new_pipeline := NULL;
    END IF;
  END IF;

  -- Only perform a lookup when we have both a valid hash and a known pipeline.
  -- The legacy_hashes parameter is intentionally ignored to prevent cross-pipeline
  -- false matches between old client-side hashes and server-side hashes.
  IF new_hash IS NULL OR new_pipeline IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.*
  FROM public.cakegenie_analysis_cache c
  WHERE c.p_hash IS NOT NULL
    AND c.p_hash ~* '^[0-9a-f]{16}$'
    AND c.fingerprint_pipeline = new_pipeline
    AND public.hamming_distance(c.p_hash, new_hash) BETWEEN 0 AND 1
  ORDER BY public.hamming_distance(c.p_hash, new_hash) ASC, c.created_at DESC
  LIMIT 1;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Delete all duplicate-of tombstone rows
--    These rows have fingerprint_pipeline starting with 'duplicate-of:' and
--    serve no functional purpose after the backfill.
-- ---------------------------------------------------------------------------
DELETE FROM public.cakegenie_analysis_cache
WHERE fingerprint_pipeline LIKE 'duplicate-of:%';
