-- ===========================================================================
-- Cake image variant pipeline — schema additions
-- ===========================================================================
--
-- Adds the JSON manifest, status, and bookkeeping columns the variant
-- pipeline writes to. All columns are nullable with NULL defaults so this
-- migration is forward-compatible: existing reads of cakegenie_analysis_cache
-- keep working before any pipeline run, and PDPs fall back to original_image_url
-- when image_variants is NULL.
--
-- Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
-- Requirements covered by this migration:
--   Req 3.1, 3.2  — image_variants jsonb column, nullable, default NULL
--   Req 4.5, 9.3  — image_variants_status / image_variants_indexed_source
--                    enable single-flight + studio-edit re-run detection
--   Req 7.1, 7.11 — partial index supports the backfill SELECT
--   Req 13.1      — coverage view drives the rollout dashboard
--
-- Rollback DDL is in the paired runbook
-- (20260601000000_add_image_variants_to_analysis_cache.runbook.md).
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Variant manifest + worker bookkeeping columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.cakegenie_analysis_cache
  ADD COLUMN IF NOT EXISTS image_variants jsonb DEFAULT NULL,
  -- Pipeline state machine. NULL = never tried. The CHECK constraint below
  -- enforces the allowed value set.
  ADD COLUMN IF NOT EXISTS image_variants_status text DEFAULT NULL,
  -- Last time a worker tried to claim this row. Used by the 5-minute
  -- stale-claim guard inside the single-flight UPDATE (design §"Single-flight
  -- concurrency control").
  ADD COLUMN IF NOT EXISTS image_variants_attempted_at timestamptz DEFAULT NULL,
  -- Last time a worker successfully wrote a manifest. Set on the same UPDATE
  -- that writes image_variants when status becomes 'ready'.
  ADD COLUMN IF NOT EXISTS image_variants_indexed_at timestamptz DEFAULT NULL,
  -- The exact source URL the worker last indexed (studio_edited_image_url
  -- or original_image_url, whichever was the effective source). Compared
  -- against the current effective source to detect studio-edit changes
  -- and trigger a re-run while preventing the worker's own UPDATE from
  -- re-firing the webhook (Req 9.3, design §"Single-flight concurrency control").
  ADD COLUMN IF NOT EXISTS image_variants_indexed_source text DEFAULT NULL,
  -- Last error message when image_variants_status='failed' or 'partial'.
  -- Format: "<stage>: <message>" (e.g. "decode: invalid webp header").
  ADD COLUMN IF NOT EXISTS image_variants_error text DEFAULT NULL;

-- Allowed status values. A NULL status means "never attempted" (the CHECK
-- explicitly allows NULL).
ALTER TABLE public.cakegenie_analysis_cache
  DROP CONSTRAINT IF EXISTS cakegenie_analysis_cache_image_variants_status_check;

ALTER TABLE public.cakegenie_analysis_cache
  ADD CONSTRAINT cakegenie_analysis_cache_image_variants_status_check
  CHECK (
    image_variants_status IS NULL
    OR image_variants_status IN (
      'pending',  -- queued by webhook, claim not yet won
      'running',  -- worker holds the claim
      'ready',    -- manifest written, all variants present
      'partial',  -- manifest written, ≥1 variant succeeded but ≥1 failed
      'failed',   -- no manifest written; see image_variants_error
      'skipped'   -- effective source URL was empty (Req 5.4)
    )
  );

-- Backfill / re-run selection index. A row is eligible for the variant
-- pipeline when image_variants is NULL and at least one of the two source
-- URL columns is non-empty (studio-edited or original). Matches the WHERE
-- clause used by scripts/backfill-image-variants.ts.
CREATE INDEX IF NOT EXISTS idx_cakegenie_analysis_cache_variants_pending
  ON public.cakegenie_analysis_cache (created_at DESC)
  WHERE image_variants IS NULL
    AND (
      (studio_edited_image_url IS NOT NULL AND studio_edited_image_url <> '')
      OR
      (original_image_url IS NOT NULL AND original_image_url <> '')
    );

-- Status filter index. Used by ops queries that count failures or list
-- partial-success rows for follow-up.
CREATE INDEX IF NOT EXISTS idx_cakegenie_analysis_cache_variants_status
  ON public.cakegenie_analysis_cache (image_variants_status)
  WHERE image_variants_status IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Column comments — make schema self-describing for psql users.
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN public.cakegenie_analysis_cache.image_variants IS
  'Variant manifest written by the variant pipeline. Shape: { format: "webp", source: "studio_edited_image_url" | "original_image_url", variants: [{ width, url, bytes }, ...] }. NULL until the pipeline runs. PDP falls back to original_image_url when NULL.';

COMMENT ON COLUMN public.cakegenie_analysis_cache.image_variants_status IS
  'Variant pipeline state: NULL (never tried) | pending | running | ready | partial | failed | skipped. See cakegenie_analysis_cache_image_variants_status_check for allowed values.';

COMMENT ON COLUMN public.cakegenie_analysis_cache.image_variants_attempted_at IS
  'Last claim attempt by a variant pipeline worker. The 5-minute stale-claim guard releases hung claims by comparing now() against this timestamp.';

COMMENT ON COLUMN public.cakegenie_analysis_cache.image_variants_indexed_at IS
  'Last successful variant manifest write. Set on the same UPDATE that flips status to ''ready''.';

COMMENT ON COLUMN public.cakegenie_analysis_cache.image_variants_indexed_source IS
  'The source URL (studio_edited_image_url or original_image_url) the worker last indexed. Used to detect studio-edit changes and trigger a re-run while preventing the worker''s own UPDATE from re-firing the webhook.';

COMMENT ON COLUMN public.cakegenie_analysis_cache.image_variants_error IS
  'Last error from the variant pipeline when status is ''failed'' or ''partial''. Format: "<stage>: <message>".';

-- ---------------------------------------------------------------------------
-- 3. Coverage view — drives the rollout dashboard (Req 13.1).
-- ---------------------------------------------------------------------------
--
-- Eligibility: row has at least one non-empty source URL. Coverage:
-- image_variants is non-NULL. Failed: image_variants_status='failed'. Partial:
-- image_variants_status='partial'. The view is intentionally an aggregate so
-- the rollout dashboard can read a single row.

CREATE OR REPLACE VIEW public.cakegenie_image_variants_coverage AS
SELECT
  count(*) FILTER (
    WHERE COALESCE(NULLIF(studio_edited_image_url, ''), NULLIF(original_image_url, '')) IS NOT NULL
  ) AS eligible_rows,
  count(*) FILTER (WHERE image_variants IS NOT NULL) AS covered_rows,
  count(*) FILTER (WHERE image_variants_status = 'failed') AS failed_rows,
  count(*) FILTER (WHERE image_variants_status = 'partial') AS partial_rows
FROM public.cakegenie_analysis_cache;

COMMENT ON VIEW public.cakegenie_image_variants_coverage IS
  'Variant pipeline rollout dashboard. covered_rows / eligible_rows >= 0.90 marks the rollout as fully backfilled (spec Req 13.1).';

COMMIT;
