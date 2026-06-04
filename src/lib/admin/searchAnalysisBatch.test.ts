import { describe, expect, it } from 'vitest';

import {
  buildSearchAnalysisBatchInputLine,
  buildSearchAnalysisBatchGenerationConfig,
  buildSearchAnalysisPersistenceOptions,
  correlateSearchAnalysisOutputs,
  parseSearchAnalysisBatchOutputText,
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
      systemInstruction: 'be exact',
      responseMimeType: 'application/json',
      temperature: 0,
    }));
    expect(line).toEqual({
      request: {
        contents: [{ role: 'user', parts: [{ fileData: { fileUri: 'https://cdn.example/cake.jpg', mimeType: 'image/jpeg' } }, { text: 'analyze exactly' }] }],
        systemInstruction: { parts: [{ text: 'be exact' }] },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      },
    });
  });

  it('keeps batch model parameters inside generationConfig', () => {
    expect(buildSearchAnalysisBatchGenerationConfig({
      systemInstruction: 'not here',
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT' },
      temperature: 0,
      thinkingConfig: { thinkingLevel: 'LOW' },
    })).toEqual({
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT' },
      temperature: 0,
      thinkingConfig: { thinkingLevel: 'LOW' },
    });
  });

  it('correlates output lines by echoed request file URI even when Vertex shuffles output order', () => {
    const correlated = correlateSearchAnalysisOutputs([
      item({ id: 'second', normalized_image_url: 'https://cdn.example/second.jpg', submission_ordinal: 1 }),
      item({ id: 'first', normalized_image_url: 'https://cdn.example/first.jpg', submission_ordinal: 0 }),
    ] as QueueItem[], [
      { request: { contents: [{ parts: [{ fileData: { fileUri: 'https://cdn.example/second.jpg' } }] }] }, response: {} },
      { request: { contents: [{ parts: [{ fileData: { fileUri: 'https://cdn.example/first.jpg' } }] }] }, error: { message: 'bad' } },
    ]);
    expect(correlated.map(({ item: row, output }) => [row.id, output])).toEqual([
      ['second', { request: { contents: [{ parts: [{ fileData: { fileUri: 'https://cdn.example/second.jpg' } }] }] }, response: {} }],
      ['first', { request: { contents: [{ parts: [{ fileData: { fileUri: 'https://cdn.example/first.jpg' } }] }] }, error: { message: 'bad' } }],
    ]);
  });

  it('parses strict JSON batch output', () => {
    expect(parseSearchAnalysisBatchOutputText('{"rejection":{"isRejected":true}}')).toEqual({
      rejection: { isRejected: true },
    });
  });

  it('recovers final JSON when the image-preview batch model prefixes Markdown reasoning', () => {
    expect(parseSearchAnalysisBatchOutputText(`**Processing image**

The image has one cake.

{
  "rejection": {
    "isRejected": false,
    "message": "Accepted"
  },
  "cakeThickness": "5 in"
}`)).toMatchObject({
      rejection: { isRejected: false, message: 'Accepted' },
      cakeThickness: '5 in',
    });
  });

  it('rejects batch output without a valid JSON object', () => {
    expect(() => parseSearchAnalysisBatchOutputText('**Processing image** no object')).toThrow('Search-analysis batch output did not contain valid JSON.');
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
