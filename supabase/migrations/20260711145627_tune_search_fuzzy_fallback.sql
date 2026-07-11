CREATE OR REPLACE FUNCTION public.search_products(
  p_query text,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0,
  p_availability text[] DEFAULT NULL::text[],
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_icing_colors text DEFAULT NULL::text
)
RETURNS TABLE(
  slug text,
  keywords text,
  original_image_url text,
  price numeric,
  alt_text text,
  usage_count integer,
  p_hash text,
  availability text,
  analysis_json jsonb,
  image_width integer,
  image_height integer,
  rank_score real
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tsquery tsquery;
  v_raw_terms text[];
  v_term text;
  v_query_parts text[] := ARRAY[]::text[];
BEGIN
  p_query := trim(lower(p_query));
  IF p_query = '' OR p_query IS NULL THEN RETURN; END IF;

  v_raw_terms := regexp_split_to_array(
    regexp_replace(p_query, '[^[:alnum:]_[:space:]-]+', ' ', 'g'),
    '\s+'
  );
  FOREACH v_term IN ARRAY v_raw_terms LOOP
    v_term := regexp_replace(v_term, '[^[:alnum:]_]+', '', 'g');
    IF length(v_term) >= 2 THEN
      v_query_parts := array_append(v_query_parts, v_term || ':*');
    END IF;
  END LOOP;
  IF array_length(v_query_parts, 1) IS NULL THEN RETURN; END IF;

  v_tsquery := to_tsquery('english', array_to_string(v_query_parts, ' & '));

  RETURN QUERY
  WITH eligible AS (
    SELECT c.*
    FROM public.cakegenie_analysis_cache c
    WHERE c.original_image_url IS NOT NULL
      AND c.slug IS NOT NULL
      AND (p_availability IS NULL OR c.availability = ANY(p_availability))
      AND (p_min_price IS NULL OR c.price >= p_min_price)
      AND (p_max_price IS NULL OR c.price <= p_max_price)
      AND (p_icing_colors IS NULL OR c.icing_colors = p_icing_colors)
  ),
  exact_results AS (
    SELECT e.*,
      ts_rank_cd(e.search_vector, v_tsquery, 32)::real AS fts_rank,
      CASE WHEN lower(coalesce(e.keywords, '')) = p_query THEN 4.0::real ELSE 0.0::real END AS exact_keyword_bonus
    FROM eligible e
    WHERE e.search_vector @@ v_tsquery
  ),
  fuzzy_results AS (
    SELECT e.*,
      0.0::real AS fts_rank,
      0.0::real AS exact_keyword_bonus,
      greatest(
        word_similarity(p_query, coalesce(e.keywords, '')),
        word_similarity(p_query, replace(coalesce(e.slug, ''), '-', ' '))
      )::real AS trgm_sim
    FROM eligible e
    WHERE NOT EXISTS (SELECT 1 FROM exact_results)
      AND greatest(
        word_similarity(p_query, coalesce(e.keywords, '')),
        word_similarity(p_query, replace(coalesce(e.slug, ''), '-', ' '))
      ) > 0.45
  ),
  combined AS (
    SELECT e.slug, e.keywords, e.original_image_url, e.price, e.alt_text,
      e.usage_count, e.p_hash, e.availability, e.analysis_json,
      e.image_width, e.image_height,
      (e.fts_rank * 5.0 + e.exact_keyword_bonus
        + least(coalesce(e.usage_count, 0), 1000)::real / 10000.0)::real AS rank_score
    FROM exact_results e
    UNION ALL
    SELECT f.slug, f.keywords, f.original_image_url, f.price, f.alt_text,
      f.usage_count, f.p_hash, f.availability, f.analysis_json,
      f.image_width, f.image_height,
      (f.trgm_sim + least(coalesce(f.usage_count, 0), 1000)::real / 10000.0)::real AS rank_score
    FROM fuzzy_results f
  )
  SELECT c.slug, c.keywords, c.original_image_url, c.price, c.alt_text,
    c.usage_count, c.p_hash, c.availability, c.analysis_json,
    c.image_width, c.image_height, c.rank_score
  FROM combined c
  ORDER BY c.rank_score DESC, c.slug ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_products_count(
  p_query text,
  p_availability text[] DEFAULT NULL::text[],
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_icing_colors text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tsquery tsquery;
  v_raw_terms text[];
  v_term text;
  v_query_parts text[] := ARRAY[]::text[];
  v_count integer := 0;
BEGIN
  p_query := trim(lower(p_query));
  IF p_query = '' OR p_query IS NULL THEN RETURN 0; END IF;

  v_raw_terms := regexp_split_to_array(
    regexp_replace(p_query, '[^[:alnum:]_[:space:]-]+', ' ', 'g'),
    '\s+'
  );
  FOREACH v_term IN ARRAY v_raw_terms LOOP
    v_term := regexp_replace(v_term, '[^[:alnum:]_]+', '', 'g');
    IF length(v_term) >= 2 THEN
      v_query_parts := array_append(v_query_parts, v_term || ':*');
    END IF;
  END LOOP;
  IF array_length(v_query_parts, 1) IS NULL THEN RETURN 0; END IF;

  v_tsquery := to_tsquery('english', array_to_string(v_query_parts, ' & '));

  SELECT count(*) INTO v_count
  FROM public.cakegenie_analysis_cache c
  WHERE c.original_image_url IS NOT NULL
    AND c.slug IS NOT NULL
    AND (p_availability IS NULL OR c.availability = ANY(p_availability))
    AND (p_min_price IS NULL OR c.price >= p_min_price)
    AND (p_max_price IS NULL OR c.price <= p_max_price)
    AND (p_icing_colors IS NULL OR c.icing_colors = p_icing_colors)
    AND (
      c.search_vector @@ v_tsquery
      OR (
        NOT EXISTS (
          SELECT 1
          FROM public.cakegenie_analysis_cache exact_c
          WHERE exact_c.original_image_url IS NOT NULL
            AND exact_c.slug IS NOT NULL
            AND exact_c.search_vector @@ v_tsquery
            AND (p_availability IS NULL OR exact_c.availability = ANY(p_availability))
            AND (p_min_price IS NULL OR exact_c.price >= p_min_price)
            AND (p_max_price IS NULL OR exact_c.price <= p_max_price)
            AND (p_icing_colors IS NULL OR exact_c.icing_colors = p_icing_colors)
        )
        AND greatest(
          word_similarity(p_query, coalesce(c.keywords, '')),
          word_similarity(p_query, replace(coalesce(c.slug, ''), '-', ' '))
        ) > 0.45
      )
    );

  RETURN v_count;
END;
$$;
