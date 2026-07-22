-- Collection membership is precision-first. It deliberately differs from the
-- shopper search fallback in two ways:
--   1. whole lexemes only (no prefix expansion such as "bl:*"), and
--   2. weight-A fields only (analyzed primary keyword/tags, not incidental SEO
--      copy, cake messages, or structural descriptions).
-- This keeps the ranking quality of search without admitting typo-similar or
-- loosely related cakes into permanent collection pages.

CREATE OR REPLACE FUNCTION public.search_collection_products(
  p_query text,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0,
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
  v_normalized_query text;
  v_tsquery tsquery;
  v_phrase_tsquery tsquery;
  v_raw_terms text[];
  v_term text;
  v_query_parts text[] := ARRAY[]::text[];
BEGIN
  v_normalized_query := trim(regexp_replace(
    regexp_replace(lower(coalesce(p_query, '')), '[^[:alnum:]_[:space:]-]+', ' ', 'g'),
    '[[:space:]]+', ' ', 'g'
  ));
  IF v_normalized_query = '' THEN RETURN; END IF;

  v_raw_terms := regexp_split_to_array(v_normalized_query, '[[:space:]]+');
  FOREACH v_term IN ARRAY v_raw_terms LOOP
    v_term := regexp_replace(v_term, '[^[:alnum:]_]+', '', 'g');
    IF length(v_term) >= 2 THEN
      v_query_parts := array_append(v_query_parts, v_term || ':A');
    END IF;
  END LOOP;
  IF array_length(v_query_parts, 1) IS NULL THEN RETURN; END IF;

  v_tsquery := to_tsquery('english', array_to_string(v_query_parts, ' & '));
  IF numnode(v_tsquery) = 0 THEN RETURN; END IF;

  IF array_length(v_raw_terms, 1) > 1 THEN
    v_phrase_tsquery := phraseto_tsquery('english', v_normalized_query);
  END IF;

  RETURN QUERY
  SELECT
    c.slug,
    c.keywords,
    c.original_image_url,
    c.price,
    c.alt_text,
    c.usage_count,
    c.p_hash,
    c.availability,
    c.analysis_json,
    c.image_width,
    c.image_height,
    (
      ts_rank_cd(c.search_vector, v_tsquery, 32) * 6.0
      + CASE
          WHEN v_phrase_tsquery IS NOT NULL AND c.search_vector @@ v_phrase_tsquery
            THEN 1.75
          ELSE 0.0
        END
      + CASE
          WHEN lower(coalesce(c.keywords, '')) ILIKE '%' || v_normalized_query || '%'
            THEN 1.25
          ELSE 0.0
        END
      + CASE
          WHEN replace(lower(coalesce(c.slug, '')), '-', ' ') ILIKE '%' || v_normalized_query || '%'
            THEN 0.40
          ELSE 0.0
        END
      + CASE
          WHEN lower(trim(coalesce(c.keywords, ''))) = v_normalized_query
            THEN 3.50
          ELSE 0.0
        END
      + least(coalesce(c.usage_count, 0), 1000)::real / 10000.0
    )::real AS rank_score
  FROM public.cakegenie_analysis_cache c
  WHERE c.original_image_url IS NOT NULL
    AND c.slug IS NOT NULL
    AND c.search_vector @@ v_tsquery
    AND (p_icing_colors IS NULL OR c.icing_colors = p_icing_colors)
  ORDER BY rank_score DESC, c.slug ASC
  LIMIT least(greatest(coalesce(p_limit, 30), 1), 100)
  OFFSET least(greatest(coalesce(p_offset, 0), 0), 10000);
END;
$$;

CREATE OR REPLACE FUNCTION public.search_collection_products_count(
  p_query text,
  p_icing_colors text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_normalized_query text;
  v_tsquery tsquery;
  v_raw_terms text[];
  v_term text;
  v_query_parts text[] := ARRAY[]::text[];
  v_count integer := 0;
BEGIN
  v_normalized_query := trim(regexp_replace(
    regexp_replace(lower(coalesce(p_query, '')), '[^[:alnum:]_[:space:]-]+', ' ', 'g'),
    '[[:space:]]+', ' ', 'g'
  ));
  IF v_normalized_query = '' THEN RETURN 0; END IF;

  v_raw_terms := regexp_split_to_array(v_normalized_query, '[[:space:]]+');
  FOREACH v_term IN ARRAY v_raw_terms LOOP
    v_term := regexp_replace(v_term, '[^[:alnum:]_]+', '', 'g');
    IF length(v_term) >= 2 THEN
      v_query_parts := array_append(v_query_parts, v_term || ':A');
    END IF;
  END LOOP;
  IF array_length(v_query_parts, 1) IS NULL THEN RETURN 0; END IF;

  v_tsquery := to_tsquery('english', array_to_string(v_query_parts, ' & '));
  IF numnode(v_tsquery) = 0 THEN RETURN 0; END IF;

  SELECT count(*)::integer
  INTO v_count
  FROM public.cakegenie_analysis_cache c
  WHERE c.original_image_url IS NOT NULL
    AND c.slug IS NOT NULL
    AND c.search_vector @@ v_tsquery
    AND (p_icing_colors IS NULL OR c.icing_colors = p_icing_colors);

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.search_collection_products(text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_collection_products_count(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_collection_products(text, integer, integer, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_collection_products_count(text, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_collection_products(text, integer, integer, text)
  IS 'Precision-only collection membership search over weight-A keyword/tag lexemes; no prefix or fuzzy fallback.';
COMMENT ON FUNCTION public.search_collection_products_count(text, text)
  IS 'Count companion for precision-only collection membership search.';
