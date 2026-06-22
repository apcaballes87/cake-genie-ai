import { describe, expect, it } from 'vitest';
import { FINGERPRINT_PIPELINE } from '../src/lib/server/imageFingerprint';
import { getBackfillRowFilter, getBackfillStatusFilter } from './backfill-server-phashes';

describe('backfill-server-phashes', () => {
  it('selects null, missing, and non-current fingerprint pipelines by default', () => {
    expect(getBackfillRowFilter()).toBe([
      'fingerprint_pipeline.is.null',
      `fingerprint_pipeline.neq.${FINGERPRINT_PIPELINE}`,
      'fingerprint_status.eq.missing',
    ].join(','));
  });

  it('can explicitly retry failed rows', () => {
    expect(getBackfillRowFilter(FINGERPRINT_PIPELINE, { retryFailed: true })).toBe([
      'fingerprint_pipeline.is.null',
      `fingerprint_pipeline.neq.${FINGERPRINT_PIPELINE}`,
      'fingerprint_status.eq.missing',
      'fingerprint_status.eq.failed',
    ].join(','));
  });

  it('rejects pipeline values that cannot be embedded in a PostgREST OR filter', () => {
    expect(() => getBackfillRowFilter('v2,bad')).toThrow(/commas/i);
  });

  it('keeps aliased duplicate and known failed rows out of default repeat backfill batches', () => {
    expect(getBackfillStatusFilter()).toBe('fingerprint_status.is.null,fingerprint_status.not.in.(aliased,failed)');
  });

  it('keeps aliased duplicate rows out of explicit failed retries', () => {
    expect(getBackfillStatusFilter({ retryFailed: true })).toBe('fingerprint_status.is.null,fingerprint_status.neq.aliased');
  });
});
