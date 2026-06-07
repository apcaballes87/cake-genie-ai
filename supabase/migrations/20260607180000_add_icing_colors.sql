-- Migration: Add icing_colors column to cakegenie_analysis_cache and support filtering in search functions.
-- Date: 2026-06-07

-- 1. Add icing_colors column of type text[]
ALTER TABLE public.cakegenie_analysis_cache ADD COLUMN IF NOT EXISTS icing_colors text[];

-- 2. Create GIN index on icing_colors for efficient array containment checks
CREATE INDEX IF NOT EXISTS idx_cakegenie_analysis_cache_icing_colors 
  ON public.cakegenie_analysis_cache USING gin(icing_colors);

-- 3. Helper function: hex_to_rgb
CREATE OR REPLACE FUNCTION public.hex_to_rgb(p_hex text, OUT r int, OUT g int, OUT b int)
RETURNS record AS $$
DECLARE
  v_clean text;
  v_val int;
BEGIN
  v_clean := ltrim(p_hex, '#');
  IF length(v_clean) = 3 THEN
    v_clean := regexp_replace(v_clean, '(.)', '\1\1', 'g');
  END IF;
  IF length(v_clean) = 6 THEN
    v_val := ('x' || v_clean)::bit(24)::int;
    r := (v_val >> 16) & 255;
    g := (v_val >> 8) & 255;
    b := v_val & 255;
  ELSE
    r := 255; g := 255; b := 255; -- fallback to white
  END IF;
EXCEPTION WHEN OTHERS THEN
  r := 255; g := 255; b := 255;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Helper function: get_closest_icing_color
CREATE OR REPLACE FUNCTION public.get_closest_icing_color(p_color text)
RETURNS text AS $$
DECLARE
  v_color text;
  v_hex text;
  v_r int;
  v_g int;
  v_b int;
  v_closest_name text;
  v_min_dist double precision := 999999;
  v_dist double precision;
  
  -- RGBs of the 10 canonical colors
  -- black: #1a1a1a (26, 26, 26)
  -- white: #e2e8f0 (226, 232, 240)
  -- blue: #60a5fa (96, 165, 250)
  -- red: #ef4444 (239, 68, 68)
  -- purple: #8b5cf6 (139, 92, 246)
  -- green: #22c55e (34, 197, 94)
  -- yellow: #facc15 (250, 204, 21)
  -- orange: #f97316 (249, 115, 22)
  -- brown: #92400e (146, 64, 14)
  -- pink: #ec4899 (236, 72, 153)
  
  v_color_names text[] := ARRAY['black', 'white', 'blue', 'red', 'purple', 'green', 'yellow', 'orange', 'brown', 'pink'];
  v_color_rs int[] := ARRAY[26, 226, 96, 239, 139, 34, 250, 249, 146, 236];
  v_color_gs int[] := ARRAY[26, 232, 165, 68, 92, 197, 204, 115, 64, 72];
  v_color_bs int[] := ARRAY[26, 240, 250, 68, 246, 94, 21, 22, 14, 153];
  i int;
