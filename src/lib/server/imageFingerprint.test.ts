import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  FINGERPRINT_PIPELINE,
  canonicalizeImageForFingerprint,
  computeImageFingerprint,
  hashHorizontalGradientPixels,
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

async function createCenteredCakeImage(innerSvg: string) {
  const overlay = Buffer.from(`
    <svg width="160" height="160" xmlns="http://www.w3.org/2000/svg">
      <circle cx="80" cy="82" r="48" fill="#f8f5ef" stroke="#e2ded4" stroke-width="8"/>
      ${innerSvg}
    </svg>
  `);

  return sharp({
    create: {
      width: 160,
      height: 160,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: overlay }])
    .png()
    .toBuffer();
}

function getHammingDistance(left: string, right: string) {
  let distance = 0;
  let xor = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);

  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }

  return distance;
}

describe('imageFingerprint', () => {
  it('generates a deterministic 64-bit canonical hash', async () => {
    const image = await createSampleImage();

    const first = await computeImageFingerprint(image);
    const second = await computeImageFingerprint(image);

    expect(first).toEqual(second);
    expect(first.pipeline).toBe(FINGERPRINT_PIPELINE);
    expect(first.pipeline).toBe('v2-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-dhash8');
    expect(first.pHash).toBe('053b1b2303434303');
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
    const pixels = new Uint8Array(72).fill(255);

    expect(() => hashHorizontalGradientPixels(pixels)).toThrow(/too little visual detail/i);
  });

  it('separates visually different centered cakes on bright square backgrounds', async () => {
    const birthdayCake = await createCenteredCakeImage(`
      <circle cx="66" cy="82" r="14" fill="none" stroke="#c8a349" stroke-width="7"/>
      <circle cx="94" cy="82" r="14" fill="none" stroke="#c8a349" stroke-width="7"/>
      <rect x="49" y="62" width="18" height="7" fill="#c8a349"/>
    `);
    const pickleballCake = await createCenteredCakeImage(`
      <circle cx="80" cy="82" r="28" fill="#83c653"/>
      <path d="M52 82 C65 62 95 62 108 82" fill="none" stroke="#ffffff" stroke-width="6"/>
      <path d="M52 82 C65 102 95 102 108 82" fill="none" stroke="#ffffff" stroke-width="6"/>
    `);

    const birthdayHash = (await computeImageFingerprint(birthdayCake)).pHash;
    const pickleballHash = (await computeImageFingerprint(pickleballCake)).pHash;

    expect(birthdayHash).not.toBe(pickleballHash);
    expect(getHammingDistance(birthdayHash, pickleballHash)).toBeGreaterThan(1);
  });
});
