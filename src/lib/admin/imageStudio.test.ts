import { describe, expect, it } from 'vitest';

import {
  buildImageStudioPrompt,
  buildImageStudioWatermarkSvg,
  getImageStudioOutputDimensions,
  getImageStudioStoragePath,
  isImageStudioSmallImage,
  normalizeImageStudioStatus,
} from './imageStudio';

describe('imageStudio helpers', () => {
  it('normalizes invalid statuses to not_started', () => {
    expect(normalizeImageStudioStatus(undefined)).toBe('not_started');
    expect(normalizeImageStudioStatus('processing')).toBe('processing');
    expect(normalizeImageStudioStatus('weird')).toBe('not_started');
  });

  it('builds the required studio editing prompt', () => {
    const prompt = buildImageStudioPrompt();

    expect(prompt).toContain('screenshot/product-grid capture');
    expect(prompt).toContain('extract only the single main cake subject');
    expect(prompt).toContain('phone frames, browser chrome, app UI');
    expect(prompt).toContain('solid light pastel purple cyclorama studio background');
    expect(prompt).toContain('soft diffused lighting');
    expect(prompt).toContain('transparent genie.ph logo');
    expect(prompt).toContain('exact same aspect ratio and dimensions');
  });

  it('creates a deterministic storage path', () => {
    expect(
      getImageStudioStoragePath({
        slug: 'My Fancy Cake!!',
        pHash: 'abc123',
      })
    ).toBe('admin/image-studio/my-fancy-cake.webp');

    expect(
      getImageStudioStoragePath({
        slug: null,
        pHash: 'ABC__123',
      })
    ).toBe('admin/image-studio/abc-123.webp');
  });

  it('renders the watermark svg with the expected brand label', () => {
    const svg = buildImageStudioWatermarkSvg({
      width: 1200,
      height: 900,
      brandLabel: 'Genie.ph',
      opacity: 0.18,
    });

    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="900"');
    expect(svg).toContain('opacity="0.18"');
    expect(svg).toContain('>Genie.ph<');
  });

  it('upscales small images while leaving larger ones alone', () => {
    expect(isImageStudioSmallImage(800, 600)).toBe(false);
    expect(isImageStudioSmallImage(1600, 900)).toBe(false);
    expect(isImageStudioSmallImage(500, 900)).toBe(false);
    expect(isImageStudioSmallImage(399, 900)).toBe(true);

    expect(getImageStudioOutputDimensions(800, 600)).toEqual({
      width: 800,
      height: 600,
      wasUpscaled: false,
      scaleFactor: 1,
    });

    expect(getImageStudioOutputDimensions(300, 600)).toEqual({
      width: 400,
      height: 800,
      wasUpscaled: true,
      scaleFactor: 400 / 300,
    });

    expect(getImageStudioOutputDimensions(1600, 900)).toEqual({
      width: 1600,
      height: 900,
      wasUpscaled: false,
      scaleFactor: 1,
    });

    expect(getImageStudioOutputDimensions(1800, 1200)).toEqual({
      width: 1800,
      height: 1200,
      wasUpscaled: false,
      scaleFactor: 1,
    });
  });
});
