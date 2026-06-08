-- Migration: Backfill missing icing_colors using v3.15 fallback chain
-- Date: 2026-06-08
-- Dry-run preview available via: SELECT * FROM cakegenie_icing_color_coverage WHERE status = 'missing' AND derived_color_hex IS NOT NULL;

-- Preview: 2105 rows would be updated, 14 truly missing remain unchanged
-- Run the UPDATE below when ready (remove -- from the UPDATE line).

-- UPDATE public.cakegenie_analysis_cache
-- SET icing_colors = public.get_closest_icing_color(
--     public.cakegenie_side_color_fallback(analysis_json, alt_text)
-- ),
--     updated_at = now()
-- WHERE icing_colors IS NULL
--   AND analysis_json IS NOT NULL
--   AND public.cakegenie_side_color_fallback(analysis_json, alt_text) IS NOT NULL;

-- Post-backfill verification:
-- SELECT status, count(*) AS n
-- FROM public.cakegenie_icing_color_coverage
-- GROUP BY status
-- ORDER BY n DESC;
