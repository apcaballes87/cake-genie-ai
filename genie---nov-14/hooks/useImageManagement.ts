import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast as toastHot } from 'react-hot-toast';
import { fileToBase64, analyzeCakeFeatures, getCoordinatesForAnalysis } from '../services/geminiService.lazy';
import { getSupabaseClient } from '../lib/supabase/client';
import { compressImage, dataURItoBlob } from '../lib/utils/imageOptimization';
import { showSuccess, showError, showLoading, showInfo } from '../lib/utils/toast';
import { HybridAnalysisResult } from '../types';
import { findSimilarAnalysisByHash, cacheAnalysisResult } from '../services/supabaseService';

/**
 * Generates a perceptual hash (pHash) for an image.
 * This creates a fingerprint based on visual content, not binary data.
 * @param imageSrc The data URI of the image.
 * @returns A promise that resolves to a 16-character hex string representing the hash.
 */
async function generatePerceptualHash(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 8; // Create an 8x8 grayscale image
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Could not get canvas context');

      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size);
      const grayscale = new Array(size * size);
      let totalLuminance = 0;

      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        grayscale[i / 4] = luminance;
        totalLuminance += luminance;
      }

      const avgLuminance = totalLuminance / (size * size);
      let hash = 0n; // Use BigInt for bitwise operations

      for (let i = 0; i < grayscale.length; i++) {
        if (grayscale[i] > avgLuminance) {
          hash |= 1n << BigInt(i);
        }
      }
      
      // Convert BigInt to a 16-character hex string
      resolve(hash.toString(16).padStart(16, '0'));
    };
    img.onerror = () => reject(new Error('Failed to load image for hashing.'));
    img.src = imageSrc;
  });
}


