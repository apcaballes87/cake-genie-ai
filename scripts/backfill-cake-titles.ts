/**
 * Title-reconstruction backfill for /customizing/[slug] PDPs.
 * Spec: .kiro/specs/customizing-pdp-seo-fixes (R7).
 *
 * Recomputes seo_title for ALL ~10,591 cakegenie_analysis_cache rows using the
 * deterministic buildCakeTitle() (the same function the write path uses), then:
 *   - preview (default): writes a before/after CSV, NO DB writes.
 *   - --confirm:         applies via the atomic apply_title_reconstruct_batch RPC.
 *   - --restore:         restores seo_title from the backup table (R7.9).
 *
 * RESILIENCE (designed for weak/patchy internet):
 *   - Reads are paginated (1000/page) with retry + exponential backoff.
 *   - Each apply batch (default 200 rows) is ONE server-side transaction (RPC):
 *     a dropped connection commits the whole batch or none of it.
 *   - A local checkpoint file records the last fully-committed offset, so a
 *     re-run with --confirm resumes instead of restarting. The apply itself is
 *     idempotent (the RPC skips rows already at the target value), so resuming
 *     or double-running is always safe.
 *
 * Usage:
 *   npx tsx scripts/backfill-cake-titles.ts                 # preview → CSV
 *   npx tsx scripts/backfill-cake-titles.ts --confirm       # apply (resumable)
 *   npx tsx scripts/backfill-cake-titles.ts --restore       # restore all
 *   npx tsx scripts/backfill-cake-titles.ts --restore --slug <slug>
 *   Flags: --batch <n> (default 200), --page <n> (default 1000), --reset-checkpoint
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { buildCakeTitle, extractTitleInputFromAnalysis } from '../src/lib/seo/cakeTitle';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIGRATION_ID = 'title_reconstruct_v1';

const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/seo-ecommerce');
const PREVIEW_CSV = path.join(ARTIFACT_DIR, 'title-backfill-preview.csv');
const CHECKPOINT = path.join(ARTIFACT_DIR, '.title-backfill-checkpoint.json');

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(1);
}

// ---- CLI args -------------------------------------------------------------
const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string, d: number): number => {
    const i = args.indexOf(f);
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d;
};
const flagVal = (f: string): string | null => {
    const i = args.indexOf(f);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

const MODE_CONFIRM = has('--confirm');
const MODE_RESTORE = has('--restore');
const RESTORE_SLUG = flagVal('--slug');
const PAGE_SIZE = val('--page', 1000);
const BATCH_SIZE = val('--batch', 200);
const RESET_CHECKPOINT = has('--reset-checkpoint');

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
});

// ---- resilience helpers ---------------------------------------------------

/** Retry an async op with exponential backoff + jitter. Tuned for flaky links. */
async function withRetry<T>(label: string, fn: () => Promise<T>, maxAttempts = 6): Promise<T> {
    let attempt = 0;
    // 1.5s, 3s, 6s, 12s, 24s (capped), + jitter
    while (true) {
        try {
            return await fn();
        } catch (err: unknown) {
            attempt += 1;
            if (attempt >= maxAttempts) {
                console.error(`✗ ${label} failed after ${attempt} attempts.`);
                throw err;
            }
            const base = Math.min(1500 * 2 ** (attempt - 1), 24000);
            const wait = base + Math.floor(Math.random() * 750);
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`… ${label} attempt ${attempt} failed (${msg}). Retrying in ${(wait / 1000).toFixed(1)}s`);
            await new Promise((r) => setTimeout(r, wait));
        }
    }
}

interface CacheRow {
    slug: string;
    seo_title: string | null;
    keywords: string | null;
    tags: (string | null)[] | null;
    analysis_json: Record<string, unknown> | null;
}

interface Checkpoint {
    migration_id: string;
    appliedOffset: number; // number of rows (sorted by slug) confirmed processed
    changed: number;
    startedAt: string;
    updatedAt: string;
}

function readCheckpoint(): Checkpoint | null {
    try {
        if (fs.existsSync(CHECKPOINT)) {
            return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) as Checkpoint;
        }
    } catch { /* ignore corrupt checkpoint */ }
    return null;
}

function writeCheckpoint(cp: Checkpoint): void {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2));
}

function csvCell(s: string | null | undefined): string {
    const v = s ?? '';
    return `"${v.replace(/"/g, '""')}"`;
}

function computeTitle(row: CacheRow): string {
    return buildCakeTitle(
        extractTitleInputFromAnalysis(
            (row.analysis_json ?? {}) as Parameters<typeof extractTitleInputFromAnalysis>[0],
            row.keywords,
            row.tags,
        ),
    );
}

