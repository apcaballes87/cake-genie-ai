
import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast as toastHot } from 'react-hot-toast';
import { fileToBase64, analyzeCakeImage } from '../services/geminiService.lazy';
import { getSupabaseClient } from '../lib/supabase/client';
import { compressImage } from '../lib/utils/imageOptimization';
import { showSuccess, showError, showLoading } from '../lib/utils/toast';
import { useAuth } from './useAuth';
import { HybridAnalysisResult } from '../types';

function dataURItoBlob(dataURI: string) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

export const useImageManagement = () => {
  const supabase = getSupabaseClient();
  const { user } = useAuth();

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
    onError: (error: Error) => void
  ) => {
    setIsLoading(true); // For file processing
    setError(null);
    try {
        const imageData = await fileToBase64(file);
        setOriginalImageData(imageData);
        setOriginalImagePreview(`data:${imageData.mimeType};base64,${imageData.data}`);
        setIsLoading(false); // File processing done

        // Now, start analysis in background.
        analyzeCakeImage(imageData.data, imageData.mimeType)
            .then(onSuccess)
            .catch(onError);
        
    } catch (err) {
        const fileProcessingError = err instanceof Error ? err : new Error("Failed to read image file.");
        setError(fileProcessingError.message);
        setIsLoading(false); // Also stop loading on error
        onError(fileProcessingError); // Propagate error
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

    const userId = user?.id || 'anonymous-guest';
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
  }, [originalImagePreview, editedImage, user, supabase]);

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
    handleSave,
    uploadCartImages,
    clearImages,
  };
};
