

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast as toastHot } from 'react-hot-toast';
import { fileToBase64, analyzeCakeFeaturesOnly, enrichAnalysisWithCoordinates, enrichAnalysisWithRoboflow } from '@/services/geminiService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization';
import { showSuccess, showError, showLoading, showInfo } from '@/lib/utils/toast';
import { HybridAnalysisResult } from '@/types';
import { COMMON_ASSETS } from '@/constants';
import { findSimilarAnalysisByHash, cacheAnalysisResult } from '@/services/supabaseService';
import { hasBoundingBoxData } from '@/lib/utils/analysisUtils';

/** Sentinel value returned when pHash generation fails or produces a degenerate hash. */
const PHASH_FAILED = null;

/**
 * Generates a perceptual hash (pHash) for an image with a specific scale factor.
 * Creates a scaled-down version of the image before processing.
 * @param imageSrc The data URI of the image.
 * @param scale Scale factor (0-1). 1 = original size, 0.5 = half size, 0.25 = quarter size.
 * @returns A 16-character hex string, or null if the hash could not be reliably computed.
 */
async function generatePerceptualHashWithScale(imageSrc: string, scale: number = 1): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();

        img.onload = async () => {
            try {
                // Strategy 1: Wait for decode (prevents "image not fully decoded" errors on mobile)
                if (img.decode) {
                    try {
                        await img.decode();
                    } catch (decodeErr) {
                        console.warn('⚠️ pHash: decode() failed, proceeding anyway:', decodeErr);
                    }
                }

                // Strategy 2: Resize before processing to reduce memory usage
                const MAX_DIMENSION = 1024;
                let width = img.naturalWidth;
                let height = img.naturalHeight;

                // Apply scale factor
                if (scale < 1) {
                    width = Math.floor(width * scale);
                    height = Math.floor(height * scale);
                }

                // Limit max dimension to reduce memory usage
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    if (width > height) {
                        height = Math.floor((height / width) * MAX_DIMENSION);
                        width = MAX_DIMENSION;
                    } else {
                        width = Math.floor((width / height) * MAX_DIMENSION);
                        height = MAX_DIMENSION;
                    }
                }

                // Strategy 3: Use createImageBitmap if available (more efficient memory handling)
                let source: HTMLImageElement | ImageBitmap = img;
                if (typeof createImageBitmap !== 'undefined' && scale === 1) {
                    try {
                        source = await createImageBitmap(img, {
                            resizeWidth: 8,
                            resizeHeight: 8,
                            resizeQuality: 'low'
                        });
                    } catch (bitmapErr) {
                        console.warn('⚠️ pHash: createImageBitmap failed, using img:', bitmapErr);
                    }
                }

                const canvas = document.createElement('canvas');
                const size = 8; // Create an 8x8 grayscale image
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.warn('⚠️ pHash: Could not get canvas context');
                    return resolve(PHASH_FAILED);
                }

                // If scaling, create a temporary canvas for the scaled image
                if (scale < 1) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (!tempCtx) {
                        console.warn('⚠️ pHash: Could not get temp canvas context');
                        return resolve(PHASH_FAILED);
                    }
                    tempCtx.drawImage(img, 0, 0, width, height);
                    ctx.drawImage(tempCanvas, 0, 0, size, size);
                } else {
                    ctx.drawImage(source, 0, 0, size, size);
                }

                // Clean up bitmap if used
                if (source instanceof ImageBitmap) {
                    source.close();
                }

                const imageData = ctx.getImageData(0, 0, size, size);
                const pixels = imageData.data;
                const numPixels = size * size;
                const grayscale = new Array(numPixels);
                let totalLuminance = 0;
                let allZero = true;

                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];
                    const a = pixels[i + 3];
                    if (r !== 0 || g !== 0 || b !== 0 || a !== 0) allZero = false;
                    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                    grayscale[i / 4] = luminance;
                    totalLuminance += luminance;
                }

                if (allZero) {
                    console.warn(`⚠️ pHash: Canvas rendered blank at scale ${scale} — image likely failed to decode. Skipping cache.`);
                    return resolve(PHASH_FAILED);
                }

                const avgLuminance = totalLuminance / numPixels;

                let minLum = Infinity;
                let maxLum = -Infinity;
                for (let i = 0; i < numPixels; i++) {
                    if (grayscale[i] < minLum) minLum = grayscale[i];
                    if (grayscale[i] > maxLum) maxLum = grayscale[i];
                }
                if (maxLum - minLum < 1) {
                    console.warn(`⚠️ pHash: All pixels same luminance at scale ${scale} (solid color). Skipping cache.`);
                    return resolve(PHASH_FAILED);
                }

                let hash = 0n;
                for (let i = 0; i < grayscale.length; i++) {
                    if (grayscale[i] > avgLuminance) {
                        hash |= 1n << BigInt(i);
                    }
                }

                const hashStr = hash.toString(16).padStart(16, '0');
                if (hashStr === '0000000000000000') {
                    console.warn(`⚠️ pHash: Computed all-zero hash at scale ${scale}. Skipping cache.`);
                    return resolve(PHASH_FAILED);
                }

                resolve(hashStr);
            } catch (err) {
                console.warn(`⚠️ pHash: Canvas operation failed at scale ${scale}:`, err);
                resolve(PHASH_FAILED);
            }
        };

        img.onerror = () => {
            console.warn(`⚠️ pHash: Image failed to load at scale ${scale}`);
            resolve(PHASH_FAILED);
        };

        img.src = imageSrc;
    });
}

