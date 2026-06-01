import { describe, expect, it } from 'vitest';

import {
  buildSearchAnalysisBatchInputLine,
  buildSearchAnalysisPersistenceOptions,
  correlateSearchAnalysisOutputs,
  resolveSearchAnalysisIntake,
  selectEligibleSearchAnalysisItems,
} from './searchAnalysisBatch';
import type { QueueItem } from './searchAnalysisBatch';

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'b',
  p_hash: 'abcdef1234567890',
  fingerprint_pipeline: 'server-v1',
  source_image_url: 'https://source.example/cake.jpg',
  normalized_image_url: 'https://cdn.example/cake.jpg',
  status: 'queued',
  submission_ordinal: null,
  source_usage_count: 0,
  queued_at: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

describe('search analysis batch helpers', () => {
  it('filters ineligible items and orders usage, queue time, then id predictably', () => {
    const selected = selectEligibleSearchAnalysisItems([
      item({ id: 'z', status: 'completed', source_usage_count: 99 }),
      item({ id: 'c', source_usage_count: 1 }),
      item({ id: 'b', source_usage_count: 2, queued_at: '2026-06-01T01:00:00.000Z' }),
      item({ id: 'a', source_usage_count: 2, queued_at: '2026-06-01T01:00:00.000Z', status: 'retryable' }),
    ] as QueueItem[]);
    expect(selected.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('constructs a Vertex JSONL request with the normalized public image', () => {
    const line = JSON.parse(buildSearchAnalysisBatchInputLine(item() as QueueItem, 'analyze exactly', {
      responseMimeType: 'application/json',
      temperature: 0,
    }));
    expect(line).toEqual({
      request: {
        contents: [{ role: 'user', parts: [{ fileData: { fileUri: 'https://cdn.example/cake.jpg', mimeType: 'image/jpeg' } }, { text: 'analyze exactly' }] }],
        responseMimeType: 'application/json',
        temperature: 0,
      },
    });
  });

  it('correlates output lines using the durable submission ordinal', () => {
    const correlated = correlateSearchAnalysisOutputs([
      item({ id: 'second', submission_ordinal: 1 }),
      item({ id: 'first', submission_ordinal: 0 }),
    ] as QueueItem[], [{ response: {} }, { error: { message: 'bad' } }]);
    expect(correlated.map(({ item: row, output }) => [row.id, output])).toEqual([
      ['first', { response: {} }],
      ['second', { error: { message: 'bad' } }],
    ]);
  });

  it('prevents duplicate queue work for cache hits and existing queue items', () => {
    expect(resolveSearchAnalysisIntake('cache-id')).toEqual({ action: 'cache_hit', cacheId: 'cache-id' });
    expect(resolveSearchAnalysisIntake(null, item() as QueueItem)).toEqual({ action: 'reuse_queue_item', item: item() });
  });

  it('persists imported analysis without overwriting the queued source asset or launching studio work', () => {
    const admin = { from: () => null };
    expect(buildSearchAnalysisPersistenceOptions(item() as QueueItem, admin as never)).toMatchObject({
      client: admin,
      triggerStudioEdit: false,
      fingerprintPipeline: 'server-v1',
      persistSourceAsset: false,
    });
  });
});
