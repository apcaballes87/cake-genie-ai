import { Storage } from '@google-cloud/storage';
import readline from 'node:readline';

import { getAI, getGoogleCloudAuthOptions } from '@/lib/ai/client';
import { toActionableGoogleCloudStorageError } from '@/lib/ai/googleCloudErrors';
import { getDynamicTypeEnums } from '@/lib/ai/utils';
import { buildSearchAnalysisGenerationConfig, postProcessSearchAnalysisResult } from '@/lib/admin/searchAnalysisContract';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { getAnalysisPromptWithFallback } from '@/services/prompts/promptLoader';
import { cacheAnalysisResult } from '@/services/supabaseService';
import type { HybridAnalysisResult } from '@/types';

const MODEL = 'gemini-3.1-flash-image-preview';
const STORAGE_BUCKET = 'cakegenie';
const MAX_BATCH_SIZE = 1000;
const PROBE_SIZE = 3;
const MAX_IMPORTS_PER_REQUEST = 50;
type AIRequestContext = {
  headers?: {
    get(name: string): string | null | undefined;
  };
} | null | undefined;

export type QueueItem = {
  id: string;
  p_hash: string;
  fingerprint_pipeline: string | null;
  source_image_url: string | null;
  normalized_image_url: string;
  status: string;
  source_usage_count?: number;
  queued_at?: string;
  submission_ordinal: number | null;
  attempt_count?: number;
};

type JsonlResponse = {
  response?: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  error?: { message?: string };
};

function parseGcsPrefix() {
  const value = process.env.VERTEX_AI_BATCH_GCS_URI?.trim();
  const match = value?.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error('Set VERTEX_AI_BATCH_GCS_URI to a writable gs:// bucket prefix.');
  return { bucket: match[1], prefix: match[2].replace(/\/+$/, '') };
}

function objectName(prefix: string, path: string) {
  return [prefix, 'search-analysis', path].filter(Boolean).join('/');
}

function parseGcsUri(value: string) {
  const match = value.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error(`Invalid GCS URI: ${value}`);
  return { bucket: match[1], path: match[2].replace(/\/+$/, '') };
}

function createBatchStorage(requestContext?: AIRequestContext) {
  return new Storage(getGoogleCloudAuthOptions(requestContext));
}

export function selectEligibleSearchAnalysisItems(items: QueueItem[], limit = MAX_BATCH_SIZE) {
  return items
    .filter((item) => item.status === 'queued' || item.status === 'retryable')
    .sort((left, right) =>
      (right.source_usage_count ?? 0) - (left.source_usage_count ?? 0)
      || (left.queued_at ?? '').localeCompare(right.queued_at ?? '')
      || left.id.localeCompare(right.id))
    .slice(0, Math.min(Math.max(limit, 1), MAX_BATCH_SIZE));
}

export function buildSearchAnalysisBatchInputLine(item: QueueItem, activePrompt: string, requestConfig: Record<string, unknown>) {
  return JSON.stringify({
    request: {
      contents: [{ role: 'user', parts: [{ fileData: { fileUri: item.normalized_image_url, mimeType: 'image/jpeg' } }, { text: activePrompt }] }],
      ...requestConfig,
    },
  });
}

export function correlateSearchAnalysisOutputs(items: QueueItem[], lines: JsonlResponse[]) {
  return items
    .slice()
    .sort((left, right) => (left.submission_ordinal ?? 0) - (right.submission_ordinal ?? 0))
    .map((item, index) => ({ item, output: lines[index] ?? null }));
}

export function resolveSearchAnalysisIntake(existingCacheId?: string | null, existingItem?: QueueItem | null) {
  if (existingCacheId) return { action: 'cache_hit' as const, cacheId: existingCacheId };
  if (existingItem) return { action: 'reuse_queue_item' as const, item: existingItem };
  return { action: 'queue' as const };
}