export const useImageManagement = () => {
  const supabase = getSupabaseClient();

  // State
  const [originalImageData, setOriginalImageData] = useState<{ data: string; mimeType: string } | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [threeTierReferenceImage, setThreeTierReferenceImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch 3-tier reference image on mount
  useEffect(() => {
    const fetchReferenceImage = async () => {
        try {
            const imageUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/3tier.webp';
            
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error('Failed to fetch reference image');
            const blob = await response.blob();
            const file = new File([blob], '3tier-reference.webp', { type: blob.type || 'image/webp' });
            const imageData = await fileToBase64(file);
            setThreeTierReferenceImage(imageData);
            console.log('✅ 3-tier reference image loaded.');
        } catch (error) {
            console.error('❌ Failed to load 3-tier reference image:', error);
        }
    };
    fetchReferenceImage();
  }, []);

  const clearImages = useCallback(() => {
    setOriginalImageData(null);
    setOriginalImagePreview(null);
    setEditedImage(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const handleImageUpload = useCallback(async (
    file: File,
    onSuccess: (result: HybridAnalysisResult) => void,
    onError: (error: Error) => void,
    onCoordinatesSuccess: (result: HybridAnalysisResult) => void,
    options?: { imageUrl?: string }
  ) => {
    setIsLoading(true); // For file processing
    setError(null);
    try {
        const imageData = await fileToBase64(file);
        const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;
        setOriginalImageData(imageData);
        setOriginalImagePreview(imageSrc);
        setIsLoading(false);

        // Perform feature analysis first for instant UI update
        const featureAnalysisResult = await analyzeCakeFeatures(imageData.data, imageData.mimeType);
        onSuccess(featureAnalysisResult);

        // Silently fetch coordinates in the background
        getCoordinatesForAnalysis(imageData.data, imageData.mimeType, featureAnalysisResult)
          .then(coordinateAnalysisResult => {
            onCoordinatesSuccess(coordinateAnalysisResult);
          })
          .catch(coordError => {
            console.warn("Coordinate analysis failed in the background:", coordError);
            showInfo("Could not place design markers on the image.");
          });

    } catch (err) {
        const processingError = err instanceof Error ? err : new Error("Failed to process the image file.");
        setError(processingError.message);
        setIsLoading(false);
        onError(processingError);
    }
  }, [supabase]);

  const loadImageWithoutAnalysis = useCallback(async (imageUrl: string) => {
      setIsLoading(true);
      setError(null);
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
              controller.abort();
              console.warn(`Fetch for ${imageUrl} timed out.`);
          }, 8000); // 8-second timeout

          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`;
          const response = await fetch(proxyUrl, { signal: controller.signal });
          
          clearTimeout(timeoutId); // Clear timeout if fetch succeeds

          if (!response.ok) throw new Error(`Failed to fetch image via proxy (status: ${response.status}).`);
          const blob = await response.blob();
          if (!blob.type.startsWith('image/')) {
              throw new Error('Fetched content is not an image. The proxy may have failed.');
          }
          const file = new File([blob], 'shopify-product-image.webp', { type: blob.type || 'image/webp' });
          
          const imageData = await fileToBase64(file);
          setOriginalImageData(imageData);
          setOriginalImagePreview(`data:${imageData.mimeType};base64,${imageData.data}`);
          return imageData;
      } catch (err) {
          let errorMessage = 'Could not load product image.';
          if (err instanceof Error) {
              errorMessage = err.name === 'AbortError' 
                  ? 'Image loading timed out. Please try again.' 
                  : err.message;
          }
          showError(errorMessage);
          setError(errorMessage);
          throw new Error(errorMessage); // re-throw to be caught by the page component
      } finally {
          setIsLoading(false);
      }
  }, []);
  
  const handleSave = useCallback(async () => {
    if (!editedImage) return;

    setIsLoading(true);
    const toastId = showLoading("Saving image...");

    try {
        const watermarkUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20watermark.png';
        
        const [cakeImage, watermarkImage] = await Promise.all([
            new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load cake image.'));
                img.src = editedImage;
            }),
            new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load watermark image.'));
                img.src = watermarkUrl;
            })
        ]);

        const canvas = document.createElement('canvas');
        canvas.width = cakeImage.naturalWidth;
        canvas.height = cakeImage.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context.');

        ctx.drawImage(cakeImage, 0, 0);

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const watermarkAspectRatio = watermarkImage.naturalWidth / watermarkImage.naturalHeight;
        let watermarkWidth, watermarkHeight;
        
        if (canvasHeight > canvasWidth) {
            watermarkWidth = canvasWidth;
            watermarkHeight = watermarkWidth / watermarkAspectRatio;
        } else {
            watermarkHeight = canvasHeight;
            watermarkWidth = watermarkHeight * watermarkAspectRatio;
        }

        const x = (canvasWidth - watermarkWidth) / 2;
        const y = (canvasHeight - watermarkHeight) / 2;
        ctx.drawImage(watermarkImage, x, y, watermarkWidth, watermarkHeight);

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `cake-genie-design-${new Date().toISOString()}.png`;
        link.click();
        
        toastHot.dismiss(toastId);
        showSuccess("Image saved successfully!");
    } catch (err) {
        toastHot.dismiss(toastId);
        const message = err instanceof Error ? err.message : 'An unexpected error occurred while saving.';
        showError(message);
        setError(message);
    } finally {
        setIsLoading(false);
    }
  }, [editedImage]);

  const uploadCartImages = useCallback(async (
    options: { editedImageDataUri?: string | null } = {}
  ): Promise<{ originalImageUrl: string; finalImageUrl: string }> => {
    if (!originalImagePreview) {
        throw new Error("Cannot upload to cart: original image is missing.");
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Authentication session not found. Cannot upload images.");
    }
    const userId = user.id;

    const originalImageBlob = dataURItoBlob(originalImagePreview);
    const originalImageFileName = `designs/${userId}/${uuidv4()}.webp`;
    
    const { error: originalUploadError } = await supabase.storage.from('cakegenie').upload(originalImageFileName, originalImageBlob, { contentType: 'image/webp', upsert: false });
    if (originalUploadError) throw new Error(`Failed to upload original image: ${originalUploadError.message}`);
    const { data: { publicUrl: originalImageUrl } } = supabase.storage.from('cakegenie').getPublicUrl(originalImageFileName);
    if (!originalImageUrl) throw new Error("Could not get original image public URL.");

    let finalImageUrl = originalImageUrl;
    const imageToUpload = options.editedImageDataUri !== undefined ? options.editedImageDataUri : editedImage;

    if (imageToUpload) {
        const editedImageBlob = dataURItoBlob(imageToUpload);
        const editedImageFile = new File([editedImageBlob], 'edited-design.webp', { type: 'image/webp' });
        const compressedEditedFile = await compressImage(editedImageFile, { maxSizeMB: 1, fileType: 'image/webp' });

        const editedImageFileName = `designs/${userId}/${uuidv4()}.webp`;
        const { error: editedUploadError } = await supabase.storage.from('cakegenie').upload(editedImageFileName, compressedEditedFile, { contentType: 'image/webp', upsert: false });
        if (editedUploadError) throw new Error(`Failed to upload customized image: ${editedUploadError.message}`);
        const { data: { publicUrl: editedPublicUrl } } = supabase.storage.from('cakegenie').getPublicUrl(editedImageFileName);
        if (!editedPublicUrl) throw new Error("Could not get customized image public URL.");
        finalImageUrl = editedPublicUrl;
    }

    return { originalImageUrl, finalImageUrl };
  }, [originalImagePreview, editedImage, supabase]);

  return {
    // State
    originalImageData,
    originalImagePreview,
    editedImage,
    threeTierReferenceImage,
    isLoading,
    error,
    setEditedImage,
    setError,
    setIsLoading,
    
    // Functions
    handleImageUpload,
    loadImageWithoutAnalysis,
    handleSave,
    uploadCartImages,
    clearImages,
  };
};