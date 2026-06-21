/**
 * scripts/backfill-phash.ts
 *
 * One-time script that recomputes the server-side pHash for all rows in
 * cakegenie_analysis_cache where fingerprint_pipeline IS NULL (old client-side hashes).
 *
 * Uses the exact same Sharp pipeline as /api/image/fingerprint so every row
 * will be on a consistent `v1-sharp-0.34-...` pipeline after this runs.
 *
 * USAGE:
 *   npm run backfill:phash
 *   npm run backfill:phash -- --dry-run
 *
 * OPTIONS:
 *   --dry-run    Fetch and compute hash but skip DB writes. Good for verification.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import {
  computeImageFingerprint,
  FINGERPRINT_PIPELINE,
} from '../src/lib/server/imageFingerprint';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    '❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isDryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CacheRow {
  id: string;
  p_hash: string | null;
  fingerprint_pipeline: string | null;
  original_image_url: string | null;
}

interface RowResult {
  id: string;
  oldHash: string | null;
  originalImageUrl: string | null;
  newHash: string | null;
  status: 'updated' | 'skipped_no_url' | 'skipped_fetch_failed' | 'skipped_hash_failed' | 'dry_run';
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🔍 pHash Backfill Script');
  console.log(`   Pipeline: ${FINGERPRINT_PIPELINE}`);
  console.log(`   Mode: ${isDryRun ? '🟡 DRY RUN (no writes)' : '🟢 LIVE'}`);
  console.log('');

  // Fetch all rows with NULL fingerprint_pipeline
  const { data: rows, error: fetchError } = await supabase
    .from('cakegenie_analysis_cache')
    .select('id, p_hash, fingerprint_pipeline, original_image_url')
    .is('fingerprint_pipeline', null)
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Failed to fetch rows:', fetchError.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('✅ No rows with NULL fingerprint_pipeline found. Database is already clean!');
    return;
  }

  console.log(`📋 Found ${rows.length} row(s) with NULL fingerprint_pipeline to process.\n`);

  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as CacheRow;
    const label = `[${i + 1}/${rows.length}] id=${row.id}`;

    console.log(`${label} — old p_hash: ${row.p_hash ?? '(null)'}`);

    if (!row.original_image_url) {
      console.log(`  ⚠️  Skipping — no original_image_url stored\n`);
      results.push({
        id: row.id,
        oldHash: row.p_hash,
        originalImageUrl: null,
        newHash: null,
        status: 'skipped_no_url',
      });
      continue;
    }

    let imageBuffer: Buffer;
    try {
      console.log(`  ⬇️  Fetching: ${row.original_image_url}`);
      imageBuffer = await fetchImageBuffer(row.original_image_url);
      console.log(`  ✅ Fetched ${(imageBuffer.length / 1024).toFixed(1)} KB`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Fetch failed: ${error}\n`);
      results.push({
        id: row.id,
        oldHash: row.p_hash,
        originalImageUrl: row.original_image_url,
        newHash: null,
        status: 'skipped_fetch_failed',
        error,
      });
      continue;
    }

    let newHash: string;
    try {
      const fingerprint = await computeImageFingerprint(imageBuffer);
      newHash = fingerprint.pHash;
      console.log(`  🔢 New hash: ${newHash}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Hash computation failed: ${error}\n`);
      results.push({
        id: row.id,
        oldHash: row.p_hash,
        originalImageUrl: row.original_image_url,
        newHash: null,
        status: 'skipped_hash_failed',
        error,
      });
      continue;
    }

    if (isDryRun) {
      console.log(`  🟡 DRY RUN — would update p_hash to ${newHash}\n`);
      results.push({
        id: row.id,
        oldHash: row.p_hash,
        originalImageUrl: row.original_image_url,
        newHash,
        status: 'dry_run',
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from('cakegenie_analysis_cache')
      .update({
        p_hash: newHash,
        fingerprint_pipeline: FINGERPRINT_PIPELINE,
      })
      .eq('id', row.id);

    if (updateError) {
      console.log(`  ❌ DB update failed: ${updateError.message}\n`);
      results.push({
        id: row.id,
        oldHash: row.p_hash,
        originalImageUrl: row.original_image_url,
        newHash,
        status: 'skipped_hash_failed',
        error: updateError.message,
      });
    } else {
      console.log(`  ✅ Updated!\n`);
      results.push({
        id: row.id,
        oldHash: row.p_hash,
        originalImageUrl: row.original_image_url,
        newHash,
        status: 'updated',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Summary report
  // ---------------------------------------------------------------------------
  const updated = results.filter((r) => r.status === 'updated');
  const dryRun = results.filter((r) => r.status === 'dry_run');
  const skippedNoUrl = results.filter((r) => r.status === 'skipped_no_url');
  const skippedFetchFailed = results.filter((r) => r.status === 'skipped_fetch_failed');
  const skippedHashFailed = results.filter((r) => r.status === 'skipped_hash_failed');

  console.log('\n═══════════════════════════════════════════');
  console.log('   pHash Backfill Complete — Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`   Total rows processed:   ${results.length}`);
  if (isDryRun) {
    console.log(`   Would update:           ${dryRun.length}`);
  } else {
    console.log(`   ✅ Updated:             ${updated.length}`);
  }
  console.log(`   ⚠️  Skipped (no URL):   ${skippedNoUrl.length}`);
  console.log(`   ❌ Fetch failed:        ${skippedFetchFailed.length}`);
  console.log(`   ❌ Hash failed:         ${skippedHashFailed.length}`);
  console.log('═══════════════════════════════════════════\n');

  if (skippedNoUrl.length > 0) {
    console.log('⚠️  Rows skipped (no image URL) — these are orphaned cache entries:');
    for (const r of skippedNoUrl) {
      console.log(`   id=${r.id} | old_hash=${r.oldHash ?? '(null)'}`);
    }
    console.log('');
  }

  if (skippedFetchFailed.length > 0) {
    console.log('❌ Rows skipped (fetch failed) — image URL is broken or inaccessible:');
    for (const r of skippedFetchFailed) {
      console.log(`   id=${r.id} | url=${r.originalImageUrl} | error=${r.error}`);
    }
    console.log('');
  }

  const failedCount = skippedNoUrl.length + skippedFetchFailed.length + skippedHashFailed.length;
  if (failedCount > 0 && !isDryRun) {
    console.log(
      `⚠️  ${failedCount} row(s) could not be backfilled. They will NOT match future uploads via the pipeline-matched path.`
    );
    console.log(
      '   Consider manually deleting these orphaned cache entries from the Supabase dashboard.'
    );
  }

  if (!isDryRun && updated.length > 0) {
    // Verify zero NULL-pipeline rows remain
    const { count } = await supabase
      .from('cakegenie_analysis_cache')
      .select('id', { count: 'exact', head: true })
      .is('fingerprint_pipeline', null);

    console.log(`\n🔎 Post-run verification: ${count ?? '?'} NULL-pipeline rows remaining.`);
    if (count === 0 || count === null) {
      console.log('✅ All rows now have a server-side pipeline fingerprint.');
    }
  }
}

main().catch((err) => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
