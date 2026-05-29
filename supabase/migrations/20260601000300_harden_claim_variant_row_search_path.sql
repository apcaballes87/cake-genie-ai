-- Migration: pin the search_path on cakegenie_claim_variant_row.
--
-- Hardens the function against the `function_search_path_mutable` advisor
-- (Supabase database linter rule 0011). With a mutable search_path, a
-- role with a hostile schema earlier in its search order could shadow
-- `cakegenie_analysis_cache` or `now()` to redirect or sabotage the
-- claim. Pinning to `public, pg_temp` removes that vector.
--
-- Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
--       Req 4.5 (security hardening side-task)
--
-- Rollback: drop the SET via `ALTER FUNCTION ... RESET search_path` —
-- the function body itself is unchanged.

ALTER FUNCTION public.cakegenie_claim_variant_row(text, text)
SET search_path = public, pg_temp;
