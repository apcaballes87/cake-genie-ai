/**
 * Re-run up to 100 existing cake-analysis rows through direct Gemini calls.
 *
 * This intentionally does not use Vertex Batch, GCS staging, or prompt/context
 * caching. It prefers the completed Studio image and updates only analysis_json
 * through the guarded service-role RPC.
 *
 * Usage:
 *   npx tsx scripts/rerun-analysis-cache-direct.ts --dry-run
 *   npx tsx scripts/rerun-analysis-cache-direct.ts --limit=100 --offset=1002
 *   npx tsx scripts/rerun-analysis-cache-direct.ts --limit=100 --offset=1002 --concurrency=1
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import type {
  CakeAnalysisModel,
  CakeAnalysisThinkingLevel,
} from '@/lib/ai/analyzeCakeImage';
import type {
  CacheAnalysisRerunItem,
  CacheAnalysisRerunRow,
} from '@/lib/admin/cacheAnalysisRerunBatch';
import {
  isDirectRerunQuotaError,
  serializeDirectRerunError,
} from '@/lib/admin/directRerunError';
import type { AnalysisGenerationSizeSchema } from '@/lib/admin/searchAnalysisContract';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

// Match the working batch runner: the local service-account key is not the
// source identity for Vertex impersonation and lacks Token Creator permission.
// Let google-auth-library use the configured gcloud ADC user instead.
if (
  process.env.VERTEX_AI_IMPERSONATE_SA?.trim()
  && !process.env.GOOGLE_CLIENT_EMAIL
  && !process.env.GOOGLE_CREDENTIALS_JSON
) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

type RuntimeDeps = {
  runActiveCakeAnalysis: typeof import('@/lib/ai/analyzeCakeImage').runActiveCakeAnalysis;
  isRejectedGeneratedCakeAnalysis: typeof import('@/lib/ai/generatedAnalysisContract').isRejectedGeneratedCakeAnalysis;
  convertToWebPBuffer: typeof import('@/lib/utils/imageHash').convertToWebPBuffer;
  selectCacheAnalysisRerunItems: typeof import('@/lib/admin/cacheAnalysisRerunBatch').selectCacheAnalysisRerunItems;
  getAnalysisGenerationSizeSchema: typeof import('@/lib/admin/searchAnalysisContract').getAnalysisGenerationSizeSchema;
  getActivePromptDetails: typeof import('@/services/prompts/promptLoader').getActivePromptDetails;
  getPromptDetailsByVersion: typeof import('@/services/prompts/promptLoader').getPromptDetailsByVersion;
};

// These modules read required environment variables at import time. Load them
// only after dotenv has populated the process environment for this CLI.
async function loadRuntimeDeps(): Promise<RuntimeDeps> {
  const [analysisModule, generatedModule, imageHashModule, rerunModule, contractModule, promptModule] =
    await Promise.all([
      import('@/lib/ai/analyzeCakeImage'),
      import('@/lib/ai/generatedAnalysisContract'),
      import('@/lib/utils/imageHash'),
      import('@/lib/admin/cacheAnalysisRerunBatch'),
      import('@/lib/admin/searchAnalysisContract'),
      import('@/services/prompts/promptLoader'),
    ]);

  return {
    runActiveCakeAnalysis: analysisModule.runActiveCakeAnalysis,
    isRejectedGeneratedCakeAnalysis: generatedModule.isRejectedGeneratedCakeAnalysis,
    convertToWebPBuffer: imageHashModule.convertToWebPBuffer,
    selectCacheAnalysisRerunItems: rerunModule.selectCacheAnalysisRerunItems,
    getAnalysisGenerationSizeSchema: contractModule.getAnalysisGenerationSizeSchema,
    getActivePromptDetails: promptModule.getActivePromptDetails,
    getPromptDetailsByVersion: promptModule.getPromptDetailsByVersion,
  };
}

const MAX_ROWS_PER_RUN = 100;
const DEFAULT_OFFSET_AFTER_FIRST_BATCH = 1002;
const MODEL: CakeAnalysisModel = 'gemini-3.1-flash-lite';

const { values } = parseArgs({
  options: {
    concurrency: { type: 'string', default: '1' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    'preflight-only': { type: 'boolean', default: false },
    ids: { type: 'string' },
    limit: { type: 'string', default: String(MAX_ROWS_PER_RUN) },
    offset: { type: 'string', default: String(DEFAULT_OFFSET_AFTER_FIRST_BATCH) },
    'prompt-version': { type: 'string' },
    'thinking-level': { type: 'string', default: 'LOW' },
    'delay-ms': { type: 'string', default: '20000' },
    'log-file': { type: 'string' },
  },
});

if (values.help) {
  console.log(`
Directly re-run up to ${MAX_ROWS_PER_RUN} cake-analysis rows with Gemini 3.1 Flash Lite.

Options:
  --dry-run             Analyze and validate without writing analysis_json.
  --preflight-only      Verify selected rows and prompt settings without calling Gemini.
  --limit=<n>           Rows to process; maximum ${MAX_ROWS_PER_RUN}. Default: ${MAX_ROWS_PER_RUN}.
  --offset=<n>          Stable cache-row offset. Default: ${DEFAULT_OFFSET_AFTER_FIRST_BATCH}.
  --ids=<id,...>        Process an exact comma-separated list of cache row UUIDs.
  --prompt-version=<v>  Use a specific ai_prompts version, including an inactive staged version.
  --concurrency=<n>     Direct requests in flight. Default: 1.
  --thinking-level=<x>  MINIMAL, LOW, MEDIUM, or HIGH. Default: LOW.
  --delay-ms=<n>        Pause between rows. Default: 20000.
  --log-file=<path>     Append structured JSONL diagnostics. Default: logs/direct-analysis-rerun-<timestamp>.jsonl.
`);
  process.exit(0);
}

function parsePositiveInt(raw: string, name: string) {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return value;
}

function parseNonNegativeInt(raw: string, name: string) {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }
  return value;
}

const limit = parsePositiveInt(String(values.limit), 'limit');
const offset = parseNonNegativeInt(String(values.offset), 'offset');
const explicitRowIds = typeof values.ids === 'string'
  ? values.ids.split(',').map((id) => id.trim()).filter(Boolean)
  : [];
if (explicitRowIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
  throw new Error('--ids must contain only cache-row UUIDs.');
}
if (new Set(explicitRowIds).size !== explicitRowIds.length) {
  throw new Error('--ids must not contain duplicate cache-row UUIDs.');
}
if (explicitRowIds.length > MAX_ROWS_PER_RUN) {
  throw new Error(`--ids cannot contain more than ${MAX_ROWS_PER_RUN} UUIDs.`);
}
const promptVersionOverride = typeof values['prompt-version'] === 'string'
  ? values['prompt-version'].trim()
  : '';
const concurrency = parsePositiveInt(String(values.concurrency), 'concurrency');
const delayMs = parseNonNegativeInt(String(values['delay-ms']), 'delay-ms');
const dryRun = Boolean(values['dry-run']);
const preflightOnly = Boolean(values['preflight-only']);
const thinkingLevelValue = String(values['thinking-level']).toUpperCase();
if (!['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'].includes(thinkingLevelValue)) {
  throw new Error('--thinking-level must be MINIMAL, LOW, MEDIUM, or HIGH.');
}
const thinkingLevel = thinkingLevelValue as CakeAnalysisThinkingLevel;
const defaultLogFile = `logs/direct-analysis-rerun-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
const logFilePath = path.resolve(process.cwd(), String(values['log-file'] ?? defaultLogFile));

if (limit > MAX_ROWS_PER_RUN) {
  throw new Error(`--limit cannot exceed ${MAX_ROWS_PER_RUN}.`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type DirectRow = CacheAnalysisRerunRow;

let logQueue: Promise<void> = Promise.resolve();

async function appendLogEvent(event: Record<string, unknown>) {
  const next = logQueue.then(async () => {
    await mkdir(path.dirname(logFilePath), { recursive: true });
    await appendFile(
      logFilePath,
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`,
      'utf8',
    );
  });

  logQueue = next.catch((error) => {
    console.error(`[direct rerun] failed to write diagnostic log: ${conciseError(error)}`);
  });
  await logQueue;
}

async function fetchRows(deps: RuntimeDeps) {
  let query = supabase
    .from('cakegenie_analysis_cache')
    .select('id, p_hash, original_image_url, studio_edited_image_url, analysis_json')
    .or('studio_edited_image_url.not.is.null,original_image_url.not.is.null')
    .order('id', { ascending: true });
  if (explicitRowIds.length > 0) {
    query = query.in('id', explicitRowIds);
  } else {
    query = query.range(offset, offset + limit - 1);
  }
  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch cache rows: ${error.message}`);
  return deps.selectCacheAnalysisRerunItems((data ?? []) as DirectRow[]);
}

async function fetchImageAsWebP(deps: RuntimeDeps, url: string) {
  const response = await fetch(url, { headers: { Accept: 'image/*' } });
  if (!response.ok) throw new Error(`image fetch failed (${response.status})`);

  const source = Buffer.from(await response.arrayBuffer());
  if (source.length > 10 * 1024 * 1024) throw new Error('image exceeds 10MB');

  const webp = await deps.convertToWebPBuffer(source);
  return { imageData: webp.toString('base64'), mimeType: 'image/webp' };
}

function conciseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 500);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processRow(
  deps: RuntimeDeps,
  row: CacheAnalysisRerunItem,
  prompt: { promptText: string; version: string },
  sizeSchema: AnalysisGenerationSizeSchema,
  thinkingLevel: CakeAnalysisThinkingLevel,
) {
  const image = await fetchImageAsWebP(deps, row.source_image_url);
  const analysis = await deps.runActiveCakeAnalysis({
    imageData: image.imageData,
    mimeType: image.mimeType,
    sourceContext: 'admin-cache-rerun-direct',
    sourceRoute: 'scripts/rerun-analysis-cache-direct',
    persistRejectedUpload: false,
    promptVersion: prompt.version,
    promptText: prompt.promptText,
    model: MODEL,
    thinkingLevel,
    sizeSchema,
    usePromptCache: false,
    previousAnalysis: row.analysis_json,
  });

  if (deps.isRejectedGeneratedCakeAnalysis(analysis.result)) {
    throw new Error(`analysis rejected: ${analysis.result.rejection.reason}`);
  }

  if (!dryRun) {
    const { data: updated, error } = await supabase.rpc('cakegenie_update_analysis_json_only', {
      p_cache_id: row.id,
      p_analysis_json: analysis.result,
    });
    if (error) throw new Error(`analysis_json update failed: ${error.message}`);
    if (updated !== true) throw new Error('analysis_json update returned false');
  }

  return analysis;
}

async function main() {
  const deps = await loadRuntimeDeps();
  const rows = await fetchRows(deps);
  if (!rows.length) {
    console.log('No eligible rows found for this offset/limit.');
    return;
  }

  const promptClient = supabase as unknown as Parameters<typeof getActivePromptDetails>[0];
  const prompt = promptVersionOverride
    ? await deps.getPromptDetailsByVersion(promptClient, promptVersionOverride)
    : await deps.getActivePromptDetails(promptClient);
  if (!prompt) throw new Error(`Requested prompt version ${promptVersionOverride} was not found.`);
  const sizeSchema = deps.getAnalysisGenerationSizeSchema(prompt.version);
  const queue = [...rows];
  const startedAt = Date.now();
  let started = 0;
  let completed = 0;
  let failed = 0;
  let stoppedForQuota = false;

  console.log('🎂 Genie.ph — direct cache analysis rerun');
  console.log(`   model=${MODEL} prompt=${prompt.version} sizeSchema=${sizeSchema}`);
  console.log(`   sourcePriority=studio_edited→original offset=${offset} rows=${rows.length}`);
  if (explicitRowIds.length > 0) console.log(`   exactRowIds=${explicitRowIds.length}`);
  console.log(`   concurrency=${concurrency} thinking=${thinkingLevel} delayMs=${delayMs} dryRun=${dryRun} promptCache=false`);
  console.log(`   diagnostics=${logFilePath}`);
  if (preflightOnly) {
    const studioEdited = rows.filter((row) => row.source_kind === 'studio_edited').length;
    console.log(`[preflight only] selected=${rows.length} studioEdited=${studioEdited} original=${rows.length - studioEdited}; no Gemini calls or cache writes performed.`);
    return;
  }
  await appendLogEvent({
    event: 'run_started',
    model: MODEL,
    prompt_version: prompt.version,
    size_schema: sizeSchema,
    source_priority: ['studio_edited', 'original'],
    offset,
    selection_mode: explicitRowIds.length > 0 ? 'explicit_ids' : 'offset',
    explicit_id_count: explicitRowIds.length,
    requested_limit: limit,
    selected_rows: rows.length,
    concurrency,
    thinking_level: thinkingLevel,
    delay_ms: delayMs,
    dry_run: dryRun,
    prompt_cache: false,
    gcs_batch: false,
  });

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length && !stoppedForQuota) {
      const row = queue.shift();
      if (!row) return;
      started += 1;
      const ordinal = started;
      const label = `[${ordinal}/${rows.length}] ${row.id} ${row.source_kind}`;
      const rowStartedAt = Date.now();

      await appendLogEvent({
        event: 'row_started',
        ordinal,
        total_rows: rows.length,
        row_id: row.id,
        p_hash: row.p_hash,
        source_kind: row.source_kind,
      });

      try {
        await processRow(deps, row, prompt, sizeSchema, thinkingLevel);
        completed += 1;
        console.log(`${label} ${dryRun ? 'validated' : 'updated'} ${Date.now() - rowStartedAt}ms`);
        await appendLogEvent({
          event: 'row_completed',
          ordinal,
          total_rows: rows.length,
          row_id: row.id,
          p_hash: row.p_hash,
          source_kind: row.source_kind,
          duration_ms: Date.now() - rowStartedAt,
          action: dryRun ? 'validated' : 'updated',
        });
      } catch (error) {
        failed += 1;
        if (isDirectRerunQuotaError(error)) {
          stoppedForQuota = true;
          console.error('[direct rerun] stopping the slice after a quota response; no full-analysis retry will be made.');
        }
        const durationMs = Date.now() - rowStartedAt;
        console.error(
          `${label} failed ${durationMs}ms: ${conciseError(error)} `
          + `(diagnostics: ${logFilePath})`,
        );
        await appendLogEvent({
          event: 'row_failed',
          ordinal,
          total_rows: rows.length,
          row_id: row.id,
          p_hash: row.p_hash,
          source_kind: row.source_kind,
          duration_ms: durationMs,
          error: serializeDirectRerunError(error),
        });
      }
      if (queue.length && !stoppedForQuota && delayMs > 0) await sleep(delayMs);
    }
  });

  await Promise.all(workers);
  const elapsedMs = Date.now() - startedAt;
  await appendLogEvent({
    event: 'run_finished',
    completed,
    failed,
    not_started: queue.length,
    stopped_for_quota: stoppedForQuota,
    elapsed_ms: elapsedMs,
  });
  if (stoppedForQuota) process.exitCode = 2;
  console.log(
    `${stoppedForQuota ? '⏸ stopped after quota response' : '✅ finished'} `
    + `completed=${completed} failed=${failed} notStarted=${queue.length} elapsedMs=${elapsedMs}`,
  );
}

main().catch(async (error) => {
  await appendLogEvent({
    event: 'run_failed',
    error: serializeDirectRerunError(error),
  });
  console.error('💥 direct cache rerun failed:', conciseError(error));
  process.exitCode = 1;
});
