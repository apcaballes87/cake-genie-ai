# Runbook: `strip_id_leak_v1` — Strip ID Leak from `seo_title`

Companion runbook for the SQL migration `20260526120000_strip_id_leak_from_seo_title.sql`.

## 1. What this migration does

The `strip_id_leak_v1` migration removes leaked internal numeric IDs from cached SEO titles in `cakegenie_analysis_cache.seo_title` so that no PDP rendered by `/customizing/[slug]` displays an `<h1>` or `<title>` containing a trailing ID-leak pattern such as ` - 1002`. The removal is scoped to the regex `\s-\s\d{2,}(?=\s|$)` — a space-hyphen-space prefix, two or more digits, terminated by a whitespace boundary or end-of-string. Only the trailing occurrence per row is stripped; mid-string matches are preserved verbatim. This satisfies Requirement 7 from the [requirements document](../../.kiro/specs/customizing-pdp-seo-fixes/requirements.md) and is the data-only counterpart to the application-level fixes for the `/customizing/[slug]` route. The migration ships three SQL functions (`strip_id_leak_preview()`, `strip_id_leak_apply()`, `strip_id_leak_restore(p_slug, p_migration_id)`) plus a backup table; the migration body itself does **not** mutate any row — apply mode is operator-invoked per R7.8.

## 2. Prerequisites

- **Supabase access level:** service-role / database admin. The functions execute `UPDATE` against `cakegenie_analysis_cache` and write to `cakegenie_analysis_cache_seo_title_backup`; the anon role does not have these privileges.
- **Connection method:** any one of —
  - Supabase Studio SQL editor (recommended for first-time operators — easiest to copy-paste, eyeball, and abort).
  - `psql` against the project's connection string (recommended for batch operations or scripted rollouts).
  - `supabase db push` followed by interactive `supabase db query` invocations.
- **Dry-run prerequisites (must be confirmed before apply):**
  1. The SQL migration `20260526120000_strip_id_leak_from_seo_title.sql` has already been applied (the migration body creates the backup table and the three functions but does **not** mutate data).
  2. The backup table exists and is empty for this `migration_id`:
     ```sql
     SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name   = 'cakegenie_analysis_cache_seo_title_backup'
     ) AS backup_table_exists;
     SELECT COUNT(*) FROM cakegenie_analysis_cache_seo_title_backup
     WHERE migration_id = 'strip_id_leak_v1';   -- expect 0 on first apply
     ```
  3. A **baseline preview** has been captured and matches expectations (see Step 1 below). If the baseline diverges from the count or shape that engineering signed off on, stop and investigate before proceeding.

## 3. Step-by-step operator commands

Run the steps below **in order**. Do not skip ahead.

### Step 1 — Run the preview

```sql
SELECT * FROM strip_id_leak_preview();
```

The function returns one row per affected slug with three columns:

| column             | meaning                                                                 |
|--------------------|-------------------------------------------------------------------------|
| `slug`             | The row identifier in `cakegenie_analysis_cache`.                       |
| `seo_title_before` | The current cached `seo_title` value.                                    |
| `seo_title_after`  | The post-strip value that `strip_id_leak_apply()` will write.            |

Capture the row count: this is the number of rows that the apply step will mutate (R7.1).

### Step 2 — Eyeball the diff

Read every row returned by Step 1 (or, for very large diffs, sample the head, the tail, and a uniform-random middle slice). Stop and investigate **before** running apply if any of the following conditions hold:

- The row count is dramatically different from the expected baseline (an order of magnitude higher or lower than the engineering sign-off number).
- Any `seo_title_after` value looks malformed — for example, ends with a stray hyphen, contains double spaces, has a leading or trailing space, or is the empty string.
- Any `seo_title_before` value has a non-trailing match that the operator expected to be stripped (the regex strips only the **trailing** occurrence — see Section 7 for worked examples and Section 8 for the rationale).

Do not proceed to Step 3 until every row in the diff looks correct.

### Step 3 — Apply

```sql
SELECT strip_id_leak_apply();
```

The function returns a single `INTEGER` equal to the number of rows actually updated. Record this number — call it `APPLIED_COUNT` — in the operations log alongside the apply timestamp and operator handle:

