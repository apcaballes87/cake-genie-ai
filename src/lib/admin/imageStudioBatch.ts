import { Storage } from '@google-cloud/storage';
import readline from 'node:readline';
import sharp from 'sharp';

import { getAI, getGoogleCloudAuthOptions } from '@/lib/ai/client';
import { toActionableGoogleCloudStorageError } from '@/lib/ai/googleCloudErrors';
import { buildImageStudioPrompt, buildImageStudioSystemInstruction, getImageStudioStoragePath } from '@/lib/admin/imageStudio';
import { buildIcingConversionPrompt } from '@/lib/icingConversionPrompt';
import { ICING_LAYER_SYSTEM_INSTRUCTION, CURRENT_MASK_VERSION } from '@/services/icingMaskService';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';
import { getSeoImageUploadHeaders } from '@/lib/seo/storageImageHeaders';

const STUDIO_MODEL = 'gemini-3.1-flash-lite-image';
const MASK_MODEL = 'gemini-3.1-flash-lite-image';
const STORAGE_BUCKET = 'cakegenie';

type Stage = 'studio' | 'mask';
type AIRequestContext = {
  headers?: {
    get(name: string): string | null | undefined;
  };
} | null | undefined;

type BatchItem = {
  id: string;
  cache_id: string;
  p_hash: string;
  slug: string | null;
  original_image_url: string;
  studio_edited_image_url: string | null;
  studio_status?: string;
  mask_status?: string;
  cache?: { slug: string | null } | null;
};

type JsonlResponse = {
  response?: {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  error?: { message?: string };
  request?: { contents?: Array<{ parts?: Array<{ fileData?: { fileUri?: string } | null }> }> };
};

type BatchRun = {
  id: string;
  gemini_job_name: string;
  output_file_uri: string;
  stage: Stage;
};

type ContinuationStep = {
  runId: string;
  stage: string;
  status: string;
  completed?: number;
  failed?: number;
  imported?: number;
  remaining?: number;
};

type BatchSelectionMode = 'pending' | 'completed';

type SubmitImageStudioBatchOptions = {
  selectionMode?: BatchSelectionMode;
  offset?: number;
};

function parseGcsPrefix() {
  const value = process.env.VERTEX_AI_BATCH_GCS_URI?.trim();
  const match = value?.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error('Set VERTEX_AI_BATCH_GCS_URI to a writable gs:// bucket prefix.');
  return { bucket: match[1], prefix: match[2].replace(/\/+$/, '') };
}

function parseGcsUri(value: string) {
  const match = value.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error(`Invalid GCS URI: ${value}`);
  return { bucket: match[1], path: match[2].replace(/\/+$/, '') };
}

export function getRunGcsPrefix(outputFileUri: string) {
  const { bucket, path } = parseGcsUri(outputFileUri);
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new Error(`Could not derive the batch GCS prefix from ${outputFileUri}.`);
  }
  segments.pop();
  segments.pop();
  return { bucket, prefix: segments.join('/') };
}

function objectName(prefix: string, path: string) {
  return [prefix, path].filter(Boolean).join('/');
}

function createBatchStorage(requestContext?: AIRequestContext) {
  return new Storage(getGoogleCloudAuthOptions(requestContext));
}

