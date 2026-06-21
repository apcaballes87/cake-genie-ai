import type { HashOptions } from './perceptualHash.client';

export interface ClientImageFingerprint {
  pHash: string | null;
  pipeline: string | null;
  error: string | null;
}

export interface ImageFingerprintLookup {
  pHash: string | null;
  pipeline: string | null;
}

function getFingerprintErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Server fingerprint request failed.';
}

export async function generateServerImageFingerprint(
  image: Blob,
  fileName = 'image'
): Promise<ClientImageFingerprint> {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const formData = new FormData();
      formData.append('image', image, image instanceof File ? image.name : fileName);

      const response = await fetch('/api/image/fingerprint', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Server fingerprint request failed.');
      }

      const result = await response.json();
      return {
        pHash: typeof result?.pHash === 'string' ? result.pHash : null,
        pipeline: typeof result?.pipeline === 'string' ? result.pipeline : null,
        error: null,
      };
    } catch (error) {
      lastError = getFingerprintErrorMessage(error);
      console.warn(`Server image fingerprint failed (attempt ${attempt}/2):`, error);

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }
  }

  return { pHash: null, pipeline: null, error: lastError };
}

export function toFingerprintLookup(
  fingerprint: ClientImageFingerprint
): ImageFingerprintLookup {
  return {
    pHash: fingerprint.pHash,
    pipeline: fingerprint.pipeline,
  };
}

// Re-export HashOptions so callers don't need a separate import
export type { HashOptions };
