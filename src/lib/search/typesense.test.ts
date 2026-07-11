import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  mapCacheRowToTypesenseDocument,
  searchTypesense,
} from './typesense';

describe('Typesense shadow search helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('maps a cache row into an explicit, searchable document', () => {
    const document = mapCacheRowToTypesenseDocument({
      p_hash: 'abc123',
      slug: 'bluey-sky-blue-cake-abc1',
      keywords: 'Bluey, Cartoon',
      alt_text: 'Bluey birthday cake',
      original_image_url: 'https://example.com/original.jpg',
      studio_edited_image_url: 'https://example.com/edited.jpg',
      price: '1499.00',
      usage_count: 12,
      availability: 'available',
      icing_colors: ['sky blue', 'white'],
      tags: ['kids', 'birthday'],
      analysis_json: { cakeType: 'fondant', tags: ['cartoon'] },
      created_at: '2026-07-11T00:00:00.000Z',
    });

    expect(document).toMatchObject({
      id: 'abc123',
      slug: 'bluey-sky-blue-cake-abc1',
      title: 'Bluey, Cartoon',
      keywords: 'Bluey, Cartoon',
      cake_type: 'fondant',
      colors: ['sky blue', 'white'],
      tags: ['kids', 'birthday', 'cartoon'],
      price: 1499,
      usage_count: 12,
      original_image_url: 'https://example.com/original.jpg',
    });
    expect(document?.aliases).toEqual(expect.arrayContaining(['Bluey', 'Cartoon', 'kids', 'birthday', 'cartoon']));
  });

  it('does not index rows that cannot produce a public product result', () => {
    expect(mapCacheRowToTypesenseDocument({
      p_hash: 'missing-slug',
      slug: null,
      keywords: 'Bluey',
      alt_text: null,
      original_image_url: 'https://example.com/original.jpg',
      price: 100,
    })).toBeNull();

    expect(mapCacheRowToTypesenseDocument({
      p_hash: 'missing-image',
      slug: 'bluey-cake-abc1',
      keywords: 'Bluey',
      alt_text: null,
      original_image_url: null,
      price: 100,
    })).toBeNull();
  });

  it('builds a typo-tolerant Typesense request with the same filter inputs', async () => {
    vi.stubEnv('TYPESENSE_URL', 'http://typesense.test:8108');
    vi.stubEnv('TYPESENSE_API_KEY', 'search-key');

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ found: 1, hits: [], search_time_ms: 1 }), { status: 200 }),
    );

    await searchTypesense('unicron', {
      limit: 30,
      offset: 60,
      maxPrice: 1500,
      icingColor: 'sky blue',
    });

    const [url, init] = fetchMock.mock.calls[0];
    const params = new URL(String(url)).searchParams;

    expect(params.get('q')).toBe('unicron');
    expect(params.get('query_by')).toContain('title,keywords,aliases');
    expect(params.get('num_typos')).toBe('1');
    expect(params.get('prioritize_exact_match')).toBe('true');
    expect(params.get('filter_by')).toBe('price:<=1500 && colors:=sky blue');
    expect(params.get('offset')).toBe('60');
    expect(init?.headers).toMatchObject({ 'X-TYPESENSE-API-KEY': 'search-key' });
  });
});
