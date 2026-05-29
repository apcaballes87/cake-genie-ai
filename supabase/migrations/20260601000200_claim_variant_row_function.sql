-- Migration: claim_variant_row RPC for the variant pipeline single-flight lock.
--
-- Why this is its own migration (not folded into the original add_image_variants
-- migration that already shipped to prod): the columns landed first so the
-- backfill could proceed; the lock function is added now alongside Phase 4
-- (webhook route). Splitting keeps each migration runnable in isolation
-- against any prior state.
--
-- The function performs the atomic conditional UPDATE described in
-- design.md §"Single-flight concurrency control" and returns 1 when the
-- claim succeeded, 0 when another worker already held it (or when the row
-- is `'ready'` against the same indexed source — the worker's own UPDATE
-- must not re-fire itself).
--
-- Safety:
--   - SECURITY INVOKER (default) — runs with the calling role's RLS context.
--     The webhook calls this as the service-role key, which bypasses RLS,
--     so RLS isn't a concern here. We deliberately do *not* mark this
--     SECURITY DEFINER because that would let any role with EXECUTE
--     permission claim arbitrary rows.
--   - Read+write happens in a single statement → no race window between
--     the existence check and the lock acquisition.
--
-- Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
--       Req 4.5, 9.3
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.cakegenie_claim_variant_row(text, text);

BEGIN;

CREATE OR REPLACE FUNCTION public.cakegenie_claim_variant_row(
    p_hash_arg text,
    effective_source_arg text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    rows_affected integer;
BEGIN
    UPDATE public.cakegenie_analysis_cache
    SET image_variants_status = 'running',
        image_variants_attempted_at = now()
    WHERE p_hash = p_hash_arg
      AND (
          -- Never indexed, or last attempt left the row in a re-runnable
          -- terminal state.
          image_variants_status IS NULL
          OR image_variants_status IN ('failed', 'partial', 'skipped', 'pending')
          -- Effective source has drifted since we last indexed (Req 9.3) —
          -- studio-edit completed, or the original URL was rewritten.
          OR (
              image_variants_status = 'ready'
              AND image_variants_indexed_source IS DISTINCT FROM effective_source_arg
          )
          -- Stale `'running'` lock: a hung function eventually frees its lock
          -- after 5 minutes. Vercel hard-caps function duration well below
          -- that, so this never preempts a real run.
          OR (
              image_variants_status = 'running'
              AND image_variants_attempted_at IS NOT NULL
              AND image_variants_attempted_at < now() - interval '5 minutes'
          )
      );

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected;
END;
$$;

COMMENT ON FUNCTION public.cakegenie_claim_variant_row(text, text) IS
'Single-flight claim for the variant pipeline. Returns 1 when the claim
succeeded, 0 otherwise. See design.md §"Single-flight concurrency control".';

COMMIT;
