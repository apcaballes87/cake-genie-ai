-- Search aliases are query-level synonyms, not product data. Keep them small,
-- explicit, and service-role managed so a typo or generic term cannot silently
-- broaden every catalog result.
CREATE TABLE IF NOT EXISTS public.cakegenie_search_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL,
  canonical_term TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cakegenie_search_aliases_alias_not_blank CHECK (btrim(alias) <> ''),
  CONSTRAINT cakegenie_search_aliases_canonical_not_blank CHECK (btrim(canonical_term) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_search_aliases_alias_lower
  ON public.cakegenie_search_aliases (lower(alias));

CREATE INDEX IF NOT EXISTS idx_search_aliases_active_priority
  ON public.cakegenie_search_aliases (is_active, priority DESC);

ALTER TABLE public.cakegenie_search_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cakegenie_search_aliases FROM anon, authenticated;

INSERT INTO public.cakegenie_search_aliases (alias, canonical_term, priority)
VALUES
  ('bday', 'birthday', 100),
  ('b-day', 'birthday', 100),
  ('lunchbox', 'bento', 90),
  ('lunch box', 'bento', 90),
  ('cup cake', 'cupcake', 80),
  ('spider man', 'spiderman', 70)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.expand_search_query(p_query text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_query TEXT := trim(lower(regexp_replace(coalesce(p_query, ''), '[^[:alnum:]_[:space:]-]+', ' ', 'g')));
  v_alias RECORD;
BEGIN
  v_query := regexp_replace(v_query, '\s+', ' ', 'g');

  FOR v_alias IN
    SELECT lower(alias) AS alias, lower(canonical_term) AS canonical_term
    FROM public.cakegenie_search_aliases
    WHERE is_active
    ORDER BY priority DESC, length(alias) DESC
  LOOP
    IF v_query = v_alias.alias
       OR v_query LIKE v_alias.alias || ' %'
       OR v_query LIKE '% ' || v_alias.alias
       OR v_query LIKE '% ' || v_alias.alias || ' %'
    THEN
      IF v_query = v_alias.alias THEN
        v_query := v_alias.canonical_term;
      ELSIF v_query LIKE v_alias.alias || ' %' THEN
        v_query := v_alias.canonical_term || substr(v_query, length(v_alias.alias) + 1);
      ELSIF v_query LIKE '% ' || v_alias.alias THEN
        v_query := substr(v_query, 1, length(v_query) - length(v_alias.alias)) || v_alias.canonical_term;
      ELSE
        v_query := replace(v_query, ' ' || v_alias.alias || ' ', ' ' || v_alias.canonical_term || ' ');
      END IF;
    END IF;
  END LOOP;

  RETURN v_query;
END;
$$;

ALTER TABLE public.cakegenie_search_analytics
  ADD COLUMN IF NOT EXISTS typed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suggestion_click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result_observation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zero_result_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_result_count INTEGER,
  ADD COLUMN IF NOT EXISTS last_result_source TEXT,
  ADD COLUMN IF NOT EXISTS last_action TEXT;

CREATE OR REPLACE FUNCTION public.log_search_keyword(
  p_search_term text,
  p_action_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_term TEXT := trim(lower(regexp_replace(coalesce(p_search_term, ''), '\s+', ' ', 'g')));
  v_action TEXT := lower(trim(coalesce(p_action_type, '')));
BEGIN
  IF length(v_term) < 3 OR v_action NOT IN ('typed', 'clicked', 'product_click') THEN
    RETURN;
  END IF;

  INSERT INTO public.cakegenie_search_analytics (
    search_term,
    search_count,
    click_count,
    typed_count,
    suggestion_click_count,
    product_click_count,
    last_searched_at,
    last_action
  )
  VALUES (
    v_term,
    CASE WHEN v_action = 'typed' THEN 1 ELSE 0 END,
    CASE WHEN v_action = 'clicked' THEN 1 ELSE 0 END,
    CASE WHEN v_action = 'typed' THEN 1 ELSE 0 END,
    CASE WHEN v_action = 'clicked' THEN 1 ELSE 0 END,
    CASE WHEN v_action = 'product_click' THEN 1 ELSE 0 END,
    now(),
    v_action
  )
  ON CONFLICT (search_term)
  DO UPDATE SET
    search_count = coalesce(public.cakegenie_search_analytics.search_count, 0)
      + CASE WHEN v_action = 'typed' THEN 1 ELSE 0 END,
    click_count = coalesce(public.cakegenie_search_analytics.click_count, 0)
      + CASE WHEN v_action = 'clicked' THEN 1 ELSE 0 END,
    typed_count = coalesce(public.cakegenie_search_analytics.typed_count, 0)
      + CASE WHEN v_action = 'typed' THEN 1 ELSE 0 END,
    suggestion_click_count = coalesce(public.cakegenie_search_analytics.suggestion_click_count, 0)
      + CASE WHEN v_action = 'clicked' THEN 1 ELSE 0 END,
    product_click_count = coalesce(public.cakegenie_search_analytics.product_click_count, 0)
      + CASE WHEN v_action = 'product_click' THEN 1 ELSE 0 END,
    last_searched_at = now(),
    last_action = v_action;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_search_result(
  p_search_term text,
  p_result_count integer,
  p_source text DEFAULT 'search_page'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_term TEXT := trim(lower(regexp_replace(coalesce(p_search_term, ''), '\s+', ' ', 'g')));
  v_count INTEGER := greatest(coalesce(p_result_count, 0), 0);
  v_source TEXT := left(trim(coalesce(p_source, 'unknown')), 40);
BEGIN
  IF length(v_term) < 3 THEN
    RETURN;
  END IF;

  INSERT INTO public.cakegenie_search_analytics (
    search_term,
    result_observation_count,
    zero_result_count,
    last_result_count,
    last_result_source,
    last_searched_at,
    last_action
  )
  VALUES (
    v_term,
    1,
    CASE WHEN v_count = 0 THEN 1 ELSE 0 END,
    v_count,
    v_source,
    now(),
    'result'
  )
  ON CONFLICT (search_term)
  DO UPDATE SET
    result_observation_count = coalesce(public.cakegenie_search_analytics.result_observation_count, 0) + 1,
    zero_result_count = coalesce(public.cakegenie_search_analytics.zero_result_count, 0)
      + CASE WHEN v_count = 0 THEN 1 ELSE 0 END,
    last_result_count = v_count,
    last_result_source = v_source,
    last_searched_at = now(),
    last_action = 'result';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_popular_keywords(p_limit integer DEFAULT 8)
RETURNS TABLE(search_term text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT a.search_term
  FROM public.cakegenie_search_analytics a
  WHERE length(trim(a.search_term)) >= 3
  ORDER BY (
    coalesce(a.search_count, 0)
    + (coalesce(a.click_count, 0) * 2)
    + coalesce(a.product_click_count, 0)
  ) DESC,
  a.last_searched_at DESC NULLS LAST,
  a.search_term ASC
  LIMIT least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

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
        ARRAY[0.05, 0.20, 0.75, 1.60]::REAL[],
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

CREATE OR REPLACE FUNCTION public.search_products_count(
  p_query text,
  p_availability text[] DEFAULT NULL::text[],
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_icing_colors text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_normalized_query TEXT;
  v_expanded_query TEXT;
  v_tsquery TSQUERY;
  v_raw_terms TEXT[];
  v_term TEXT;
  v_query_parts TEXT[] := ARRAY[]::TEXT[];
  v_fuzzy_threshold REAL;
  v_count INTEGER := 0;
BEGIN
  v_normalized_query := trim(regexp_replace(
    regexp_replace(lower(coalesce(p_query, '')), '[^[:alnum:]_[:space:]-]+', ' ', 'g'),
    '\s+', ' ', 'g'
  ));
  IF v_normalized_query = '' THEN RETURN 0; END IF;

  v_expanded_query := public.expand_search_query(v_normalized_query);
  v_raw_terms := regexp_split_to_array(v_expanded_query, '\s+');
  FOREACH v_term IN ARRAY v_raw_terms LOOP
    v_term := regexp_replace(v_term, '[^[:alnum:]_]+', '', 'g');
    IF length(v_term) >= 2 THEN
      v_query_parts := array_append(v_query_parts, v_term || ':*');
    END IF;
  END LOOP;
  IF array_length(v_query_parts, 1) IS NULL THEN RETURN 0; END IF;

  v_tsquery := to_tsquery('english', array_to_string(v_query_parts, ' & '));
  v_fuzzy_threshold := CASE
    WHEN length(regexp_replace(v_normalized_query, '[^[:alnum:]]', '', 'g')) < 5 THEN 0.58::REAL
    ELSE 0.45::REAL
  END;

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
    SELECT e.slug
    FROM eligible e
    WHERE e.search_vector @@ v_tsquery
  ),
  fuzzy_results AS (
    SELECT e.slug
    FROM eligible e
    CROSS JOIN LATERAL (
      SELECT greatest(
        word_similarity(v_normalized_query, coalesce(e.keywords, '')),
        similarity(v_normalized_query, coalesce(e.keywords, '')),
        word_similarity(v_normalized_query, replace(coalesce(e.slug, ''), '-', ' ')),
        similarity(v_normalized_query, replace(coalesce(e.slug, ''), '-', ' '))
      )::REAL AS best_similarity
    ) score
    WHERE NOT EXISTS (SELECT 1 FROM exact_results)
      AND score.best_similarity >= v_fuzzy_threshold
  )
  SELECT count(*) INTO v_count
  FROM (
    SELECT slug FROM exact_results
    UNION ALL
    SELECT slug FROM fuzzy_results
  ) matches;

  RETURN v_count;
END;
$$;
