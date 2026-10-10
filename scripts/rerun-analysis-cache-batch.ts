#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import { parseArgs } from 'node:util';

import { Storage } from '@google-cloud/storage';
import { createClient } from '@supabase/supabase-js';
import type { AnalysisGenerationSizeSchema } from '@/lib/admin/searchAnalysisContract';
import type {
  CacheAnalysisRerunItem,
  CacheAnalysisRerunRow,
} from '@/lib/admin/cacheAnalysisRerunBatch';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

// Match the analysis client's local impersonation behavior. A globally
// exported credential file can otherwise silently select an unrelated GCP
// identity for the GCS input upload.
if (
  process.env.VERTEX_AI_IMPERSONATE_SA?.trim()
  && !process.env.GOOGLE_CLIENT_EMAIL
  && !process.env.GOOGLE_CREDENTIALS_JSON
) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

let runtimeDeps: any;

async function loadRuntimeDeps() {
  const [aiClient, contract, batch, utils, generated, analysisSize, promptLoader, helpers] = await Promise.all([
    import('@/lib/ai/client'),
    import('@/lib/admin/searchAnalysisContract'),
    import('@/lib/admin/searchAnalysisBatch'),
    import('@/lib/ai/utils'),
    import('@/lib/ai/generatedAnalysisContract'),
    import('@/lib/ai/analysisSize'),
    import('@/services/prompts/promptLoader'),
    import('@/lib/admin/cacheAnalysisRerunBatch'),
  ]);

  return {
    getAI: aiClient.getAI,
    getGoogleCloudAuthOptions: aiClient.getGoogleCloudAuthOptions,
    buildSearchAnalysisGenerationConfig: contract.buildSearchAnalysisGenerationConfig,
    getAnalysisGenerationSizeSchema: contract.getAnalysisGenerationSizeSchema,
    postProcessSearchAnalysisResult: contract.postProcessSearchAnalysisResult,
    buildSearchAnalysisBatchGenerationConfig: batch.buildSearchAnalysisBatchGenerationConfig,
    parseSearchAnalysisBatchOutputText: batch.parseSearchAnalysisBatchOutputText,
    getDynamicTypeEnums: utils.getDynamicTypeEnums,
    isRejectedGeneratedCakeAnalysis: generated.isRejectedGeneratedCakeAnalysis,
    integratedBboxV2Schema: analysisSize.INTEGRATED_BBOX_V2_ANALYSIS_SIZE_SCHEMA,
    getActivePromptDetails: promptLoader.getActivePromptDetails,
    buildAnalysisJsonOnlyUpdate: helpers.buildAnalysisJsonOnlyUpdate,
    buildCacheAnalysisRerunInputLine: helpers.buildCacheAnalysisRerunInputLine,
    cacheAnalysisRerunModel: helpers.CACHE_ANALYSIS_RERUN_MODEL,
    selectCacheAnalysisRerunItems: helpers.selectCacheAnalysisRerunItems,
  };
}

