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
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_normalized_query TEXT;
  v_expanded_query TEXT;
  v_tsquery TSQUERY;
  v_phrase_tsquery TSQUERY;
  v_raw_terms TEXT[];
  v_term TEXT;
  v_query_parts TEXT[] := ARRAY[]::TEXT[];
  v_fuzzy_threshold REAL;
BEGIN
  v_normalized_query := trim(regexp_replace(
    regexp_replace(lower(coalesce(p_query, '')), '[^[:alnum:]_[:space:]-]+', ' ', 'g'),
    '\s+', ' ', 'g'
  ));
  IF v_normalized_query = '' THEN RETURN; END IF;

  v_expanded_query := public.expand_search_query(v_normalized_query);
  v_raw_terms := regexp_split_to_array(v_expanded_query, '\s+');
  FOREACH v_term IN ARRAY v_raw_terms LOOP
    v_term := regexp_replace(v_term, '[^[:alnum:]_]+', '', 'g');
    IF length(v_term) >= 2 THEN
      v_query_parts := array_append(v_query_parts, v_term || ':*');
    END IF;
  END LOOP;
  IF array_length(v_query_parts, 1) IS NULL THEN RETURN; END IF;

  v_tsquery := to_tsquery('english', array_to_string(v_query_parts, ' & '));
  IF array_length(regexp_split_to_array(v_normalized_query, '\s+'), 1) > 1 THEN
    v_phrase_tsquery := phraseto_tsquery('english', v_normalized_query);
  END IF;

  v_fuzzy_threshold := CASE
    WHEN length(regexp_replace(v_normalized_query, '[^[:alnum:]]', '', 'g')) < 5 THEN 0.58::REAL
    ELSE 0.45::REAL
  END;

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
      ts_rank_cd(
        ARRAY[0.05, 0.20, 0.75, 1.00]::REAL[],
        e.search_vector,
        v_tsquery,
        32
      )::REAL AS fts_rank,
      CASE
        WHEN v_phrase_tsquery IS NOT NULL AND e.search_vector @@ v_phrase_tsquery THEN 1.75::REAL
        ELSE 0.0::REAL
      END AS phrase_bonus,
      CASE
        WHEN lower(coalesce(e.keywords, '')) ILIKE '%' || v_normalized_query || '%' THEN 1.25::REAL
        ELSE 0.0::REAL
      END AS keyword_phrase_bonus,
      CASE
        WHEN replace(lower(coalesce(e.slug, '')), '-', ' ') ILIKE '%' || v_normalized_query || '%' THEN 0.40::REAL
        ELSE 0.0::REAL
      END AS slug_phrase_bonus,
      CASE
        WHEN lower(trim(coalesce(e.keywords, ''))) = v_normalized_query THEN 3.50::REAL
        ELSE 0.0::REAL
      END AS exact_keyword_bonus
    FROM eligible e
    WHERE e.search_vector @@ v_tsquery
  ),
  fuzzy_results AS (
    SELECT e.*,
      0.0::REAL AS fts_rank,
      0.0::REAL AS phrase_bonus,
      0.0::REAL AS keyword_phrase_bonus,
      0.0::REAL AS slug_phrase_bonus,
      0.0::REAL AS exact_keyword_bonus,
      greatest(
        word_similarity(v_normalized_query, coalesce(e.keywords, '')),
        similarity(v_normalized_query, coalesce(e.keywords, ''))
      )::REAL AS keyword_similarity,
      greatest(
        word_similarity(v_normalized_query, replace(coalesce(e.slug, ''), '-', ' ')),
        similarity(v_normalized_query, replace(coalesce(e.slug, ''), '-', ' '))
      )::REAL AS slug_similarity
    FROM eligible e
    WHERE NOT EXISTS (SELECT 1 FROM exact_results)
  ),
  combined AS (
    SELECT e.slug, e.keywords, e.original_image_url, e.price, e.alt_text,
      e.usage_count, e.p_hash, e.availability, e.analysis_json,
      e.image_width, e.image_height,
      (
        e.fts_rank * 6.0
        + e.phrase_bonus
        + e.keyword_phrase_bonus
        + e.slug_phrase_bonus
        + e.exact_keyword_bonus
        + least(coalesce(e.usage_count, 0), 1000)::REAL / 10000.0
      )::REAL AS rank_score
    FROM exact_results e
    UNION ALL
    SELECT f.slug, f.keywords, f.original_image_url, f.price, f.alt_text,
      f.usage_count, f.p_hash, f.availability, f.analysis_json,
      f.image_width, f.image_height,
      (
        f.keyword_similarity * 1.25
        + f.slug_similarity * 0.70
        + least(coalesce(f.usage_count, 0), 1000)::REAL / 10000.0
      )::REAL AS rank_score
    FROM fuzzy_results f
    WHERE greatest(f.keyword_similarity, f.slug_similarity) >= v_fuzzy_threshold
  )
  SELECT c.slug, c.keywords, c.original_image_url, c.price, c.alt_text,
    c.usage_count, c.p_hash, c.availability, c.analysis_json,
    c.image_width, c.image_height, c.rank_score
  FROM combined c
  ORDER BY c.rank_score DESC, c.slug ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
