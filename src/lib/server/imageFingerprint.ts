import sharp from 'sharp';

export const FINGERPRINT_PIPELINE =
  'v1-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-ahash8';

export const MAX_FINGERPRINT_INPUT_BYTES = 10 * 1024 * 1024;

const CANONICAL_SIZE = 512;
const HASH_SIZE = 8;
const WHITE_BACKGROUND = { r: 255, g: 255, b: 255 };

export interface ImageFingerprint {
  pHash: string;
  pipeline: string;
}

function createCanonicalPipeline(input: Buffer) {
  return sharp(input, { failOn: 'none' })
    .rotate()
    .toColorspace('srgb')
    .flatten({ background: WHITE_BACKGROUND })
    .resize(CANONICAL_SIZE, CANONICAL_SIZE, {
      fit: 'contain',
      background: WHITE_BACKGROUND,
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
    })
    .greyscale()
    .toColorspace('b-w');
}

export async function canonicalizeImageForFingerprint(input: Buffer): Promise<Buffer> {
  return createCanonicalPipeline(input)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export function hashGrayscalePixels(pixels: Uint8Array): string {
  const expectedLength = HASH_SIZE * HASH_SIZE;
  if (pixels.length !== expectedLength) {
    throw new Error(`Expected ${expectedLength} grayscale pixels, received ${pixels.length}.`);
  }

  let total = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const value of pixels) {
    total += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (max - min < 1) {
    throw new Error('Image has too little visual detail to fingerprint reliably.');
  }

  const average = total / pixels.length;
  let hash = 0n;

  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] > average) {
      hash |= 1n << BigInt(i);
    }
  }

  return hash.toString(16).padStart(16, '0');
}

export async function computeCanonicalImageHash(input: Buffer): Promise<string> {
  const { data, info } = await createCanonicalPipeline(input)
    .resize(HASH_SIZE, HASH_SIZE, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 1) {
    throw new Error(`Expected grayscale image with 1 channel, received ${info.channels}.`);
  }

  return hashGrayscalePixels(data);
}

export async function computeImageFingerprint(input: Buffer): Promise<ImageFingerprint> {
  return {
    pHash: await computeCanonicalImageHash(input),
    pipeline: FINGERPRINT_PIPELINE,
  };
}
