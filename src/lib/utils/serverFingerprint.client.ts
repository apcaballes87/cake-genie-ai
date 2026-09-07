export interface ClientImageFingerprint {
  pHash: string | null;
  pipeline: string | null;
  pdqHash: string | null;
  pdqQuality: number | null;
  pdqPipeline: string | null;
  error: string | null;
}

export interface ImageFingerprintLookup {
  pdqHash: string | null;
  pdqQuality: number | null;
  pdqPipeline: string | null;
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
        pHash: typeof result?.legacyPHash === 'string' ? result.legacyPHash : null,
        pipeline: typeof result?.legacyPipeline === 'string' ? result.legacyPipeline : null,
        pdqHash: typeof result?.pdqHash === 'string' && /^[0-9a-f]{64}$/i.test(result.pdqHash)
          ? result.pdqHash.toLowerCase()
          : null,
        pdqQuality: typeof result?.pdqQuality === 'number' ? result.pdqQuality : null,
        pdqPipeline: typeof result?.pdqPipeline === 'string' ? result.pdqPipeline : null,
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

  return { pHash: null, pipeline: null, pdqHash: null, pdqQuality: null, pdqPipeline: null, error: lastError };
}

export function toFingerprintLookup(
  fingerprint: ClientImageFingerprint
): ImageFingerprintLookup {
  return {
    pdqHash: fingerprint.pdqHash,
    pdqQuality: fingerprint.pdqQuality,
    pdqPipeline: fingerprint.pdqPipeline,
  };
}