const { values } = parseArgs({
  options: {
    'batch-size': { type: 'string', default: '1000' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    'max-batches': { type: 'string' },
    'poll-ms': { type: 'string', default: '30000' },
    'probe-only': { type: 'boolean', default: false },
    'resume-job': { type: 'string' },
    'resume-run-id': { type: 'string' },
    'start-offset': { type: 'string', default: '0' },
  },
});

if (values.help) {
  console.log(`
Re-run cake analysis JSON through Vertex Batch, preferring Studio-edited images.

Examples:
  npx tsx scripts/rerun-analysis-cache-batch.ts --dry-run
  npx tsx scripts/rerun-analysis-cache-batch.ts --probe-only --batch-size=3
  npx tsx scripts/rerun-analysis-cache-batch.ts --batch-size=1000

Options:
  --dry-run            Print the plan without submitting or updating rows.
  --probe-only         Process only the first batch; use this before the full run.
  --batch-size=<n>     Rows per Vertex batch. Default: 1000.
  --start-offset=<n>   Offset into the stable cache-row set. Default: 0.
  --max-batches=<n>    Stop after this many batches.
  --poll-ms=<n>        Wait time between provider polls. Default: 30000.
  --resume-job=<name>  Resume polling/import for an already-submitted job.
  --resume-run-id=<id> Run ID used to derive that job's GCS output path.
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
const probeOnly = Boolean(values['probe-only']);
const batchSize = parsePositiveInt(String(values['batch-size'] ?? '1000'), 'batch-size');
const startOffset = parseNonNegativeInt(String(values['start-offset'] ?? '0'), 'start-offset');
const maxBatches = values['max-batches']
  ? parsePositiveInt(String(values['max-batches']), 'max-batches')
  : null;
const pollMs = parsePositiveInt(String(values['poll-ms'] ?? '30000'), 'poll-ms');
const resumeJob = values['resume-job'] ? String(values['resume-job']) : null;
const resumeRunId = values['resume-run-id'] ? String(values['resume-run-id']) : null;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type BatchOutput = {
  customId?: string;
  custom_id?: string;
  id?: string;
  response?: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  error?: { message?: string };
  status?: string;
};

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

function parseGcsPrefix() {
  const value = process.env.VERTEX_AI_BATCH_GCS_URI?.trim();
  const match = value?.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error('Set VERTEX_AI_BATCH_GCS_URI to a writable gs:// bucket prefix.');
  return { bucket: match[1], prefix: match[2].replace(/\/+$/, '') };
}

async function createStorage() {
  const targetPrincipal = process.env.VERTEX_AI_IMPERSONATE_SA?.trim();
  if (targetPrincipal && process.env.NODE_ENV !== 'production') {
    // The local Vertex identity is intentionally scoped to the provider API.
    // The configured batch bucket is writable by the existing gcloud user,
    // but not by local-dev-vertex, so use ADC directly for GCS staging and
    // output reads instead of broadening bucket IAM for the service account.
    return new Storage({ projectId: process.env.VERTEX_AI_PROJECT?.trim() });
  }

  return new Storage(runtimeDeps.getGoogleCloudAuthOptions());
}

function objectName(prefix: string, runId: string, suffix: string) {
  return [prefix, 'search-analysis-cache-rerun', runId, suffix].filter(Boolean).join('/');
}

function parseGcsUri(value: string) {
  const match = value.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error(`Invalid GCS URI: ${value}`);
  return { bucket: match[1], path: match[2].replace(/\/+$/, '') };
}

async function fetchCacheRows() {
  const rows: CacheAnalysisRerunRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('cakegenie_analysis_cache')
      .select('id, p_hash, original_image_url, studio_edited_image_url')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Failed to fetch cache rows: ${error.message}`);
    rows.push(...((data ?? []) as CacheAnalysisRerunRow[]));
    if (!data || data.length < pageSize) break;
  }

  return runtimeDeps.selectCacheAnalysisRerunItems(rows);
}

function extractOutputText(output: BatchOutput) {
  return output.response?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() || null;
}

function extractItemId(output: BatchOutput) {
  const customId = output.customId || output.custom_id || output.id;
  return customId?.split('|')[0] || null;
}

async function findOutputFile(storage: Storage, outputUri: string) {
  const { bucket, path: outputPrefix } = parseGcsUri(outputUri);
  const [files] = await storage.bucket(bucket).getFiles({ prefix: outputPrefix });
  return files.find((file) => file.name.endsWith('.jsonl')) ?? null;
}

async function cleanupBatchObjects(storage: Storage, inputUri: string, outputUri: string) {
  try {
    const input = parseGcsUri(inputUri);
    const output = parseGcsUri(outputUri);
    await storage.bucket(input.bucket).file(input.path).delete({ ignoreNotFound: true });
    const [outputFiles] = await storage.bucket(output.bucket).getFiles({ prefix: output.path });
    await Promise.all(outputFiles.map((file) => file.delete({ ignoreNotFound: true })));
    console.log(`   ↳ cleaned temporary GCS batch objects for ${input.path}`);
  } catch (error) {
    console.warn('   ↳ temporary GCS cleanup failed; objects may incur storage charges:', error instanceof Error ? error.message : error);
  }
}

async function waitForProviderJob(jobName: string) {
  const ai = await runtimeDeps.getAI();

  for (;;) {
    let job;
    try {
      job = await ai.batches.get({ name: jobName });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/(fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|5\d\d)/i.test(message)) throw error;
      console.warn(`   ↳ provider poll transient error; retrying in ${pollMs}ms: ${message}`);
      await sleep(pollMs);
      continue;
    }
    console.log(`   ↳ provider=${job.state ?? 'UNKNOWN'}`);

    if (job.state === 'JOB_STATE_SUCCEEDED') return job;
    if (
      job.state === 'JOB_STATE_FAILED'
      || job.state === 'JOB_STATE_CANCELLED'
      || job.state === 'JOB_STATE_CANCELED'
      || job.state === 'JOB_STATE_EXPIRED'
    ) {
      const details = job.error?.message ? `: ${job.error.message}` : '';
      throw new Error(`Vertex Batch job ended in ${job.state}${details}`);
    }

    await sleep(pollMs);
  }
}