/**
 * Generates a perceptual hash (pHash) for an image with progressive retry.
 * If the first attempt fails, retries with half resolution, then quarter resolution.
 * @param imageSrc The data URI of the image.
 * @returns A 16-character hex string, or null if all attempts failed.
 *
 * Returns null (instead of a degenerate hash) when:
 *  - The canvas fails to render the image (blank/transparent canvas)
 *  - All pixels have the same luminance (solid-color image)
 *  - The image fails to load or the canvas context is unavailable
 *  - All retry attempts failed
 *
 * A null hash means "do not use cache" — the caller must skip both
 * cache lookup and cache storage to avoid false matches.
 */
async function generatePerceptualHash(imageSrc: string): Promise<string | null> {
    // Attempt 1: Full resolution (with decode + resize + createImageBitmap)
    let hash = await generatePerceptualHashWithScale(imageSrc, 1);
    if (hash !== null) {
        console.log('✅ pHash: Success on first attempt');
        return hash;
    }

    // Attempt 2: Half resolution
    console.log('🔄 pHash: First attempt failed, retrying with half resolution...');
    hash = await generatePerceptualHashWithScale(imageSrc, 0.5);
    if (hash !== null) {
        console.log('✅ pHash: Success on second attempt (half resolution)');
        return hash;
    }

    // Attempt 3: Quarter resolution
    console.log('🔄 pHash: Second attempt failed, retrying with quarter resolution...');
    hash = await generatePerceptualHashWithScale(imageSrc, 0.25);
    if (hash !== null) {
        console.log('✅ pHash: Success on third attempt (quarter resolution)');
        return hash;
    }

    // All attempts failed
    console.warn('⚠️ pHash: All retry attempts failed, skipping cache');
    return null;
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
            console.log(`🖼️ pHash result: ${pHash ?? 'FAILED (null) — cache will be skipped'}`);

            const cacheHit = pHash
                ? await findSimilarAnalysisByHash(pHash, uploadedImageUrl)
                : null;

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

                            // Update cache with bbox data (only if pHash is valid)
                            if (pHash) cacheAnalysisResult(pHash!, enrichedResult, undefined, blobToPass);

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

            } catch (compressionErr) {
                // Silently handle compression failure
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

                    // Cache the fully enriched result (only if pHash is valid)
                    if (pHash) cacheAnalysisResult(pHash!, enrichedResult, uploadedImageUrl, finalImageBlobToCache);
                }).catch(enrichmentError => {
                    // Still cache the fast result even if enrichment fails
                    if (pHash) cacheAnalysisResult(pHash!, fastResult, uploadedImageUrl, finalImageBlobToCache);
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
        options: { editedImageDataUri?: string | null; userId?: string; slug?: string } = {}
    ): Promise<{ originalImageUrl: string; finalImageUrl: string }> => {
        if (!originalImagePreview) {
            throw new Error("Cannot upload to cart: original image is missing.");
        }

        // Helper to check if string is a Supabase public URL or similar permanent storage URL
        const isPermanentUrl = (str: string) => {
            if (!str) return false;
            return str.startsWith('http') && (str.includes('supabase.co') || str.includes('genie.ph'));
        };

        // Use provided userId or fetch from auth (allows caller to cache auth)
        let userId = options.userId;
        if (!userId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error("Authentication session not found. Cannot upload images.");
            }
            userId = user.id;
        }

        const slug = options.slug;
        const storageFolder = 'customizations';

        // 1. Handle Original Image
        let originalImageUrl = originalImagePreview;
        let originalImageFileName = '';

        if (!isPermanentUrl(originalImagePreview)) {
            const originalImageBlob = dataURItoBlob(originalImagePreview);
            // Use slug if available, else random UUID
            originalImageFileName = slug
                ? `${storageFolder}/${userId}/${slug}.webp`
                : `${storageFolder}/${userId}/${uuidv4()}.webp`;

            const { error: originalUploadError } = await supabase.storage
                .from('cakegenie')
                .upload(originalImageFileName, originalImageBlob, { contentType: 'image/webp', upsert: true });

            if (originalUploadError) throw new Error(`Failed to upload original image: ${originalUploadError.message}`);

            const { data: urlData } = supabase.storage.from('cakegenie').getPublicUrl(originalImageFileName);
            if (!urlData?.publicUrl) throw new Error("Could not get original image public URL.");
            originalImageUrl = urlData.publicUrl;
        }

        // 2. Handle Edited Image
        const imageToUpload = options.editedImageDataUri !== undefined ? options.editedImageDataUri : editedImage;
        let finalImageUrl = originalImageUrl;

        if (imageToUpload && !isPermanentUrl(imageToUpload)) {
            const editedImageBlob = dataURItoBlob(imageToUpload);
            const editedImageFile = new File([editedImageBlob], 'edited-design.webp', { type: 'image/webp' });
            const compressedEditedFile = await compressImage(editedImageFile, { maxSizeMB: 1, fileType: 'image/webp' });

            const editedImageFileName = slug
                ? `${storageFolder}/${userId}/${slug}_edited.webp`
                : `${storageFolder}/${userId}/${uuidv4()}.webp`;

            const { error: editedUploadError } = await supabase.storage
                .from('cakegenie')
                .upload(editedImageFileName, compressedEditedFile, { contentType: 'image/webp', upsert: true });

            if (editedUploadError) throw new Error(`Failed to upload customized image: ${editedUploadError.message}`);

            const { data: urlData } = supabase.storage.from('cakegenie').getPublicUrl(editedImageFileName);
            if (!urlData?.publicUrl) throw new Error("Could not get customized image public URL.");
            finalImageUrl = urlData.publicUrl;
        } else if (imageToUpload && isPermanentUrl(imageToUpload)) {
            finalImageUrl = imageToUpload;
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