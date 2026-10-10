import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTerminalOpenAIAdsUploadStatus } from './feedSync';

describe('syncOpenAIAdsCatalog', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does not access the catalog or SFTP until explicitly enabled', async () => {
    vi.stubEnv('OPENAI_ADS_CATALOG_SYNC_ENABLED', 'false');
    vi.resetModules();
    const { syncOpenAIAdsCatalog } = await import('./feedSync');

    await expect(syncOpenAIAdsCatalog()).resolves.toEqual({ status: 'disabled' });
  });

  it.each(['scanning', 'received', 'processing'])('keeps %s uploads in the pending state', (status) => {
    expect(isTerminalOpenAIAdsUploadStatus(status)).toBe(false);
  });

  it.each(['completed', 'completed_with_errors', 'skipped', 'failed'])('recognizes %s as terminal', (status) => {
    expect(isTerminalOpenAIAdsUploadStatus(status)).toBe(true);
  });
});
