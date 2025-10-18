import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
}

/**
 * Compress an image file for optimal upload size
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const defaultOptions = {
    maxSizeMB: 1, // Max file size in MB
    maxWidthOrHeight: 1920, // Max dimension
    useWebWorker: true, // Use web worker for better performance
    fileType: 'image/webp', // Convert to WebP for better compression
  };

  const compressionOptions = { ...defaultOptions, ...options };

  try {
    console.log('Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    const compressedFile = await imageCompression(file, compressionOptions);
    
    console.log('Compressed file size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Compression ratio:', ((1 - compressedFile.size / file.size) * 100).toFixed(2), '%');
    
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Compress an image for thumbnail display
 */
export async function compressThumbnail(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 400,
  });
}

/**
 * Get optimized image URL from Supabase Storage with transforms
 */
export function getOptimizedImageUrl(
  supabaseUrl: string,
  bucketName: string,
  filePath: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): string {
  const { width = 800, height = 800, quality = 80, format = 'webp' } = options;
  
  // Supabase storage transform URL format
  const transformParams = `width=${width}&height=${height}&quality=${quality}&format=${format}`;
  return `${supabaseUrl}/storage/v1/render/image/public/${bucketName}/${filePath}?${transformParams}`;
}

/**
 * Validate image file type and size
 */
export function validateImageFile(
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const { maxSizeMB = 10, allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] } = options;

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB (your file: ${fileSizeMB.toFixed(2)}MB)`,
    };
  }

  return { valid: true };
}

/**
 * Create a preview URL for an image file
 */
export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}