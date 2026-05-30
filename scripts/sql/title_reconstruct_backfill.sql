-- Title-reconstruction backfill: backup table + atomic apply/restore RPCs.
-- Applied to the live DB via Supabase migration `create_seo_title_backup_and_apply_rpc`.
-- Kept here for version control. Spec: .kiro/specs/customizing-pdp-seo-fixes (R7).
--
-- The TS backfill (scripts/backfill-cake-titles.ts) computes each new title with
-- buildCakeTitle() and calls apply_title_reconstruct_batch() one batch per
-- network round-trip. Each call is a single transaction: a dropped connection
-- commits the whole batch or none of it. Restore is per-slug or whole-migration.

CREATE TABLE IF NOT EXISTS cakegenie_analysis_cache_seo_title_backup (
  slug             TEXT NOT NULL,
  seo_title_before TEXT,
  backed_up_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  migration_id     TEXT NOT NULL DEFAULT 'title_reconstruct_v1',
  PRIMARY KEY (slug, migration_id, backed_up_at)
);

CREATE OR REPLACE FUNCTION apply_title_reconstruct_batch(
  p_items        JSONB,
  p_migration_id TEXT DEFAULT 'title_reconstruct_v1'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_changed INTEGER;
BEGIN
  WITH incoming AS (
    SELECT (e->>'slug')::TEXT AS slug, (e->>'seo_title')::TEXT AS new_title
    FROM jsonb_array_elements(p_items) AS e
  ),
  targets AS (
    SELECT c.slug, c.seo_title AS old_title, i.new_title
    FROM cakegenie_analysis_cache c
    JOIN incoming i ON i.slug = c.slug
    WHERE c.seo_title IS DISTINCT FROM i.new_title
  ),
  backup AS (
    INSERT INTO cakegenie_analysis_cache_seo_title_backup (slug, seo_title_before, migration_id)
    SELECT slug, old_title, p_migration_id FROM targets
    RETURNING slug
  ),
  upd AS (
    UPDATE cakegenie_analysis_cache c
    SET seo_title = t.new_title
    FROM targets t
    WHERE c.slug = t.slug
    RETURNING c.slug
  )
  SELECT COUNT(*) INTO v_changed FROM upd;
  RETURN v_changed;
END;
$$;

CREATE OR REPLACE FUNCTION restore_title_reconstruct(
  p_slug         TEXT DEFAULT NULL,
  p_migration_id TEXT DEFAULT 'title_reconstruct_v1'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_restored INTEGER;
BEGIN
  WITH latest AS (
    SELECT DISTINCT ON (slug) slug, seo_title_before
    FROM cakegenie_analysis_cache_seo_title_backup
    WHERE migration_id = p_migration_id
      AND (p_slug IS NULL OR slug = p_slug)
    ORDER BY slug, backed_up_at DESC
  ),
  upd AS (
    UPDATE cakegenie_analysis_cache c
    SET seo_title = l.seo_title_before
    FROM latest l
    WHERE c.slug = l.slug
    RETURNING c.slug
  )
  SELECT COUNT(*) INTO v_restored FROM upd;
  RETURN v_restored;
END;
$$;
