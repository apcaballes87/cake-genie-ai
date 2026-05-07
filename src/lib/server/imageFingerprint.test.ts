import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  FINGERPRINT_PIPELINE,
  canonicalizeImageForFingerprint,
  computeImageFingerprint,
  hashGrayscalePixels,
} from './imageFingerprint';

async function createSampleImage() {
  const overlay = Buffer.from(`
    <svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="10" width="42" height="48" fill="#2b1a12"/>
      <circle cx="66" cy="62" r="18" fill="#f06292"/>
      <path d="M16 76 L80 78" stroke="#4caf50" stroke-width="8"/>
    </svg>
  `);

  return sharp({
    create: {
      width: 96,
      height: 96,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: overlay }])
    .png()
    .toBuffer();
}

describe('imageFingerprint', () => {
  it('generates a deterministic 64-bit canonical hash', async () => {
    const image = await createSampleImage();

    const first = await computeImageFingerprint(image);
    const second = await computeImageFingerprint(image);

    expect(first).toEqual(second);
    expect(first.pipeline).toBe(FINGERPRINT_PIPELINE);
    expect(first.pHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('canonicalizes to the locked 512px grayscale PNG pipeline', async () => {
    const image = await createSampleImage();
    const canonical = await canonicalizeImageForFingerprint(image);
    const metadata = await sharp(canonical).metadata();

    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(metadata.space).toBe('b-w');
  });

  it('rejects low-detail hashes instead of caching a degenerate fingerprint', () => {
    const pixels = new Uint8Array(64).fill(255);

    expect(() => hashGrayscalePixels(pixels)).toThrow(/too little visual detail/i);
  });
});
