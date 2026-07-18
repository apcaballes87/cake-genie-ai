-- Stop the variant webhook from reclaiming terminal rows when the worker's
-- own UPDATE did not change the effective source image.
--
-- Claim policy:
--   * NULL and explicit `pending` are claimable.
--   * `ready`, `failed`, `partial`, and `skipped` are claimable only when the
--     effective source differs from the source used by the last attempt.
--   * `running` is claimable only after its five-minute stale-lock timeout.
--
-- The route also ignores unchanged-source UPDATE webhooks before this RPC.
-- Keeping the rule here is the authoritative concurrency/state guard for
-- callers whose payload has no `old_record` and for non-webhook callers.

BEGIN;

CREATE OR REPLACE FUNCTION public.cakegenie_claim_variant_row(
    p_hash_arg text,
    effective_source_arg text
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    rows_affected integer;
BEGIN
    UPDATE public.cakegenie_analysis_cache
    SET image_variants_status = 'running',
        image_variants_attempted_at = now()
    WHERE p_hash = p_hash_arg
      AND (
          image_variants_status IS NULL
          OR image_variants_status = 'pending'
          OR (
              image_variants_status IN ('ready', 'failed', 'partial', 'skipped')
              AND image_variants_indexed_source IS DISTINCT FROM effective_source_arg
          )
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
'Single-flight claim for the variant pipeline. NULL and pending rows may run;
terminal rows run only after an effective-source change; running locks expire
after five minutes. Returns 1 when claimed and 0 otherwise.';

COMMIT;
