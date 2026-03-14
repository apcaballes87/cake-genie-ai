

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast as toastHot } from 'react-hot-toast';
import { fileToBase64, analyzeCakeFeaturesOnly, enrichAnalysisWithCoordinates, enrichAnalysisWithRoboflow, embedCakeImage } from '@/services/geminiService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization';
import { showSuccess, showError, showLoading, showInfo } from '@/lib/utils/toast';
import { HybridAnalysisResult } from '@/types';
import { COMMON_ASSETS } from '@/constants';
import { findSimilarAnalysisByHash, findSimilarAnalysisByEmbedding, cacheAnalysisResult } from '@/services/supabaseService';
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
                const imageUrl = COMMON_ASSETS.threeTierReference;

                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error('Failed to fetch reference image');
                const blob = await response.blob();
                const file = new File([blob], '3tier-reference.webp', { type: blob.type || 'image/webp' });
                const imageData = await fileToBase64(file);
                setThreeTierReferenceImage(imageData);

            } catch (error) {
                // Silently handle reference image load failure
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
            let uploadedImageUrl = options?.imageUrl; // Use existing URL if from web search
            let compressedImageData = imageData; // Default to original
            let finalImageBlobToCache: Blob | undefined;

            // --- STEP 1: CHECK pHash CACHE (FASTEST) ---
            const pHash = await generatePerceptualHash(imageSrc);
            console.log(`🖼️ Generated pHash for upload: ${pHash}`);
            
            const cacheHit = await findSimilarAnalysisByHash(pHash, uploadedImageUrl);

            if (cacheHit) {
                console.log('⚡ pHash Cache Hit! Skipping AI analysis.');
                const cachedAnalysis = cacheHit.analysisResult;
                onSuccess(cachedAnalysis);

                // Check if cached result has bbox data
                const hasBbox = hasBoundingBoxData(cachedAnalysis);

                if (!hasBbox) {

                    // Run enrichment in background without blocking
                    (async () => {
                        try {
                            let bgCompressedData = compressedImageData;
                            let bgBlob = finalImageBlobToCache;

                            if (!bgBlob) {
                                // Need to get compressed image data for enrichment
                                const imageBlob = dataURItoBlob(imageSrc);
                                const fileToUpload = new File([imageBlob], file.name, { type: file.type });
                                bgBlob = await compressImage(fileToUpload, {
                                    maxSizeMB: 0.5,
                                    maxWidthOrHeight: 1024,
                                    fileType: 'image/webp',
                                });
                                bgCompressedData = await fileToBase64(new File([bgBlob], file.name, { type: 'image/webp' }));
                            }

                            // Enrich with Roboflow
                            const enrichedResult = await enrichAnalysisWithRoboflow(
                                bgCompressedData.data,
                                bgCompressedData.mimeType,
                                cachedAnalysis
                            );

                            // Better Process: Only update image if it's missing in cache
                            const blobToPass = cacheHit.seoMetadata.original_image_url ? undefined : bgBlob;

                            // Update cache with bbox data
                            cacheAnalysisResult(pHash, enrichedResult, undefined, blobToPass);

                            // Notify UI of enriched coordinates
                            if (options?.onCoordinatesEnriched) {
                                options.onCoordinatesEnriched(enrichedResult);
                            }
                        } catch (error) {
                            // Silently handle background enrichment failure
                        }
                    })();
                }

                return; // Skip compression and AI call entirely!
            }

            // --- STEP 2: COMPRESS IMAGE FOR AI & STORAGE (ONLY ON CACHE MISS) ---
            try {
                // Compress image for both AI analysis and storage. 1024x1024 is optimal for Gemini.
                const imageBlob = dataURItoBlob(imageSrc);
                const fileToUpload = new File([imageBlob], file.name, { type: file.type });
                finalImageBlobToCache = fileToUpload; // default

                const compressedFile = await compressImage(fileToUpload, {
                    maxSizeMB: 0.5,
                    maxWidthOrHeight: 1024,
                    fileType: 'image/webp',
                });
                finalImageBlobToCache = compressedFile;

                // Convert compressed file to base64 for AI
                compressedImageData = await fileToBase64(compressedFile);

                // --- STEP 2.75: CHECK EMBEDDING CACHE IF pHash MISSED ---
                try {
                    console.log('🧠 Generating image embedding for deeper cache check...');
                    const imageEmbedding = await embedCakeImage({ data: compressedImageData.data, mimeType: compressedImageData.mimeType });
                    console.log('🔎 Searching embedding cache with 0.92 threshold...');
                    const embeddingMatch = await findSimilarAnalysisByEmbedding(imageEmbedding, 0.92, uploadedImageUrl);

                    if (embeddingMatch) {
                        console.log('✅ Embedding Match Found! Similarity Score:', (embeddingMatch as any).similarity || 'High');
                        onSuccess(embeddingMatch.analysisResult);

                        // Background enrichment for embeddings too
                        (async () => {
                            try {
                                const enrichedResult = await enrichAnalysisWithRoboflow(
                                    compressedImageData.data,
                                    compressedImageData.mimeType,
                                    embeddingMatch.analysisResult
                                );
                                
                                // Better Process: Only update image if it's missing in cache
                                const blobToPass = embeddingMatch.seoMetadata.original_image_url ? undefined : finalImageBlobToCache;
                                
                                cacheAnalysisResult(pHash, enrichedResult, uploadedImageUrl, blobToPass);
                                if (options?.onCoordinatesEnriched) {
                                    options.onCoordinatesEnriched(enrichedResult);
                                }
                            } catch (e) {
                                // Silently handle background enrichment failure
                            }
                        })();

                        return; // EXIT EARLY
                    }
                } catch (embedError) {
                    // Silently handle embedding check failure
                }

                // Image upload to Supabase is now deferred until after AI analysis completes
                // so we can use the generated SEO-friendly slug as the filename.

            } catch (compressionErr) {
                // Silently handle compression failure
            }
            // --- END OF COMPRESSION LOGIC & EMBEDDING CHECK ---

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

                    // Cache the fully enriched result, passing the blob to upload it with the generated slug
                    cacheAnalysisResult(pHash, enrichedResult, uploadedImageUrl, finalImageBlobToCache);
                }).catch(enrichmentError => {
                    // Still cache the fast result even if enrichment fails, passing the blob
                    cacheAnalysisResult(pHash, fastResult, uploadedImageUrl, finalImageBlobToCache);
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
        options: { editedImageDataUri?: string | null; userId?: string } = {}
    ): Promise<{ originalImageUrl: string; finalImageUrl: string }> => {
        if (!originalImagePreview) {
            throw new Error("Cannot upload to cart: original image is missing.");
        }

        // Use provided userId or fetch from auth (allows caller to cache auth)
        let userId = options.userId;
        if (!userId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error("Authentication session not found. Cannot upload images.");
            }
            userId = user.id;
        }

        // Prepare both images for upload in parallel
        const originalImageBlob = dataURItoBlob(originalImagePreview);
        const originalImageFileName = `designs/${userId}/${uuidv4()}.webp`;

        const imageToUpload = options.editedImageDataUri !== undefined ? options.editedImageDataUri : editedImage;

        // If we have an edited image, prepare and upload both in parallel
        if (imageToUpload) {
            const editedImageBlob = dataURItoBlob(imageToUpload);
            const editedImageFile = new File([editedImageBlob], 'edited-design.webp', { type: 'image/webp' });
            const compressedEditedFile = await compressImage(editedImageFile, { maxSizeMB: 1, fileType: 'image/webp' });
            const editedImageFileName = `designs/${userId}/${uuidv4()}.webp`;

            // Upload both images in PARALLEL for ~2x speedup
            const [originalResult, editedResult] = await Promise.all([
                supabase.storage.from('cakegenie').upload(originalImageFileName, originalImageBlob, { contentType: 'image/webp', upsert: false }),
                supabase.storage.from('cakegenie').upload(editedImageFileName, compressedEditedFile, { contentType: 'image/webp', upsert: false })
            ]);

            if (originalResult.error) throw new Error(`Failed to upload original image: ${originalResult.error.message}`);
            if (editedResult.error) throw new Error(`Failed to upload customized image: ${editedResult.error.message}`);

            const { data: { publicUrl: originalImageUrl } } = supabase.storage.from('cakegenie').getPublicUrl(originalImageFileName);
            const { data: { publicUrl: editedPublicUrl } } = supabase.storage.from('cakegenie').getPublicUrl(editedImageFileName);

            if (!originalImageUrl) throw new Error("Could not get original image public URL.");
            if (!editedPublicUrl) throw new Error("Could not get customized image public URL.");

            return { originalImageUrl, finalImageUrl: editedPublicUrl };
        }

        // Only original image to upload
        const { error: originalUploadError } = await supabase.storage.from('cakegenie').upload(originalImageFileName, originalImageBlob, { contentType: 'image/webp', upsert: false });
        if (originalUploadError) throw new Error(`Failed to upload original image: ${originalUploadError.message}`);

        const { data: { publicUrl: originalImageUrl } } = supabase.storage.from('cakegenie').getPublicUrl(originalImageFileName);
        if (!originalImageUrl) throw new Error("Could not get original image public URL.");

        return { originalImageUrl, finalImageUrl: originalImageUrl };
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