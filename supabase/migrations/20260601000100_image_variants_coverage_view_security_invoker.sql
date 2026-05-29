-- ===========================================================================
-- Switch cakegenie_image_variants_coverage view to SECURITY INVOKER
-- ===========================================================================
--
-- The coverage view from 20260601000000_add_image_variants_to_analysis_cache.sql
-- was created with the default SECURITY DEFINER behavior, which the Supabase
-- advisor flags because the view runs with creator privileges instead of the
-- caller's. Since the view only aggregates counts from cakegenie_analysis_cache
-- (a public table) and we want it to respect any RLS the caller has, set
-- security_invoker so it runs as the calling role.
-- ===========================================================================

ALTER VIEW public.cakegenie_image_variants_coverage SET (security_invoker = true);
