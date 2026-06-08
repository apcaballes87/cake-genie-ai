-- Migration: Simplify icing_colors to a single `text` column extracted from icing_design.colors.side only.
-- Date: 2026-06-07
--
-- Replaces the previous text[] column (which aggregated all colors keys: top, side, borderTop, borderBase,
-- drip, gumpasteBaseBoardColor) with a single text column that stores the canonical bucket name for
-- the `side` icing color only. Missing/empty `side` values resolve to NULL so the SQL `=` filter naturally
-- excludes them from any color swatch result.

-- 1. Drop the GIN index — no longer needed (we filter with `=`, not `&&`).
DROP INDEX IF EXISTS public.idx_cakegenie_analysis_cache_icing_colors;

-- 2. Drop and recreate the column at the same name, switching type from text[] to text.
ALTER TABLE public.cakegenie_analysis_cache DROP COLUMN IF EXISTS icing_colors;
ALTER TABLE public.cakegenie_analysis_cache ADD COLUMN icing_colors text;

-- 3. Replace extract_icing_colors(): now returns a single text (bucket name) for the `side` color.
--    Returns NULL when the `side` value is missing or empty.
CREATE OR REPLACE FUNCTION public.extract_icing_colors(p_analysis_json jsonb)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_side text;
BEGIN
  IF p_analysis_json IS NULL THEN RETURN NULL; END IF;
  IF NOT (p_analysis_json ? 'icing_design') THEN RETURN NULL; END IF;
  IF NOT (p_analysis_json->'icing_design' ? 'colors') THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_analysis_json->'icing_design'->'colors') <> 'object' THEN RETURN NULL; END IF;

  v_side := p_analysis_json->'icing_design'->'colors'->>'side';
  IF v_side IS NULL OR btrim(v_side) = '' THEN RETURN NULL; END IF;

  RETURN public.get_closest_icing_color(v_side);
END;
$$;

-- 4. The trigger body that calls extract_icing_colors() is unchanged — only the function signature
--    changed (text[] → text), and the assignment target column is now text. The function is
--    recreated idempotently to ensure the latest body is in place even if a previous migration
--    applied a different version.
CREATE OR REPLACE FUNCTION public.update_cake_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := build_cake_search_vector(
    NEW.keywords, NEW.alt_text, NEW.slug, NEW.analysis_json
  );
  NEW.searchable_text := build_searchable_text(
    NEW.keywords, NEW.alt_text, NEW.slug, NEW.analysis_json
  );
  NEW.icing_colors := public.extract_icing_colors(NEW.analysis_json);
  RETURN NEW;
END;
$$;

-- 5. Backfill all existing cache rows to populate the new icing_colors text column.
UPDATE public.cakegenie_analysis_cache
SET icing_colors = public.extract_icing_colors(analysis_json)
WHERE analysis_json IS NOT NULL;

-- 6. Drop and recreate search_products() to switch p_icing_colors from text[] to text.
DROP FUNCTION IF EXISTS public.search_products(text, integer, integer, text[], numeric, numeric, text[]);

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
AS $$
DECLARE
  v_tsquery    tsquery;
  v_raw_terms  TEXT[];
  v_term       TEXT;
  v_query_parts TEXT[] := ARRAY[]::TEXT[];