async function importBatchOutput(
  outputFile: Awaited<ReturnType<typeof findOutputFile>>,
  items: CacheAnalysisRerunItem[],
  typeEnums: any,
  sizeSchema: AnalysisGenerationSizeSchema,
  persist: boolean,
) {
  if (!outputFile) throw new Error('Vertex Batch completed without a JSONL output file.');

  const byId = new Map(items.map((item) => [item.id, item]));
  const counts = { completed: 0, rejected: 0, failed: 0, missing: 0 };
  const seen = new Set<string>();
  const lines = readline.createInterface({ input: outputFile.createReadStream() });

  for await (const rawLine of lines) {
    let output: BatchOutput;
    try {
      output = JSON.parse(rawLine) as BatchOutput;
    } catch {
      counts.failed += 1;
      console.warn('   ↳ skipped malformed output line');
      continue;
    }

    const itemId = extractItemId(output);
    const item = itemId ? byId.get(itemId) : undefined;
    if (!item) {
      counts.failed += 1;
      console.warn(`   ↳ output did not map to a cache row: ${itemId ?? '<missing id>'}`);
      continue;
    }
    seen.add(item.id);

    try {
      const text = extractOutputText(output);
      if (!text) throw new Error(output.error?.message ?? output.status ?? 'No analysis returned.');

      const parsedResult = runtimeDeps.parseSearchAnalysisBatchOutputText(text);
      const result = {
        ...runtimeDeps.postProcessSearchAnalysisResult(parsedResult, typeEnums, sizeSchema, 'analysis_only'),
        analysis_size_schema: runtimeDeps.integratedBboxV2Schema,
      };

      if (runtimeDeps.isRejectedGeneratedCakeAnalysis(result)) {
        counts.rejected += 1;
        console.warn(`   ↳ rejected ${item.id}: ${result.rejection.reason}`);
        continue;
      }

      if (persist) {
        const { data: updated, error } = await supabase.rpc('cakegenie_update_analysis_json_only', {
          p_cache_id: item.id,
          p_analysis_json: result,
        });
        if (error) throw new Error(`Cache analysis_json update failed: ${error.message}`);
        if (updated !== true) throw new Error(`Cache row was not found for analysis_json update: ${item.id}`);
      }

      counts.completed += 1;
    } catch (error) {
      counts.failed += 1;
      console.warn(`   ↳ failed ${item.id}:`, error instanceof Error ? error.message : error);
    }
  }

  counts.missing = items.filter((item) => !seen.has(item.id)).length;
  return counts;
}

async function submitAndImportBatch(
  items: CacheAnalysisRerunItem[],
  activePrompt: string,
  generationConfig: Record<string, unknown>,
  typeEnums: any,
  sizeSchema: AnalysisGenerationSizeSchema,
) {
  const runId = randomUUID();
  const gcs = parseGcsPrefix();
  const inputPath = objectName(gcs.prefix, runId, 'input.jsonl');
  const outputPath = objectName(gcs.prefix, runId, 'output');
  const inputUri = `gs://${gcs.bucket}/${inputPath}`;
  const outputUri = `gs://${gcs.bucket}/${outputPath}`;
  const storage = await createStorage();
  const input = items.map((item) => runtimeDeps.buildCacheAnalysisRerunInputLine(
    item,
    activePrompt,
    generationConfig,
    sizeSchema,
  )).join('\n');

  await storage.bucket(gcs.bucket).file(inputPath).save(input, {
    contentType: 'application/jsonl',
  });

  const ai = await runtimeDeps.getAI();
  const providerJob = await ai.batches.create({
    model: runtimeDeps.cacheAnalysisRerunModel,
    src: { gcsUri: [inputUri], format: 'jsonl' },
    config: {
      displayName: `cakegenie-analysis-cache-rerun-${runId}`,
      dest: { gcsUri: outputUri, format: 'jsonl' },
    },
  });
  if (!providerJob.name) throw new Error('Vertex AI did not return a batch job name.');

  console.log(`   ↳ runId=${runId} providerJob=${providerJob.name}`);
  await waitForProviderJob(providerJob.name);
  const outputFile = await findOutputFile(storage, outputUri);
  const counts = await importBatchOutput(outputFile, items, typeEnums, sizeSchema, !dryRun);
  await cleanupBatchObjects(storage, inputUri, outputUri);
  return counts;
}

