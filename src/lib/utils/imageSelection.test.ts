import { describe, expect, it } from 'vitest';
import { firstNonBlankImageUrl, getPreferredProductImageUrl } from './imageSelection';

describe('imageSelection', () => {
  it('prefers the first non-blank image url', () => {
    expect(firstNonBlankImageUrl('   ', null, 'https://example.com/studio.webp')).toBe('https://example.com/studio.webp');
  });

  it('prefers studio edited images over originals', () => {
    expect(getPreferredProductImageUrl(' https://example.com/studio.webp ', 'https://example.com/original.webp')).toBe('https://example.com/studio.webp');
  });

  it('falls back to the original image when studio edited is blank', () => {
    expect(getPreferredProductImageUrl(' ', 'https://example.com/original.webp')).toBe('https://example.com/original.webp');
  });
});
