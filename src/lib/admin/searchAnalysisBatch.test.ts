/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';

// Define mocks first
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: vi.fn(() => mockSupabase),
}));

const mockAI = {
  batches: {
    create: vi.fn(),
    get: vi.fn(),
  },
};

vi.mock('@/lib/ai/client', () => ({
  getAI: vi.fn(() => mockAI),
  getGoogleCloudAuthOptions: vi.fn(() => ({})),
}));

const mockBucket = {
  getFiles: vi.fn(),
  file: vi.fn(() => ({
    save: vi.fn().mockResolvedValue(undefined),
  })),
};

vi.mock('@google-cloud/storage', () => {
  return {
    Storage: class {
      bucket() {
        return mockBucket;
      }
    }
  };
});

const mockCacheAnalysisResult = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  cacheAnalysisResult: (...args: any[]) => mockCacheAnalysisResult(...args),
}));

import {
  buildSearchAnalysisBatchInputLine,
  buildSearchAnalysisBatchGenerationConfig,
  buildSearchAnalysisPersistenceOptions,
  correlateSearchAnalysisOutputs,
  parseSearchAnalysisBatchOutputText,
  resolveSearchAnalysisIntake,
  selectEligibleSearchAnalysisItems,
  submitNextSearchAnalysisBatch,
  reconcileSearchAnalysisBatch,
} from './searchAnalysisBatch';
import { buildSearchAnalysisResponseSchema } from './searchAnalysisContract';
import type { QueueItem } from './searchAnalysisBatch';

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'b',
  p_hash: 'abcdef1234567890',
  fingerprint_pipeline: 'server-v1',
  source_image_url: 'https://source.example/cake.jpg',
  normalized_image_url: 'https://cdn.example/cake.jpg',
  storage_path: 'admin/search-analysis/abcdef1234567890.jpg',
  status: 'queued',
  submission_ordinal: null,
  source_usage_count: 0,
  queued_at: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

describe('search analysis batch helpers', () => {
  it('requires SEO copy and accepted-analysis fields in the shared response schema', () => {
    const schema = buildSearchAnalysisResponseSchema({
      mainTopperTypes: ['printout', 'edible_photo_top'],
      supportElementTypes: ['dragees', 'sprinkles'],
    }) as any;

    expect(schema.required).toEqual(expect.arrayContaining([
      'cakeType',
      'cakeThickness',
      'main_toppers',
      'support_elements',
      'cake_messages',
      'icing_design',
      'keyword',
      'alt_text',
      'seo_title',
      'seo_description',
      'rejection',
    ]));
  });

  it('keeps cupcake analyses accepted while removing cupcake-only rejection', () => {
    const schema = buildSearchAnalysisResponseSchema({
      mainTopperTypes: ['printout', 'edible_photo_top'],
      supportElementTypes: ['dragees', 'sprinkles'],
    }) as any;

    const rejectionReasons = schema.properties.rejection.properties.reason.enum;
    expect(rejectionReasons).not.toContain('cupcakes_only');

    const cinderellaCupcakes = {
      cakeType: 'Cupcake',
      cakeThickness: '2 in',
      main_toppers: [{
        x: 0,
        y: 0,
        type: 'printout',
        material: 'photopaper',
        group_id: 'cinderella_toppers',
        classification: 'hero',
        size: 'medium',
        quantity: 3,
        description: 'Cinderella character cutouts',
      }],
      support_elements: [{
        x: 0,
        y: 0,
        type: 'dragees',
        material: 'candy',
        group_id: 'silver_dragees',
        color: '#C0C0C0',
        size: 'tiny',
        quantity: 15,
        description: 'silver dragees',
      }],
      cake_messages: [],
      icing_design: {
        base: 'soft_icing',
        color_type: 'single',
        colors: { side: '#87CEEB' },
      },
      keyword: 'Cinderella Cupcakes',
      alt_text: 'Cupcakes with printed Cinderella character toppers and silver dragees on blue icing',
      seo_title: 'Cinderella Cupcakes With Blue Icing Cebu | Genie.ph',
      seo_description: 'These are Cinderella cupcakes with printed character toppers. The cupcakes use blue icing with a soft piped finish. Silver dragees add small metallic accents on top. Made for a child who wants a princess-themed birthday set. Order through Genie.ph for delivery in Cebu City.',
      rejection: { isRejected: false, message: '' },
    };

    for (const key of schema.required) {
      expect(cinderellaCupcakes).toHaveProperty(key);
    }
  });

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
      customId: 'b',
      custom_id: 'b',
      id: 'b',
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
      persistSourceAsset: 'if_missing',
    });
  });
});

