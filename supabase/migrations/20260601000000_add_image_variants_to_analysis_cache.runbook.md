# Migration runbook — `add_image_variants_to_analysis_cache`

Migration file: `20260601000000_add_image_variants_to_analysis_cache.sql`

Adds the columns + index + coverage view that the cake image variant pipeline
needs. Spec: `.kiro/specs/cake-image-variant-pipeline/{requirements,design}.md`.

## What this migration does

Adds the following to `public.cakegenie_analysis_cache`:

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| `image_variants` | `jsonb` | `NULL` | The variant manifest. PDP renders srcset from this when non-NULL. |
| `image_variants_status` | `text` | `NULL` | State machine: `NULL` / `pending` / `running` / `ready` / `partial` / `failed` / `skipped`. CHECK constraint enforces. |
| `image_variants_attempted_at` | `timestamptz` | `NULL` | Last claim attempt. Drives the 5-min stale-claim guard. |
| `image_variants_indexed_at` | `timestamptz` | `NULL` | Last successful manifest write. |
| `image_variants_indexed_source` | `text` | `NULL` | The exact source URL the worker last processed. Detects studio-edit changes. |
| `image_variants_error` | `text` | `NULL` | Last failure message, format `<stage>: <message>`. |

Plus:

- `cakegenie_analysis_cache_image_variants_status_check` — CHECK constraint on the status column.
- `idx_cakegenie_analysis_cache_variants_pending` — partial index on `(created_at DESC)` filtering rows ready for backfill / pipeline run.
- `idx_cakegenie_analysis_cache_variants_status` — partial index on `image_variants_status` for ops queries.
- `cakegenie_image_variants_coverage` — aggregate view returning `eligible_rows`, `covered_rows`, `failed_rows`, `partial_rows` for the rollout dashboard.

## Forward compatibility

All new columns are nullable with `NULL` defaults, and the migration only
**adds** structure — no existing reads or writes change behavior. Code that
selects existing columns continues to work without change. The only
constraint that can refuse a write is the status CHECK; it permits `NULL`
and six explicit values, so any UPDATE that doesn't touch
`image_variants_status` is unaffected.

## Pre-apply checks

Run on the target database before applying:

```sql
-- Confirm no prior partial migration left the columns behind.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cakegenie_analysis_cache'
  AND column_name LIKE 'image_variants%';
-- Expect 0 rows on first apply. If any rows come back, this migration is
-- already partially applied — investigate before proceeding.

-- Snapshot the row count for after-comparison.
SELECT count(*) AS rows_before FROM public.cakegenie_analysis_cache;

-- Confirm the studio-edited / original columns we depend on are present.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cakegenie_analysis_cache'
  AND column_name IN ('studio_edited_image_url', 'original_image_url');
-- Expect exactly 2 rows. If either is missing, abort — earlier migrations
-- (20260414103000_add_image_studio_fields_to_analysis_cache.sql) must
-- run first.
```

## Apply

Use Supabase Studio SQL editor or `supabase db push`:

```bash
# Local development
supabase db reset                 # rebuild from scratch including this file

# Production
supabase db push                  # if managed via CLI
# OR copy-paste the SQL into Studio's SQL editor
```

Expected runtime on a table with ~8000 rows: well under 1 second. The
ALTER TABLE adds nullable columns, which doesn't rewrite the table.

## Post-apply verification

```sql
-- 1. All six new columns exist with the right defaults.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cakegenie_analysis_cache'
  AND column_name LIKE 'image_variants%'
ORDER BY column_name;
-- Expect 6 rows. All defaults NULL, all nullable=YES.

-- 2. The CHECK constraint exists.
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.cakegenie_analysis_cache'::regclass
  AND conname = 'cakegenie_analysis_cache_image_variants_status_check';
-- Expect 1 row.

-- 3. The two indexes exist.
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'cakegenie_analysis_cache'
  AND indexname LIKE 'idx_cakegenie_analysis_cache_variants%';
-- Expect 2 rows.

-- 4. The coverage view returns one row with four counts.
SELECT * FROM public.cakegenie_image_variants_coverage;
-- Expect 1 row. covered_rows starts at 0; eligible_rows reflects current
-- inventory.

-- 5. Insert a test row (or update one) and confirm the CHECK constraint
--    rejects an invalid status.
DO $$
BEGIN
  PERFORM 1 FROM public.cakegenie_analysis_cache LIMIT 1;
  IF FOUND THEN
    BEGIN
      UPDATE public.cakegenie_analysis_cache
      SET image_variants_status = 'invalid_value'
      WHERE p_hash = (SELECT p_hash FROM public.cakegenie_analysis_cache LIMIT 1);
      RAISE EXCEPTION 'CHECK constraint did not reject invalid status';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'CHECK constraint correctly rejected invalid status.';
    END;
  END IF;
END$$;
```

## Rollback

Tiered, lightest first.

### Tier 1 — Disable srcset rendering globally (instant, no schema change)

If the variant pipeline is misbehaving and PDPs need to fall back to the
original URLs immediately:

```sql
-- Force every PDP to render the legacy original_image_url path.
-- Variant objects in storage remain (unreferenced) until cleanup.
UPDATE public.cakegenie_analysis_cache SET image_variants = NULL;
```

The renderer treats `image_variants IS NULL` as "fall back to
`studio_edited_image_url ?? original_image_url`" (design § PDP fallback chain).

### Tier 2 — Stop the pipeline (no data change)

Disable the Supabase Database Webhook on `cakegenie_analysis_cache` from the
dashboard (Database → Webhooks → toggle off). New uploads stop producing
variants; existing manifests keep rendering normally.

### Tier 3 — Drop the schema (last resort)

```sql
BEGIN;

DROP VIEW IF EXISTS public.cakegenie_image_variants_coverage;

DROP INDEX IF EXISTS public.idx_cakegenie_analysis_cache_variants_pending;
DROP INDEX IF EXISTS public.idx_cakegenie_analysis_cache_variants_status;

ALTER TABLE public.cakegenie_analysis_cache
  DROP CONSTRAINT IF EXISTS cakegenie_analysis_cache_image_variants_status_check;

ALTER TABLE public.cakegenie_analysis_cache
  DROP COLUMN IF EXISTS image_variants,
  DROP COLUMN IF EXISTS image_variants_status,
  DROP COLUMN IF EXISTS image_variants_attempted_at,
  DROP COLUMN IF EXISTS image_variants_indexed_at,
  DROP COLUMN IF EXISTS image_variants_indexed_source,
  DROP COLUMN IF EXISTS image_variants_error;

COMMIT;
```

Before running this: ship a release first that removes
`parseManifest(design.image_variants)` from the renderers and removes
`image_variants` from any SELECT column lists, otherwise PostgREST will
return errors when the column is missing.

## What this migration does NOT do

- It does not write to `image_variants` for any existing row. Backfill is a
  separate phase (Phase 7 in the spec, run via
  `tsx scripts/backfill-image-variants.ts`).
- It does not configure the Supabase Database Webhook. That happens in
  Phase 4.4 of the spec, in the Supabase dashboard.
- It does not change behavior of any existing column or index.

## Notes

- The `image_variants_indexed_source` column is the gate that prevents the
  worker's own UPDATE from re-firing the webhook. See design
  § "Single-flight concurrency control".
- The partial index uses the same WHERE clause as the backfill SELECT to
  ensure the planner picks it up. If you change one, change both.
- The coverage view is intentionally cheap (one aggregate scan) so the
  rollout dashboard can poll it daily without putting load on the database.
