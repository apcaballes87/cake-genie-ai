const HASH_SIZE = 8;
const MAX_DIMENSION = 1024;
const RETRY_SCALES = [1, 0.5, 0.25] as const;

export type HashOptions = {
  crossOrigin?: '' | 'anonymous' | 'use-credentials';
};

function hashImageData(pixels: Uint8ClampedArray): string | null {
  const numPixels = HASH_SIZE * HASH_SIZE;
  const grayscale = new Array<number>(numPixels);
  let totalLuminance = 0;
  let allZero = true;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (r !== 0 || g !== 0 || b !== 0 || a !== 0) {
      allZero = false;
    }

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    grayscale[i / 4] = luminance;
    totalLuminance += luminance;
  }

  if (allZero) {
    return null;
  }

  let minLum = Infinity;
  let maxLum = -Infinity;

  for (let i = 0; i < numPixels; i++) {
    if (grayscale[i] < minLum) minLum = grayscale[i];
    if (grayscale[i] > maxLum) maxLum = grayscale[i];
  }

  if (maxLum - minLum < 1) {
    return null;
  }

  const avgLuminance = totalLuminance / numPixels;
  let hash = 0n;

  for (let i = 0; i < grayscale.length; i++) {
    if (grayscale[i] > avgLuminance) {
      hash |= 1n << BigInt(i);
    }
  }

  const hashStr = hash.toString(16).padStart(16, '0');
  return hashStr === '0000000000000000' ? null : hashStr;
}

function getScaledDimensions(img: HTMLImageElement, scale: number) {
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (scale < 1) {
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.max(1, Math.floor((height / width) * MAX_DIMENSION));
      width = MAX_DIMENSION;
    } else {
      width = Math.max(1, Math.floor((width / height) * MAX_DIMENSION));
      height = MAX_DIMENSION;
    }
  }

  return { width, height };
}

async function loadImage(imageSrc: string, options?: HashOptions): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    if (options?.crossOrigin) {
      img.crossOrigin = options.crossOrigin;
    }

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for hashing.'));
    img.src = imageSrc;
  });
}

async function ensureDecoded(img: HTMLImageElement) {
  if (!img.decode) return;

  try {
    await img.decode();
  } catch {
    // Some browsers reject decode() even though the image can still render.
  }
}

async function generatePerceptualHashWithScale(
  img: HTMLImageElement,
  scale: number,
  useBitmapCompatibilityResize = false
): Promise<string | null> {
  await ensureDecoded(img);

  const canvas = document.createElement('canvas');
  canvas.width = HASH_SIZE;
  canvas.height = HASH_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.imageSmoothingEnabled = true;

  let bitmap: ImageBitmap | null = null;

  try {
    if (useBitmapCompatibilityResize && scale === 1 && typeof createImageBitmap !== 'undefined') {
      bitmap = await createImageBitmap(img, {
        resizeWidth: HASH_SIZE,
        resizeHeight: HASH_SIZE,
        resizeQuality: 'low',
      });

      ctx.drawImage(bitmap, 0, 0, HASH_SIZE, HASH_SIZE);
    } else if (scale < 1) {
      const { width, height } = getScaledDimensions(img, scale);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;

      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        return null;
      }

      tempCtx.imageSmoothingEnabled = true;
      tempCtx.drawImage(img, 0, 0, width, height);
      ctx.drawImage(tempCanvas, 0, 0, HASH_SIZE, HASH_SIZE);
    } else {
      ctx.drawImage(
        img,
        0,
        0,
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
        0,
        0,
        HASH_SIZE,
        HASH_SIZE
      );
    }

    const imageData = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE);
    return hashImageData(imageData.data);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export async function generatePerceptualHash(
  imageSrc: string,
  options?: HashOptions
): Promise<string | null> {
  const candidates = await generatePerceptualHashCandidates(imageSrc, options);
  return candidates[0] ?? null;
}

export async function generatePerceptualHashCandidates(
  imageSrc: string,
  options?: HashOptions
): Promise<string[]> {
  try {
    const img = await loadImage(imageSrc, options);
    const candidates: string[] = [];

    for (const scale of RETRY_SCALES) {
      const hash = await generatePerceptualHashWithScale(img, scale, false);
      if (hash) {
        candidates.push(hash);
        break;
      }
    }

    const compatibilityHash = await generatePerceptualHashWithScale(img, 1, true);
    if (compatibilityHash) {
      candidates.push(compatibilityHash);
    }

    return [...new Set(candidates)];
  } catch {
    return [];
  }
}
