/**
 * scripts/convert-to-webp.ts
 *
 * Scans `cakegenie_analysis_cache` for rows with non-WebP images in the
 * `analysis-cache/` storage folder, converts them to WebP (quality 85) using sharp,
 * uploads the new file, updates the DB, and deletes the old file.
 *
 * USAGE:
 *   npx tsx scripts/convert-to-webp.ts
 *
 * OPTIONS (env vars):
 *   BATCH_SIZE      — rows to process per DB page (default: 50)
 *   CONCURRENCY     — parallel image fetches/conversions per batch (default: 4)
 *   DRY_RUN=false   — actually write to DB/Storage (default: true)
 */

import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Next.js projects use .env.local — load it first so it takes precedence
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? '4', 10);
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to true

const BUCKET_NAME = 'cakegenie';
const FOLDER_NAME = 'analysis-cache';
const SUPABASE_BASE_URL = 'https://cqmhanqnfybyxezhobkx.supabase.co';

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    console.log('🎂  Genie.ph — Cache Image WebP Conversion');
    console.log(`    BATCH_SIZE=${BATCH_SIZE}  CONCURRENCY=${CONCURRENCY}  DRY_RUN=${DRY_RUN}`);
    console.log('');

    // Query filters based on requirements
    const getBaseQuery = () => 
        supabase
            .from('cakegenie_analysis_cache')
            .select('*', { count: 'exact', head: true })
            .not('slug', 'is', null)
            .not('original_image_url', 'ilike', '%.webp')
            .ilike('original_image_url', '%analysis-cache%');

    const { count, error: countError } = await getBaseQuery();

    if (countError) {
        console.error('❌  Supabase count error:', countError.message);
        process.exit(1);
    }

    const total = count ?? 0;
    console.log(`📊  Rows to process: ${total}`);

    if (total === 0) {
        console.log('✅  Nothing to do! All eligible images are already WebP.');
        return;
    }

    let processed = 0;
    let converted = 0;
    let failed = 0;
    let pageOffset = 0;

    while (true) {
        // Fetch next page
        const { data: rows, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash, original_image_url, slug')
            .not('slug', 'is', null)
            .not('original_image_url', 'ilike', '%.webp')
            .ilike('original_image_url', '%analysis-cache%')
            .order('created_at', { ascending: false })
            .range(pageOffset, pageOffset + BATCH_SIZE - 1);

        if (error) {
            console.error('❌  Supabase fetch error:', error.message);
            break;
        }
        if (!rows || rows.length === 0) break;

        // Process this batch concurrently
        await pMap(
            rows,
            async (row) => {
                const { p_hash, original_image_url, slug } = row;
                
                try {
                    const targetFilename = `${slug}.webp`;
                    const targetPath = `${FOLDER_NAME}/${targetFilename}`;
                    const targetUrl = `${SUPABASE_BASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${targetPath}`;

                    if (DRY_RUN) {
                        // console.log(`  [DRY] Row ${p_hash.slice(0, 8)}: Would convert ${path.basename(original_image_url)} -> ${targetFilename}`);
                        converted++;
                        return;
                    }

                    // 1. Download image
                    const res = await fetch(original_image_url);
                    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // 2. Convert to WebP using sharp
                    const webpBuffer = await sharp(buffer)
                        .webp({ quality: 85 })
                        .toBuffer();

                    // 3. Upload to Supabase Storage
                    const { error: uploadError } = await supabase.storage
                        .from(BUCKET_NAME)
                        .upload(targetPath, webpBuffer, {
                            contentType: 'image/webp',
                            upsert: true
                        });

                    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

                    // 4. Update Database
                    const { error: updateError } = await supabase
                        .from('cakegenie_analysis_cache')
                        .update({ original_image_url: targetUrl })
                        .eq('p_hash', p_hash);

                    if (updateError) throw new Error(`DB Update failed: ${updateError.message}`);

                    // 5. Delete old file from storage
                    // Parse original path from URL
                    const urlMatch = original_image_url.match(new RegExp(`/public/${BUCKET_NAME}/(.+)$`));
                    if (urlMatch) {
                        const oldPath = urlMatch[1];
                        // Only delete if the path is different (though unlikely if both are in analysis-cache)
                        if (oldPath !== targetPath) {
                            await supabase.storage.from(BUCKET_NAME).remove([oldPath]);
                        }
                    }

                    converted++;
                } catch (err: any) {
                    console.warn(`  ⚠️  Failed row ${p_hash.slice(0, 8)}: ${err.message}`);
                    failed++;
                } finally {
                    processed++;
                }
            },
            CONCURRENCY
        );

        const pct = Math.round((processed / total) * 100);
        console.log(
            `  ✓ ${processed}/${total} (${pct}%)  —  converted=${converted}  failed=${failed}`
        );

        // In DRY_RUN rows aren't updated, so advance offset
        if (DRY_RUN) {
            pageOffset += BATCH_SIZE;
        } else {
            // Rows are removed from the query filter (not ending in .webp)
            // so we don't need to advance offset as much, but to be safe against drift:
            // if we have failures, they still have the old original_image_url.
            // If failure count grows, offset 0 will keep giving failures.
            // Simplified approach: offset = number of failures encountered so far.
            pageOffset = failed;
        }

        if (rows.length < BATCH_SIZE) break;
    }

    console.log('');
    console.log('────────────────────────────────────────');
    console.log(`✅  Done!`);
    console.log(`    Total processed : ${processed}`);
    console.log(`    Successfully converted : ${converted}`);
    console.log(`    Failed / skipped       : ${failed}`);
    console.log('────────────────────────────────────────');
    console.log('');
};

main().catch((err) => {
    console.error('💥  Unhandled error:', err);
    process.exit(1);
});