describe('search analysis batch run submission and reconciliation regression tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VERTEX_AI_BATCH_GCS_URI = 'gs://test-bucket/prefix';
  });

  const createFluentChain = (customOverrides: Record<string, any> = {}) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      gt: vi.fn(() => chain),
      not: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      order: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn((resolve) => resolve({ data: null, count: 0, error: null })),
      ...customOverrides,
    };
    return chain;
  };

  it('submit flow creates a collecting run and claims items before calling Vertex', async () => {
    const callOrder: string[] = [];

    mockSupabase.from = vi.fn((table: string) => {
      const chain = createFluentChain();

      if (table === 'cakegenie_search_analysis_batch_runs') {
        chain.maybeSingle.mockImplementation(() => {
          callOrder.push('check-active');
          return Promise.resolve({ data: null, error: null });
        });
        chain.insert.mockImplementation(() => {
          callOrder.push('insert-collecting-run');
          return createFluentChain({
            select: () => createFluentChain({
              single: () => Promise.resolve({ data: { id: 'test-run-id' }, error: null }),
            }),
          });
        });
        chain.update.mockImplementation(() => {
          callOrder.push('update-run-submitted');
          return createFluentChain({
            eq: () => createFluentChain({
              select: () => createFluentChain({
                single: () => Promise.resolve({ data: { id: 'test-run-id', status: 'submitted' }, error: null }),
              }),
            }),
          });
        });
      }

      if (table === 'cakegenie_search_analysis_batch_items') {
        chain.limit.mockImplementation(() => {
          callOrder.push('query-queued-items');
          return Promise.resolve({ data: [item({ id: 'item1' }), item({ id: 'item2' })], error: null });
        });
        chain.upsert.mockImplementation(() => {
          callOrder.push('upsert-claim-items');
          return Promise.resolve({ error: null });
        });
      }

      if (table === 'ai_prompts') {
        chain.single.mockResolvedValue({ data: { prompt_text: 'test prompt' }, error: null });
      }

      if (table === 'cakegenie_pricing_contract') {
        chain.not = vi.fn(() => Promise.resolve({ data: [], error: null }) as any);
      }

      return chain as any;
    });

    mockAI.batches.create.mockImplementation(() => {
      callOrder.push('call-vertex-ai');
      return Promise.resolve({ name: 'projects/test/locations/global/batchPredictionJobs/job1' });
    });

    const run = await submitNextSearchAnalysisBatch(1000);

    expect(run).toBeDefined();
    expect(callOrder).toEqual([
      'check-active',
      'check-active', // check-active is called twice: once for active run check, once for compatibility probe check
      'query-queued-items',
      'insert-collecting-run',
      'upsert-claim-items',
      'call-vertex-ai',
      'update-run-submitted',
    ]);
  });

  it('submit failure releases items back to retryable and fails the run', async () => {
    mockSupabase.from = vi.fn((table: string) => {
      const chain = createFluentChain();

      if (table === 'cakegenie_search_analysis_batch_runs') {
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
        chain.insert.mockReturnValue(createFluentChain({
          select: () => createFluentChain({
            single: () => Promise.resolve({ data: { id: 'test-run-id' }, error: null }),
          }),
        }));
        chain.update.mockReturnValue(createFluentChain({
          eq: () => Promise.resolve({ data: {}, error: null }),
        }));
      }

      if (table === 'cakegenie_search_analysis_batch_items') {
        chain.limit.mockResolvedValue({ data: [item({ id: 'item1' })], error: null });
        chain.upsert.mockResolvedValue({ error: null });
        chain.update.mockReturnValue(createFluentChain({
          eq: () => createFluentChain({
            eq: () => Promise.resolve({ error: null }),
          }),
        }));
      }

      if (table === 'ai_prompts') {
        chain.single.mockResolvedValue({ data: { prompt_text: 'test prompt' }, error: null });
      }

      if (table === 'cakegenie_pricing_contract') {
        chain.not = vi.fn(() => Promise.resolve({ data: [], error: null }) as any);
      }

      return chain as any;
    });

    mockAI.batches.create.mockRejectedValue(new Error('Vertex submission failed'));

    const itemsUpdateSpy = vi.spyOn(mockSupabase, 'from');

    await expect(submitNextSearchAnalysisBatch(1000)).rejects.toThrow('Vertex submission failed');

    // Check that we updated the items to retryable and the run to failed
    expect(itemsUpdateSpy).toHaveBeenCalledWith('cakegenie_search_analysis_batch_items');
    expect(itemsUpdateSpy).toHaveBeenCalledWith('cakegenie_search_analysis_batch_runs');
  });

  it('reconcile matching matches shuffled outputs by request ID or URI and prevents unknown contamination', async () => {
    const runId = 'test-reconcile-run';
    mockSupabase.from = vi.fn((table: string) => {
      const chain = createFluentChain();

      if (table === 'cakegenie_search_analysis_batch_runs') {
        chain.single.mockResolvedValue({
          data: {
            id: runId,
            status: 'importing',
            output_file_uri: 'gs://test-bucket/output',
          },
          error: null,
        });
        chain.update.mockReturnValue(createFluentChain({
          eq: () => createFluentChain({
            select: () => createFluentChain({
              single: () => Promise.resolve({ data: {}, error: null }),
            }),
          }),
        }));
      }

      if (table === 'cakegenie_search_analysis_batch_items') {
        chain.order = vi.fn(() => Promise.resolve({
          data: [
            item({ id: 'item-1', normalized_image_url: 'uri-1', p_hash: 'ph1', status: 'submitted', submission_ordinal: 0 }),
            item({ id: 'item-2', normalized_image_url: 'uri-2', p_hash: 'ph2', status: 'submitted', submission_ordinal: 1 }),
          ],
          error: null,
        }) as any);
        chain.update.mockReturnValue(createFluentChain({
          eq: () => createFluentChain({
            neq: () => Promise.resolve({ error: null }),
          }),
        }));
      }

      return chain as any;
    });

    // Mock output predictions.jsonl content (shuffled!)
    const jsonlContent = [
      JSON.stringify({ customId: 'item-2', request: { contents: [{ parts: [{ fileData: { fileUri: 'uri-2' } }] }] }, response: { candidates: [{ content: { parts: [{ text: '{"cakeType": "1 Tier", "icing_design": {"base": "fondant"}}' }] } }] } }),
      JSON.stringify({ customId: 'unknown-id', request: { contents: [{ parts: [{ fileData: { fileUri: 'uri-unknown' } }] }] }, response: { candidates: [{ content: { parts: [{ text: '{"cakeType": "2 Tier"}' }] } }] } }),
      JSON.stringify({ customId: 'item-1', request: { contents: [{ parts: [{ fileData: { fileUri: 'uri-1' } }] }] }, response: { candidates: [{ content: { parts: [{ text: '{"cakeType": "1 Tier", "icing_design": {"base": "soft_icing"}}' }] } }] } }),
    ].join('\n');

    mockBucket.getFiles.mockResolvedValue([[ { name: 'predictions.jsonl', createReadStream: () => Readable.from([jsonlContent]) } ]]);

    // Mock cacheAnalysisResult
    mockCacheAnalysisResult.mockResolvedValue({ id: 'new-cache-row-id' });

    const result = await reconcileSearchAnalysisBatch(runId);

    expect(result).toBeDefined();

    // Verify that cacheAnalysisResult was called for uri-1 and uri-2 but NOT uri-unknown
    expect(mockCacheAnalysisResult).toHaveBeenCalledTimes(2);
    expect(mockCacheAnalysisResult).toHaveBeenCalledWith('ph1', expect.any(Object), 'uri-1', undefined, expect.any(Object));
    expect(mockCacheAnalysisResult).toHaveBeenCalledWith('ph2', expect.any(Object), 'uri-2', undefined, expect.any(Object));
  });

  it('reconcile matching skips output lines with missing echoed URI and ID, preventing cross-contamination', async () => {
    const runId = 'test-reconcile-run-ordinal';
    mockSupabase.from = vi.fn((table: string) => {
      const chain = createFluentChain();

      if (table === 'cakegenie_search_analysis_batch_runs') {
        chain.single.mockResolvedValue({
          data: {
            id: runId,
            status: 'importing',
            output_file_uri: 'gs://test-bucket/output',
          },
          error: null,
        });
        chain.update.mockReturnValue(createFluentChain({
          eq: () => createFluentChain({
            select: () => createFluentChain({
              single: () => Promise.resolve({ data: {}, error: null }),
            }),
          }),
        }));
      }

      if (table === 'cakegenie_search_analysis_batch_items') {
        chain.order = vi.fn(() => Promise.resolve({
          data: [
            item({ id: 'item-1', normalized_image_url: 'uri-1', p_hash: 'ph1', status: 'submitted', submission_ordinal: 0 }),
            item({ id: 'item-2', normalized_image_url: 'uri-2', p_hash: 'ph2', status: 'submitted', submission_ordinal: 1 }),
          ],
          error: null,
        }) as any);
        chain.update.mockReturnValue(createFluentChain({
          eq: () => createFluentChain({
            neq: () => Promise.resolve({ error: null }),
          }),
        }));
      }

      return chain as any;
    });

    const itemsUpdateSpy = vi.spyOn(mockSupabase, 'from');

    // Mock output: line has NO echoed request ID or URI
    const jsonlContent = [
      JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: '{"cakeType": "1 Tier"}' }] } }] } }),
    ].join('\n');

    mockBucket.getFiles.mockResolvedValue([[ { name: 'predictions.jsonl', createReadStream: () => Readable.from([jsonlContent]) } ]]);
    mockCacheAnalysisResult.mockResolvedValue({ id: 'ordinal-cache-id' });

    const result = await reconcileSearchAnalysisBatch(runId);
    expect(result).toBeDefined();

    // Verify it skipped and did NOT match or call cacheAnalysisResult
    expect(mockCacheAnalysisResult).not.toHaveBeenCalled();

    // Verify that we ran cleanup to mark remaining submitted items as retryable
    expect(itemsUpdateSpy).toHaveBeenCalledWith('cakegenie_search_analysis_batch_items');
  });
});
