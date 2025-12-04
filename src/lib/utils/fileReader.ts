/**
 * Robust file reading utilities with mobile-specific fixes
 * Addresses intermittent "Failed to read image file" errors on mobile devices
 */

export interface FileReadResult {
  mimeType: string;
  data: string;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192; // Process in chunks to avoid call stack issues

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

/**
 * Read file using FileReader (more reliable on mobile than arrayBuffer())
 * @param file - The file to read
 * @returns Promise with base64 data and mime type
 */
function readFileWithFileReader(file: File): Promise<FileReadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Set timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      reader.abort();
      reject(new Error('File reading timed out after 30 seconds'));
    }, 30000);

    reader.onload = () => {
      clearTimeout(timeoutId);
      try {
        const result = reader.result as string;
        // Extract base64 data (remove data:image/...;base64, prefix)
        const base64Data = result.split(',')[1];
        if (!base64Data) {
          reject(new Error('Invalid file data'));
          return;
        }
        resolve({
          mimeType: file.type || 'image/jpeg',
          data: base64Data
        });
      } catch (error) {
        reject(new Error('Failed to process file data'));
      }
    };

    reader.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown error'}`));
    };

    reader.onabort = () => {
      clearTimeout(timeoutId);
      reject(new Error('File reading was aborted'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Read file using arrayBuffer (faster but less reliable on mobile)
 * @param file - The file to read
 * @returns Promise with base64 data and mime type
 */
async function readFileWithArrayBuffer(file: File): Promise<FileReadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const base64Data = arrayBufferToBase64(arrayBuffer);
  return {
    mimeType: file.type || 'image/jpeg',
    data: base64Data
  };
}

/**
 * Robustly read a file to base64 with retry logic and fallbacks
 * Optimized for mobile devices with memory constraints
 *
 * @param file - The file to read
 * @param options - Configuration options
 * @returns Promise with base64 data and mime type
 */
export async function fileToBase64Robust(
  file: File,
  options: {
    maxRetries?: number;
    preferFileReader?: boolean;
  } = {}
): Promise<FileReadResult> {
  const { maxRetries = 3, preferFileReader = false } = options;

  // Validate file
  if (!file || !(file instanceof File)) {
    throw new Error('Invalid file object');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error(`Invalid file type: ${file.type}. Expected an image.`);
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > 50) {
    throw new Error(`File too large: ${fileSizeMB.toFixed(1)}MB. Maximum is 50MB.`);
  }

  // Detect if on mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const shouldUseFileReader = preferFileReader || isMobile || fileSizeMB > 10;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[fileToBase64] Attempt ${attempt}/${maxRetries} for file: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);

      if (shouldUseFileReader || attempt > 1) {
        // Use FileReader (more reliable on mobile)
        console.log('[fileToBase64] Using FileReader method (mobile-optimized)');
        return await readFileWithFileReader(file);
      } else {
        // Try arrayBuffer first on desktop (faster)
        console.log('[fileToBase64] Using arrayBuffer method');
        return await readFileWithArrayBuffer(file);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error reading file');
      console.warn(`[fileToBase64] Attempt ${attempt} failed:`, lastError.message);

      // If arrayBuffer failed, try FileReader on next attempt
      if (attempt < maxRetries) {
        const delay = attempt * 500; // Exponential backoff: 500ms, 1000ms, 1500ms
        console.log(`[fileToBase64] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  const errorMessage = lastError?.message || 'Unknown error';
  console.error(`[fileToBase64] All ${maxRetries} attempts failed. Last error:`, errorMessage);
  throw new Error(`Failed to read image file after ${maxRetries} attempts. ${errorMessage}`);
}

/**
 * Validate image file before processing
 */
export function validateImageFile(
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const {
    maxSizeMB = 50,
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  } = options;

  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'Invalid file object' };
  }

  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Please use JPEG, PNG, or WebP.`
    };
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `Image too large: ${fileSizeMB.toFixed(1)}MB. Maximum size is ${maxSizeMB}MB.`
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  return { valid: true };
}
