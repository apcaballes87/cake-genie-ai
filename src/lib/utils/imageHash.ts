import sharp from 'sharp';
import { computeCanonicalImageHash } from '../server/imageFingerprint';

export async function computeImageHash(imageBuffer: Buffer): Promise<string> {
  return computeCanonicalImageHash(imageBuffer);
}

export async function convertToWebPBuffer(
  imageBuffer: Buffer,
  options: { width?: number; height?: number; quality?: number } = {}
): Promise<Buffer> {
  let pipeline = sharp(imageBuffer).webp({ quality: options.quality ?? 85 });

  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  return pipeline.toBuffer();
}

export async function getImageDimensions(
  imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}
