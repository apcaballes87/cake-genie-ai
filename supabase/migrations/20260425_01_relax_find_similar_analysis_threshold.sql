CREATE OR REPLACE FUNCTION public.find_similar_analysis(new_hash text)
 RETURNS SETOF cakegenie_analysis_cache
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT *
  FROM cakegenie_analysis_cache
  WHERE public.hamming_distance(p_hash, new_hash) BETWEEN 0 AND 3
  ORDER BY public.hamming_distance(p_hash, new_hash) ASC
  LIMIT 1;
END;
$function$;
