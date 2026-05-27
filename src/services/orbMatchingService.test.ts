import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findOrbCacheHit } from './orbMatchingService';

describe('findOrbCacheHit', () => {
  const file = new File(['cake-bytes'], 'cake.png', { type: 'image/png' });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts slow ORB requests after 2000ms', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          const abortError = new Error('Request aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = findOrbCacheHit(file, {
      endpoint: 'https://orb.example/api/match',
    });
    const timeoutExpectation = expect(resultPromise).rejects.toThrow(
      'ORB match timed out after 2000ms'
    );

    await vi.advanceTimersByTimeAsync(2000);

    await timeoutExpectation;
    expect(fetchMock).toHaveBeenCalledWith(
      'https://orb.example/api/match?mode=default&visualize=false',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('returns a normalized cache hit when the ORB backend matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          match: true,
          confidence: 0.91,
          matched_image_id: 'cache-row-1',
          matched_image_url: 'https://example.com/cake.webp',
          analysis_json: {
            cakeType: 'bento',
          },
          execution_time_ms: 127,
          cache_p_hash: 'abc123ff00ee9988',
          cache_metadata: {
            slug: 'purple-bento-cake',
            original_image_url: 'https://example.com/original.webp',
            price: 899,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await findOrbCacheHit(file, {
      endpoint: 'https://orb.example/api/match',
      timeoutMs: 25,
    });

    expect(result).toEqual({
      analysisResult: {
        cakeType: 'bento',
      },
      confidence: 0.91,
      executionTimeMs: 127,
      matchedImageId: 'cache-row-1',
      matchedImageUrl: 'https://example.com/cake.webp',
      pHash: 'abc123ff00ee9988',
      seoMetadata: {
        seo_title: null,
        seo_description: null,
        keywords: null,
        alt_text: null,
        slug: 'purple-bento-cake',
        original_image_url: 'https://example.com/original.webp',
        price: 899,
        availability: null,
      },
    });
  });
});
