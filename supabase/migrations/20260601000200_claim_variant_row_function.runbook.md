# Runbook: 20260601000200_claim_variant_row_function.sql

## What this migration does

Adds the `public.cakegenie_claim_variant_row(p_hash text, effective_source text)`
function used by the variant pipeline webhook route to atomically claim a
row for processing. Returns:

- `1` when the row is now claimed (caller proceeds)
- `0` when the row is already locked or already up-to-date (caller exits)

## Apply

```bash
# Local
supabase db reset    # full reset, includes this migration
# or
supabase db push     # apply only un-applied migrations to remote

# Production (Apply via SQL Editor or `supabase db push --linked`)
```

## Verify

```sql
-- Function exists and is callable
SELECT proname, prosrc IS NOT NULL AS has_body
FROM pg_proc
WHERE proname = 'cakegenie_claim_variant_row';

-- Smoke test: claim a never-indexed row, then claim again — second call
-- must return 0 because status is now 'running'.
SELECT public.cakegenie_claim_variant_row('<known-p-hash>', 'https://example.com/source.jpg');
SELECT public.cakegenie_claim_variant_row('<known-p-hash>', 'https://example.com/source.jpg');
-- Reset the row before re-running the smoke test:
UPDATE public.cakegenie_analysis_cache
SET image_variants_status = NULL, image_variants_attempted_at = NULL
WHERE p_hash = '<known-p-hash>';
```

## Rollback

```sql
DROP FUNCTION IF EXISTS public.cakegenie_claim_variant_row(text, text);
```

This is safe to drop independently of the column migration — the function
is purely additive.

## Status

- [ ] Applied to local dev
- [ ] Applied to staging (n/a — no separate staging DB)
- [ ] Applied to production
