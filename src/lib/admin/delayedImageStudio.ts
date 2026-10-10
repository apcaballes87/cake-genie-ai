import { Storage } from '@google-cloud/storage';
import readline from 'node:readline';

import { FEATURE_FLAGS } from '@/config/features';
import {
  extractImageStudioBatchImage,
  buildImageStudioBatchInputLine,
  parseImageStudioBatchGcsPrefix,
  type BatchItem,
  type ImageStudioBatchJsonlResponse,
} from '@/lib/admin/imageStudioBatch';
import { getAI, getGoogleCloudAuthOptions } from '@/lib/ai/client';
import { toActionableGoogleCloudStorageError } from '@/lib/ai/googleCloudErrors';
import { uploadGeneratedStudioImage } from '@/lib/admin/imageStudioJob';
import { createAdminServerSupabaseClient } from '@/lib/supabase/adminServer';

type WorkerContext = {
  headers?: { get(name: string): string | null | undefined };
} | null | undefined;

type QueuedStudioJob = {
  id: string;
  cache_id: string;
  source_revision: string;
  source_image_url: string;
  p_hash: string;
  attempt_count: number;
  status: string;
  batch_run_id?: string | null;
};

type BatchRun = {
  id: string;
  provider_job_name: string | null;
  input_file_uri: string | null;
  output_file_uri: string | null;
  status: 'collecting' | 'submitted' | 'importing' | 'completed' | 'failed';
  total_jobs: number;
  imported_jobs: number;
};

type BatchOutputLine = ImageStudioBatchJsonlResponse & {
  request?: {
    contents?: Array<{
      parts?: Array<{ fileData?: { fileUri?: string | null } | null }>;
    }>;
  };
};

export type DelayedImageStudioWorkerResult = {
  status: 'disabled' | 'idle' | 'submitted' | 'waiting' | 'importing' | 'completed' | 'failed' | 'needs_review';
  runId: string | null;
  claimed: number;
  submitted: number;
  completed: number;
  imported: number;
  retryable: number;
  failed: number;
  skipped: number;
  waitingForProvider?: boolean;
  needsReview?: boolean;
};

const MODEL_NAME = 'gemini-3.1-flash-lite-image';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function safeLimit(limit: number | undefined) {
  const value = Number.isFinite(limit) ? Math.trunc(limit as number) : DEFAULT_LIMIT;
  return Math.min(Math.max(value, 1), MAX_LIMIT);
}

function parseGcsUri(value: string) {
  const match = value.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) throw new Error(`Invalid GCS URI: ${value}`);
  return { bucket: match[1], path: match[2].replace(/\/+$/, '') };
}

function objectName(prefix: string, path: string) {
  return [prefix, path].filter(Boolean).join('/');
}

function isTerminalProviderFailure(state?: string | null) {
  return Boolean(state && /FAILED|CANCELLED|CANCELED|EXPIRED/.test(state));
}

function isDefinitiveSubmissionFailure(error: unknown) {
  return /accountDisabled|billing account.*(?:disabled|closed)|permission.?denied|PERMISSION_DENIED|UNAUTHENTICATED|INVALID_ARGUMENT|\b(?:400|401|403|404)\b/i.test(message(error));
}

function storageFor(context?: WorkerContext) {
  return new Storage(getGoogleCloudAuthOptions(context));
}

function checked<T extends { error?: { message?: string } | null }>(result: T) {
  if (result.error) throw new Error(result.error.message ?? 'Supabase operation failed.');
  return result;
}

const disabledResult = (): DelayedImageStudioWorkerResult => ({
  status: 'disabled',
  runId: null,
  claimed: 0,
  submitted: 0,
  completed: 0,
  imported: 0,
  retryable: 0,
  failed: 0,
  skipped: 0,
});

async function getActiveBatch(admin: ReturnType<typeof createAdminServerSupabaseClient>) {
  const result = await admin
    .from('cakegenie_studio_edit_batch_runs')
    .select('*')
    .in('status', ['collecting', 'submitted', 'importing'])
    .order('created_at')
    .limit(1)
    .maybeSingle();
  return checked(result).data as BatchRun | null;
}

async function failBatch(
  admin: ReturnType<typeof createAdminServerSupabaseClient>,
  runId: string,
  error: unknown,
) {
  const result = await admin.rpc('fail_studio_edit_batch', {
    p_run_id: runId,
    p_error: message(error),
  });
  return checked(result).data as number;
}