async function resumeAndImportBatch(
  runId: string,
  jobName: string,
  items: CacheAnalysisRerunItem[],
  typeEnums: any,
  sizeSchema: AnalysisGenerationSizeSchema,
) {
  const gcs = parseGcsPrefix();
  const inputUri = `gs://${gcs.bucket}/${objectName(gcs.prefix, runId, 'input.jsonl')}`;
  const outputUri = `gs://${gcs.bucket}/${objectName(gcs.prefix, runId, 'output')}`;
  const storage = await createStorage();
  await waitForProviderJob(jobName);
  const outputFile = await findOutputFile(storage, outputUri);
  const counts = await importBatchOutput(outputFile, items, typeEnums, sizeSchema, true);
  await cleanupBatchObjects(storage, inputUri, outputUri);
  return counts;
}

async function main() {
  runtimeDeps = await loadRuntimeDeps();
  const items = await fetchCacheRows();
  const studioCount = items.filter((item) => item.source_kind === 'studio_edited').length;
  const originalCount = items.length - studioCount;
  const promptDetails = await runtimeDeps.getActivePromptDetails(supabase as any);
  const sizeSchema = runtimeDeps.getAnalysisGenerationSizeSchema(promptDetails.version);
  if (sizeSchema !== 'integrated_bbox_v2') {
    throw new Error(`Expected integrated_bbox_v2 for the active prompt, found ${sizeSchema}.`);
  }
  const typeEnums = await runtimeDeps.getDynamicTypeEnums(supabase);
  const generationConfig = runtimeDeps.buildSearchAnalysisBatchGenerationConfig(
    runtimeDeps.buildSearchAnalysisGenerationConfig(typeEnums, sizeSchema, 'analysis_only'),
  );

  const availableItems = items.slice(startOffset);
  const plannedBatches = availableItems.length === 0 ? 0 : Math.ceil(availableItems.length / batchSize);
  const boundedBatches = maxBatches ? Math.min(plannedBatches, maxBatches) : plannedBatches;
  const batchesToRun = probeOnly ? Math.min(1, boundedBatches) : boundedBatches;

  console.log('');
  console.log('🎂 Genie.ph — Batch cache analysis JSON rerun');
  console.log(`   model=${runtimeDeps.cacheAnalysisRerunModel}`);
  console.log(`   activePrompt=${promptDetails.version} sizeSchema=${sizeSchema}`);
  console.log(`   sourcePriority=studio_edited(${studioCount}) → original(${originalCount})`);
  console.log(`   rows=${items.length} startOffset=${startOffset} batchSize=${batchSize} plannedBatches=${plannedBatches}`);
  console.log(`   dryRun=${dryRun} probeOnly=${probeOnly} batchesToRun=${batchesToRun}`);
  console.log('');

  if (resumeJob || resumeRunId) {
    if (!resumeJob || !resumeRunId) throw new Error('Both --resume-job and --resume-run-id are required together.');
    const batchItems = items.slice(startOffset, startOffset + batchSize);
    console.log(`🔁 Resuming submitted batch: rows=${batchItems.length} offset=${startOffset} runId=${resumeRunId}`);
    const counts = await resumeAndImportBatch(resumeRunId, resumeJob, batchItems, typeEnums, sizeSchema);
    console.log(`   ↳ completed=${counts.completed} rejected=${counts.rejected} failed=${counts.failed} missing=${counts.missing}`);
    return;
  }

  if (dryRun || batchesToRun === 0) {
    for (let index = 0; index < batchesToRun; index += 1) {
      const offset = startOffset + index * batchSize;
      const batchItems = items.slice(offset, offset + batchSize);
      console.log(`  [DRY] batch ${index + 1}/${batchesToRun}: rows=${batchItems.length} first=${batchItems[0]?.id ?? '<none>'} last=${batchItems.at(-1)?.id ?? '<none>'}`);
    }
    return;
  }

  for (let index = 0; index < batchesToRun; index += 1) {
    const offset = startOffset + index * batchSize;
    const batchItems = items.slice(offset, offset + batchSize);
    console.log(`🚀 Submitting batch ${index + 1}/${batchesToRun}: rows=${batchItems.length} offset=${offset}`);
    const counts = await submitAndImportBatch(
      batchItems,
      promptDetails.promptText,
      generationConfig,
      typeEnums,
      sizeSchema,
    );
    console.log(`   ↳ completed=${counts.completed} rejected=${counts.rejected} failed=${counts.failed} missing=${counts.missing}`);
  }

  console.log(`✅ Finished ${batchesToRun} cache-analysis batch(es).`);
}

main().catch((error) => {
  console.error('💥 Cache-analysis batch rerun failed:', error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});
