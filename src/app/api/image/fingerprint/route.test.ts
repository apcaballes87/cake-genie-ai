import sharp from 'sharp';
import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { FINGERPRINT_PIPELINE, MAX_FINGERPRINT_INPUT_BYTES } from '@/lib/server/imageFingerprint';
import { POST } from './route';

async function createImageBuffer() {
  return sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      {
        input: Buffer.from('<svg width="32" height="32"><rect x="4" y="4" width="20" height="18" fill="#000"/></svg>'),
      },
    ])
    .png()
    .toBuffer();
}

function createJsonRequest(imageData: string, mimeType: string): NextRequest {
  return new Request('http://localhost/api/image/fingerprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, mimeType }),
  }) as NextRequest;
}

describe('/api/image/fingerprint', () => {
  it('returns a server pHash and pipeline for a valid image', async () => {
    const imageData = (await createImageBuffer()).toString('base64');
    const response = await POST(createJsonRequest(imageData, 'image/png'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pHash).toMatch(/^[0-9a-f]{16}$/);
    expect(json.pipeline).toBe(FINGERPRINT_PIPELINE);
  });

  it('rejects non-image uploads', async () => {
    const response = await POST(createJsonRequest(Buffer.from('not an image').toString('base64'), 'text/plain'));

    expect(response.status).toBe(400);
  });

  it('rejects oversized images before decoding', async () => {
    const imageData = Buffer.alloc(MAX_FINGERPRINT_INPUT_BYTES + 1).toString('base64');
    const response = await POST(createJsonRequest(imageData, 'image/png'));

    expect(response.status).toBe(413);
  });
});
