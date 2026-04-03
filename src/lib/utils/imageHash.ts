import sharp from 'sharp';

export async function computeImageHash(imageBuffer: Buffer): Promise<string> {
  const img = sharp(imageBuffer)
    .grayscale()
    .resize(8, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  const pixels = await img;
  const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;

  let hash = '';
  for (let i = 0; i < pixels.length; i++) {
    hash += pixels[i] > avg ? '1' : '0';
  }

  return parseInt(hash, 2).toString(16).padStart(16, '0');
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
