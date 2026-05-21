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
DECLARE
  sanitized_legacy_hashes text[] := ARRAY(
    SELECT lower(hash_value)
    FROM unnest(COALESCE(legacy_hashes, '{}'::text[])) AS hash_value
    WHERE hash_value ~* '^[0-9a-f]{16}$'
  );
BEGIN
  IF new_hash IS NOT NULL THEN
    new_hash := lower(new_hash);
    IF new_hash !~* '^[0-9a-f]{16}$' THEN
      new_hash := NULL;
      new_pipeline := NULL;
    END IF;
  END IF;

  IF new_hash IS NOT NULL AND new_pipeline IS NOT NULL THEN
    RETURN QUERY
    SELECT c.*
    FROM public.cakegenie_analysis_cache c
    WHERE c.p_hash IS NOT NULL
      AND c.p_hash ~* '^[0-9a-f]{16}$'
      AND c.fingerprint_pipeline = new_pipeline
      AND public.hamming_distance(c.p_hash, new_hash) BETWEEN 0 AND 2
    ORDER BY public.hamming_distance(c.p_hash, new_hash) ASC, c.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF array_length(sanitized_legacy_hashes, 1) > 0 THEN
    RETURN QUERY
    SELECT c.*
    FROM public.cakegenie_analysis_cache c
    CROSS JOIN LATERAL (
      SELECT MIN(public.hamming_distance(c.p_hash, legacy_hash)) AS distance
      FROM unnest(sanitized_legacy_hashes) AS legacy_hash
    ) d
    WHERE c.p_hash IS NOT NULL
      AND c.p_hash ~* '^[0-9a-f]{16}$'
      AND d.distance BETWEEN 0 AND 2
    ORDER BY d.distance ASC, c.created_at DESC
    LIMIT 1;
  END IF;
END;
$function$;
