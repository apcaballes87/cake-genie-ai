import sharp from 'sharp';

export const FINGERPRINT_PIPELINE =
  'v2-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-dhash8';

export const MAX_FINGERPRINT_INPUT_BYTES = 10 * 1024 * 1024;

const CANONICAL_SIZE = 512;
const HASH_SIZE = 8;
const DIFFERENCE_HASH_WIDTH = HASH_SIZE + 1;
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

export function hashHorizontalGradientPixels(pixels: Uint8Array): string {
  const expectedLength = DIFFERENCE_HASH_WIDTH * HASH_SIZE;
  if (pixels.length !== expectedLength) {
    throw new Error(`Expected ${expectedLength} grayscale pixels, received ${pixels.length}.`);
  }

  let min = Infinity;
  let max = -Infinity;

  for (const value of pixels) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (max - min < 1) {
    throw new Error('Image has too little visual detail to fingerprint reliably.');
  }

  let hash = 0n;
  let bitIndex = 0;

  for (let y = 0; y < HASH_SIZE; y += 1) {
    const rowOffset = y * DIFFERENCE_HASH_WIDTH;
    for (let x = 0; x < HASH_SIZE; x += 1) {
      if (pixels[rowOffset + x] > pixels[rowOffset + x + 1]) {
        hash |= 1n << BigInt(bitIndex);
      }
      bitIndex += 1;
    }
  }

  return hash.toString(16).padStart(16, '0');
}

export async function computeCanonicalImageHash(input: Buffer): Promise<string> {
  const { data, info } = await createCanonicalPipeline(input)
    .resize(DIFFERENCE_HASH_WIDTH, HASH_SIZE, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 1) {
    throw new Error(`Expected grayscale image with 1 channel, received ${info.channels}.`);
  }

  return hashHorizontalGradientPixels(data);
}

export async function computeImageFingerprint(input: Buffer): Promise<ImageFingerprint> {
  return {
    pHash: await computeCanonicalImageHash(input),
    pipeline: FINGERPRINT_PIPELINE,
  };
}
