/* eslint-disable @typescript-eslint/no-explicit-any */
import { Storage } from '@google-cloud/storage';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

const runId = '53882998-c94e-412a-a724-4e6f0eea6a02';
const bucketName = 'cakegenie-ai-batch-project-cf9db8b5';
const predictionsPath = 'search-analysis/53882998-c94e-412a-a724-4e6f0eea6a02/output/prediction-model-2026-06-04T17:45:41.291399Z/predictions.jsonl';
const scratchDir = '/Users/apcaballes/.gemini/antigravity/brain/e3bed454-6e41-41a9-80f8-7f8f18536832/scratch';

const storage = new Storage({
  projectId: 'project-cf9db8b5-0a4c-4486-b35'
});

type QueueItem = {
  id: string;
  p_hash: string;
  normalized_image_url: string;
  status: string;
  submission_ordinal: number | null;
  cache_id: string | null;
};

function extractOutputRequestFileUri(line: any) {
  const parts = line?.request?.contents?.flatMap((content: any) => content.parts ?? []) ?? [];
  return parts.find((part: any) => part.fileData?.fileUri)?.fileData?.fileUri ?? null;
}

async function main() {
  console.log('=== Starting Repair Analysis ===');
  console.log(`Analyzing run: ${runId}`);
  
  const admin = createAdminServerSupabaseClient();

  // 1. Fetch all items associated with this run from the DB
  const { data: dbItems, error: itemsError } = await admin
    .from('cakegenie_search_analysis_batch_items')
    .select('id, p_hash, normalized_image_url, status, submission_ordinal, cache_id')
    .eq('run_id', runId);

  if (itemsError) throw itemsError;
  console.log(`Loaded ${dbItems?.length ?? 0} batch items from database for this run.`);

  if (!dbItems || dbItems.length === 0) {
    console.log('No batch items found for this run in database.');
    return;
  }

  // Build mapped lookups
  const itemsByUri = new Map<string, QueueItem>();
  for (const item of dbItems) {
    itemsByUri.set(item.normalized_image_url, item);
  }

  // Reconstruct the fallbackItems array (sorted by submission_ordinal)
  const fallbackItems = dbItems
    .slice()
    .sort((left, right) => (left.submission_ordinal ?? 0) - (right.submission_ordinal ?? 0));

  // 2. Open GCS file stream
  const file = storage.bucket(bucketName).file(predictionsPath);
  const stream = file.createReadStream();
  const lines = readline.createInterface({ input: stream });

  let lineCount = 0;
  let mismatchCount = 0;
  let exactMatchCount = 0;
  let missingUriCount = 0;

  const contaminationDetails: Array<{
    lineIndex: number;
    echoedUri: string;
    truePHash: string;
    trueItemSlug: string | null;
    assignedPHash: string;
    assignedCacheId: string | null;
  }> = [];

  for await (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    
    let output: any;
    try {
      output = JSON.parse(rawLine);
    } catch {
      lineCount++;
      continue;
    }

    const echoedUri = extractOutputRequestFileUri(output);
    const assignedItem = lineCount < fallbackItems.length ? fallbackItems[lineCount] : null;

    if (echoedUri) {
      const trueItem = itemsByUri.get(echoedUri);
      
      if (trueItem && assignedItem) {
        if (trueItem.id !== assignedItem.id) {
          mismatchCount++;
          contaminationDetails.push({
            lineIndex: lineCount,
            echoedUri,
            truePHash: trueItem.p_hash,
            trueItemSlug: echoedUri.split('/').pop() || null,
            assignedPHash: assignedItem.p_hash,
            assignedCacheId: assignedItem.cache_id
          });
        } else {
          exactMatchCount++;
        }
      }
    } else {
      missingUriCount++;
    }

    lineCount++;
  }

  console.log('\n=== Analysis Summary ===');
  console.log(`Total output lines processed: ${lineCount}`);
  console.log(`Exact matches (correctly aligned): ${exactMatchCount}`);
  console.log(`Mismatches (contaminated/shuffled): ${mismatchCount}`);
  console.log(`Lines with missing echoed URI: ${missingUriCount}`);

  if (mismatchCount > 0) {
    // Generate cache IDs list to clean
    const cacheIdsToClean = contaminationDetails
      .map(d => d.assignedCacheId)
      .filter((id): id is string => Boolean(id));

    console.log(`\nGenerated list of ${cacheIdsToClean.length} contaminated cache IDs.`);
    
    // Write JSON file of contaminated IDs
    const jsonPath = path.join(scratchDir, 'contaminated_cache_ids.json');
    fs.writeFileSync(jsonPath, JSON.stringify(cacheIdsToClean, null, 2));
    console.log(`Exported contaminated cache IDs to: ${jsonPath}`);

    // Generate SQL remediation script
    const sqlPath = path.join(scratchDir, 'remediate_contaminated_run.sql');
    const sqlContent = [
      `-- Remediation script for contaminated search-analysis batch run ${runId}`,
      `-- Generated on ${new Date().toISOString()}`,
      `BEGIN;`,
      `\n-- 1. Delete contaminated cache records`,
      `DELETE FROM cakegenie_analysis_cache`,
      `WHERE id IN (`,
      cacheIdsToClean.map(id => `  '${id}'`).join(',\n'),
      `);`,
      `\n-- 2. Reset the status of all batch items in this run to queued and clear their run_id and cache_id`,
      `UPDATE cakegenie_search_analysis_batch_items`,
      `SET status = 'queued',`,
      `    run_id = NULL,`,
      `    cache_id = NULL,`,
      `    submission_ordinal = NULL,`,
      `    error = NULL,`,
      `    updated_at = NOW()`,
      `WHERE run_id = '${runId}';`,
      `\n-- 3. Fail out the bad run in the batch runs table`,
      `UPDATE cakegenie_search_analysis_batch_runs`,
      `SET status = 'failed',`,
      `    completed_count = 0,`,
      `    failed_count = 0,`,
      `    retryable_count = submitted_count,`,
      `    error = 'Quarantined and reset due to cross-contamination matching bug.',`,
      `    updated_at = NOW()`,
      `WHERE id = '${runId}';`,
      `\nCOMMIT;`
    ].join('\n');

    fs.writeFileSync(sqlPath, sqlContent);
    console.log(`Generated SQL remediation script at: ${sqlPath}`);
  }
}

main().catch(console.error);