BEGIN
  p_query := trim(lower(p_query));
  IF p_query = '' OR p_query IS NULL THEN
    RETURN;
  END IF;

  v_raw_terms := regexp_split_to_array(p_query, '\s+');

  FOREACH v_term IN ARRAY v_raw_terms
  LOOP
    IF length(v_term) >= 2 THEN
      v_query_parts := array_append(v_query_parts, v_term || ':*');
    END IF;
  END LOOP;

  IF array_length(v_query_parts, 1) IS NULL THEN
    RETURN;
  END IF;

  v_tsquery := to_tsquery('english', array_to_string(v_query_parts, ' & '));

  RETURN QUERY
  WITH fts_results AS (
    -- Primary: Full-text search via GIN index
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
      ts_rank_cd(c.search_vector, v_tsquery, 32)::REAL AS fts_rank,
      0::REAL AS trgm_sim
    FROM cakegenie_analysis_cache c
    WHERE c.search_vector @@ v_tsquery
      AND c.original_image_url IS NOT NULL
      AND c.slug IS NOT NULL
      AND (p_availability IS NULL OR c.availability = ANY(p_availability))
      AND (p_min_price IS NULL OR c.price >= p_min_price)
      AND (p_max_price IS NULL OR c.price <= p_max_price)
      AND (p_icing_colors IS NULL OR c.icing_colors = p_icing_colors)

    UNION ALL

    -- Fallback: trigram fuzzy match on keywords + alt_text for typo tolerance
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
      0::REAL AS fts_rank,
      GREATEST(
        word_similarity(p_query, COALESCE(c.keywords, '')),
        word_similarity(p_query, COALESCE(c.alt_text, ''))
      )::REAL AS trgm_sim
    FROM cakegenie_analysis_cache c
    WHERE (
        word_similarity(p_query, COALESCE(c.keywords, '')) > 0.4
        OR word_similarity(p_query, COALESCE(c.alt_text, '')) > 0.4
      )
      AND c.original_image_url IS NOT NULL
      AND c.slug IS NOT NULL
      AND NOT c.search_vector @@ v_tsquery
      AND (p_availability IS NULL OR c.availability = ANY(p_availability))
      AND (p_min_price IS NULL OR c.price >= p_min_price)
      AND (p_max_price IS NULL OR c.price <= p_max_price)
      AND (p_icing_colors IS NULL OR c.icing_colors = p_icing_colors)
  ),
  deduped AS (
    SELECT DISTINCT ON (r.slug)
      r.slug,
      r.keywords,
      r.original_image_url,
      r.price,
      r.alt_text,
      r.usage_count,
      r.p_hash,
      r.availability,
      r.analysis_json,
      r.image_width,
      r.image_height,
      (r.fts_rank * 5.0 + r.trgm_sim + LEAST(COALESCE(r.usage_count, 0), 1000)::REAL / 10000.0)::REAL AS rank_score
    FROM fts_results r
    ORDER BY r.slug, (r.fts_rank * 5.0 + r.trgm_sim) DESC
  )
  SELECT
    d.slug,
    d.keywords,
    d.original_image_url,
    d.price,
    d.alt_text,
    d.usage_count,
    d.p_hash,
    d.availability,
    d.analysis_json,
    d.image_width,
    d.image_height,
    d.rank_score
  FROM deduped d
  ORDER BY d.rank_score DESC, d.slug ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 7. Drop and recreate search_products_count() to switch p_icing_colors from text[] to text.
DROP FUNCTION IF EXISTS public.search_products_count(text, text[], numeric, numeric, text[]);

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
AS $$
DECLARE
  v_tsquery    tsquery;
  v_raw_terms  TEXT[];
  v_term       TEXT;
  v_query_parts TEXT[] := ARRAY[]::TEXT[];
  v_count      INT := 0;
BEGIN
  p_query := trim(lower(p_query));
  IF p_query = '' OR p_query IS NULL THEN
    RETURN 0;
  END IF;

  v_raw_terms := regexp_split_to_array(p_query, '\s+');
  FOREACH v_term IN ARRAY v_raw_terms
  LOOP
    IF length(v_term) >= 2 THEN
      v_query_parts := array_append(v_query_parts, v_term || ':*');
    END IF;
  END LOOP;

  IF array_length(v_query_parts, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_tsquery := to_tsquery('english', array_to_string(v_query_parts, ' & '));

  SELECT COUNT(DISTINCT sub.slug) INTO v_count
  FROM (
    SELECT c.slug
    FROM cakegenie_analysis_cache c
    WHERE c.search_vector @@ v_tsquery
      AND c.original_image_url IS NOT NULL
      AND c.slug IS NOT NULL
      AND (p_availability IS NULL OR c.availability = ANY(p_availability))
      AND (p_min_price IS NULL OR c.price >= p_min_price)
      AND (p_max_price IS NULL OR c.price <= p_max_price)
      AND (p_icing_colors IS NULL OR c.icing_colors = p_icing_colors)
    UNION ALL
    SELECT c.slug
    FROM cakegenie_analysis_cache c
    WHERE (
        word_similarity(p_query, COALESCE(c.keywords, '')) > 0.4
        OR word_similarity(p_query, COALESCE(c.alt_text, '')) > 0.4
      )
      AND c.original_image_url IS NOT NULL
      AND c.slug IS NOT NULL
      AND NOT c.search_vector @@ v_tsquery
      AND (p_availability IS NULL OR c.availability = ANY(p_availability))
      AND (p_min_price IS NULL OR c.price >= p_min_price)
      AND (p_max_price IS NULL OR c.price <= p_max_price)
      AND (p_icing_colors IS NULL OR c.icing_colors = p_icing_colors)
  ) sub;

  RETURN v_count;
END;
$$;
