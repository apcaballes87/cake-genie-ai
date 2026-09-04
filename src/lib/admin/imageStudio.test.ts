import { describe, expect, it } from 'vitest';

import {
  buildImageStudioPrompt,
  buildImageStudioSystemInstruction,
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

    expect(prompt).toContain('screenshot/product-grid/social-media capture');
    expect(prompt).toContain('use it only as a reference for the cake design');
    expect(prompt).toContain('follow this exact sequence');
    expect(prompt).toContain('extract or cut out only that cake subject');
    expect(prompt).toContain('completely erase the entire original screenshot scene');
    expect(prompt).toContain('phone frames, browser chrome, app UI');
    expect(prompt).toContain('Do NOT do a simple background replacement');
    expect(prompt).toContain('original screenshot must be considered fully discarded');
    expect(prompt).toContain('fresh ecommerce product photoshoot');
    expect(prompt).toContain('seamless light pastel purple cyclorama studio set');
    expect(prompt).toContain('Output a photorealistic, high-resolution bakery catalog image');
    expect(prompt).toContain('1:1 square aspect ratio');
    expect(prompt).toContain('final image is perfectly square');
    expect(prompt).toContain('HIGHEST PRIORITY — if the source contains a whole cake alongside cupcakes');
    expect(prompt).toContain('4-inch Bento + 5 Cupcakes set must remain exactly one 4-inch bento cake plus exactly five cupcakes');
    expect(prompt).toContain('For every composite cake set (a whole cake alongside cupcakes), change only the background');
    expect(prompt).toContain('If — and only if — the source contains cupcakes with no whole cake');
    expect(prompt).toContain('A cake-and-cupcake composite set is one product subject');
    expect(prompt).toContain('translate that text into English');
    expect(prompt).toContain('foreign (non-English) language');
    expect(prompt).toContain('English text on the source cake should be preserved as-is');
    expect(prompt).toContain('STITCHED / COMPOSITE IMAGE EDGE CASE');
    expect(prompt).toContain('two or more different cake or cupcake photos stitched');
    expect(prompt).toContain('smooth the transitions between tiers');
    expect(prompt).toContain('blend or repaint the seam area');
    expect(prompt).toContain('For stitched cupcake sets');
    expect(prompt).toContain('unify the lighting, frosting colors, and decoration style');
  });

  it('builds a system instruction that prioritizes a real product photo result', () => {
    const systemInstruction = buildImageStudioSystemInstruction();

    expect(systemInstruction).toContain('professional bakery ecommerce image editor');
    expect(systemInstruction).toContain('treat it only as design reference for the cake itself');
    expect(systemInstruction).toContain('cutout-and-restage workflow');
    expect(systemInstruction).toContain('discard the entire original screenshot scene');
    expect(systemInstruction).toContain('only the cake design should survive');
    expect(systemInstruction).toContain('never like a screenshot');
    expect(systemInstruction).toContain('simple background swap');
    expect(systemInstruction).toContain('Convert cake and cupcake references');
    expect(systemInstruction).toContain('A source that contains a whole cake alongside cupcakes is one indivisible composite product set');
    expect(systemInstruction).toContain('4-inch Bento + 5 Cupcakes set must remain one 4-inch bento cake plus exactly five cupcakes');
    expect(systemInstruction).toContain('For composite cake sets, change only the background and natural studio lighting/contact shadows');
    expect(systemInstruction).toContain('two or more different cake or cupcake images stitched');
    expect(systemInstruction).toContain('smooth transitions, blend seams');
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

    expect(getImageStudioOutputDimensions(300, 300)).toEqual({
      width: 400,
      height: 400,
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
