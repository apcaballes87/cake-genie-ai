import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  batchesCreate: vi.fn(),
  batchesGet: vi.fn(),
  save: vi.fn(),
  getFiles: vi.fn(),
  uploadGeneratedStudioImage: vi.fn(),
}));

vi.mock('@/config/features', () => ({
  FEATURE_FLAGS: { ENABLE_DELAYED_STUDIO_EDITING: true },
}));

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

vi.mock('@/lib/ai/client', () => ({
  getAI: vi.fn(async () => ({
    batches: { create: mocks.batchesCreate, get: mocks.batchesGet },
  })),
  getGoogleCloudAuthOptions: vi.fn(() => ({})),
}));

vi.mock('@google-cloud/storage', () => ({
  Storage: class {
    bucket() {
      return {
        file: () => ({ save: mocks.save }),
        getFiles: mocks.getFiles,
      };
    }
  },
}));

vi.mock('@/lib/admin/imageStudioJob', () => ({
  uploadGeneratedStudioImage: mocks.uploadGeneratedStudioImage,
}));

import { runDelayedImageStudioWorker } from './delayedImageStudio';

const job = {
  id: 'job-1',
  cache_id: 'cache-1',
  source_revision: 'revision-1',
  source_image_url: 'https://example.com/original.webp',
  p_hash: 'abc123',
  attempt_count: 1,
  status: 'batch_submitted',
};

function query(data: unknown = null) {
  const result = { data, error: null };
  const chain = {
    select: vi.fn(() => chain),
    in: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    update: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

describe('delayed Image Studio batch worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VERTEX_AI_BATCH_GCS_URI', 'gs://test-bucket/delayed');
    mocks.from.mockImplementation((table: string) => {
      if (table === 'cakegenie_studio_edit_batch_runs') return query(null);
      if (table === 'cakegenie_analysis_cache') return query([{ id: 'cache-1', slug: 'purple-cake', studio_edited_image_url: null }]);
      return query([]);
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'claim_studio_edit_batch_jobs') return { data: [job], error: null };
      if (name === 'set_studio_edit_batch_submission') return { data: true, error: null };
      if (name === 'fail_studio_edit_batch') return { data: 1, error: null };
      return { data: true, error: null };
    });
    mocks.batchesCreate.mockResolvedValue({ name: 'providers/test-batch' });
    mocks.batchesGet.mockResolvedValue({ state: 'JOB_STATE_RUNNING' });
    mocks.save.mockResolvedValue(undefined);
    mocks.getFiles.mockResolvedValue([]);
    mocks.uploadGeneratedStudioImage.mockResolvedValue({
      publicUrl: 'https://example.com/studio.webp',
      imageWidth: 1024,
      imageHeight: 1024,
    });
  });

  it('claims due rows and submits one Gemini Batch request with the image model', async () => {
    await expect(runDelayedImageStudioWorker(undefined, { limit: 100 })).resolves.toMatchObject({
      status: 'submitted',
      claimed: 1,
      submitted: 1,
    });

    expect(mocks.rpc).toHaveBeenCalledWith('claim_studio_edit_batch_jobs', {
      p_run_id: expect.any(String),
      p_limit: 100,
    });
    expect(mocks.batchesCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.1-flash-lite-image',
      src: expect.objectContaining({ format: 'jsonl' }),
    }));
    expect(mocks.save).toHaveBeenCalledWith(expect.stringContaining('original.webp'), expect.objectContaining({ contentType: 'application/jsonl' }));
    expect(mocks.rpc).toHaveBeenCalledWith('set_studio_edit_batch_submission', expect.objectContaining({
      p_provider_job_name: 'providers/test-batch',
    }));
  });

  it('waits for an active provider batch instead of claiming a duplicate', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'cakegenie_studio_edit_batch_runs') {
        return query({
          id: 'run-1',
          provider_job_name: 'providers/active',
          output_file_uri: 'gs://test-bucket/delayed/run-1/output',
          status: 'submitted',
          total_jobs: 1,
          imported_jobs: 0,
        });
      }
      return query([]);
    });

    await expect(runDelayedImageStudioWorker()).resolves.toMatchObject({
      status: 'waiting',
      runId: 'run-1',
      waitingForProvider: true,
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith('claim_studio_edit_batch_jobs', expect.anything());
  });

  it('marks every queued item retryable or failed when Vertex ends terminally', async () => {
    mocks.from.mockImplementation((table: string) => table === 'cakegenie_studio_edit_batch_runs'
      ? query({
        id: 'run-1',
        provider_job_name: 'providers/active',
        output_file_uri: 'gs://test-bucket/delayed/run-1/output',
        status: 'submitted',
        total_jobs: 1,
        imported_jobs: 0,
      })
      : query([]));
    mocks.batchesGet.mockResolvedValue({ state: 'JOB_STATE_FAILED' });

    await expect(runDelayedImageStudioWorker()).resolves.toMatchObject({
      status: 'failed',
      runId: 'run-1',
      failed: 1,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('fail_studio_edit_batch', expect.objectContaining({
      p_run_id: 'run-1',
    }));
  });

  it('imports only matching batch outputs and finalizes the cache row through the queue RPC', async () => {
    const outputLine = {
      request: { contents: [{ parts: [{ fileData: { fileUri: job.source_image_url } }] }] },
      response: { candidates: [{ content: { parts: [{ inlineData: { data: 'AQ==', mimeType: 'image/png' } }] } }] },
    };
    mocks.from.mockImplementation((table: string) => {
      if (table === 'cakegenie_studio_edit_batch_runs') {
        return query({
          id: 'run-1',
          provider_job_name: 'providers/active',
          output_file_uri: 'gs://test-bucket/delayed/run-1/output',
          status: 'submitted',
          total_jobs: 1,
          imported_jobs: 0,
        });
      }
      if (table === 'cakegenie_studio_edit_jobs') return query([job]);
      if (table === 'cakegenie_analysis_cache') return query([{ id: 'cache-1', slug: 'purple-cake' }]);
      return query([]);
    });
    mocks.batchesGet.mockResolvedValue({ state: 'JOB_STATE_SUCCEEDED' });
    mocks.getFiles.mockResolvedValue([[{
      name: 'output/predictions.jsonl',
      createReadStream: () => Readable.from([`${JSON.stringify(outputLine)}\n`]),
    }], {}]);

    await expect(runDelayedImageStudioWorker()).resolves.toMatchObject({
      status: 'completed',
      completed: 1,
      imported: 1,
    });
    expect(mocks.uploadGeneratedStudioImage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      pHash: job.p_hash,
    }));
    expect(mocks.rpc).toHaveBeenCalledWith('complete_studio_edit_job', expect.objectContaining({
      p_job_id: job.id,
      p_source_revision: job.source_revision,
    }));
    expect(mocks.rpc).toHaveBeenCalledWith('finish_studio_edit_batch', expect.objectContaining({ p_run_id: 'run-1' }));
  });
});
