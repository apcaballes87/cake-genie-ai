import { describe, expect, it } from 'vitest';

import { buildImageStudioBatchInputLine, inferBatchImageMimeType } from './imageStudioBatch';

const item = {
  id: 'item-id',
  cache_id: 'cache-id',
  p_hash: 'abc123',
  slug: 'purple-cake',
  original_image_url: 'https://example.com/original.jpg',
  studio_edited_image_url: 'https://example.com/studio.webp',
};

describe('image studio batch JSONL', () => {
  it('infers supported image MIME types from public URLs', () => {
    expect(inferBatchImageMimeType('https://example.com/cake.png?t=1')).toBe('image/png');
    expect(inferBatchImageMimeType('https://example.com/cake.webp')).toBe('image/webp');
    expect(inferBatchImageMimeType('https://example.com/cake.jpg')).toBe('image/jpeg');
  });

  it('uses the original image for the studio stage', () => {
    const payload = JSON.parse(buildImageStudioBatchInputLine(item, 'studio'));
    expect(payload.request.contents[0].parts[0].fileData).toEqual({
      fileUri: item.original_image_url,
      mimeType: 'image/jpeg',
    });
    expect(payload.request.generationConfig.responseModalities).toEqual(['IMAGE']);
  });

  it('uses the completed studio image for the mask stage', () => {
    const payload = JSON.parse(buildImageStudioBatchInputLine(item, 'mask'));
    expect(payload.request.contents[0].parts[0].fileData).toEqual({
      fileUri: item.studio_edited_image_url,
      mimeType: 'image/webp',
    });
  });
});
