import { Storage } from '@google-cloud/storage';
import readline from 'node:readline';
import sharp from 'sharp';

import { getAI, getGoogleCloudAuthOptions } from '@/lib/ai/client';
import { buildImageStudioPrompt, buildImageStudioSystemInstruction, getImageStudioStoragePath } from '@/lib/admin/imageStudio';
import { buildIcingConversionPrompt } from '@/lib/icingConversionPrompt';
import { ICING_LAYER_SYSTEM_INSTRUCTION, CURRENT_MASK_VERSION } from '@/services/icingMaskService';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

const STUDIO_MODEL = 'gemini-3.1-flash-image-preview';
const MASK_MODEL = 'gemini-3.1-flash-image-preview';
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
};

type JsonlResponse = {
  response?: {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  error?: { message?: string };
};

type BatchRun = {
  id: string;
  gemini_job_name: string;
  output_file_uri: string;
  stage: Stage;
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

function getRunGcsPrefix(run: BatchRun) {
  const { bucket, path } = parseGcsUri(run.output_file_uri);
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 3) {
    throw new Error(`Could not derive the batch GCS prefix from ${run.output_file_uri}.`);
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

export async function submitNextImageStudioBatch(limit = 1000, requestContext?: AIRequestContext) {
  const admin = createAdminServerSupabaseClient();
  const { data: activeRun, error: activeRunError } = await admin
    .from('cakegenie_image_studio_batch_jobs')
    .select('id')
    .neq('stage', 'complete')
    .limit(1)
    .maybeSingle();
  if (activeRunError) throw activeRunError;
  if (activeRun) throw new Error('An offline image batch is already active. Refresh its status before submitting another.');
  const { data: rows, error } = await admin
    .from('cakegenie_analysis_cache')
    .select('id,p_hash,slug,original_image_url,studio_edited_image_url')
    .not('original_image_url', 'is', null)
    .neq('original_image_url', '')
    .or('studio_edit_status.is.null,studio_edit_status.neq.completed')
    .is('batch_job_id', null)
    .limit(Math.min(Math.max(limit, 1), 1000));
  if (error) throw error;
  if (!rows?.length) throw new Error('No eligible cache rows are waiting for batch processing.');

  const adminClient = getAI(requestContext);
  const gcs = parseGcsPrefix();
  const storage = createBatchStorage(requestContext);
  const runId = crypto.randomUUID();
  const inputUri = `gs://${gcs.bucket}/${objectName(gcs.prefix, `${runId}/studio-input.jsonl`)}`;
  const outputUri = `gs://${gcs.bucket}/${objectName(gcs.prefix, `${runId}/studio-output`)}`;
  await storage.bucket(gcs.bucket).file(objectName(gcs.prefix, `${runId}/studio-input.jsonl`))
    .save(rows.map((row) => buildImageStudioBatchInputLine(row as BatchItem, 'studio')).join('\n'), { contentType: 'application/jsonl' });
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
  const [files] = await storage.bucket(bucket).getFiles({ prefix: outputPrefix });
  const outputFile = files.find((file) => file.name.endsWith('.jsonl'));
  if (!outputFile) throw new Error(`No JSONL output found under ${run.output_file_uri}.`);
  const lines = readline.createInterface({ input: outputFile.createReadStream() });
  let completed = 0;
  let failed = 0;
  let imported = 0;
  let index = 0;
  for await (const rawLine of lines) {
    const item = items[index];
    index += 1;
    if (!item) break;
    const currentStatus = stage === 'studio' ? item.studio_status : item.mask_status;
    if (currentStatus === 'completed') {
      completed += 1;
      continue;
    }
    if (imported >= maxImports) break;
    const line = JSON.parse(rawLine) as JsonlResponse;
    const image = extractImage(line);
    if (!image) {
      failed += 1;
      imported += 1;
      await admin.from('cakegenie_image_studio_batch_items').update({ [`${stage}_status`]: 'failed', error: line.error?.message ?? 'No image returned.' }).eq('id', item.id);
      continue;
    }
    if (stage === 'studio') {
      const path = getImageStudioStoragePath({ slug: item.slug, pHash: item.p_hash });
      const webp = await sharp(image).webp({ quality: 92, effort: 4 }).toBuffer();
      await admin.storage.from(STORAGE_BUCKET).upload(path, webp, { contentType: 'image/webp', upsert: true });
      const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      await admin.from('cakegenie_analysis_cache').update({ studio_edited_image_url: data.publicUrl, studio_edit_status: 'completed', studio_edited_at: new Date().toISOString() }).eq('id', item.cache_id);
      await admin.from('cakegenie_image_studio_batch_items').update({ studio_status: 'completed', studio_edited_image_url: data.publicUrl }).eq('id', item.id);
    } else {
      const path = `icing-masks/${item.cache_id}/v${CURRENT_MASK_VERSION}.png`;
      const png = await sharp(image).png().toBuffer();
      const metadata = await sharp(png).metadata();
      await admin.storage.from(STORAGE_BUCKET).upload(path, png, { contentType: 'image/png', upsert: true });
      const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      await admin.from('cakegenie_icing_masks').upsert({
        cache_id: item.cache_id, mask_url: `${data.publicUrl}?t=${Date.now()}`,
        source_image_url: item.studio_edited_image_url, mask_version: CURRENT_MASK_VERSION,
        width: metadata.width, height: metadata.height, status: 'ready',
      }, { onConflict: 'cache_id,mask_version' });
      await admin.from('cakegenie_image_studio_batch_items').update({ mask_status: 'completed' }).eq('id', item.id);
    }
    completed += 1;
    imported += 1;
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
    providerJob = await aiClient.batches.get({ name: run.gemini_job_name });
    await admin.from('cakegenie_image_studio_batch_jobs').update({ status: providerJob.state ?? 'unknown', updated_at: new Date().toISOString() }).eq('id', runId);
    if (providerJob.state !== 'JOB_STATE_SUCCEEDED') return { run: { ...run, status: providerJob.state }, providerJob };
  }
  let itemsQuery = admin.from('cakegenie_image_studio_batch_items').select('*').eq('batch_job_id', runId);
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
  const gcs = getRunGcsPrefix(run);
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
  await storage.bucket(gcs.bucket).file(objectName(gcs.prefix, `${runId}/mask-input.jsonl`)).save(ready.map((item) => buildImageStudioBatchInputLine(item, 'mask')).join('\n'), { contentType: 'application/jsonl' });
  const maskJob = await aiClient.batches.create({ model: MASK_MODEL, src: { gcsUri: [inputUri], format: 'jsonl' }, config: { displayName: `cakegenie-mask-${runId}`, dest: { gcsUri: outputUri, format: 'jsonl' } } });
  await admin.from('cakegenie_image_studio_batch_jobs').update({ gemini_job_name: maskJob.name, status: 'submitted', stage: 'mask', input_file_uri: inputUri, output_file_uri: outputUri, completed_requests: result.completed, failed_requests: result.failed, updated_at: new Date().toISOString() }).eq('id', runId);
  await admin.from('cakegenie_image_studio_batch_items').update({ mask_status: 'submitted' }).eq('batch_job_id', runId).eq('studio_status', 'completed');
  return { run: { ...run, stage: 'mask', status: 'submitted' }, result };
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
