-- Migration: Add side-color fallback helper + coverage view + partial index
-- Date: 2026-06-08
--
-- Provides a single source of truth for the v3.15 side-color fallback chain
-- (side -> top -> alt_text) so the Option A backfill and any future data
-- quality fixes use identical logic. The helper is NOT wired into the
-- existing extract_icing_colors() trigger; we do not want to silently mask
-- future model regressions on the icing_design.colors.side key.
--
-- Objects:
--   1. public.cakegenie_alt_text_lead_color(p_alt_text text) — extracts the
--      leading color word/phrase from alt text and returns the matching
--      v3.14 palette hex (or NULL).
--   2. public.cakegenie_side_color_fallback(p_analysis_json jsonb,
--      p_alt_text text) — three-step chain: side -> top -> alt_text -> NULL.
--      Returns a hex (or NULL). The trigger's get_closest_icing_color()
--      bucketing is left to the trigger, not this function.
--   3. public.cakegenie_icing_color_coverage — audit view, security_invoker,
--      showing the current side-color state of every cached row plus what
--      the backfill would produce.
--   4. Partial index on (created_at, slug) WHERE icing_colors IS NULL, for
--      fast oldest-first NULL-row scans during re-analysis sweeps.

-- 1. Lead-color extractor. The v3.14 prompt's alt_text rule
--    (src/services/prompts/fallback-prompt.txt:941) enforces the structure
--    "[Color] [cake type] [occasion if visible] with [main topper/decoration]
--    and [secondary detail]" so the color is always the leading 1-3 words.
CREATE OR REPLACE FUNCTION public.cakegenie_alt_text_lead_color(p_alt_text text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_head text;
BEGIN
  IF p_alt_text IS NULL OR btrim(p_alt_text) = '' THEN
    RETURN NULL;
  END IF;

  -- Lowercase and strip leading whitespace and stray punctuation.
  v_head := lower(regexp_replace(btrim(p_alt_text), '^[[:space:].,;:]+', ''));
  IF v_head = '' THEN RETURN NULL; END IF;

  -- 2-word palette colors (matched before their single-word counterparts
  -- so "light blue" wins over "light", "navy blue" wins over "navy", etc.).
  IF v_head LIKE 'light blue%'   THEN RETURN '#87CEEB'; END IF;
  IF v_head LIKE 'light pink%'   THEN RETURN '#FFB6C1'; END IF;
  IF v_head LIKE 'hot pink%'     THEN RETURN '#FF69B4'; END IF;
  IF v_head LIKE 'dark red%'     THEN RETURN '#8B0000'; END IF;
  IF v_head LIKE 'light yellow%' THEN RETURN '#FFFFE0'; END IF;
  IF v_head LIKE 'light green%'  THEN RETURN '#90EE90'; END IF;
  IF v_head LIKE 'rose gold%'    THEN RETURN '#B76E79'; END IF;
  IF v_head LIKE 'navy blue%'    THEN RETURN '#000080'; END IF;

  -- 1-word palette colors (the rest of the v3.14 palette at
  -- src/services/prompts/fallback-prompt.txt:768-798).
  IF v_head LIKE 'white%'      THEN RETURN '#FFFFFF'; END IF;
  IF v_head LIKE 'black%'      THEN RETURN '#000000'; END IF;
  IF v_head LIKE 'gold%'       THEN RETURN '#FFD700'; END IF;
  IF v_head LIKE 'silver%'     THEN RETURN '#C0C0C0'; END IF;
  IF v_head LIKE 'pink%'       THEN RETURN '#FFC0CB'; END IF;
  IF v_head LIKE 'red%'        THEN RETURN '#FF0000'; END IF;
  IF v_head LIKE 'orange%'     THEN RETURN '#FFA500'; END IF;
  IF v_head LIKE 'yellow%'     THEN RETURN '#FFFF00'; END IF;
  IF v_head LIKE 'green%'      THEN RETURN '#008000'; END IF;
  IF v_head LIKE 'teal%'       THEN RETURN '#008080'; END IF;
  IF v_head LIKE 'blue%'       THEN RETURN '#0000FF'; END IF;
  IF v_head LIKE 'navy%'       THEN RETURN '#000080'; END IF;
  IF v_head LIKE 'purple%'     THEN RETURN '#800080'; END IF;
  IF v_head LIKE 'lavender%'   THEN RETURN '#E6E6FA'; END IF;
  IF v_head LIKE 'brown%'      THEN RETURN '#8B4513'; END IF;
  IF v_head LIKE 'tan%'        THEN RETURN '#D2B48C'; END IF;
  IF v_head LIKE 'beige%'      THEN RETURN '#F5F5DC'; END IF;
  IF v_head LIKE 'peach%'      THEN RETURN '#FFDAB9'; END IF;
  IF v_head LIKE 'coral%'      THEN RETURN '#FF7F50'; END IF;
  IF v_head LIKE 'mint%'       THEN RETURN '#98FF98'; END IF;
  IF v_head LIKE 'champagne%'  THEN RETURN '#F7E7CE'; END IF;
  IF v_head LIKE 'ivory%'      THEN RETURN '#FFFFF0'; END IF;

  -- Common synonyms that appear in the v3.14 prompt's own alt_text
  -- examples (fallback-prompt.txt:944 includes "Chocolate...") even
  -- though the palette does not list them. Map to the closest palette hex.
  IF v_head LIKE 'chocolate%'
     OR v_head LIKE 'coffee%'
     OR v_head LIKE 'mocha%'
     OR v_head LIKE 'caramel%' THEN
    RETURN '#8B4513';
  END IF;
  IF v_head LIKE 'cream%' OR v_head LIKE 'vanilla%' THEN
    RETURN '#FFFFF0';
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.cakegenie_alt_text_lead_color(text) IS
  'Extracts the leading 1-3 word color phrase from v3.14 alt_text and returns the matching palette hex. Used by cakegenie_side_color_fallback().';

-- 2. The fallback chain. Returns a hex (NOT a bucket) so the caller can
--    write it back to analysis_json->icing_design->colors->side and let
--    the existing update_cake_search_vector() trigger derive the icing_colors
--    bucket via get_closest_icing_color().
CREATE OR REPLACE FUNCTION public.cakegenie_side_color_fallback(
  p_analysis_json jsonb,
  p_alt_text text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_side text;
  v_top  text;
BEGIN
  -- Step 1: confident model output for side.
  IF p_analysis_json IS NOT NULL
     AND p_analysis_json ? 'icing_design'
     AND p_analysis_json->'icing_design' ? 'colors'
     AND jsonb_typeof(p_analysis_json->'icing_design'->'colors') = 'object' THEN
    v_side := nullif(
      btrim(p_analysis_json->'icing_design'->'colors'->>'side'),
      ''
    );
    IF v_side IS NOT NULL THEN
      RETURN v_side;
    END IF;

    -- Step 2: fall back to top.
    v_top := nullif(
      btrim(p_analysis_json->'icing_design'->'colors'->>'top'),
      ''
    );
    IF v_top IS NOT NULL THEN
      RETURN v_top;
    END IF;
  END IF;

  -- Step 3: derive from the alt_text leading color word.
  RETURN public.cakegenie_alt_text_lead_color(p_alt_text);
END;
$$;

COMMENT ON FUNCTION public.cakegenie_side_color_fallback(jsonb, text) IS
  'v3.15 CATEGORY 5 side-color fallback chain: side -> top -> alt_text -> NULL. Returns a hex; bucketing is the trigger''s job. NOT wired into extract_icing_colors() to keep model regressions visible.';

-- 3. Coverage view. security_invoker matches the pattern at
--    20260601000100_image_variants_coverage_view_security_invoker.sql.
--    Read-permission follows the calling role.
CREATE OR REPLACE VIEW public.cakegenie_icing_color_coverage
WITH (security_invoker = on)
AS
SELECT
  slug,
  created_at,
  analysis_json->'icing_design'->'colors'->>'side' AS side_raw,
  analysis_json->'icing_design'->'colors'->>'top'  AS top_raw,
  CASE
    WHEN length(coalesce(alt_text, '')) > 80
      THEN substring(alt_text, 1, 80) || '...'
    ELSE alt_text
  END AS alt_text_preview,
  icing_colors AS bucket,
  public.cakegenie_side_color_fallback(analysis_json, alt_text) AS derived_color_hex,
  public.get_closest_icing_color(
    public.cakegenie_side_color_fallback(analysis_json, alt_text)
  ) AS derived_bucket,
  CASE
    WHEN icing_colors IS NULL THEN 'missing'
    WHEN nullif(
      btrim(analysis_json->'icing_design'->'colors'->>'side'),
      ''
    ) IS NOT NULL THEN 'ok'
    WHEN nullif(
      btrim(analysis_json->'icing_design'->'colors'->>'top'),
      ''
    ) IS NOT NULL THEN 'derived_from_top'
    ELSE 'derived_from_alt_text'
  END AS status
FROM public.cakegenie_analysis_cache
WHERE analysis_json IS NOT NULL;

COMMENT ON VIEW public.cakegenie_icing_color_coverage IS
  'Audit view for the v3.15 side-color fix. status = ''missing'' rows are excluded from the icing_colors swatch filter; ''ok'' rows have a model-emitted side; ''derived_from_top'' / ''derived_from_alt_text'' indicate a previous backfill populated icing_colors from a fallback source. derived_color_hex / derived_bucket preview what the Option A backfill (PR 3) would write for each missing row.';

GRANT SELECT ON public.cakegenie_icing_color_coverage TO authenticated, anon;

-- 4. Partial index for fast oldest-first NULL-row scans.
CREATE INDEX IF NOT EXISTS idx_cakegenie_cache_null_icing_colors
  ON public.cakegenie_analysis_cache (created_at, slug)
  WHERE icing_colors IS NULL;