export function buildSearchAnalysisPersistenceOptions(item: QueueItem, admin: ReturnType<typeof createAdminServerSupabaseClient>) {
  return {
    client: admin,
    triggerStudioEdit: false,
    fingerprintPipeline: item.fingerprint_pipeline,
    persistSourceAsset: false,
  };
}

export async function queueSearchAnalysisItem(input: {
  pHash: string;
  fingerprintPipeline?: string | null;
  sourceImageUrl?: string | null;
  imageData: string;
  mimeType: string;
}) {
  const admin = createAdminServerSupabaseClient();
  const { data: completedCache } = await admin.from('cakegenie_analysis_cache').select('id').eq('p_hash', input.pHash).maybeSingle();
  const intake = resolveSearchAnalysisIntake(completedCache?.id);
  if (intake.action === 'cache_hit') return { status: 'completed', cache_id: intake.cacheId, p_hash: input.pHash };
  const { data: existing } = await admin.from('cakegenie_search_analysis_batch_items').select('*').eq('p_hash', input.pHash).maybeSingle();
  const queuedIntake = resolveSearchAnalysisIntake(null, existing as QueueItem | null);
  if (queuedIntake.action === 'reuse_queue_item') return queuedIntake.item;

  const extension = input.mimeType === 'image/png' ? 'png' : 'jpg';
  const storagePath = `admin/search-analysis/${input.pHash}.${extension}`;
  const bytes = Buffer.from(input.imageData, 'base64');
  const { error: uploadError } = await admin.storage.from(STORAGE_BUCKET).upload(storagePath, Uint8Array.from(bytes), {
    contentType: input.mimeType,
    upsert: false,
  });
  if (uploadError && !uploadError.message.toLowerCase().includes('already exists')) throw uploadError;
  const { data: publicUrl } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  const { data, error } = await admin.from('cakegenie_search_analysis_batch_items').upsert({
    p_hash: input.pHash,
    fingerprint_pipeline: input.fingerprintPipeline ?? null,
    source_image_url: input.sourceImageUrl ?? null,
    normalized_image_url: publicUrl.publicUrl,
    storage_path: storagePath,
    status: 'queued',
  }, { onConflict: 'p_hash', ignoreDuplicates: true }).select('*').single();
  if (error) {
    const { data: raced, error: racedError } = await admin.from('cakegenie_search_analysis_batch_items').select('*').eq('p_hash', input.pHash).single();
    if (racedError) throw error;
    return raced;
  }
  return data;
}

