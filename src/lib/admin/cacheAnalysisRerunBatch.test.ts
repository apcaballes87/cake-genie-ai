import { describe, expect, it } from 'vitest';

import {
  buildAnalysisJsonOnlyUpdate,
  buildCacheAnalysisRerunInputLine,
  CACHE_ANALYSIS_RERUN_MODEL,
  selectCacheAnalysisRerunItems,
} from './cacheAnalysisRerunBatch';

describe('cache analysis rerun batch helpers', () => {
  it('prefers a non-blank Studio image and falls back to the original image', () => {
    const selected = selectCacheAnalysisRerunItems([
      {
        id: 'b',
        p_hash: 'bbbbbbbbbbbbbbbb',
        original_image_url: 'https://cdn.example/original-b.webp',
        studio_edited_image_url: ' https://cdn.example/studio-b.webp ',
      },
      {
        id: 'a',
        p_hash: 'aaaaaaaaaaaaaaaa',
        original_image_url: 'https://cdn.example/original-a.webp',
        studio_edited_image_url: ' ',
      },
      {
        id: 'c',
        p_hash: 'cccccccccccccccc',
        original_image_url: null,
        studio_edited_image_url: null,
      },
    ]);

    expect(selected).toEqual([
      expect.objectContaining({
        id: 'a',
        source_kind: 'original',
        source_image_url: 'https://cdn.example/original-a.webp',
      }),
      expect.objectContaining({
        id: 'b',
        source_kind: 'studio_edited',
        source_image_url: 'https://cdn.example/studio-b.webp',
      }),
    ]);
  });

  it('builds a batch request from the selected source and analysis-only schema marker', () => {
    const [item] = selectCacheAnalysisRerunItems([{
      id: 'cache-row',
      p_hash: 'abcdef1234567890',
      original_image_url: 'https://cdn.example/original.webp',
      studio_edited_image_url: 'https://cdn.example/studio.webp',
    }]);
    const line = JSON.parse(buildCacheAnalysisRerunInputLine(
      item,
      'active prompt',
      { systemInstruction: 'system', responseMimeType: 'application/json' },
      'integrated_bbox_v2',
    ));

    expect(line.customId).toBe('cache-row|size_schema:integrated_bbox_v2|seo_schema:analysis_only');
    expect(line.request.contents[0].parts[0].fileData.fileUri).toBe('https://cdn.example/studio.webp');
  });

  it('keeps persistence scoped to analysis_json and uses the selected model', () => {
    expect(buildAnalysisJsonOnlyUpdate({ cakeType: '1 Tier' })).toEqual({
      analysis_json: { cakeType: '1 Tier' },
    });
    expect(CACHE_ANALYSIS_RERUN_MODEL).toBe('gemini-3.1-flash-lite');
  });
});
