-- Restore the intended global pHash tolerance to Hamming distance <= 2.
-- The recent-upload flow may inspect distance 3 only through candidate-scoped
-- strict ORB; these RPCs must never become global distance-3 lookups.

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
    AND public.hamming_distance(p_hash, lower(new_hash)) BETWEEN 0 AND 2
  ORDER BY public.hamming_distance(p_hash, lower(new_hash)) ASC
  LIMIT 1;
END;
$function$;

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
  IF new_hash IS NOT NULL THEN
    new_hash := lower(new_hash);
    IF new_hash !~* '^[0-9a-f]{16}$' THEN
      new_hash := NULL;
      new_pipeline := NULL;
    END IF;
  END IF;

  IF new_hash IS NULL OR new_pipeline IS NULL THEN
    RETURN;
  END IF;

  -- legacy_hashes remains in the signature for deployed callers, but is
  -- intentionally ignored to prevent cross-pipeline false matches.
  RETURN QUERY
  SELECT c.*
  FROM public.cakegenie_analysis_cache c
  WHERE c.p_hash IS NOT NULL
    AND c.p_hash ~* '^[0-9a-f]{16}$'
    AND c.fingerprint_pipeline = new_pipeline
    AND public.hamming_distance(c.p_hash, new_hash) BETWEEN 0 AND 2
  ORDER BY public.hamming_distance(c.p_hash, new_hash) ASC, c.created_at DESC
  LIMIT 1;
END;
$function$;
