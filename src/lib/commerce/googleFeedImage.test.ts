import { describe, expect, it } from 'vitest';

import { resolveGoogleFeedImage } from './googleFeedImage';

describe('resolveGoogleFeedImage', () => {
  it('prefers the studio-edited image', () => {
    expect(resolveGoogleFeedImage({
      studio_edited_image_url: 'https://example.com/studio.webp',
      original_image_url: 'https://example.com/original.webp',
    })).toBe('https://example.com/studio.webp');
  });

  it('falls back to the original image when the studio URL is blank', () => {
    expect(resolveGoogleFeedImage({
      studio_edited_image_url: '   ',
      original_image_url: 'https://example.com/original.webp',
    })).toBe('https://example.com/original.webp');
  });

  it('falls back to the original image when the studio URL is null', () => {
    expect(resolveGoogleFeedImage({
      studio_edited_image_url: null,
      original_image_url: 'https://example.com/original.webp',
    })).toBe('https://example.com/original.webp');
  });

  it('falls back when the studio URL is unusable', () => {
    expect(resolveGoogleFeedImage({
      studio_edited_image_url: 'data:image/webp;base64,abc',
      original_image_url: 'https://example.com/original.webp',
    })).toBe('https://example.com/original.webp');
  });

  it('removes query parameters from Supabase image URLs', () => {
    expect(resolveGoogleFeedImage({
      studio_edited_image_url: 'https://project.supabase.co/storage/v1/object/public/images/studio.webp?token=secret',
      original_image_url: null,
    })).toBe('https://project.supabase.co/storage/v1/object/public/images/studio.webp');
  });

  it('returns an empty string when neither image is usable', () => {
    expect(resolveGoogleFeedImage({
      studio_edited_image_url: 'not a URL',
      original_image_url: 'data:image/webp;base64,abc',
    })).toBe('');
  });
});
