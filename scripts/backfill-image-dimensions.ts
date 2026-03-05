/**
 * backfill-image-dimensions.ts
 *
 * One-time script that reads all rows in `cakegenie_analysis_cache` where
 * `image_width IS NULL`, fetches each image, measures its dimensions using
 * sharp, then writes image_width + image_height back to the row.
 *
 * USAGE:
 *   node_modules/.bin/tsx scripts/backfill-image-dimensions.ts
 *
 * OPTIONS (env vars):
 *   BATCH_SIZE      — rows to process per DB page (default: 50)
 *   CONCURRENCY     — parallel image fetches per batch (default: 8)
 *   DRY_RUN=true    — measure dims but don't write to DB
 */

import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';

// Next.js projects use .env.local — load it first so it takes precedence
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
        '❌  Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY)'
    );
    process.exit(1);
}

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '50', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? '8', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch the image at `url` and return { width, height }, or null on failure. */
const measureImageUrl = async (
    url: string
): Promise<{ width: number; height: number } | null> => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'GeniePH-backfill/1.0' },
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.warn(`  ⚠️  HTTP ${res.status} for ${url}`);
            return null;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        const meta = await sharp(buffer).metadata();

        if (meta.width && meta.height) {
            return { width: meta.width, height: meta.height };
        }
        return null;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  ⚠️  Failed to measure ${url.slice(0, 80)}: ${msg}`);
        return null;
    }
};

/** Run `fn` over `items` with at most `limit` concurrent executions. */
const pMap = async <T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    limit: number
): Promise<R[]> => {
    const results: R[] = [];
    let idx = 0;

    const run = async (): Promise<void> => {
        while (idx < items.length) {
            const i = idx++;
            results[i] = await fn(items[i]);
        }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, run);
    await Promise.all(workers);
    return results;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const main = async () => {
    console.log('');
    console.log('🎂  Genie.ph — Image Dimension Backfill');
    console.log(`    BATCH_SIZE=${BATCH_SIZE}  CONCURRENCY=${CONCURRENCY}  DRY_RUN=${DRY_RUN}`);
    console.log('');

    // Count total rows to process
    const { count } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .is('image_width', null)
        .not('original_image_url', 'is', null)
        .neq('original_image_url', '');

    const total = count ?? 0;
    console.log(`📊  Rows to process: ${total}`);

    if (total === 0) {
        console.log('✅  Nothing to do! All rows already have dimensions.');
        return;
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;
    let pageOffset = 0;

    while (true) {
        // Fetch next page. In real mode, updated rows fall off the IS NULL filter
        // so offset 0 always returns the next unprocessed batch.
        // In DRY_RUN we need pageOffset to advance (rows never get updated).
        const { data: rows, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash, original_image_url')
            .is('image_width', null)
            .not('original_image_url', 'is', null)
            .neq('original_image_url', '')
            .order('created_at', { ascending: false })
            .range(pageOffset, pageOffset + BATCH_SIZE - 1);

        if (error) {
            console.error('❌  Supabase fetch error:', error.message);
            break;
        }
        if (!rows || rows.length === 0) break;

        // Process this batch concurrently
        const results = await pMap(
            rows,
            async (row) => {
                const dims = await measureImageUrl(row.original_image_url);
                return { p_hash: row.p_hash, url: row.original_image_url, dims };
            },
            CONCURRENCY
        );

        // Write results back to DB
        for (const { p_hash, url, dims } of results) {
            processed++;

            if (!dims) {
                failed++;
                continue;
            }

            if (DRY_RUN) {
                console.log(
                    `  [DRY] ${p_hash.slice(0, 8)}…  ${dims.width}×${dims.height}  ${url.slice(0, 60)}`
                );
                updated++;
                continue;
            }

            const { error: updateError } = await supabase
                .from('cakegenie_analysis_cache')
                .update({ image_width: dims.width, image_height: dims.height })
                .eq('p_hash', p_hash);

            if (updateError) {
                console.warn(
                    `  ⚠️  Update failed for ${p_hash.slice(0, 8)}: ${updateError.message}`
                );
                failed++;
            } else {
                updated++;
            }
        }

        const pct = Math.round((processed / total) * 100);
        console.log(
            `  ✓ ${processed}/${total} (${pct}%)  —  updated=${updated}  failed=${failed}`
        );

        // In DRY_RUN rows aren't updated, so we must advance the offset manually.
        // In real mode, rows fall off the WHERE IS NULL filter, so offset stays at 0
        // and each loop naturally gets a fresh batch of unprocessed rows.
        if (DRY_RUN) pageOffset += BATCH_SIZE;

        if (rows.length < BATCH_SIZE) break; // last page
    }

    console.log('');
    console.log('────────────────────────────────────────');
    console.log(`✅  Done!`);
    console.log(`    Total processed : ${processed}`);
    console.log(`    Successfully updated : ${updated}`);
    console.log(`    Failed / skipped     : ${failed}`);
    console.log('────────────────────────────────────────');
    console.log('');
};

main().catch((err) => {
    console.error('💥  Unhandled error:', err);
    process.exit(1);
});
