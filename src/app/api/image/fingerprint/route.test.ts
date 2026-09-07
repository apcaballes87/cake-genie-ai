// @vitest-environment node

import { readFile } from 'node:fs/promises';
import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  FINGERPRINT_PIPELINE,
  MAX_FINGERPRINT_INPUT_BYTES,
  PDQ_PIPELINE,
} from '@/lib/server/imageFingerprint';
import { POST } from './route';

async function createImageBuffer() {
  return readFile('cinnamoroll-test.webp');
}

function createJsonRequest(imageData: string, mimeType: string): NextRequest {
  return new Request('http://localhost/api/image/fingerprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, mimeType }),
  }) as NextRequest;
}

describe('/api/image/fingerprint', () => {
  it('returns an opaque legacy pHash plus local server-only PDQ fields for a valid image', async () => {
    const imageData = (await createImageBuffer()).toString('base64');
    const response = await POST(createJsonRequest(imageData, 'image/png'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.legacyPHash).toMatch(/^[0-9a-f]{16}$/);
    expect(json.legacyPipeline).toBe(FINGERPRINT_PIPELINE);
    expect(json.pdqHash).toMatch(/^[0-9a-f]{64}$/);
    expect(json.pdqQuality).toEqual(expect.any(Number));
    expect(json.pdqPipeline).toBe(PDQ_PIPELINE);
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