async function submitDueBatch(
  context: WorkerContext | undefined,
  limit: number,
): Promise<DelayedImageStudioWorkerResult> {
  const admin = createAdminServerSupabaseClient();
  const runId = crypto.randomUUID();
  const claim = await admin.rpc('claim_studio_edit_batch_jobs', {
    p_run_id: runId,
    p_limit: limit,
  });
  if (claim.error) {
    if (/active|duplicate|unique/i.test(claim.error.message)) {
      return { ...disabledResult(), status: 'waiting' };
    }
    throw new Error(`Failed to claim delayed Studio batch jobs: ${claim.error.message}`);
  }

  const jobs = (claim.data ?? []) as QueuedStudioJob[];
  if (!jobs.length) {
    const active = await getActiveBatch(admin);
    return active
      ? { ...disabledResult(), status: 'waiting', runId: active.id, waitingForProvider: true }
      : { ...disabledResult(), status: 'idle', runId };
  }

  const cacheResult = await admin
    .from('cakegenie_analysis_cache')
    .select('id,slug,studio_edited_image_url')
    .in('id', jobs.map((job) => job.cache_id));
  const cacheRows = checked(cacheResult).data ?? [];
  const cacheById = new Map(cacheRows.map((row) => [row.id, row]));
  const items: BatchItem[] = jobs.map((job) => {
    const cache = cacheById.get(job.cache_id);
    return {
      id: job.id,
      cache_id: job.cache_id,
      p_hash: job.p_hash,
      slug: cache?.slug ?? null,
      original_image_url: job.source_image_url,
      studio_edited_image_url: cache?.studio_edited_image_url ?? null,
    };
  });

  const gcs = parseImageStudioBatchGcsPrefix();
  const storage = storageFor(context);
  const root = objectName(gcs.prefix, `delayed-studio/${runId}`);
  const inputUri = `gs://${gcs.bucket}/${objectName(root, 'input.jsonl')}`;
  const outputUri = `gs://${gcs.bucket}/${objectName(root, 'output')}`;
  const inputPath = objectName(root, 'input.jsonl');
  let providerRequestStarted = false;

  try {
    await storage.bucket(gcs.bucket).file(inputPath)
      .save(items.map((item) => buildImageStudioBatchInputLine(item, 'studio')).join('\n'), {
        contentType: 'application/jsonl',
      });

    checked(await admin.from('cakegenie_studio_edit_batch_runs').update({
      input_file_uri: inputUri,
      output_file_uri: outputUri,
      updated_at: new Date().toISOString(),
    }).eq('id', runId));

    providerRequestStarted = true;
    const provider = await (await getAI(context)).batches.create({
      model: MODEL_NAME,
      src: { gcsUri: [inputUri], format: 'jsonl' },
      config: {
        displayName: `cakegenie-delayed-studio-${runId}`,
        dest: { gcsUri: outputUri, format: 'jsonl' },
      },
    });
    if (!provider.name) throw new Error('Vertex Batch did not return a provider job name.');

    const submission = await admin.rpc('set_studio_edit_batch_submission', {
      p_run_id: runId,
      p_provider_job_name: provider.name,
      p_input_file_uri: inputUri,
      p_output_file_uri: outputUri,
    });
    if (submission.error || submission.data !== true) {
      throw new Error(submission.error?.message ?? 'Delayed Studio batch submission was not recorded.');
    }

    return {
      ...disabledResult(),
      status: 'submitted',
      runId,
      claimed: jobs.length,
      submitted: jobs.length,
    };
  } catch (error) {
    if (!providerRequestStarted || isDefinitiveSubmissionFailure(error)) {
      const failed = await failBatch(admin, runId, error);
      return {
        ...disabledResult(),
        status: 'failed',
        runId,
        claimed: jobs.length,
        failed,
      };
    }

    await admin.from('cakegenie_studio_edit_batch_runs').update({
      error: message(error).slice(0, 2000),
      updated_at: new Date().toISOString(),
    }).eq('id', runId);
    return {
      ...disabledResult(),
      status: 'needs_review',
      runId,
      claimed: jobs.length,
      needsReview: true,
    };
  }
}

