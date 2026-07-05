#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import path from 'path';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { values } = parseArgs({
  options: {
    'batch-size': { type: 'string', default: '1000' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    'max-batches': { type: 'string' },
    'poll-ms': { type: 'string', default: '30000' },
    'start-offset': { type: 'string', default: '0' },
  },
});

if (values.help) {
  console.log(`
Re-run all completed Image Studio rows in offline batch chunks.

Examples:
  npx tsx scripts/rerun-completed-studio-rows.ts --dry-run
  npx tsx scripts/rerun-completed-studio-rows.ts --batch-size=1000
  npx tsx scripts/rerun-completed-studio-rows.ts --start-offset=3000 --max-batches=2

Options:
  --dry-run            Print the rerun plan without submitting a batch.
  --batch-size=<n>     Rows per Studio batch run. Default: 1000.
  --start-offset=<n>   Offset into the completed-row set. Default: 0.
  --max-batches=<n>    Stop after this many batch runs.
  --poll-ms=<n>        Wait time between provider polls. Default: 30000.
`);
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const dryRun = Boolean(values['dry-run']);
const batchSize = parsePositiveInt(String(values['batch-size'] ?? '1000'), 'batch-size');
const startOffset = parseNonNegativeInt(String(values['start-offset'] ?? '0'), 'start-offset');
const maxBatches = values['max-batches']
  ? parsePositiveInt(String(values['max-batches']), 'max-batches')
  : null;
const pollMs = parsePositiveInt(String(values['poll-ms'] ?? '30000'), 'poll-ms');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function parsePositiveInt(rawValue: string, name: string) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error(`--${name} must be a positive integer.`);
    process.exit(1);
  }
  return parsed;
}

function parseNonNegativeInt(rawValue: string, name: string) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`--${name} must be a non-negative integer.`);
    process.exit(1);
  }
  return parsed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNoActiveBatch() {
  const { continueImageStudioBatch, getActiveImageStudioBatch } = await import('@/lib/admin/imageStudioBatch');
  for (;;) {
    const activeRun = await getActiveImageStudioBatch();
    if (!activeRun) {
      return;
    }

    console.log(
      `⏳ Active batch ${activeRun.id} is still ${activeRun.stage}/${activeRun.status}. Waiting ${pollMs}ms...`
    );

    const continuation = await continueImageStudioBatch(undefined, { maxSteps: 20 });
    const lastStep = continuation.steps.at(-1);
    if (lastStep) {
      console.log(
        `   ↳ ${lastStep.stage}/${lastStep.status} completed=${lastStep.completed ?? 0} failed=${lastStep.failed ?? 0} imported=${lastStep.imported ?? 0} remaining=${lastStep.remaining ?? 0}`
      );
    }

    if (!continuation.active) {
      return;
    }

    await sleep(pollMs);
  }
}

async function waitForSubmittedRun(runId: string) {
  const { continueImageStudioBatch, getActiveImageStudioBatch } = await import('@/lib/admin/imageStudioBatch');
  for (;;) {
    const activeRun = await getActiveImageStudioBatch();

    if (!activeRun) {
      console.log(`✅ Batch ${runId} finished.`);
      return;
    }

    if (activeRun.id !== runId) {
      console.log(`ℹ️ Active batch moved from ${runId} to ${activeRun.id}; continuing to wait.`);
    }

    const continuation = await continueImageStudioBatch(undefined, { maxSteps: 20 });
    const lastStep = continuation.steps.at(-1);
    if (lastStep) {
      console.log(
        `   ↳ ${lastStep.stage}/${lastStep.status} completed=${lastStep.completed ?? 0} failed=${lastStep.failed ?? 0} imported=${lastStep.imported ?? 0} remaining=${lastStep.remaining ?? 0}`
      );
    } else {
      console.log(`⏳ Waiting on provider for batch ${runId}...`);
    }

    if (!continuation.active) {
      console.log(`✅ Batch ${runId} finished.`);
      return;
    }

    await sleep(pollMs);
  }
}

async function getEligibleCompletedCount() {
  const { count, error } = await supabase
    .from('cakegenie_analysis_cache')
    .select('*', { count: 'exact', head: true })
    .eq('studio_edit_status', 'completed')
    .not('original_image_url', 'is', null)
    .neq('original_image_url', '')
    .is('batch_job_id', null);

  if (error) {
    throw new Error(`Failed to count completed Studio rows: ${error.message}`);
  }

  return count ?? 0;
}

async function main() {
  const { submitNextImageStudioBatch } = await import('@/lib/admin/imageStudioBatch');
  const totalEligible = await getEligibleCompletedCount();
  const remainingFromOffset = Math.max(totalEligible - startOffset, 0);
  const plannedBatches =
    remainingFromOffset === 0 ? 0 : Math.ceil(remainingFromOffset / batchSize);
  const batchesToRun = maxBatches ? Math.min(plannedBatches, maxBatches) : plannedBatches;

  console.log('');
  console.log('🎂  Genie.ph — Re-run Completed Studio Rows');
  console.log(
    `    totalEligible=${totalEligible} startOffset=${startOffset} batchSize=${batchSize} plannedBatches=${plannedBatches} dryRun=${dryRun}`
  );
  console.log('');

  if (remainingFromOffset === 0) {
    console.log('✅ No completed Studio rows remain at or beyond that offset.');
    return;
  }

  if (dryRun) {
    for (let batchIndex = 0; batchIndex < batchesToRun; batchIndex += 1) {
      const offset = startOffset + batchIndex * batchSize;
      console.log(
        `  [DRY] batch ${batchIndex + 1}/${batchesToRun}: selectionMode=completed offset=${offset} limit=${batchSize}`
      );
    }
    return;
  }

  let batchesRan = 0;

  while (batchesRan < batchesToRun) {
    const offset = startOffset + batchesRan * batchSize;

    await waitForNoActiveBatch();

    console.log(`🚀 Submitting completed-row Studio rerun batch ${batchesRan + 1}/${batchesToRun} at offset ${offset}...`);
    const run = await submitNextImageStudioBatch(batchSize, undefined, {
      selectionMode: 'completed',
      offset,
    });
    console.log(`   ↳ runId=${run.id} total_requests=${run.total_requests} stage=${run.stage} status=${run.status}`);

    await waitForSubmittedRun(run.id);
    batchesRan += 1;
  }

  console.log('');
  console.log(`✅ Submitted and reconciled ${batchesRan} completed-row rerun batch(es).`);
}

main().catch((error) => {
  console.error('💥 Rerun failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
