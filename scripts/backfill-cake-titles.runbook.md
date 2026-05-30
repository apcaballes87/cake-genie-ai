# Runbook — Customizing PDP Title Reconstruction Backfill

Spec: `.kiro/specs/customizing-pdp-seo-fixes` (R6, R7, R10).
Script: `scripts/backfill-cake-titles.ts` · SQL: `scripts/sql/title_reconstruct_backfill.sql`
(already applied to the live DB as Supabase migration `create_seo_title_backup_and_apply_rpc`).

## What it does

Recomputes `cakegenie_analysis_cache.seo_title` for all ~10,591 rows using the
deterministic `buildCakeTitle()` (the same function the write path uses), e.g.
`Kuromi Cake - 1002` → `Kuromi-Inspired Lavender Floral Birthday Cake`.

- The numeric design code never appears in the title (kept as internal SKU/MPN only).
- `-Inspired` is added for entertainment/character IP (Sanrio, Disney, anime, KPop, etc.)
  so unlicensed character cakes don't imply an official license. Real brands
  (McDonald's, Jollibee, Red Horse, Shopee) do NOT get `-Inspired`.
- Titles never use `cake_messages` (customer PII / real names).

## Resilience (weak/patchy internet)

- Reads are paginated with retry + exponential backoff (up to 6 attempts/page).
- Each apply batch (default 200 rows) is ONE server-side transaction via the
  `apply_title_reconstruct_batch` RPC: a dropped connection commits the whole
  batch or none of it. No partial/corrupt rows.
- A local checkpoint (`artifacts/seo-ecommerce/.title-backfill-checkpoint.json`)
  records the last committed offset. Re-running `--confirm` RESUMES from there.
- The apply is idempotent (the RPC skips rows already at the target value), so
  resuming or accidentally double-running is always safe.

## Prerequisites

`.env`/`.env.local` must provide `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (the script uses the service-role key for writes).

## Procedure

### 1. Preview (no DB writes)

```bash
npx tsx scripts/backfill-cake-titles.ts
```

Writes `artifacts/seo-ecommerce/title-backfill-preview.csv` with columns
`slug,before,after,changed`. Review it — spot-check franchise `-Inspired`,
multicolor (color omitted), and occasion handling. **Do not proceed until the
preview looks right.**

### 2. Apply (transactional + backup)

```bash
npx tsx scripts/backfill-cake-titles.ts --confirm
```

- Backs up each changed row's old title to
  `cakegenie_analysis_cache_seo_title_backup` (migration_id `title_reconstruct_v1`)
  BEFORE updating, inside the same transaction.
- If the connection drops, just run the same command again — it resumes.
- Tuning: `--batch <n>` (default 200), `--page <n>` (default 1000).
  On a very weak link, smaller batches commit more often: `--confirm --batch 50`.
- `--reset-checkpoint` forces a clean restart (rarely needed; the apply is idempotent).

### 3. Refresh the live pages (ISR)

PDPs cache for `revalidate = 3600` (1 hour). Either wait up to an hour, or
revalidate changed slugs sooner via your on-demand revalidation path.

### 4. Verify

Re-run the SEO audit pipeline on a few slugs and confirm the `<title>` is the new
reconstructed value with no ` - NNNN` and ≤ 60 chars including ` | Genie.ph`.

## Rollback / restore

Restore ALL rows touched by this migration:

```bash
npx tsx scripts/backfill-cake-titles.ts --restore
```

Restore a single slug:

```bash
npx tsx scripts/backfill-cake-titles.ts --restore --slug kuromi-light-purple-1-tier-cake-e3c3
```

Restore reads the most-recent backup row per slug and writes it back.

## Retention

Keep `cakegenie_analysis_cache_seo_title_backup` for **at least 30 days** after
apply (operator responsibility — no automatic cleanup ships with this feature).

## New designs

The write path (`src/services/supabaseService.ts`) already builds `seo_title`
with `buildCakeTitle`, so designs fingerprinted after this backfill ship correct
titles automatically — the two paths cannot drift (shared `buildCakeTitle` +
`extractTitleInputFromAnalysis`).