async function importCompletedBatch(
  context: WorkerContext | undefined,
  run: BatchRun,
): Promise<DelayedImageStudioWorkerResult> {
  const admin = createAdminServerSupabaseClient();
  if (!run.output_file_uri) throw new Error(`Delayed Studio batch ${run.id} has no output URI.`);

  const importing = await admin.rpc('mark_studio_edit_batch_importing', { p_run_id: run.id });
  if (importing.error) throw new Error(importing.error.message);

  const { bucket, path } = parseGcsUri(run.output_file_uri);
  const storage = storageFor(context);
  const [files] = await storage.bucket(bucket).getFiles({ prefix: path })
    .catch((error: unknown) => { throw toActionableGoogleCloudStorageError(error, 'list'); });
  const outputFile = files.find((file) => file.name.endsWith('.jsonl'));
  if (!outputFile) throw new Error(`No JSONL output found under ${run.output_file_uri}.`);

  const jobsResult = await admin
    .from('cakegenie_studio_edit_jobs')
    .select('id,cache_id,p_hash,source_revision,source_image_url,status,batch_run_id')
    .eq('batch_run_id', run.id);
  const jobs = checked(jobsResult).data as QueuedStudioJob[];
  const bySource = new Map(jobs.map((job) => [job.source_image_url, job]));
  const seen = new Set<string>();
  let completed = 0;
  let imported = 0;
  let retryable = 0;
  let failed = 0;
  let skipped = 0;

  const lines = readline.createInterface({ input: outputFile.createReadStream() });
  try {
    for await (const rawLine of lines) {
      let line: BatchOutputLine;
      try {
        line = JSON.parse(rawLine) as BatchOutputLine;
      } catch {
        continue;
      }
      const sourceUrl = line.request?.contents
        ?.flatMap((content) => content.parts ?? [])
        .find((part) => part.fileData?.fileUri)?.fileData?.fileUri;
      if (!sourceUrl) continue;
      const job = bySource.get(sourceUrl);
      if (!job || seen.has(job.id)) continue;
      seen.add(job.id);

      if (job.status === 'completed') {
        completed += 1;
        skipped += 1;
        continue;
      }

      try {
        const image = extractImageStudioBatchImage(line);
        if (!image) {
          const failure = await admin.rpc('fail_studio_edit_job', {
            p_job_id: job.id,
            p_run_id: run.id,
            p_error: line.error?.message ?? 'Vertex Batch returned no edited image.',
          });
          if (failure.error) throw new Error(failure.error.message);
          if (failure.data === 'failed') failed += 1;
          else if (failure.data === 'retryable') retryable += 1;
          else skipped += 1;
          imported += 1;
          continue;
        }

        const cache = await admin
          .from('cakegenie_analysis_cache')
          .select('slug')
          .eq('id', job.cache_id)
          .maybeSingle();
        if (cache.error) throw new Error(cache.error.message);
        const uploaded = await uploadGeneratedStudioImage(admin, {
          pHash: job.p_hash,
          slug: cache.data?.slug ?? null,
          buffer: image,
        });
        const finalized = await admin.rpc('complete_studio_edit_job', {
          p_job_id: job.id,
          p_run_id: run.id,
          p_source_revision: job.source_revision,
          p_studio_edited_image_url: uploaded.publicUrl,
          p_image_width: uploaded.imageWidth,
          p_image_height: uploaded.imageHeight,
        });
        if (finalized.error) throw new Error(finalized.error.message);
        if (finalized.data === true) completed += 1;
        else skipped += 1;
        imported += 1;
      } catch (error) {
        const failure = await admin.rpc('fail_studio_edit_job', {
          p_job_id: job.id,
          p_run_id: run.id,
          p_error: message(error),
        });
        if (failure.error) throw new Error(failure.error.message);
        if (failure.data === 'failed') failed += 1;
        else if (failure.data === 'retryable') retryable += 1;
        else skipped += 1;
        imported += 1;
      }
    }
  } finally {
    lines.close();
  }

  for (const job of jobs) {
    if (seen.has(job.id) || job.status === 'completed') continue;
    const failure = await admin.rpc('fail_studio_edit_job', {
      p_job_id: job.id,
      p_run_id: run.id,
      p_error: 'Vertex Batch completed without an output for this source image.',
    });
    if (failure.error) throw new Error(failure.error.message);
    if (failure.data === 'failed') failed += 1;
    else if (failure.data === 'retryable') retryable += 1;
    else skipped += 1;
    imported += 1;
  }

  const finished = await admin.rpc('finish_studio_edit_batch', {
    p_run_id: run.id,
    p_imported_jobs: imported,
  });
  if (finished.error) throw new Error(finished.error.message);

  return {
    ...disabledResult(),
    status: 'completed',
    runId: run.id,
    claimed: jobs.length,
    completed,
    imported,
    retryable,
    failed,
    skipped,
  };
}

async function reconcileActiveBatch(
  context: WorkerContext | undefined,
  run: BatchRun,
): Promise<DelayedImageStudioWorkerResult> {
  if (run.status === 'collecting' || !run.provider_job_name) {
    return { ...disabledResult(), status: 'needs_review', runId: run.id, needsReview: true };
  }

  if (run.status === 'submitted') {
    const provider = await (await getAI(context)).batches.get({ name: run.provider_job_name });
    if (provider.state !== 'JOB_STATE_SUCCEEDED') {
      if (isTerminalProviderFailure(provider.state)) {
        const admin = createAdminServerSupabaseClient();
        const failed = await failBatch(admin, run.id, `Vertex Batch ended as ${provider.state}.`);
        return { ...disabledResult(), status: 'failed', runId: run.id, failed };
      }
      return { ...disabledResult(), status: 'waiting', runId: run.id, waitingForProvider: true };
    }
  }

  return importCompletedBatch(context, run);
}

export async function runDelayedImageStudioWorker(
  context?: WorkerContext,
  options: { limit?: number } = {},
): Promise<DelayedImageStudioWorkerResult> {
  if (!FEATURE_FLAGS.ENABLE_DELAYED_STUDIO_EDITING) return disabledResult();

  const admin = createAdminServerSupabaseClient();
  const active = await getActiveBatch(admin);
  if (active) return reconcileActiveBatch(context, active);
  return submitDueBatch(context, safeLimit(options.limit));
}
