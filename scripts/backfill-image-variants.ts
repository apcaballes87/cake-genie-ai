/**
 * scripts/backfill-image-variants.ts
 *
 * Command-line runner that backfills WebP variants (400/800/1200 px) for existing
 * cake design cache rows where `image_variants` is currently NULL (or has specific status).
 *
 * Reuses the exact same single-flight claim and processing pipeline as the Supabase Webhook
 * to prevent race conditions during concurrent runs.
 *
 * USAGE:
 *   npx tsx scripts/backfill-image-variants.ts [options]
 *
 * OPTIONS:
 *   --limit=<n>         Cap the maximum number of rows processed in this run.
 *   --batch-size=<n>    Process rows in batches of N (default: 25).
 *   --dry-run           Fetch and process images but skip storage uploads and DB writes.
 *   --from-id=<uuid>    Page start cursor p_hash UUID to resume processing from.
 *   --status=<status>   Filter by status (failed | partial | skipped | null). Default is null/all-eligible.
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline/requirements.md (Req 7.1 to 7.11)
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Next.js projects load configuration from .env.local in development/production.
// We must load this BEFORE importing any application modules (e.g. runForRow) because
// static imports are hoisted and executed first. Loading env vars synchronously first
// ensures constants.ts and other files find their required environment variables.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import { parseBackfillCliArgs } from '../src/scripts/backfillCliArgs';

// ---------------------------------------------------------------------------
// Configuration validation
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
        '❌ Configuration error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.'
    );
    process.exit(1);
}

// Build the service-role admin Supabase client inline.
// This role bypasses RLS, ensuring storage uploads and row claims succeed.
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Logging Setup
// ---------------------------------------------------------------------------
const isoDate = new Date().toISOString().split('T')[0];
const logsDir = path.resolve(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const failuresFile = path.resolve(logsDir, `variant-backfill-failures-${isoDate}.ndjson`);

/**
 * Appends a structured per-row failure log entry in NDJSON format.
 * Req 7.7
 */
const appendFailureLog = (
    pHash: string,
    stage: string,
    message: string,
    sourceUrl: string
): void => {
    const entry = JSON.stringify({
        p_hash: pHash,
        stage,
        message,
        source_url: sourceUrl,
    });
    fs.appendFileSync(failuresFile, entry + '\n');
};

/** Utility sleep wrapper to yield control between batches. */
const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

