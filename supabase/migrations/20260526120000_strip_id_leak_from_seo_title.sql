-- Migration: strip_id_leak_from_seo_title
-- Feature: customizing-pdp-seo-fixes (R7)
--
-- Purpose
--   Remove leaked internal numeric IDs from cached SEO titles in
--   cakegenie_analysis_cache.seo_title. The leaked substring matches
--   the regex \s-\s\d{2,}\s*$ — a space-hyphen-space prefix
--   followed by 2+ digits, optional trailing whitespace, anchored to
--   end-of-string. Mid-string occurrences are NEVER matched (R7.2).
--
-- Worked examples (R7.2)
--   'Kuromi Cake - 1002'                  -> 'Kuromi Cake'
--   'Kuromi Cake - 1002 Cake Design'      -> unchanged (digit run not at EOS)
--   'Strawberry Cake - 47'                -> 'Strawberry Cake'
--   'Strawberry Cake - 5'                 -> unchanged (single digit)
--   'Sample - 12 something - 99'          -> 'Sample - 12 something'
--                                            (mid-string ' - 12' preserved)
--
-- Operator workflow (R7.8 — apply mode is operator-invoked, NOT auto-run)
--   1. Apply this migration file (creates backup table + 3 functions; no
--      data is mutated). Standard `supabase db push` is sufficient.
--   2. SELECT * FROM strip_id_leak_preview();              -- inspect diff
--   3. SELECT strip_id_leak_apply();                       -- mutates rows
--   4. (optional) SELECT strip_id_leak_restore('<slug>');  -- rollback per-row
--      or         SELECT strip_id_leak_restore();          -- rollback all
--
-- Idempotence (R7.3): re-running apply after the first invocation updates
-- zero rows; preview returns zero rows.
--
-- Atomicity (R7.4): apply runs as a single statement (CTE) inside the
-- function's implicit transaction — backup writes and UPDATEs commit or
-- roll back together.
--
-- Backup retention (R7.5): backup rows are retained indefinitely by
-- schema; 30-day retention is an operator policy, not enforced here.
--
-- This migration body MUST NOT call strip_id_leak_apply(). Operators
-- invoke it explicitly per R7.8.

-- ---------------------------------------------------------------------------
-- Backup table (R7.5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cakegenie_analysis_cache_seo_title_backup (
  slug TEXT NOT NULL,
  seo_title_before TEXT NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  migration_id TEXT NOT NULL DEFAULT 'strip_id_leak_v1',
  PRIMARY KEY (slug, migration_id, backed_up_at)
);

-- ---------------------------------------------------------------------------
-- Preview (R7.1): returns count + per-row before/after, no writes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION strip_id_leak_preview()
RETURNS TABLE (slug TEXT, seo_title_before TEXT, seo_title_after TEXT)
LANGUAGE sql STABLE AS $$
  SELECT
    slug,
    seo_title AS seo_title_before,
    regexp_replace(seo_title, '\s-\s\d{2,}\s*$', '') AS seo_title_after
  FROM cakegenie_analysis_cache
  WHERE seo_title ~ '\s-\s\d{2,}\s*$';
$$;

-- ---------------------------------------------------------------------------
-- Apply (R7.2, R7.4, R7.7): transactional UPDATE + backup.
-- Returns the number of rows actually updated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION strip_id_leak_apply()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  affected INTEGER;
BEGIN
  -- Single statement: backup-then-update via CTE, all atomic within the
  -- function's implicit transaction (R7.4).
  WITH targets AS (
    SELECT slug, seo_title
    FROM cakegenie_analysis_cache
    WHERE seo_title ~ '\s-\s\d{2,}\s*$'
  ),
  inserted AS (
    INSERT INTO cakegenie_analysis_cache_seo_title_backup
      (slug, seo_title_before)
    SELECT slug, seo_title FROM targets
    RETURNING slug
  )
  UPDATE cakegenie_analysis_cache c
  SET seo_title = regexp_replace(c.seo_title, '\s-\s\d{2,}\s*$', '')
  FROM inserted i
  WHERE c.slug = i.slug;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ---------------------------------------------------------------------------
-- Restore (R7.9): writes seo_title_before back to cakegenie_analysis_cache
-- for either a specific slug or every slug backed up under p_migration_id.
-- Returns the number of rows actually restored.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION strip_id_leak_restore(
  p_slug TEXT DEFAULT NULL,
  p_migration_id TEXT DEFAULT 'strip_id_leak_v1'
)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE cakegenie_analysis_cache c
  SET seo_title = b.seo_title_before
  FROM cakegenie_analysis_cache_seo_title_backup b
  WHERE c.slug = b.slug
    AND b.migration_id = p_migration_id
    AND (p_slug IS NULL OR b.slug = p_slug);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
