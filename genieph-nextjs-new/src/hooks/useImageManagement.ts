

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast as toastHot } from 'react-hot-toast';
import { fileToBase64, analyzeCakeFeaturesOnly, enrichAnalysisWithCoordinates, enrichAnalysisWithRoboflow } from '@/services/geminiService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization';
import { showSuccess, showError, showLoading, showInfo } from '@/lib/utils/toast';
import { HybridAnalysisResult } from '@/types';
import { findSimilarAnalysisByHash, cacheAnalysisResult } from '@/services/supabaseService';
import { hasBoundingBoxData } from '@/lib/utils/analysisUtils';

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
    const [sourceImageData, setSourceImageData] = useState<{ data: string; mimeType: string } | null>(null); // True original, never overwritten
    const [previousImageData, setPreviousImageData] = useState<{ data: string; mimeType: string } | null>(null); // For undo functionality
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

            } catch (error) {
                console.error('❌ Failed to load 3-tier reference image:', error);
            }
        };
        fetchReferenceImage();
    }, []);

    const clearImages = useCallback(() => {
        setOriginalImageData(null);
        setSourceImageData(null);
        setPreviousImageData(null);
        setOriginalImagePreview(null);
        setEditedImage(null);
        setError(null);
        setIsLoading(false);
    }, []);

    const handleImageUpload = useCallback(async (
        file: File,
        onSuccess: (result: HybridAnalysisResult) => void,
        onError: (error: Error) => void,
        options?: { imageUrl?: string; onCoordinatesEnriched?: (result: HybridAnalysisResult) => void }
    ) => {
        setIsLoading(true); // For file processing
        setError(null);
        try {
            const imageData = await fileToBase64(file);
            const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;
            setOriginalImageData(imageData);
            setSourceImageData(imageData); // Store the true original that will never be overwritten
            setOriginalImagePreview(imageSrc);
            setIsLoading(false); // File processing done

            // --- STEP 1: CHECK CACHE FIRST (FAST PATH) ---

            const pHash = await generatePerceptualHash(imageSrc);
            const cachedAnalysis = await findSimilarAnalysisByHash(pHash, options?.imageUrl);

            if (cachedAnalysis) {
                console.log('✅ Using cached analysis result');
                onSuccess(cachedAnalysis);

                // Check if cached result has bbox data
                const hasBbox = hasBoundingBoxData(cachedAnalysis);

                if (!hasBbox) {
                    console.log('🔄 Cached result missing bbox data, enriching in background...');

                    // Run enrichment in background without blocking
                    (async () => {
                        try {
                            // Need to get compressed image data for enrichment
                            const imageBlob = dataURItoBlob(imageSrc);
                            const fileToUpload = new File([imageBlob], file.name, { type: file.type });
                            const compressedFile = await compressImage(fileToUpload, {
                                maxSizeMB: 0.5,
                                maxWidthOrHeight: 1024,
                                fileType: 'image/webp',
                            });
                            const compressedImageData = await fileToBase64(compressedFile);

                            // Enrich with Roboflow
                            const enrichedResult = await enrichAnalysisWithRoboflow(
                                compressedImageData.data,
                                compressedImageData.mimeType,
                                cachedAnalysis
                            );

                            // Update cache with bbox data
                            cacheAnalysisResult(pHash, enrichedResult);

                            // Notify UI of enriched coordinates
                            if (options?.onCoordinatesEnriched) {
                                options.onCoordinatesEnriched(enrichedResult);
                            }

                            console.log('✅ Background enrichment complete, cache updated with bbox data');
                        } catch (error) {
                            console.warn('⚠️ Background enrichment failed:', error);
                        }
                    })();
                } else {
                    console.log('✨ Cached result already has bbox data, skipping enrichment');
                }

                return; // Skip compression and AI call entirely!
            }




            // --- STEP 2: COMPRESS IMAGE FOR AI & STORAGE (ONLY ON CACHE MISS) ---
            let uploadedImageUrl = options?.imageUrl; // Use existing URL if from web search
            let compressedImageData = imageData; // Default to original

            try {
                // Compress image for both AI analysis and storage. 1024x1024 is optimal for Gemini.
                const imageBlob = dataURItoBlob(imageSrc);
                const fileToUpload = new File([imageBlob], file.name, { type: file.type });

                const compressedFile = await compressImage(fileToUpload, {
                    maxSizeMB: 0.5,
                    maxWidthOrHeight: 1024,
                    fileType: 'image/webp',
                });

                // Convert compressed file to base64 for AI
                compressedImageData = await fileToBase64(compressedFile);


                // Upload compressed file to storage
                if (!uploadedImageUrl) {
                    const fileName = `analysis-cache/${uuidv4()}.webp`;
                    const { error: uploadError } = await supabase.storage
                        .from('cakegenie')
                        .upload(fileName, compressedFile, {
                            contentType: 'image/webp',
                            upsert: false,
                        });

                    if (uploadError) {
                        console.warn('Failed to upload image for caching, proceeding without URL.', uploadError.message);
                    } else {
                        const { data: { publicUrl } } = supabase.storage.from('cakegenie').getPublicUrl(fileName);
                        uploadedImageUrl = publicUrl;

                    }
                }
            } catch (compressionErr) {
                console.warn('Image compression failed, proceeding with original:', compressionErr);
            }
            // --- END OF COMPRESSION LOGIC ---

            // --- STEP 3: TWO-PHASE AI ANALYSIS ---


            try {
                // PHASE 1: Fast feature-only analysis with v3.2 prompt (coordinates all 0,0)
                const fastResult = await analyzeCakeFeaturesOnly(
                    compressedImageData.data,
                    compressedImageData.mimeType
                );

                onSuccess(fastResult); // User can now see features and price immediately!

                // PHASE 2: Background coordinate enrichment with Roboflow + Florence-2
                // (Falls back to Gemini if Roboflow fails or is disabled)
                enrichAnalysisWithRoboflow(
                    compressedImageData.data,
                    compressedImageData.mimeType,
                    fastResult
                ).then(enrichedResult => {
                    // Notify the UI to update with enriched coordinates
                    if (options?.onCoordinatesEnriched) {
                        options.onCoordinatesEnriched(enrichedResult);
                    }

                    // Cache the fully enriched result
                    cacheAnalysisResult(pHash, enrichedResult, uploadedImageUrl);

                    console.log('✨ Coordinate enrichment complete');
                }).catch(enrichmentError => {
                    console.warn('⚠️ Coordinate enrichment failed, but features are still available:', enrichmentError);
                    // Still cache the fast result even if enrichment fails
                    cacheAnalysisResult(pHash, fastResult, uploadedImageUrl);
                });

            } catch (error) {
                onError(error instanceof Error ? error : new Error('Failed to analyze image'));
            }

        } catch (err) {
            const fileProcessingError = err instanceof Error ? err : new Error("Failed to read image file.");
            setError(fileProcessingError.message);
            setIsLoading(false); // Also stop loading on error
            onError(fileProcessingError); // Propagate error
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
            setSourceImageData(imageData); // Store the true original that will never be overwritten
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
        sourceImageData,
        previousImageData,
        originalImagePreview,
        editedImage,
        threeTierReferenceImage,
        isLoading,
        error,
        setEditedImage,
        setError,
        setIsLoading,
        setOriginalImageData,
        setPreviousImageData,

        // Functions
        handleImageUpload,
        loadImageWithoutAnalysis,
        handleSave,
        uploadCartImages,
        clearImages,
    };
};