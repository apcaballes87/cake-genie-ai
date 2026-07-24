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

const MODEL = 'gemini-3.5-flash-lite';
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
  storage_path: string;
  status: string;
  source_usage_count?: number;
  queued_at?: string;
  submission_ordinal: number | null;
  attempt_count?: number;
};

type JsonlResponse = {
  customId?: string;
  custom_id?: string;
  id?: string;
  request?: { contents?: Array<{ parts?: Array<{ fileData?: { fileUri?: string } | null }> }> };
  status?: string;
  response?: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  error?: { message?: string };
};

type BatchStorage = ReturnType<typeof createBatchStorage>;

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

async function findSearchAnalysisOutputFile(storage: BatchStorage, outputFileUri: string) {
  const { bucket, path: outputPrefix } = parseGcsUri(outputFileUri);
  const [files] = await storage.bucket(bucket).getFiles({ prefix: outputPrefix })
    .catch((error: unknown) => { throw toActionableGoogleCloudStorageError(error, 'list'); });
  return files.find((file) => file.name.endsWith('.jsonl')) ?? null;
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

export function buildSearchAnalysisBatchGenerationConfig(requestConfig: Record<string, unknown>) {
  const { responseMimeType, responseSchema, thinkingConfig } = requestConfig;
  return {
    ...(responseMimeType ? { responseMimeType } : {}),
    ...(responseSchema ? { responseSchema } : {}),
    ...(thinkingConfig ? { thinkingConfig } : {}),
  };
}

export function buildSearchAnalysisBatchInputLine(item: QueueItem, activePrompt: string, requestConfig: Record<string, unknown>) {
  const { systemInstruction } = requestConfig;
  return JSON.stringify({
    customId: item.id,
    custom_id: item.id,
    id: item.id,
    request: {
      contents: [{ role: 'user', parts: [{ fileData: { fileUri: item.normalized_image_url, mimeType: 'image/jpeg' } }, { text: activePrompt }] }],
      ...(typeof systemInstruction === 'string' ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      generationConfig: buildSearchAnalysisBatchGenerationConfig(requestConfig),
    },
  });
}

export function correlateSearchAnalysisOutputs(items: QueueItem[], lines: JsonlResponse[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const byUri = new Map(items.map((item) => [item.normalized_image_url, item]));
  return lines.map((output) => {
    const id = output.customId || output.custom_id || output.id;
    const item = id ? byId.get(id) : byUri.get(extractOutputRequestFileUri(output) ?? '');
    return {
      item,
      output,
    };
  }).filter((entry): entry is { item: QueueItem; output: JsonlResponse } => Boolean(entry.item));
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
    persistSourceAsset: 'if_missing' as const,
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
  const { data: active } = await admin.from('cakegenie_search_analysis_batch_runs').select('id').in('status', ['collecting', 'submitted', 'importing']).limit(1).maybeSingle();
  if (active) throw new Error('A search-analysis batch is already submitted. Refresh its status first.');
  const { data: successfulProbe } = await admin.from('cakegenie_search_analysis_batch_runs').select('id').eq('is_compatibility_probe', true).in('status', ['completed', 'completed_with_errors']).gt('completed_count', 0).limit(1).maybeSingle();
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
  const { error: insertError } = await admin.from('cakegenie_search_analysis_batch_runs').insert({
    id: runId, status: 'collecting', is_compatibility_probe: isCompatibilityProbe,
    input_file_uri: inputUri, output_file_uri: outputUri, submitted_count: items.length,
  });
  if (insertError) throw insertError;

  try {
    const updates = items.map((item, index) => ({
      id: item.id,
      p_hash: item.p_hash,
      normalized_image_url: item.normalized_image_url,
      storage_path: item.storage_path,
      run_id: runId,
      status: 'submitted' as const,
      submission_ordinal: index,
      attempt_count: (item.attempt_count ?? 0) + 1,
      error: null,
    }));
    const { error: updateError } = await admin.from('cakegenie_search_analysis_batch_items').upsert(updates);
    if (updateError) throw updateError;

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
    const { data: submittedRun, error: submitUpdateError } = await admin.from('cakegenie_search_analysis_batch_runs').update({
      gemini_job_name: providerJob.name,
      status: 'submitted',
      updated_at: new Date().toISOString(),
    }).eq('id', runId).select('*').single();
    if (submitUpdateError) throw submitUpdateError;
    return submittedRun;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit search-analysis batch.';
    await admin.from('cakegenie_search_analysis_batch_items').update({
      run_id: null,
      status: 'retryable',
      error: message,
      updated_at: new Date().toISOString(),
    }).eq('run_id', runId).eq('status', 'submitted');
    await admin.from('cakegenie_search_analysis_batch_runs').update({
      status: 'failed',
      retryable_count: items.length,
      error: message,
      updated_at: new Date().toISOString(),
    }).eq('id', runId);
    throw error;
  }
}

function extractText(line: JsonlResponse | null) {
  return line?.response?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() || null;
}

function extractOutputRequestFileUri(line: JsonlResponse | null) {
  const parts = line?.request?.contents?.flatMap((content) => content.parts ?? []) ?? [];
  return parts.find((part) => part.fileData?.fileUri)?.fileData?.fileUri ?? null;
}

export function parseSearchAnalysisBatchOutputText(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // The image-preview batch model can prepend visible reasoning/Markdown even
    // when the final answer is valid JSON. Keep the importer strict about the
    // persisted shape, but recover the final object when present.
  }

  const objectStarts = [...trimmed.matchAll(/{/g)].map((match) => match.index).filter((index): index is number => typeof index === 'number');
  for (const start of objectStarts) {
    const candidate = trimmed.slice(start).replace(/```(?:json)?\s*$/i, '').trim();
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      // Try the next opening brace. This keeps earlier prose/braces from poisoning import.
    }
  }

  throw new SyntaxError('Search-analysis batch output did not contain valid JSON.');
}

function isTerminalProviderFailure(state?: string | null) {
  return Boolean(state && (
    state.includes('FAILED') ||
    state.includes('CANCELLED') ||
    state.includes('CANCELED') ||
    state.includes('EXPIRED')
  ));
}

function describeProviderFailure(providerJob: { state?: string | null; error?: { message?: string; code?: number | string } | null }) {
  const details = [
    providerJob.state ? `state=${providerJob.state}` : null,
    providerJob.error?.code ? `code=${providerJob.error.code}` : null,
    providerJob.error?.message ? `message=${providerJob.error.message}` : null,
  ].filter(Boolean).join('; ');
  return details ? `Search-analysis batch provider job failed: ${details}` : 'Search-analysis batch provider job failed before import.';
}

function getProviderRefreshErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as { error?: { status?: string; message?: string; code?: number } };
    if (parsed.error?.status || parsed.error?.message) {
      return `Search-analysis batch provider refresh failed: ${parsed.error.status ?? parsed.error.code ?? 'unknown'}${parsed.error.message ? ` - ${parsed.error.message}` : ''}`;
    }
  } catch {
    // Not a JSON-encoded provider error.
  }
  return `Search-analysis batch provider refresh failed: ${raw}`;
}

async function closeSearchAnalysisProviderFailure(
  admin: ReturnType<typeof createAdminServerSupabaseClient>,
  runId: string,
  submittedCount: number,
  errorMessage: string,
) {
  await admin.from('cakegenie_search_analysis_batch_items').update({
    status: 'retryable',
    run_id: null,
    error: errorMessage,
    updated_at: new Date().toISOString(),
  }).eq('run_id', runId).eq('status', 'submitted');
  await admin.from('cakegenie_search_analysis_batch_runs').update({
    status: 'failed',
    retryable_count: submittedCount,
    error: errorMessage,
    updated_at: new Date().toISOString(),
  }).eq('id', runId);
}

export async function reconcileSearchAnalysisBatch(runId: string, requestContext?: AIRequestContext) {
  const admin = createAdminServerSupabaseClient();
  const { data: run, error } = await admin.from('cakegenie_search_analysis_batch_runs').select('*').eq('id', runId).single();
  if (error) throw error;
  if (run.status !== 'submitted' && run.status !== 'importing') return { run };
  const storage = createBatchStorage(requestContext);
  let outputFile = null as Awaited<ReturnType<typeof findSearchAnalysisOutputFile>>;
  if (run.status === 'submitted') {
    let providerJob: Awaited<ReturnType<ReturnType<typeof getAI>['batches']['get']>> | undefined;
    try {
      providerJob = await getAI(requestContext).batches.get({ name: run.gemini_job_name });
    } catch (providerError) {
      outputFile = await findSearchAnalysisOutputFile(storage, run.output_file_uri);
      if (outputFile) {
        await admin.from('cakegenie_search_analysis_batch_runs').update({
          status: 'importing',
          error: null,
          updated_at: new Date().toISOString(),
        }).eq('id', runId);
      } else {
        const errorMessage = getProviderRefreshErrorMessage(providerError);
        await closeSearchAnalysisProviderFailure(admin, runId, run.submitted_count ?? 0, errorMessage);
        return {
          run: {
            ...run,
            status: 'failed',
            retryable_count: run.submitted_count ?? 0,
            error: errorMessage,
          },
        };
      }
    }
    if (providerJob && providerJob.state !== 'JOB_STATE_SUCCEEDED') {
      if (isTerminalProviderFailure(providerJob.state)) {
        const errorMessage = describeProviderFailure(providerJob);
        await closeSearchAnalysisProviderFailure(admin, runId, run.submitted_count ?? 0, errorMessage);
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
    if (providerJob) await admin.from('cakegenie_search_analysis_batch_runs').update({
      status: 'importing',
      updated_at: new Date().toISOString(),
    }).eq('id', runId);
  }

  outputFile = outputFile ?? await findSearchAnalysisOutputFile(storage, run.output_file_uri);
  if (!outputFile) throw new Error(`No JSONL output found under ${run.output_file_uri}.`);
  const { data: rows, error: itemsError } = await admin.from('cakegenie_search_analysis_batch_items').select('*').eq('run_id', runId).order('submission_ordinal');
  if (itemsError) throw itemsError;
  const items = rows as QueueItem[];
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const itemsByUri = new Map(items.map((item) => [item.normalized_image_url, item]));
  const lines = readline.createInterface({ input: outputFile.createReadStream() });
  let imported = 0;
  for await (const rawLine of lines) {
    if (imported >= MAX_IMPORTS_PER_REQUEST) break;
    let output: JsonlResponse | null = null;
    try {
      output = JSON.parse(rawLine) as JsonlResponse;
    } catch {
      console.warn(`[Batch Import] Failed to parse output line in run ${runId} as JSON.`);
      continue;
    }
    const echoedId = output?.customId || output?.custom_id || output?.id;
    const echoedUri = extractOutputRequestFileUri(output);
    let item: QueueItem | undefined;

    if (echoedId) {
      item = itemsById.get(echoedId);
      if (!item) {
        console.warn(`[Batch Import] Echoed ID "${echoedId}" does not map to any item in run ${runId}. Skipping.`);
        continue;
      }
    } else if (echoedUri) {
      item = itemsByUri.get(echoedUri);
      if (!item) {
        console.warn(`[Batch Import] Echoed URI "${echoedUri}" does not map to any item in run ${runId}. Skipping.`);
        continue;
      }
    } else {
      console.warn(`[Batch Import] Output line has no echoed ID or URI in run ${runId}. Skipping to prevent cross-contamination.`);
      continue;
    }

    if (item.status !== 'submitted') continue;
    imported += 1;
    const text = extractText(output);
    if (!text) {
      await admin.from('cakegenie_search_analysis_batch_items').update({ status: 'retryable', error: output?.error?.message ?? output?.status ?? 'No analysis returned.' }).eq('id', item.id);
      continue;
    }
    try {
      const result = postProcessSearchAnalysisResult(parseSearchAnalysisBatchOutputText(text));
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

  // If we processed the entire file (i.e. did not break due to MAX_IMPORTS_PER_REQUEST)
  // and we are done reading, then any remaining 'submitted' items are missing.
  const reachedEndOfFile = imported < MAX_IMPORTS_PER_REQUEST;
  if (reachedEndOfFile) {
    const { error: cleanupError } = await admin
      .from('cakegenie_search_analysis_batch_items')
      .update({
        status: 'retryable',
        error: 'Batch job completed but this item was not returned in the output.',
        updated_at: new Date().toISOString(),
      })
      .eq('run_id', runId)
      .eq('status', 'submitted');
    if (cleanupError) console.error('Failed to clean up remaining submitted items:', cleanupError);
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
