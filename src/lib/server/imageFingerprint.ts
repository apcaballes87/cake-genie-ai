import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { PDQ } = require('pdq-wasm') as typeof import('pdq-wasm');

export const FINGERPRINT_PIPELINE =
  'v2-sharp-0.34-autoOrient-srgb-512-contain-white-lanczos3-gray-dhash8';
export const PDQ_MIN_QUALITY = 50;
export const PDQ_MAX_HAMMING_DISTANCE = 35;
export const PDQ_PIPELINE =
  'pdq-v2-wasm-0.3.9-sharp-0.34-autoOrient-srgb-rgb-512-contain-white-lanczos3-no-upscale-word-reversed';

export const MAX_FINGERPRINT_INPUT_BYTES = 10 * 1024 * 1024;

const CANONICAL_SIZE = 512;
const HASH_SIZE = 8;
const DIFFERENCE_HASH_WIDTH = HASH_SIZE + 1;
const WHITE_BACKGROUND = { r: 255, g: 255, b: 255 };

export interface ImageFingerprint {
  pHash: string;
  pipeline: string;
  pdqHash: string | null;
  pdqQuality: number | null;
  pdqPipeline: string | null;
}

export class PDQFingerprintError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'PDQFingerprintError';
    this.status = status;
  }
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

function createCanonicalPDQPipeline(input: Buffer) {
  return sharp(input, { failOn: 'none' })
    .rotate()
    .toColorspace('srgb')
    .flatten({ background: WHITE_BACKGROUND })
    .resize(CANONICAL_SIZE, CANONICAL_SIZE, {
      fit: 'contain',
      background: WHITE_BACKGROUND,
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
      // Pillow's Image.thumbnail(), which backs the pinned Python reference,
      // does not enlarge images smaller than the canonical canvas.
      withoutEnlargement: true,
    })
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
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

export async function computeLegacyImageFingerprint(input: Buffer): Promise<{ pHash: string; pipeline: string }> {
  return {
    pHash: await computeCanonicalImageHash(input),
    pipeline: FINGERPRINT_PIPELINE,
  };
}

let pdqInitPromise: Promise<void> | null = null;

async function initializePDQ() {
  if (!pdqInitPromise) {
    pdqInitPromise = PDQ.init().catch((error: unknown) => {
      pdqInitPromise = null;
      throw new PDQFingerprintError(
        `PDQ WASM initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        503,
      );
    });
  }

  return pdqInitPromise;
}

function toReferenceHex(hash: Uint8Array): string {
  // pdq-wasm exposes the native hash as sixteen 16-bit words in reverse word
  // order, while threatexchange==1.2.16 serializes those words in reference
  // order. Keep this conversion explicit so stored values remain compatible
  // with the existing Python-generated PDQ values.
  const source = Buffer.from(hash);
  const reference = Buffer.alloc(source.length);
  for (let offset = 0; offset < source.length; offset += 2) {
    const sourceOffset = source.length - offset - 2;
    source.copy(reference, offset, sourceOffset, sourceOffset + 2);
  }
  return reference.toString('hex');
}

export async function computePDQFingerprint(input: Buffer): Promise<{
  pdqHash: string | null;
  pdqQuality: number | null;
  pdqPipeline: string | null;
  status: string;
}> {
  try {
    const { data, info } = await createCanonicalPDQPipeline(input);
    if (info.width !== CANONICAL_SIZE || info.height !== CANONICAL_SIZE || info.channels !== 3) {
      throw new PDQFingerprintError(
        `PDQ normalization returned ${info.width}x${info.height} with ${info.channels} channels.`,
      );
    }

    await initializePDQ();
    const result = PDQ.hash({
      data: Uint8Array.from(data),
      width: info.width,
      height: info.height,
      channels: 3,
    });
    const quality = Number(result.quality);
    if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
      throw new PDQFingerprintError(`PDQ WASM returned an invalid quality score: ${result.quality}`);
    }

    if (quality < PDQ_MIN_QUALITY) {
      return {
        pdqHash: null,
        pdqQuality: quality,
        pdqPipeline: PDQ_PIPELINE,
        status: 'low_quality',
      };
    }

    return {
      pdqHash: toReferenceHex(result.hash),
      pdqQuality: quality,
      pdqPipeline: PDQ_PIPELINE,
      status: 'ready',
    };
  } catch (error) {
    if (error instanceof PDQFingerprintError) throw error;
    throw new PDQFingerprintError(error instanceof Error ? error.message : 'PDQ fingerprint failed.');
  }
}

export async function computeImageFingerprint(input: Buffer): Promise<ImageFingerprint> {
  const legacy = await computeLegacyImageFingerprint(input);
  const pdq = await computePDQFingerprint(input);
  return {
    ...legacy,
    pdqHash: pdq.pdqHash,
    pdqQuality: pdq.pdqQuality,
    pdqPipeline: pdq.pdqPipeline,
  };
}
