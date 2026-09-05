import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(), rpc: vi.fn(), providerGet: vi.fn(), providerCreate: vi.fn(),
  update: vi.fn(), jobs: vi.fn(), cacheRows: vi.fn(),
}));
vi.mock('@google-cloud/storage', () => ({ Storage: class {} }));
vi.mock('@/lib/ai/client', () => ({ getGoogleCloudAuthOptions: () => ({}), getAI: () => ({ batches: { get: mocks.providerGet, create: mocks.providerCreate } }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/indexNow', () => ({ submitIndexNow: vi.fn() }));
vi.mock('@/lib/supabase/adminServer', () => ({ createAdminServerSupabaseClient: () => ({
  rpc: mocks.rpc,
  from: (table: string) => table === 'cakegenie_seo_batch_jobs'
    ? (() => {
      const query = {
        eq: () => query,
        is: () => ({ limit: mocks.jobs }),
        in: () => ({ limit: () => ({ maybeSingle: mocks.maybeSingle }) }),
        limit: () => ({ maybeSingle: mocks.maybeSingle }),
      };
      return { select: () => query, update: mocks.update };
    })()
    : table === 'cakegenie_analysis_cache'
      ? { select: () => ({ eq: () => ({ in: mocks.cacheRows }) }) }
      : { select: () => ({ in: () => ({ limit: () => ({ maybeSingle: mocks.maybeSingle }) }) }), update: mocks.update },
}) }));
vi.mock('./seoPublication', () => ({ buildSeoPublicationMetadata: vi.fn(), buildSeoBatchInput: vi.fn() }));
vi.mock('@/services/prompts/promptLoader', () => ({ getSeoPromptDetails: async () => ({ promptText: 'SEO', version: 'seo-v1.0' }) }));
import { runSeoBatchWorker } from './seoBatch';

describe('SEO worker spending and recovery guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SEO_BATCH_SUBMISSIONS_ENABLED', 'false');
    mocks.jobs.mockResolvedValue({ data: [], error: null });
    mocks.cacheRows.mockResolvedValue({ data: [], error: null });
  });
  it('does not submit until explicitly enabled', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await runSeoBatchWorker()).toEqual({ status: 'submissions_disabled', notified: 0 });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.providerCreate).not.toHaveBeenCalled();
  });
  it('holds ambiguous submissions instead of incurring duplicate batch charges', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'run', status: 'collecting' }, error: null });
    expect(await runSeoBatchWorker()).toEqual({ status: 'collecting', runId: 'run', needsReview: true, notified: 0 });
    expect(mocks.providerCreate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('preserves submitted work on a transient provider polling failure', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'run', status: 'submitted', gemini_job_name: 'provider-job' }, error: null });
    mocks.providerGet.mockRejectedValue(new Error('503 temporarily unavailable'));
    await expect(runSeoBatchWorker()).rejects.toThrow('503');
    expect(mocks.providerCreate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