export async function submitNextSearchAnalysisBatch(requestedLimit = MAX_BATCH_SIZE, requestContext?: AIRequestContext) {
  const admin = createAdminServerSupabaseClient();
  const { data: active } = await admin.from('cakegenie_search_analysis_batch_runs').select('id').in('status', ['submitted', 'importing']).limit(1).maybeSingle();
  if (active) throw new Error('A search-analysis batch is already submitted. Refresh its status first.');
  const { data: successfulProbe } = await admin.from('cakegenie_search_analysis_batch_runs').select('id').eq('is_compatibility_probe', true).in('status', ['completed', 'completed_with_errors']).limit(1).maybeSingle();
  const isCompatibilityProbe = !successfulProbe;
  const limit = isCompatibilityProbe ? PROBE_SIZE : Math.min(Math.max(requestedLimit, 1), MAX_BATCH_SIZE);
  const { data: rows, error } = await admin.from('cakegenie_search_analysis_batch_items').select('*').in('status', ['queued', 'retryable']).order('source_usage_count', { ascending: false }).order('queued_at').order('id').limit(limit);
  if (error) throw error;
  const items = rows as QueueItem[];
  if (!items.length) throw new Error('No queued search-analysis items are waiting for batch processing.');

  const activePrompt = await getAnalysisPromptWithFallback(admin as unknown as Parameters<typeof getAnalysisPromptWithFallback>[0]);
  const typeEnums = await getDynamicTypeEnums(admin as unknown);
  const generationConfig = buildSearchAnalysisGenerationConfig(typeEnums);
  const runId = crypto.randomUUID();
  const gcs = parseGcsPrefix();
  const inputPath = objectName(gcs.prefix, `${runId}/input.jsonl`);
  const outputPath = objectName(gcs.prefix, `${runId}/output`);
  const inputUri = `gs://${gcs.bucket}/${inputPath}`;
  const outputUri = `gs://${gcs.bucket}/${outputPath}`;
  await createBatchStorage(requestContext).bucket(gcs.bucket).file(inputPath).save(
    items.map((item) => buildSearchAnalysisBatchInputLine(item, activePrompt, generationConfig)).join('\n'),
    { contentType: 'application/jsonl' },
  ).catch((error: unknown) => { throw toActionableGoogleCloudStorageError(error, 'create'); });
  const providerJob = await getAI(requestContext).batches.create({
    model: MODEL,
    src: { gcsUri: [inputUri], format: 'jsonl' },
    config: { displayName: `cakegenie-search-analysis-${runId}`, dest: { gcsUri: outputUri, format: 'jsonl' } },
  });
  if (!providerJob.name) throw new Error('Vertex AI did not return a batch job name.');
  const { data: run, error: insertError } = await admin.from('cakegenie_search_analysis_batch_runs').insert({
    id: runId, gemini_job_name: providerJob.name, status: 'submitted', is_compatibility_probe: isCompatibilityProbe,
    input_file_uri: inputUri, output_file_uri: outputUri, submitted_count: items.length,
  }).select('*').single();
  if (insertError) throw insertError;
  for (const [submissionOrdinal, item] of items.entries()) {
    await admin.from('cakegenie_search_analysis_batch_items').update({
      run_id: runId, status: 'submitted', submission_ordinal: submissionOrdinal, attempt_count: (item.attempt_count ?? 0) + 1, error: null,
    }).eq('id', item.id).in('status', ['queued', 'retryable']);
  }
  return run;
}

function extractText(line: JsonlResponse | null) {
  return line?.response?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() || null;
}

function isTerminalProviderFailure(state?: string | null) {
  return Boolean(state && (
    state.includes('FAILED') ||
    state.includes('CANCELLED') ||
    state.includes('CANCELED') ||
    state.includes('EXPIRED')
  ));
}