/** Fetch one page of rows ordered by slug (stable order for resumable offset). */
async function fetchPage(offset: number): Promise<CacheRow[]> {
    return withRetry(`fetch rows ${offset}..${offset + PAGE_SIZE - 1}`, async () => {
        const { data, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('slug, seo_title, keywords, tags, analysis_json')
            .order('slug', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        return (data ?? []) as CacheRow[];
    });
}

// ---- modes ----------------------------------------------------------------

async function runRestore(): Promise<void> {
    console.log(`Restoring seo_title from backup (migration_id=${MIGRATION_ID}${RESTORE_SLUG ? `, slug=${RESTORE_SLUG}` : ', ALL rows'})...`);
    const restored = await withRetry('restore', async () => {
        const { data, error } = await supabase.rpc('restore_title_reconstruct', {
            p_slug: RESTORE_SLUG,
            p_migration_id: MIGRATION_ID,
        });
        if (error) throw new Error(error.message);
        return data as number;
    });
    console.log(`✓ Restored ${restored} row(s).`);
}

async function runBackfill(): Promise<void> {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

    if (RESET_CHECKPOINT && fs.existsSync(CHECKPOINT)) {
        fs.unlinkSync(CHECKPOINT);
        console.log('Checkpoint reset.');
    }

    let cp = MODE_CONFIRM ? readCheckpoint() : null;
    let startOffset = 0;
    if (cp && cp.migration_id === MIGRATION_ID) {
        startOffset = cp.appliedOffset;
        console.log(`Resuming from checkpoint: offset=${startOffset}, changed-so-far=${cp.changed}`);
    } else {
        cp = {
            migration_id: MIGRATION_ID,
            appliedOffset: 0,
            changed: 0,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    // Preview CSV is (re)written fresh only on a non-resumed run.
    const writingCsv = !MODE_CONFIRM || startOffset === 0;
    if (writingCsv) {
        fs.writeFileSync(PREVIEW_CSV, 'slug,before,after,changed\n');
    }

    let offset = startOffset;
    let totalSeen = startOffset;
    let totalChanged = cp.changed;
    let pendingBatch: { slug: string; seo_title: string }[] = [];

    const flushBatch = async (): Promise<void> => {
        if (pendingBatch.length === 0) return;
        if (!MODE_CONFIRM) {
            pendingBatch = [];
            return;
        }
        const items = pendingBatch;
        const changed = await withRetry(`apply batch (${items.length} rows @ offset ${totalSeen})`, async () => {
            const { data, error } = await supabase.rpc('apply_title_reconstruct_batch', {
                p_items: items,
                p_migration_id: MIGRATION_ID,
            });
            if (error) throw new Error(error.message);
            return data as number;
        });
        totalChanged += changed;
        // Checkpoint AFTER the batch transaction has committed server-side.
        cp = {
            migration_id: MIGRATION_ID,
            appliedOffset: totalSeen,
            changed: totalChanged,
            startedAt: cp!.startedAt,
            updatedAt: new Date().toISOString(),
        };
        writeCheckpoint(cp);
        pendingBatch = [];
        console.log(`  ✓ committed batch → ${changed} changed (cumulative ${totalChanged}); checkpoint @ ${totalSeen}`);
    };

    /* eslint-disable no-await-in-loop */
    while (true) {
        const rows = await fetchPage(offset);
        if (rows.length === 0) break;

        for (const row of rows) {
            totalSeen += 1;
            const next = computeTitle(row);
            const changed = (row.seo_title ?? '') !== next;
            if (writingCsv) {
                fs.appendFileSync(
                    PREVIEW_CSV,
                    `${csvCell(row.slug)},${csvCell(row.seo_title)},${csvCell(next)},${changed ? 1 : 0}\n`,
                );
            }
            if (changed) pendingBatch.push({ slug: row.slug, seo_title: next });
            if (pendingBatch.length >= BATCH_SIZE) await flushBatch();
        }

        offset += PAGE_SIZE;
        if (rows.length < PAGE_SIZE) break;
    }
    await flushBatch();
    /* eslint-enable no-await-in-loop */

    const changedCount = MODE_CONFIRM ? totalChanged : countCsvChanged();
    console.log('\n--- Summary ---');
    console.log(`Rows scanned:  ${totalSeen}`);
    console.log(`Rows changed:  ${changedCount}`);
    if (MODE_CONFIRM) {
        console.log('Mode:          APPLIED (DB updated).');
        if (fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT); // clean finish
        console.log('Checkpoint cleared (run complete).');
        console.log('Next: wait for ISR (revalidate=3600) or revalidate changed slugs to refresh PDPs.');
    } else {
        console.log('Mode:          PREVIEW (no DB writes).');
        console.log(`Preview CSV:   ${PREVIEW_CSV}`);
        console.log('Review the CSV, then re-run with --confirm to apply.');
    }
}

function countCsvChanged(): number {
    try {
        const lines = fs.readFileSync(PREVIEW_CSV, 'utf8').split('\n');
        return lines.filter((l) => l.endsWith(',1')).length;
    } catch {
        return 0;
    }
}

// ---- entry ----------------------------------------------------------------
(async () => {
    if (MODE_RESTORE) {
        await runRestore();
    } else {
        await runBackfill();
    }
})()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\nBackfill aborted:', err instanceof Error ? err.message : err);
        console.error('Safe to re-run: --confirm resumes from the last committed checkpoint; batches are atomic and idempotent.');
        process.exit(1);
    });
