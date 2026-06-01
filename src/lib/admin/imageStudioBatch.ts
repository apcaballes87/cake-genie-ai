import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';

import { getAI } from '@/lib/ai/client';
import { buildImageStudioPrompt, buildImageStudioSystemInstruction, getImageStudioStoragePath } from '@/lib/admin/imageStudio';
import { buildIcingConversionPrompt } from '@/lib/icingConversionPrompt';
import { ICING_LAYER_SYSTEM_INSTRUCTION, CURRENT_MASK_VERSION } from '@/services/icingMaskService';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

const STUDIO_MODEL = 'gemini-3.1-flash-image-preview';
const MASK_MODEL = 'gemini-3.1-flash-image-preview';
const STORAGE_BUCKET = 'cakegenie';

type Stage = 'studio' | 'mask';
type BatchItem = {
  id: string;
  cache_id: string;
  p_hash: string;
  slug: string | null;
  original_image_url: string;
  studio_edited_image_url: string | null;
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

function objectName(prefix: string, path: string) {
  return [prefix, path].filter(Boolean).join('/');
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

export async function submitNextImageStudioBatch(limit = 1000) {
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

  const adminClient = getAI();
  const gcs = parseGcsPrefix();
  const storage = new Storage();
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

async function importStage(run: BatchRun, items: BatchItem[], stage: Stage) {
  const admin = createAdminServerSupabaseClient();
  const storage = new Storage();
  const gcs = parseGcsPrefix();
  const outputPrefix = run.output_file_uri.replace(`gs://${gcs.bucket}/`, '');
  const [files] = await storage.bucket(gcs.bucket).getFiles({ prefix: outputPrefix });
  const outputFile = files.find((file) => file.name.endsWith('.jsonl'));
  if (!outputFile) throw new Error(`No JSONL output found under ${run.output_file_uri}.`);
  const [contents] = await outputFile.download();
  const lines = contents.toString('utf8').trim().split('\n').map((line) => JSON.parse(line) as JsonlResponse);
  let completed = 0;
  let failed = 0;
  for (const [index, item] of items.entries()) {
    const image = extractImage(lines[index] ?? {});
    if (!image) {
      failed += 1;
      await admin.from('cakegenie_image_studio_batch_items').update({ [`${stage}_status`]: 'failed', error: lines[index]?.error?.message ?? 'No image returned.' }).eq('id', item.id);
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
  }
  return { completed, failed };
}

export async function reconcileImageStudioBatch(runId: string) {
  const admin = createAdminServerSupabaseClient();
  const { data: run, error } = await admin.from('cakegenie_image_studio_batch_jobs').select('*').eq('id', runId).single();
  if (error) throw error;
  const providerJob = await getAI().batches.get({ name: run.gemini_job_name });
  await admin.from('cakegenie_image_studio_batch_jobs').update({ status: providerJob.state ?? 'unknown', updated_at: new Date().toISOString() }).eq('id', runId);
  if (providerJob.state !== 'JOB_STATE_SUCCEEDED') return { run: { ...run, status: providerJob.state }, providerJob };
  const { data: items, error: itemsError } = await admin.from('cakegenie_image_studio_batch_items').select('*').eq('batch_job_id', runId).order('created_at');
  if (itemsError) throw itemsError;
  const result = await importStage(run, items as BatchItem[], run.stage);
  if (run.stage === 'mask') {
    const status = result.failed ? 'completed_with_errors' : 'completed';
    await admin.from('cakegenie_image_studio_batch_jobs').update({ status, stage: 'complete', completed_requests: result.completed, failed_requests: result.failed, updated_at: new Date().toISOString() }).eq('id', runId);
    await admin.from('cakegenie_analysis_cache').update({ batch_job_id: null }).eq('batch_job_id', runId);
    return { run: { ...run, status, stage: 'complete' }, result };
  }
  const gcs = parseGcsPrefix();
  const storage = new Storage();
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
  const maskJob = await getAI().batches.create({ model: MASK_MODEL, src: { gcsUri: [inputUri], format: 'jsonl' }, config: { displayName: `cakegenie-mask-${runId}`, dest: { gcsUri: outputUri, format: 'jsonl' } } });
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