export function inferBatchImageMimeType(url: string) {
  const extension = url.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export function buildImageStudioBatchInputLine(item: BatchItem, stage: Stage) {
  const imageUrl = stage === 'studio' ? item.original_image_url : item.studio_edited_image_url;
  if (!imageUrl) throw new Error(`Missing ${stage} source for ${item.p_hash}.`);
  const prompt = stage === 'studio' ? buildImageStudioPrompt() : buildIcingConversionPrompt();
  const systemInstruction = stage === 'studio' ? buildImageStudioSystemInstruction() : ICING_LAYER_SYSTEM_INSTRUCTION;
  return JSON.stringify({
    request: {
      contents: [{ role: 'user', parts: [{ fileData: { fileUri: imageUrl, mimeType: inferBatchImageMimeType(imageUrl) } }, { text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { responseModalities: ['IMAGE'] },
    },
  });
}

function extractImage(line: JsonlResponse) {
  const parts = line.response?.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((part) => part.inlineData?.data)?.inlineData;
  return image?.data ? Buffer.from(image.data, 'base64') : null;
}

function throwIfSupabaseError(error: { message?: string } | null | undefined, action: string) {
  if (error) {
    throw new Error(`${action}: ${error.message ?? 'Supabase operation failed.'}`);
  }
}

function isTerminalProviderFailure(state?: string | null) {
  return Boolean(state && (
    state.includes('FAILED') ||
    state.includes('CANCELLED') ||
    state.includes('CANCELED') ||
    state.includes('EXPIRED')
  ));
}

export async function submitNextImageStudioBatch(
  limit = 1000,
  requestContext?: AIRequestContext,
  options: SubmitImageStudioBatchOptions = {}
) {
  const selectionMode = options.selectionMode ?? 'pending';
  const offset = Math.max(options.offset ?? 0, 0);
  const admin = createAdminServerSupabaseClient();
  const { data: activeRun, error: activeRunError } = await admin
    .from('cakegenie_image_studio_batch_jobs')
    .select('id')
    .neq('stage', 'complete')
    .limit(1)
    .maybeSingle();
  if (activeRunError) throw activeRunError;
  if (activeRun) throw new Error('An offline image batch is already active. Refresh its status before submitting another.');

  let rowsQuery = admin
    .from('cakegenie_analysis_cache')
    .select('id,p_hash,slug,original_image_url,studio_edited_image_url')
    .not('original_image_url', 'is', null)
    .neq('original_image_url', '')
    .is('batch_job_id', null)
    .order('created_at', { ascending: false });

  if (selectionMode === 'completed') {
    rowsQuery = rowsQuery.eq('studio_edit_status', 'completed');
  } else {
    rowsQuery = rowsQuery.or('studio_edit_status.is.null,studio_edit_status.neq.completed');
  }

  const safeLimit = Math.min(Math.max(limit, 1), 1000);
  const { data: rows, error } = await rowsQuery.range(offset, offset + safeLimit - 1);
  if (error) throw error;
  if (!rows?.length) {
    if (selectionMode === 'completed') {
      throw new Error('No eligible completed Studio rows were found for batch rerun.');
    }
    throw new Error('No eligible cache rows are waiting for batch processing.');
  }

  const adminClient = getAI(requestContext);
  const gcs = parseGcsPrefix();
  const storage = createBatchStorage(requestContext);
  const runId = crypto.randomUUID();
  const inputUri = `gs://${gcs.bucket}/${objectName(gcs.prefix, `${runId}/studio-input.jsonl`)}`;
  const outputUri = `gs://${gcs.bucket}/${objectName(gcs.prefix, `${runId}/studio-output`)}`;
  await storage.bucket(gcs.bucket).file(objectName(gcs.prefix, `${runId}/studio-input.jsonl`))
    .save(rows.map((row) => buildImageStudioBatchInputLine(row as BatchItem, 'studio')).join('\n'), { contentType: 'application/jsonl' })
    .catch((error: unknown) => { throw toActionableGoogleCloudStorageError(error, 'create'); });
  const providerJob = await adminClient.batches.create({
    model: STUDIO_MODEL,
    src: { gcsUri: [inputUri], format: 'jsonl' },
    config: { displayName: `cakegenie-studio-${runId}`, dest: { gcsUri: outputUri, format: 'jsonl' } },
  });
  if (!providerJob.name) throw new Error('Vertex AI did not return a batch job name.');

  const { data: run, error: insertError } = await admin.from('cakegenie_image_studio_batch_jobs').insert({
    gemini_job_name: providerJob.name, status: 'submitted', stage: 'studio',
    input_file_uri: inputUri, output_file_uri: outputUri, total_requests: rows.length,
  }).select('*').single();
  if (insertError) throw insertError;
  await admin.from('cakegenie_image_studio_batch_items').insert(rows.map((row) => ({
    batch_job_id: run.id, cache_id: row.id, p_hash: row.p_hash, slug: row.slug,
    original_image_url: row.original_image_url, studio_edited_image_url: row.studio_edited_image_url,
    studio_status: 'submitted',
  })));
  await admin.from('cakegenie_analysis_cache').update({ batch_job_id: run.id, studio_edit_status: 'processing' })
    .in('id', rows.map((row) => row.id));
  return run;
}

async function importStage(run: BatchRun, items: BatchItem[], stage: Stage, maxImports = 10, requestContext?: AIRequestContext) {
  const admin = createAdminServerSupabaseClient();
  const storage = createBatchStorage(requestContext);
  const { bucket, path: outputPrefix } = parseGcsUri(run.output_file_uri);
  const [files] = await storage.bucket(bucket).getFiles({ prefix: outputPrefix })
    .catch((error: unknown) => { throw toActionableGoogleCloudStorageError(error, 'list'); });
  const outputFile = files.find((file) => file.name.endsWith('.jsonl'));
  if (!outputFile) throw new Error(`No JSONL output found under ${run.output_file_uri}.`);
  const itemsByUri = new Map<string, BatchItem>();
  for (const item of items) {
    const key = stage === 'studio' ? item.original_image_url : item.studio_edited_image_url;
    if (key) {
      itemsByUri.set(key, item);
    }
  }

  const lines = readline.createInterface({ input: outputFile.createReadStream() });
  let completed = 0;
  let failed = 0;
  let imported = 0;
  for await (const rawLine of lines) {
    let line: JsonlResponse;
    try {
      line = JSON.parse(rawLine) as JsonlResponse;
    } catch {
      continue;
    }
    const parts = line.request?.contents?.flatMap((content) => content.parts ?? []) ?? [];
    const fileUri = parts.find((part) => part?.fileData?.fileUri)?.fileData?.fileUri ?? null;
    if (!fileUri) {
      continue;
    }
    const item = itemsByUri.get(fileUri);
    if (!item) {
      continue;
    }
    const currentStatus = stage === 'studio' ? item.studio_status : item.mask_status;
    if (currentStatus === 'completed') {
      completed += 1;
      continue;
    }
    if (currentStatus === 'failed') {
      failed += 1;
      continue;
    }
    if (imported >= maxImports) break;
    try {
      const image = extractImage(line);
      if (!image) {
        const { error: failedUpdateError } = await admin
          .from('cakegenie_image_studio_batch_items')
          .update({ [`${stage}_status`]: 'failed', error: line.error?.message ?? 'No image returned.' })
          .eq('id', item.id);
        throwIfSupabaseError(failedUpdateError, `Mark ${stage} item failed`);
        failed += 1;
        imported += 1;
        continue;
      }
      if (stage === 'studio') {
        const latestSlug = item.cache?.slug || item.slug;
        const path = getImageStudioStoragePath({ slug: latestSlug, pHash: item.p_hash });
        const webp = await sharp(image).webp({ quality: 92, effort: 4 }).toBuffer();
        const metadata = await sharp(webp).metadata().catch(() => null);
        const { error: uploadError } = await admin.storage.from(STORAGE_BUCKET).upload(path, webp, {
          contentType: 'image/webp',
          upsert: true,
          headers: getSeoImageUploadHeaders(),
        });
        throwIfSupabaseError(uploadError, `Upload studio image ${path}`);
        const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        const { error: cacheUpdateError } = await admin
          .from('cakegenie_analysis_cache')
          .update({
            studio_edited_image_url: data.publicUrl,
            studio_edit_status: 'completed',
            studio_edited_at: new Date().toISOString(),
            image_width: metadata?.width ?? null,
            image_height: metadata?.height ?? null,
          })
          .eq('id', item.cache_id);
        throwIfSupabaseError(cacheUpdateError, `Update studio cache row ${item.cache_id}`);
        const { error: itemUpdateError } = await admin
          .from('cakegenie_image_studio_batch_items')
          .update({ studio_status: 'completed', studio_edited_image_url: data.publicUrl, error: null })
          .eq('id', item.id);
        throwIfSupabaseError(itemUpdateError, `Mark studio item completed ${item.id}`);
      } else {
        const path = `icing-masks/${item.cache_id}/v${CURRENT_MASK_VERSION}.png`;
        const png = await sharp(image).png().toBuffer();
        const metadata = await sharp(png).metadata();
        const { error: uploadError } = await admin.storage.from(STORAGE_BUCKET).upload(path, png, { contentType: 'image/png', upsert: true });
        throwIfSupabaseError(uploadError, `Upload mask image ${path}`);
        const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        const { error: maskUpsertError } = await admin.from('cakegenie_icing_masks').upsert({
          cache_id: item.cache_id, mask_url: `${data.publicUrl}?t=${Date.now()}`,
          source_image_url: item.studio_edited_image_url, mask_version: CURRENT_MASK_VERSION,
          width: metadata.width, height: metadata.height, status: 'ready',
        }, { onConflict: 'cache_id,mask_version' });
        throwIfSupabaseError(maskUpsertError, `Upsert mask row ${item.cache_id}`);
        const { error: itemUpdateError } = await admin
          .from('cakegenie_image_studio_batch_items')
          .update({ mask_status: 'completed', error: null })
          .eq('id', item.id);
        throwIfSupabaseError(itemUpdateError, `Mark mask item completed ${item.id}`);
      }
      completed += 1;
      imported += 1;
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : `${stage} import failed.`;
      const { error: failedUpdateError } = await admin
        .from('cakegenie_image_studio_batch_items')
        .update({ [`${stage}_status`]: 'failed', error: message })
        .eq('id', item.id);
      throwIfSupabaseError(failedUpdateError, `Mark ${stage} import failure ${item.id}`);
      failed += 1;
      imported += 1;
    }
  }
  const statusColumn = stage === 'studio' ? 'studio_status' : 'mask_status';
  const { count: remaining, error: countError } = await admin
    .from('cakegenie_image_studio_batch_items')
    .select('id', { count: 'exact', head: true })
    .eq('batch_job_id', run.id)
    .in(statusColumn, ['pending', 'submitted']);
  if (countError) throw countError;
  const { count: completedCount, error: completedCountError } = await admin
    .from('cakegenie_image_studio_batch_items')
    .select('id', { count: 'exact', head: true })
    .eq('batch_job_id', run.id)
    .eq(statusColumn, 'completed');
  if (completedCountError) throw completedCountError;
  const { count: failedCount, error: failedCountError } = await admin
    .from('cakegenie_image_studio_batch_items')
    .select('id', { count: 'exact', head: true })
    .eq('batch_job_id', run.id)
    .eq(statusColumn, 'failed');
  if (failedCountError) throw failedCountError;
  return { completed: completedCount ?? completed, failed: failedCount ?? failed, imported, remaining: remaining ?? 0 };
}

export async function reconcileImageStudioBatch(runId: string, requestContext?: AIRequestContext) {
  const admin = createAdminServerSupabaseClient();
  const { data: run, error } = await admin.from('cakegenie_image_studio_batch_jobs').select('*').eq('id', runId).single();
  if (error) throw error;
  const aiClient = getAI(requestContext);
  let providerJob: Awaited<ReturnType<typeof aiClient.batches.get>> | null = null;
  if (run.status !== 'JOB_STATE_SUCCEEDED' && run.status !== 'importing') {
    try {
      providerJob = await aiClient.batches.get({ name: run.gemini_job_name });
      await admin.from('cakegenie_image_studio_batch_jobs').update({ status: providerJob.state ?? 'unknown', updated_at: new Date().toISOString() }).eq('id', runId);
    } catch (providerError) {
      const stageStatusColumn = run.stage === 'studio' ? 'studio_status' : 'mask_status';
      const errorMessage = providerError instanceof Error ? providerError.message : String(providerError);
      await admin.from('cakegenie_image_studio_batch_items').update({
        [stageStatusColumn]: 'failed',
        error: `Batch provider check failed: ${errorMessage}`,
      }).eq('batch_job_id', runId).eq(stageStatusColumn, 'submitted');
      await admin.from('cakegenie_analysis_cache').update({ batch_job_id: null }).eq('batch_job_id', runId);
      
      const { count: completedCount, error: completedCountError } = await admin.from('cakegenie_image_studio_batch_items')
        .select('id', { count: 'exact', head: true }).eq('batch_job_id', runId).eq(stageStatusColumn, 'completed');
      if (completedCountError) throw completedCountError;
      const { count: failedCount, error: failedCountError } = await admin.from('cakegenie_image_studio_batch_items')
        .select('id', { count: 'exact', head: true }).eq('batch_job_id', runId).eq(stageStatusColumn, 'failed');
      if (failedCountError) throw failedCountError;
      
      const status = completedCount ? 'completed_with_errors' : 'failed';
      await admin.from('cakegenie_image_studio_batch_jobs').update({
        status,
        stage: 'complete',
        completed_requests: completedCount ?? 0,
        failed_requests: failedCount ?? 0,
        error: `Batch provider check failed: ${errorMessage}`,
        updated_at: new Date().toISOString(),
      }).eq('id', runId);
      
      return {
        run: {
          ...run,
          status,
          stage: 'complete',
          completed_requests: completedCount ?? 0,
          failed_requests: failedCount ?? 0,
          error: `Batch provider check failed: ${errorMessage}`,
        }
      };
    }

    if (providerJob.state !== 'JOB_STATE_SUCCEEDED') {
      if (isTerminalProviderFailure(providerJob.state)) {
        const stageStatusColumn = run.stage === 'studio' ? 'studio_status' : 'mask_status';
        await admin.from('cakegenie_image_studio_batch_items').update({
          [stageStatusColumn]: 'failed',
          error: `${run.stage} batch provider job ended as ${providerJob.state}.`,
        }).eq('batch_job_id', runId).eq(stageStatusColumn, 'submitted');
        await admin.from('cakegenie_analysis_cache').update({ batch_job_id: null }).eq('batch_job_id', runId);
        const { count: completedCount, error: completedCountError } = await admin.from('cakegenie_image_studio_batch_items')
          .select('id', { count: 'exact', head: true }).eq('batch_job_id', runId).eq(stageStatusColumn, 'completed');
        if (completedCountError) throw completedCountError;
        const { count: failedCount, error: failedCountError } = await admin.from('cakegenie_image_studio_batch_items')
          .select('id', { count: 'exact', head: true }).eq('batch_job_id', runId).eq(stageStatusColumn, 'failed');
        if (failedCountError) throw failedCountError;
        const status = completedCount ? 'completed_with_errors' : 'failed';
        await admin.from('cakegenie_image_studio_batch_jobs').update({
          status,
          stage: 'complete',
          completed_requests: completedCount ?? 0,
          failed_requests: failedCount ?? 0,
          error: `${run.stage} batch provider job ended as ${providerJob.state}.`,
          updated_at: new Date().toISOString(),
        }).eq('id', runId);
        return {
          run: {
            ...run,
            status,
            stage: 'complete',
            completed_requests: completedCount ?? 0,
            failed_requests: failedCount ?? 0,
          },
          providerJob,
        };
      }
      return { run: { ...run, status: providerJob.state }, providerJob };
    }
  }
  let itemsQuery = admin.from('cakegenie_image_studio_batch_items').select('*, cache:cakegenie_analysis_cache(slug)').eq('batch_job_id', runId);
  if (run.stage === 'mask') itemsQuery = itemsQuery.eq('studio_status', 'completed');
  const { data: items, error: itemsError } = await itemsQuery.order('created_at');
  if (itemsError) throw itemsError;
  const result = await importStage(run, items as BatchItem[], run.stage, 10, requestContext);
  if (result.remaining > 0) {
    await admin.from('cakegenie_image_studio_batch_jobs').update({
      status: 'importing',
      completed_requests: result.completed,
      failed_requests: result.failed,
      updated_at: new Date().toISOString(),
    }).eq('id', runId);
    return { run: { ...run, status: 'importing', completed_requests: result.completed, failed_requests: result.failed }, result };
  }
  if (run.stage === 'mask') {
    const status = result.failed ? 'completed_with_errors' : 'completed';
    await admin.from('cakegenie_image_studio_batch_jobs').update({ status, stage: 'complete', completed_requests: result.completed, failed_requests: result.failed, updated_at: new Date().toISOString() }).eq('id', runId);
    await admin.from('cakegenie_analysis_cache').update({ batch_job_id: null }).eq('batch_job_id', runId);
    return { run: { ...run, status, stage: 'complete' }, result };
  }
  const gcs = getRunGcsPrefix(run.output_file_uri);
  const storage = createBatchStorage(requestContext);
  const inputUri = `gs://${gcs.bucket}/${objectName(gcs.prefix, `${runId}/mask-input.jsonl`)}`;
  const outputUri = `gs://${gcs.bucket}/${objectName(gcs.prefix, `${runId}/mask-output`)}`;
  const refreshed = await admin.from('cakegenie_image_studio_batch_items').select('*').eq('batch_job_id', runId).eq('studio_status', 'completed').order('created_at');
  if (refreshed.error) throw refreshed.error;
  const ready = refreshed.data as BatchItem[];
  if (ready.length === 0) {
    await admin.from('cakegenie_image_studio_batch_jobs').update({
      status: 'completed_with_errors', stage: 'complete',
      completed_requests: result.completed, failed_requests: result.failed,
      updated_at: new Date().toISOString(),
    }).eq('id', runId);
    await admin.from('cakegenie_analysis_cache').update({ batch_job_id: null }).eq('batch_job_id', runId);
    return { run: { ...run, stage: 'complete', status: 'completed_with_errors' }, result };
  }
  await storage.bucket(gcs.bucket).file(objectName(gcs.prefix, `${runId}/mask-input.jsonl`)).save(ready.map((item) => buildImageStudioBatchInputLine(item, 'mask')).join('\n'), { contentType: 'application/jsonl' })
    .catch((error: unknown) => { throw toActionableGoogleCloudStorageError(error, 'create'); });
  const maskJob = await aiClient.batches.create({ model: MASK_MODEL, src: { gcsUri: [inputUri], format: 'jsonl' }, config: { displayName: `cakegenie-mask-${runId}`, dest: { gcsUri: outputUri, format: 'jsonl' } } });
  await admin.from('cakegenie_image_studio_batch_jobs').update({ gemini_job_name: maskJob.name, status: 'submitted', stage: 'mask', input_file_uri: inputUri, output_file_uri: outputUri, completed_requests: result.completed, failed_requests: result.failed, updated_at: new Date().toISOString() }).eq('id', runId);
  await admin.from('cakegenie_image_studio_batch_items').update({ mask_status: 'submitted' }).eq('batch_job_id', runId).eq('studio_status', 'completed');
  return { run: { ...run, stage: 'mask', status: 'submitted' }, result };
}

export async function getActiveImageStudioBatch() {
  const admin = createAdminServerSupabaseClient();
  const { data, error } = await admin
    .from('cakegenie_image_studio_batch_jobs')
    .select('*')
    .neq('stage', 'complete')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function continueImageStudioBatch(requestContext?: AIRequestContext, options: { maxSteps?: number } = {}) {
  const maxSteps = Math.min(Math.max(options.maxSteps ?? 8, 1), 20);
  const steps: ContinuationStep[] = [];

  for (let index = 0; index < maxSteps; index += 1) {
    const activeRun = await getActiveImageStudioBatch();
    if (!activeRun?.id) {
      return { active: false, steps };
    }

    const response = await reconcileImageStudioBatch(activeRun.id, requestContext);
    const run = response.run as { id: string; stage?: string; status?: string; completed_requests?: number; failed_requests?: number };
    const result = response.result as { imported?: number; remaining?: number } | undefined;

    steps.push({
      runId: run.id,
      stage: run.stage ?? activeRun.stage,
      status: run.status ?? activeRun.status,
      completed: run.completed_requests,
      failed: run.failed_requests,
      imported: result?.imported,
      remaining: result?.remaining,
    });

    if (run.stage === 'complete') {
      return { active: false, steps };
    }

    if (run.status !== 'importing' && run.status !== 'JOB_STATE_SUCCEEDED') {
      return { active: true, waitingForProvider: true, steps };
    }

    if (!result || result.remaining === 0) {
      continue;
    }
  }

  return { active: true, steps };
}

export async function getLatestImageStudioBatch() {
  const admin = createAdminServerSupabaseClient();
  const { data, error } = await admin.from('cakegenie_image_studio_batch_jobs').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getImageStudioBatchHistory(limit = 20) {
  const admin = createAdminServerSupabaseClient();
  const { data, error } = await admin
    .from('cakegenie_image_studio_batch_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw error;
  return data ?? [];
}