BEGIN
  v_color := lower(trim(p_color));
  
  -- Keyword checks (highest priority)
  IF v_color LIKE '%black%' OR v_color LIKE '%dark%' THEN RETURN 'black'; END IF;
  IF v_color LIKE '%baby blue%' OR v_color LIKE '%turquoise%' OR v_color LIKE '%aqua%' OR v_color LIKE '%blue%' OR v_color LIKE '%cyan%' OR v_color LIKE '%teal%' OR v_color LIKE '%sky%' THEN RETURN 'blue'; END IF;
  IF v_color LIKE '%crimson%' OR v_color LIKE '%scarlet%' OR v_color LIKE '%maroon%' OR v_color LIKE '%red%' THEN RETURN 'red'; END IF;
  IF v_color LIKE '%lavender%' OR v_color LIKE '%purple%' OR v_color LIKE '%violet%' OR v_color LIKE '%lilac%' OR v_color LIKE '%mauve%' THEN RETURN 'purple'; END IF;
  IF v_color LIKE '%emerald%' OR v_color LIKE '%green%' OR v_color LIKE '%olive%' OR v_color LIKE '%lime%' OR v_color LIKE '%mint%' OR v_color LIKE '%sage%' THEN RETURN 'green'; END IF;
  IF v_color LIKE '%canary%' OR v_color LIKE '%yellow%' OR v_color LIKE '%lemon%' OR v_color LIKE '%gold%' THEN RETURN 'yellow'; END IF;
  IF v_color LIKE '%tangerine%' OR v_color LIKE '%orange%' OR v_color LIKE '%salmon%' OR v_color LIKE '%coral%' OR v_color LIKE '%peach%' THEN RETURN 'orange'; END IF;
  IF v_color LIKE '%chocolate%' OR v_color LIKE '%caramel%' OR v_color LIKE '%coffee%' OR v_color LIKE '%brown%' OR v_color LIKE '%mocha%' OR v_color LIKE '%tan%' THEN RETURN 'brown'; END IF;
  IF v_color LIKE '%magenta%' OR v_color LIKE '%fuchsia%' OR v_color LIKE '%blush%' OR v_color LIKE '%pink%' OR v_color LIKE '%rose%' THEN RETURN 'pink'; END IF;
  IF v_color LIKE '%light white%' OR v_color LIKE '%silver%' OR v_color LIKE '%white%' OR v_color LIKE '%cream%' OR v_color LIKE '%gray%' OR v_color LIKE '%grey%' THEN RETURN 'white'; END IF;

  -- Hex code parsing
  IF v_color ~ '#[0-9a-fA-F]{3,6}' THEN
    v_hex := (regexp_matches(v_color, '#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}'))[1];
    IF v_hex IS NOT NULL THEN
      -- Get RGB
      SELECT r, g, b INTO v_r, v_g, v_b FROM public.hex_to_rgb(v_hex);
      
      -- Find closest
      FOR i IN 1..10 LOOP
        v_dist := sqrt(power(v_r - v_color_rs[i], 2) + power(v_g - v_color_gs[i], 2) + power(v_b - v_color_bs[i], 2));
        IF v_dist < v_min_dist THEN
          v_min_dist := v_dist;
          v_closest_name := v_color_names[i];
        END IF;
      END LOOP;
      
      RETURN v_closest_name;
    END IF;
  END IF;

  RETURN 'white'; -- fallback
EXCEPTION WHEN OTHERS THEN
  RETURN 'white';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Helper function: extract_icing_colors
CREATE OR REPLACE FUNCTION public.extract_icing_colors(p_analysis_json jsonb)
RETURNS text[] AS $$
DECLARE
  v_colors text[];
BEGIN
  IF p_analysis_json IS NULL OR NOT (p_analysis_json ? 'icing_design') THEN
    RETURN ARRAY[]::text[];
  END IF;
  
  IF NOT (p_analysis_json->'icing_design' ? 'colors') OR jsonb_typeof(p_analysis_json->'icing_design'->'colors') <> 'object' THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT ARRAY_AGG(DISTINCT col) INTO v_colors
  FROM (
    SELECT public.get_closest_icing_color(val) as col
    FROM jsonb_each_text(p_analysis_json->'icing_design'->'colors') AS t(key, val)
    WHERE val IS NOT NULL AND val <> ''
  ) s
  WHERE col IS NOT NULL;

  RETURN COALESCE(v_colors, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Update search vector trigger function to also extract and store icing_colors
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

-- 7. Backfill existing cache rows to populate the icing_colors column
UPDATE public.cakegenie_analysis_cache 
SET icing_colors = public.extract_icing_colors(analysis_json) 
WHERE analysis_json IS NOT NULL;

-- 8. Drop and recreate search_products function to support p_icing_colors parameter
DROP FUNCTION IF EXISTS public.search_products(text, integer, integer, text[], numeric, numeric);

CREATE OR REPLACE FUNCTION public.search_products(
  p_query text,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0,
  p_availability text[] DEFAULT NULL::text[],
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_icing_colors text[] DEFAULT NULL::text[]
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
      AND (p_icing_colors IS NULL OR c.icing_colors && p_icing_colors)

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
      AND (p_icing_colors IS NULL OR c.icing_colors && p_icing_colors)
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

-- 9. Drop and recreate search_products_count function to support p_icing_colors parameter
DROP FUNCTION IF EXISTS public.search_products_count(text, text[], numeric, numeric);

CREATE OR REPLACE FUNCTION public.search_products_count(
  p_query text,
  p_availability text[] DEFAULT NULL::text[],
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_icing_colors text[] DEFAULT NULL::text[]
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
END;
$$;

-- Wait, the body was cut in search_products_count, let's write it fully:
CREATE OR REPLACE FUNCTION public.search_products_count(
  p_query text,
  p_availability text[] DEFAULT NULL::text[],
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_icing_colors text[] DEFAULT NULL::text[]
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
      AND (p_icing_colors IS NULL OR c.icing_colors && p_icing_colors)
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
      AND (p_icing_colors IS NULL OR c.icing_colors && p_icing_colors)
  ) sub;

  RETURN v_count;
END;
$$;
