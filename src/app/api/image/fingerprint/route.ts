import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import {
  computeImageFingerprint,
  MAX_FINGERPRINT_INPUT_BYTES,
} from '@/lib/server/imageFingerprint';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Pre-warm sharp / libvips at module load. The first sharp() call on a fresh
// Node process pays a one-time native binding initialization cost (often
// 100-300ms in serverless cold starts). Doing a tiny 1×1 PNG decode here moves
// that cost out of the first user request's critical path.
let sharpWarmupPromise: Promise<unknown> | null = null;
function warmupSharp() {
  if (sharpWarmupPromise) return sharpWarmupPromise;

  // 1×1 transparent PNG — smallest valid input that exercises the decode path.
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
    'base64'
  );
  sharpWarmupPromise = sharp(tinyPng).raw().toBuffer().catch(() => null);
  return sharpWarmupPromise;
}
warmupSharp();

function isImageMimeType(mimeType: string | null | undefined) {
  return typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('image/');
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value === 'object'
    && value !== null
    && 'arrayBuffer' in value
    && 'size' in value
    && 'type' in value;
}

async function readImageFromRequest(req: NextRequest): Promise<Buffer> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const image = formData.get('image');

    if (!isUploadedFile(image)) {
      throw new Error('Missing image file.');
    }

    if (!isImageMimeType(image.type)) {
      throw new Error('Uploaded file must be an image.');
    }

    if (image.size > MAX_FINGERPRINT_INPUT_BYTES) {
      throw new Error('Image too large.');
    }

    return Buffer.from(await image.arrayBuffer());
  }

  if (contentType.includes('application/json')) {
    const body = await req.json();
    const imageData = typeof body?.imageData === 'string' ? body.imageData : '';
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';

    if (!imageData || !isImageMimeType(mimeType)) {
      throw new Error('Missing imageData or valid image mimeType.');
    }

    const buffer = Buffer.from(imageData, 'base64');
    if (buffer.length > MAX_FINGERPRINT_INPUT_BYTES) {
      throw new Error('Image too large.');
    }

    return buffer;
  }

  throw new Error('Unsupported request content type.');
}

export async function POST(req: NextRequest) {
  try {
    const imageBuffer = await readImageFromRequest(req);
    // Make sure libvips is initialized before we hit the heavy pipeline. On a
    // warm node this resolves instantly because warmupSharp() ran at module load.
    await warmupSharp();
    const fingerprint = await computeImageFingerprint(imageBuffer);

    return NextResponse.json(fingerprint);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fingerprint image.';
    const status = message.includes('too large')
      ? 413
      : message.includes('too little visual detail')
        ? 422
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