```text
strip_id_leak_apply() returned: ____ rows   (APPLIED_COUNT)
applied at: YYYY-MM-DD HH:MM:SS TZ
operator:   <your-handle>
migration_id: strip_id_leak_v1
```

The apply happens inside a single implicit transaction — backup writes and `UPDATE`s commit or roll back together (R7.4).

### Step 4 — Verify the backup landed

```sql
SELECT COUNT(*) AS backup_row_count
FROM   cakegenie_analysis_cache_seo_title_backup
WHERE  migration_id = 'strip_id_leak_v1';
```

Expected: `backup_row_count` equals `APPLIED_COUNT` from Step 3. If the two numbers differ, do **not** drop the backup table and do **not** re-run apply — escalate, then refer to Section 6 (rollback safety) and Section 8 (gotchas).

### Step 5 (optional) — Re-run preview to confirm idempotence

```sql
SELECT * FROM strip_id_leak_preview();
```

Expected: zero rows. The regex no longer matches any cached `seo_title`, which confirms idempotence (R7.3). If any rows are returned, those rows were not covered by the apply — investigate before any further action.

### Step 6 — Wait for ISR refresh, or force it

Affected PDPs are cached by Next.js with `revalidate = 3600` (the `ISR_Window`). Choose one path:

- **Wait for ISR to elapse.** After 3601 s from the Step 3 apply timestamp, the next HTTP GET against each `/customizing/<slug>` URL triggers a fresh server render that picks up the updated `seo_title`. No operator action required. Use this when the affected count is large and there is no immediate user-facing pressure.
- **Force immediate refresh.** Invoke the optional script from Task 5.3 (`scripts/revalidate-affected-slugs.ts`) to call `revalidatePath('/customizing/<slug>')` on every affected slug:
  ```bash
  pnpm tsx scripts/revalidate-affected-slugs.ts --migration-id strip_id_leak_v1
  ```
  Use this when you need the kuromi (or other high-traffic) PDP to render the fixed title immediately, including for the audit-pipeline check in Step 7. If the Task 5.3 script has not shipped yet, fall back to waiting for ISR.

### Step 7 — Re-run the audit pipeline against the kuromi URL

Once the affected PDP has refreshed (Step 6), run the audit pipeline against the canonical kuromi URL to confirm the fix is visible end-to-end (R7.6):

```bash
python .agent/skills/scripts/fetch_page.py \
  --url https://genie.ph/customizing/kuromi-light-purple-1-tier-cake-e3c3 \
  --out /tmp/kuromi.html
python .agent/skills/scripts/parse_html.py \
  --in /tmp/kuromi.html --json --out /tmp/kuromi.json
```

Inspect `/tmp/kuromi.json` and confirm:

- The `title` field does **not** contain the substring ` - 1002`.
- The first element of the `h1` array does **not** contain the substring ` - 1002`.

If either still contains ` - 1002`, the cache hasn't refreshed (re-do Step 6 with Option B) or there is a CDN edge layer holding the old HTML (purge the affected paths from the CDN). Do **not** re-run apply.

## 4. Restore procedures (R7.9)

Two cases. After either case, repeat Step 6 (ISR refresh) so the rendered HTML reverts as well.

### 4.1 Per-slug restore

When a single row was mistakenly trimmed (for example, a hand-curated title that was inadvertently caught by the regex):

```sql
SELECT strip_id_leak_restore(p_slug => 'specific-slug-here');
```

This restores the original `seo_title` for that slug only. Expected return: `1` (one row restored).

### 4.2 Full restore (catastrophic regression)

When the entire migration must be rolled back:

```sql
SELECT strip_id_leak_restore();
```

With no arguments, the function defaults `p_slug` to `NULL` and `p_migration_id` to `'strip_id_leak_v1'`, restoring every row that was modified by this migration. Expected return: an integer equal to `APPLIED_COUNT` (modulo any rows already individually restored in Section 4.1).

## 5. Backup retention policy (R7.5)

