// @vitest-environment node

import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  FINGERPRINT_PIPELINE,
  PDQ_PIPELINE,
  PDQ_MIN_QUALITY,
  canonicalizeImageForFingerprint,
  computePDQFingerprint,
  computeImageFingerprint,
  computeLegacyImageFingerprint,
  hashHorizontalGradientPixels,
} from './imageFingerprint';

async function createSampleImage() {
  const overlay = Buffer.from('<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="10" width="42" height="48" fill="#2b1a12"/><circle cx="66" cy="62" r="18" fill="#f06292"/><path d="M16 76 L80 78" stroke="#4caf50" stroke-width="8"/></svg>');
  return sharp({
    create: { width: 96, height: 96, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  }).composite([{ input: overlay }]).png().toBuffer();
}

describe('imageFingerprint', () => {
  it('keeps the legacy compatibility dHash deterministic and server-only', async () => {
    const image = await createSampleImage();
    const first = await computeLegacyImageFingerprint(image);
    const second = await computeLegacyImageFingerprint(image);

    expect(first).toEqual(second);
    expect(first.pipeline).toBe(FINGERPRINT_PIPELINE);
    expect(first.pHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('normalizes the legacy compatibility image to the locked pipeline', async () => {
    const canonical = await canonicalizeImageForFingerprint(await createSampleImage());
    const metadata = await sharp(canonical).metadata();
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(metadata.space).toBe('b-w');
  });

  it('rejects low-detail legacy fingerprints', () => {
    expect(() => hashHorizontalGradientPixels(new Uint8Array(72).fill(255))).toThrow(/too little visual detail/i);
  });

  it('computes a server-only WASM PDQ hash with quality and pipeline metadata', async () => {
    const result = await computePDQFingerprint(await readFile('cinnamoroll-test.webp'));

    expect(result.pdqHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.pdqQuality).toBeGreaterThanOrEqual(PDQ_MIN_QUALITY);
    expect(result.pdqPipeline).toBe(PDQ_PIPELINE);
    expect(result.status).toBe('ready');
  });

  it('keeps low-detail images out of similarity matching', async () => {
    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();

    await expect(computePDQFingerprint(image)).resolves.toMatchObject({
      pdqHash: null,
      pdqQuality: expect.any(Number),
      pdqPipeline: PDQ_PIPELINE,
      status: 'low_quality',
    });
  });

  it('matches the pinned Python reference output for the repository fixture', async () => {
    const fixture = await readFile('cinnamoroll-test.webp');
    await expect(computePDQFingerprint(fixture)).resolves.toEqual({
      pdqHash: 'f36663996c93b0c69633c8645a6c2e19e79bb38631868ce6e64d4e795a69b186',
      pdqQuality: 100,
      pdqPipeline: PDQ_PIPELINE,
      status: 'ready',
    });
  });

  it('combines the opaque legacy pHash with the authoritative local PDQ result', async () => {
    const result = await computeImageFingerprint(await readFile('cinnamoroll-test.webp'));
    expect(result.pHash).toMatch(/^[0-9a-f]{16}$/);
    expect(result.pdqHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.pdqQuality).toBeGreaterThanOrEqual(PDQ_MIN_QUALITY);
    expect(result.pdqPipeline).toBe(PDQ_PIPELINE);
  });
});
