import { describe, expect, it } from 'vitest';
import { buildSeoBatchInputLine, getSeoOutputItemId, parseSeoBatchOutput, seoRetryStatus } from './seoBatchContract';

describe('SEO batch contract', () => {
  it('sends text-only structured input with a correlation key', () => {
    const line = JSON.parse(buildSeoBatchInputLine({ id: 'job', cache_id: 'cache', analysis_revision: 'rev', analysis_json: { cakeType: 'Round' }, attempt_count: 1, status: 'submitted' }, 'SEO rules'));
    expect(line.request.contents[0].parts).toHaveLength(1);
    expect(line.request.contents[0].parts[0].fileData).toBeUndefined();
    expect(getSeoOutputItemId({ request: line.request })).toBe('job');
    expect(line.request.generationConfig.responseSchema.required).toEqual(['seo_description', 'alt_text']);
  });
  it('does not correlate output by order or arbitrary prose', () => {
    expect(getSeoOutputItemId({ request: { contents: [{ parts: [{ text: 'job' }] }] } })).toBeUndefined();
  });
  it('rejects empty metadata and provider errors', () => {
    expect(() => parseSeoBatchOutput({ error: { message: 'blocked' } })).toThrow('blocked');
    expect(() => parseSeoBatchOutput({ response: { candidates: [{ content: { parts: [{ text: '{"seo_description":"","alt_text":"Cake"}' }] } }] } })).toThrow('seo_description');
  });
  it('accepts valid metadata and stops retries after three attempts', () => {
    expect(parseSeoBatchOutput({ response: { candidates: [{ content: { parts: [{ text: '{"seo_description":" Cake description ","alt_text":"Round cake"}' }] } }] } })).toEqual({ seo_description: 'Cake description', alt_text: 'Round cake' });
    expect(seoRetryStatus(2)).toBe('retryable');
    expect(seoRetryStatus(3)).toBe('failed');
  });
});