export async function reconcileSearchAnalysisBatch(runId: string, requestContext?: AIRequestContext) {
  const admin = createAdminServerSupabaseClient();
  const { data: run, error } = await admin.from('cakegenie_search_analysis_batch_runs').select('*').eq('id', runId).single();
  if (error) throw error;
  if (run.status !== 'submitted' && run.status !== 'importing') return { run };
  if (run.status === 'submitted') {
    const providerJob = await getAI(requestContext).batches.get({ name: run.gemini_job_name });
    if (providerJob.state !== 'JOB_STATE_SUCCEEDED') {
      if (isTerminalProviderFailure(providerJob.state)) {
        const errorMessage = `Search-analysis batch provider job ended as ${providerJob.state}.`;
        await admin.from('cakegenie_search_analysis_batch_items').update({
          status: 'retryable',
          run_id: null,
          error: errorMessage,
          updated_at: new Date().toISOString(),
        }).eq('run_id', runId).eq('status', 'submitted');
        await admin.from('cakegenie_search_analysis_batch_runs').update({
          status: 'failed',
          retryable_count: run.submitted_count ?? 0,
          error: errorMessage,
          updated_at: new Date().toISOString(),
        }).eq('id', runId);
        return {
          run: {
            ...run,
            status: 'failed',
            retryable_count: run.submitted_count ?? 0,
            error: errorMessage,
            provider_state: providerJob.state,
          },
          providerJob,
        };
      }
      return { run: { ...run, provider_state: providerJob.state } };
    }
    await admin.from('cakegenie_search_analysis_batch_runs').update({
      status: 'importing',
      updated_at: new Date().toISOString(),
    }).eq('id', runId);
  }

  const { bucket, path: outputPrefix } = parseGcsUri(run.output_file_uri);
  const [files] = await createBatchStorage(requestContext).bucket(bucket).getFiles({ prefix: outputPrefix })
    .catch((error: unknown) => { throw toActionableGoogleCloudStorageError(error, 'list'); });
  const outputFile = files.find((file) => file.name.endsWith('.jsonl'));
  if (!outputFile) throw new Error(`No JSONL output found under ${run.output_file_uri}.`);
  const { data: rows, error: itemsError } = await admin.from('cakegenie_search_analysis_batch_items').select('*').eq('run_id', runId).order('submission_ordinal');
  if (itemsError) throw itemsError;
  const items = rows as QueueItem[];
  const lines = readline.createInterface({ input: outputFile.createReadStream() });
  let imported = 0;
  let index = 0;
  for await (const rawLine of lines) {
    const item = items[index];
    index += 1;
    if (!item) break;
    if (item.status !== 'submitted') continue;
    if (imported >= MAX_IMPORTS_PER_REQUEST) break;
    imported += 1;
    let output: JsonlResponse | null = null;
    try {
      output = JSON.parse(rawLine) as JsonlResponse;
    } catch {
      await admin.from('cakegenie_search_analysis_batch_items').update({ status: 'failed', error: 'Vertex output was not valid JSON.' }).eq('id', item.id);
      continue;
    }
    const text = extractText(output);
    if (!text) {
      await admin.from('cakegenie_search_analysis_batch_items').update({ status: 'retryable', error: output?.error?.message ?? 'No analysis returned.' }).eq('id', item.id);
      continue;
    }
    try {
      const result = postProcessSearchAnalysisResult(JSON.parse(text));
      const rejection = result.rejection as { isRejected?: boolean; reason?: string; message?: string } | undefined;
      if (rejection?.isRejected) {
        await admin.from('cakegenie_search_analysis_batch_items').update({ status: 'rejected', error: rejection.reason ?? rejection.message }).eq('id', item.id);
        continue;
      }
      const cached = await cacheAnalysisResult(item.p_hash, result as unknown as HybridAnalysisResult, item.normalized_image_url, undefined, buildSearchAnalysisPersistenceOptions(item, admin));
      if (!cached?.id) throw new Error('Analysis cache persistence did not return a cache row id.');
      await admin.from('cakegenie_search_analysis_batch_items').update({ status: 'completed', cache_id: cached.id, error: null }).eq('id', item.id).neq('status', 'completed');
    } catch (importError) {
      await admin.from('cakegenie_search_analysis_batch_items').update({ status: 'failed', error: importError instanceof Error ? importError.message : 'Import failed.' }).eq('id', item.id);
    }
  }
  const counts = await Promise.all(['completed', 'failed', 'retryable', 'submitted'].map(async (status) => {
    const { count, error: countError } = await admin.from('cakegenie_search_analysis_batch_items')
      .select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('status', status);
    if (countError) throw countError;
    return count ?? 0;
  }));
  const [completed, failed, retryable, remaining] = counts;
  const status = remaining > 0 ? 'importing' : (failed || retryable ? 'completed_with_errors' : 'completed');
  const { data: updated } = await admin.from('cakegenie_search_analysis_batch_runs').update({
    status, completed_count: completed, failed_count: failed, retryable_count: retryable, updated_at: new Date().toISOString(),
  }).eq('id', runId).select('*').single();
  return { run: updated, result: { imported, remaining } };
}

export async function getLatestSearchAnalysisBatch() {
  const admin = createAdminServerSupabaseClient();
  const { data, error } = await admin.from('cakegenie_search_analysis_batch_runs').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSearchAnalysisBatchHistory(limit = 20) {
  const admin = createAdminServerSupabaseClient();
  const { data, error } = await admin.from('cakegenie_search_analysis_batch_runs')
    .select('*').order('created_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw error;
  return data ?? [];
}