// ---------------------------------------------------------------------------
// Main Execution Runner
// ---------------------------------------------------------------------------
const main = async (): Promise<void> => {
    let args;
    try {
        args = parseBackfillCliArgs(process.argv.slice(2));
    } catch (err) {
        console.error(`❌ Argument parsing error: ${(err as Error).message}`);
        process.exit(1);
    }

    const { limit, dryRun, batchSize, fromId, status } = args;

    console.log('🎂  Genie.ph — Historical Image Variant Backfill');
    console.log(`    DRY_RUN=${dryRun}  BATCH_SIZE=${batchSize}  STATUS=${status}  LIMIT=${limit ?? 'unlimited'}  FROM_ID=${fromId ?? 'none'}`);
    console.log('─────────────────────────────────────────────────────────────────');

    // Dynamic imports guarantee that constants.ts and config files (which are imported
    // inside the library helpers) are evaluated AFTER dotenv has loaded all environment keys.
    const { runVariantPipelineForRow } = await import('../src/lib/imageVariants/runForRow');
    const { claimRowForVariantPipeline } = await import('../src/lib/imageVariants/claim');
    const { selectEffectiveSource } = await import('../src/lib/imageVariants/manifest');
    const { serializeManifest } = await import('../src/lib/imageVariants/manifest');

    let processed = 0;
    let ok = 0;
    let partial = 0;
    let failed = 0;
    let skipped = 0;
    const startTime = Date.now();

    // Cursor for pagination. Tracks oldest created_at processed in the run.
    let lastCreatedAt: string | null = null;
    const processedHashes = new Set<string>();

    if (fromId) {
        // Resolve starting row's timestamp for cursor initialization.
        const { data: cursorRow, error: cursorError } = await supabase
            .from('cakegenie_analysis_cache')
            .select('created_at')
            .eq('p_hash', fromId)
            .single();

        if (cursorError || !cursorRow) {
            console.error(
                `❌ Starting cursor row "${fromId}" not found:`,
                cursorError?.message ?? 'no row matched'
            );
            process.exit(1);
        }
        lastCreatedAt = cursorRow.created_at;
    }

    while (true) {
        // Stop pagination if we have processed up to the user-defined limit.
        if (limit !== undefined && processed >= limit) {
            break;
        }

        const currentBatchLimit = limit !== undefined ? Math.min(batchSize, limit - processed) : batchSize;

        let query = supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash, slug, created_at, studio_edited_image_url, original_image_url, image_variants_status')
            .order('created_at', { ascending: false });

        // Apply filters based on status selection.
        if (status === 'null') {
            query = query.is('image_variants', null);
        } else {
            query = query.eq('image_variants_status', status);
        }

        // Only query rows with at least one non-empty source image URL.
        query = query.or('studio_edited_image_url.neq."",original_image_url.neq.""');

        // Apply cursor pagination bound.
        if (lastCreatedAt) {
            query = query.lte('created_at', lastCreatedAt);
        }

        // Fetch extra rows to ensure batch sizes are filled after in-memory duplicate checks.
        query = query.limit(Math.max(50, currentBatchLimit * 2));

        const { data: rows, error: fetchError } = await query;

        if (fetchError) {
            console.error('❌ Supabase fetch page error:', fetchError.message);
            break;
        }

        if (!rows || rows.length === 0) {
            break;
        }

        // Filter out already processed hashes in memory to prevent cursor loops.
        const unprocessed = rows.filter((r) => !processedHashes.has(r.p_hash));

        if (unprocessed.length === 0) {
            // No new rows found in this cursor window, advance cursor to continue.
            lastCreatedAt = rows[rows.length - 1].created_at;
            continue;
        }

        const batch = unprocessed.slice(0, currentBatchLimit);

        for (const row of batch) {
            processedHashes.add(row.p_hash);
            processed++;

            const studioUrl = row.studio_edited_image_url ?? null;
            const originalUrl = row.original_image_url ?? null;

            // Step 1: selection - resolve the correct source URL (studio vs original).
            const selected = selectEffectiveSource({
                studio_edited_image_url: studioUrl,
                original_image_url: originalUrl,
            });

            if (!selected) {
                skipped++;
                if (!dryRun) {
                    await supabase
                        .from('cakegenie_analysis_cache')
                        .update({
                            image_variants_status: 'skipped',
                            image_variants_attempted_at: new Date().toISOString(),
                        })
                        .eq('p_hash', row.p_hash);
                }
                continue;
            }

            // Step 2: claim row atomically server-side (only in live mode).
            // Prevents parallel execution races with concurrent webhooks.
            if (!dryRun) {
                const claim = await claimRowForVariantPipeline(supabase, row.p_hash, selected.url);
                if (!claim.claimed) {
                    skipped++;
                    continue;
                }
            }

            // Step 3: execute the actual variant generation pipeline.
            let result;
            try {
                result = await runVariantPipelineForRow({
                    pHash: row.p_hash,
                    slug: row.slug ?? null,
                    studioEditedImageUrl: studioUrl,
                    originalImageUrl: originalUrl,
                    client: supabase,
                    dryRun,
                });
            } catch (pipelineErr) {
                // Outer try-catch to keep processing even if unhandled throw occurs.
                failed++;
                appendFailureLog(
                    row.p_hash,
                    'pipeline_uncaught',
                    (pipelineErr as Error).message,
                    selected.url
                );

                if (!dryRun) {
                    await supabase
                        .from('cakegenie_analysis_cache')
                        .update({
                            image_variants_status: 'failed',
                            image_variants_error: `pipeline_uncaught: ${(pipelineErr as Error).message}`,
                            image_variants_indexed_source: selected.url,
                        })
                        .eq('p_hash', row.p_hash);
                }
                continue;
            }

            // Step 4: persist outcome
            if (result.status === 'skipped') {
                skipped++;
                if (!dryRun) {
                    await supabase
                        .from('cakegenie_analysis_cache')
                        .update({
                            image_variants_status: 'skipped',
                            image_variants_indexed_source: selected.url,
                            image_variants_indexed_at: new Date().toISOString(),
                        })
                        .eq('p_hash', row.p_hash);
                }
                continue;
            }

            if (result.status === 'failed' || !result.manifest) {
                failed++;
                const firstErr = result.errors[0] || { stage: 'unknown', message: 'unknown error' };
                appendFailureLog(row.p_hash, firstErr.stage, firstErr.message, selected.url);

                if (!dryRun) {
                    const errorJson =
                        result.errors.length > 0 ? JSON.stringify(result.errors) : 'unknown_error';
                    await supabase
                        .from('cakegenie_analysis_cache')
                        .update({
                            image_variants_status: 'failed',
                            image_variants_error: errorJson,
                            image_variants_indexed_source: selected.url,
                        })
                        .eq('p_hash', row.p_hash);
                }
                continue;
            }

            // Success or partial success (at least one variant uploaded)
            if (result.status === 'ok') {
                ok++;
            } else {
                partial++;
            }

            // Report partial failure items to the failure log.
            if (result.status === 'partial') {
                for (const err of result.errors) {
                    appendFailureLog(row.p_hash, err.stage, err.message, selected.url);
                }
            }

            if (!dryRun) {
                const updatePayload: Record<string, unknown> = {
                    image_variants: serializeManifest(result.manifest),
                    image_variants_status: result.status === 'ok' ? 'ready' : 'partial',
                    image_variants_indexed_source: selected.url,
                    image_variants_indexed_at: new Date().toISOString(),
                    image_variants_error:
                        result.errors.length > 0 ? JSON.stringify(result.errors) : null,
                };

                // Re-measured dimensions overwrite original cache row entries.
                if (result.source) {
                    updatePayload.image_width = result.source.width;
                    updatePayload.image_height = result.source.height;
                }

                const { error: updateError } = await supabase
                    .from('cakegenie_analysis_cache')
                    .update(updatePayload)
                    .eq('p_hash', row.p_hash);

                if (updateError) {
                    console.error(
                        `  ⚠️  DB Update failed for ${row.p_hash.slice(0, 8)}: ${updateError.message}`
                    );
                    continue;
                }

                // Optional rehost rewrite of source columns.
                if (result.rehostedTo && selected.column) {
                    const { error: rehostError } = await supabase
                        .from('cakegenie_analysis_cache')
                        .update({ [selected.column]: result.rehostedTo })
                        .eq('p_hash', row.p_hash);

                    if (rehostError) {
                        console.error(
                            `  ⚠️  Rehost rewrite failed for ${row.p_hash.slice(0, 8)}: ${rehostError.message}`
                        );
                    }
                }
            } else {
                console.log(
                    `  [DRY] Row ${row.p_hash.slice(0, 8)}…: ${result.manifest.variants.length} variants generated. Sourced from ${selected.column}. Remeasured: ${result.source?.width}x${result.source?.height}. Rehost: ${!!result.rehostedTo}`
                );
            }
        }

        // Emits structured log every batch. Req 7.5
        const elapsed_s = Math.round((Date.now() - startTime) / 1000);
        console.log(
            JSON.stringify({
                processed,
                ok,
                partial,
                failed,
                skipped,
                elapsed_s,
            })
        );

        // Pause 1000 ms between batches to polite-consume Supabase storage. Req 7.6
        if (limit === undefined || processed < limit) {
            await sleep(1000);
        }

        const lastRow = batch[batch.length - 1];
        lastCreatedAt = lastRow.created_at;

        if (rows.length < batchSize) {
            break;
        }
    }

    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`✅ Completed! Elapsed: ${Math.round((Date.now() - startTime) / 1000)}s`);
    console.log(`   processed=${processed} ok=${ok} partial=${partial} failed=${failed} skipped=${skipped}`);
};

main().catch((err) => {
    console.error('💥 Unhandled script error:', err);
    process.exit(1);
});