- **Minimum retention:** 30 days post-apply. This is **operator responsibility**; no automated cleanup ships with this feature.
- **Why 30 days:** SERP snippets, cached-image services, and downstream search-console reports may continue to surface the pre-strip title for several days after the change goes live. Retaining the backup for 30 days gives engineering a comfortable window to confirm no unintended regression and, if needed, restore.
- **After 30 days:** the operator may `DROP` the backup table or scope-delete its rows if disk space is a concern, but only after confirming no further restore is anticipated. Recommended scoped delete:

  ```sql
  DELETE FROM cakegenie_analysis_cache_seo_title_backup
  WHERE  migration_id = 'strip_id_leak_v1'
    AND  backed_up_at < NOW() - INTERVAL '30 days';
  ```

  Drop the entire table only if no other migration uses it.

There is no Postgres job, cron, or trigger that performs this cleanup automatically. Track the apply date in your operations log.

## 6. Rollback safety

`strip_id_leak_apply()` performs the backup write and the row update inside a **single transaction** (R7.4). The function uses a single SQL statement composed of two CTEs (`targets`, `inserted`) feeding the final `UPDATE`; either the entire statement commits or the entire statement rolls back. There is no partial state to repair.

If `strip_id_leak_apply()` raises an error:

1. The transaction has rolled back automatically. Both `cakegenie_analysis_cache` and `cakegenie_analysis_cache_seo_title_backup` are unchanged.
2. Capture the full error message from the SQL client.
3. Re-run Step 1 (preview) to confirm no partial state — the row count and per-row diff should be identical to the pre-apply baseline.
4. Investigate the error message before any retry. Common causes:
   - **Lock contention** on `cakegenie_analysis_cache` from a competing writer. Retry during a quieter traffic window.
   - **Privilege error** — the connecting role lacks `UPDATE` on `cakegenie_analysis_cache`. Re-connect using the service-role / db-admin credentials called out in Section 2.
5. Once the root cause is fixed, return to Step 3 and re-run apply. Because nothing was written on the failed attempt, idempotence is unaffected.

## 7. Worked examples

The four canonical worked examples from R7.2:

| input (`seo_title_before`)              | output (`seo_title_after`)        | note                                          |
|-----------------------------------------|-----------------------------------|-----------------------------------------------|
| `Kuromi Cake - 1002 Cake Design`        | `Kuromi Cake Cake Design`         | trailing match before whitespace stripped     |
| `Strawberry Cake - 47`                  | `Strawberry Cake - 47` (unchanged) | digit count below 2 — regex does not match    |
| `Strawberry Cake - 1002`                | `Strawberry Cake`                 | trailing match at end-of-string stripped      |
| `Sample - 12 something - 99 cake`       | `Sample - 12 something cake`      | only the **trailing** match is removed; the mid-string ` - 12` is preserved |

Sanity-check these in any environment before approving an apply by running:

```sql
SELECT input, regexp_replace(input, '\s-\s\d{2,}(?=\s|$)', '') AS output
FROM (VALUES
  ('Kuromi Cake - 1002 Cake Design'),
  ('Strawberry Cake - 47'),
  ('Strawberry Cake - 1002'),
  ('Sample - 12 something - 99 cake')
) AS t(input);
```

The four output rows must match the table above exactly.

## 8. Common operator gotchas

- **The migration body alone does NOT mutate data.** Applying the SQL file (`supabase db push` or equivalent) only creates the backup table and the three functions. `strip_id_leak_apply()` must be invoked manually per Step 3 — there is no environment variable, deploy hook, or CI step that runs it automatically. This is by design (R7.8).
- **The regex matches only the *trailing* ID-leak.** Mid-string ID-like patterns (e.g. the ` - 12` in `Sample - 12 something - 99 cake`) are preserved. If a future revision needs to strip non-trailing matches, the regex must be changed deliberately, the worked-example table updated, and a new `migration_id` chosen.
- **Re-applying is safe (idempotent) but wastes a no-op transaction.** Running `strip_id_leak_apply()` a second time on the same dataset returns `0`, writes nothing to the backup table, and leaves all rows untouched (R7.3). It is not harmful but adds a row in the database statistics with no benefit; prefer to confirm via preview (Step 5) instead of re-applying.
- **ISR cache means the change is not immediately visible on the live site.** After apply, the rendered HTML continues to show the old title until either (a) `ISR_Window = 3600` seconds have elapsed *and* an HTTP GET has reached the server, or (b) the operator forces refresh via the Task 5.3 `revalidatePath` script. Audit-pipeline checks against the live URL will fail until one of those two conditions is met.
