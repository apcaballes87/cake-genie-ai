

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
import {
    generateImageFingerprintWithLegacyCandidates,
    toFingerprintLookup,
} from '@/lib/utils/serverFingerprint.client';
import { findOrbCacheHit } from '@/services/orbMatchingService';
export { generatePerceptualHash } from '@/lib/utils/perceptualHash.client';


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

            // --- STEP 1: CHECK CACHE (FAST PATH) ---
            const uploadedImageUrl = options?.imageUrl; // Use existing URL if from web search
            let compressedImageData = imageData; // Default to original
            let finalImageBlobToCache: Blob | undefined;

            // Step 1a: Try crop-resistant ORB+RANSAC backend first (handles crops/resizes/screenshots)
            let orbCacheHit: HybridAnalysisResult | null = null;
            try {
                const matchData = await findOrbCacheHit(file);
                if (matchData) {
                    console.log(
                        '%c🎯 CACHE HIT (ORB+RANSAC)',
                        'color: #22c55e; font-weight: bold;',
                        `\nSlug: ${matchData.seoMetadata?.slug ? `"${matchData.seoMetadata.slug}"` : '(no slug)'}`,
                        `\nMatched ID: ${matchData.matchedImageId ?? 'n/a'}`,
                        `\nMatched URL: ${matchData.matchedImageUrl ?? matchData.seoMetadata?.original_image_url ?? 'n/a'}`,
                        `\nConfidence: ${(matchData.confidence * 100).toFixed(1)}%`,
                        `\nLatency: ${matchData.executionTimeMs?.toFixed(0) ?? 'n/a'}ms`,
                    );
                    orbCacheHit = matchData.analysisResult;
                } else {
                    console.log('%c⚫ CACHE MISS (ORB+RANSAC)', 'color: #94a3b8; font-weight: bold;', '— falling back to pHash lookup');
                }
            } catch (err) {
                console.warn('FastAPI backend offline, falling back to pHash matching:', err);
            }

            if (orbCacheHit) {
                onSuccess(orbCacheHit);
                return; // Skip AI entirely — exact visual match found
            }

            // Step 1b: Fallback to server pHash fingerprint lookup
            const fingerprint = await generateImageFingerprintWithLegacyCandidates(file, imageSrc);
            const pHash = fingerprint.pHash;
            console.log(`🖼️ Server pHash result: ${pHash ?? 'FAILED (null) — new cache writes will be skipped'}`);

            const cacheHit = pHash || fingerprint.legacyPHashCandidates.length > 0
                ? await findSimilarAnalysisByHash(toFingerprintLookup(fingerprint), uploadedImageUrl)
                : null;

            if (cacheHit) {
                const hitSlug = cacheHit.seoMetadata?.slug;
                console.log(
                    '%c⚡ CACHE HIT (pHash)',
                    'color: #f59e0b; font-weight: bold;',
                    `\nSlug: ${hitSlug ? `"${hitSlug}"` : '(no slug)'}`,
                    `\nURL: ${hitSlug ? `https://genie.ph/customizing/${hitSlug}` : 'n/a'}`,
                );
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

                            // Update cache with bbox data only when the authoritative server pHash is available.
                            if (pHash) {
                                cacheAnalysisResult(pHash, enrichedResult, undefined, blobToPass, {
                                    fingerprintPipeline: fingerprint.pipeline,
                                });
                            }

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

            console.log('%c⚫ CACHE MISS (all methods)', 'color: #94a3b8; font-weight: bold;', '— running Gemini AI analysis');

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
                    if (pHash) {
                        cacheAnalysisResult(pHash, enrichedResult, uploadedImageUrl, finalImageBlobToCache, {
                            fingerprintPipeline: fingerprint.pipeline,
                        }).then(async (cacheResult) => {
                            if (cacheResult?.slug) {
                                console.log(
                                    '%c💾 NEW ROW CREATED (cakegenie_analysis_cache)',
                                    'color: #818cf8; font-weight: bold;',
                                    `\nSlug: "${cacheResult.slug}"`,
                                    `\nURL: https://genie.ph/customizing/${cacheResult.slug}`,
                                    `\nPrice: ₱${cacheResult.price?.toLocaleString() ?? 'n/a'}`,
                                );
                            }
                            // Also index into crop-resistant ORB backend (fire-and-forget)
                            const cacheId = cacheResult?.storedPHash;
                            if (cacheId) {
                                try {
                                    const formDataIdx = new FormData();
                                    formDataIdx.append('cache_id', cacheId);
                                    formDataIdx.append('file', file);
                                    await fetch('http://localhost:8000/api/index', {
                                        method: 'POST',
                                        body: formDataIdx,
                                    });
                                    console.log('%c🔎 ORB features indexed', 'color: #818cf8;', `for slug "${cacheResult?.slug}"`);
                                } catch (idxErr) {
                                    console.warn('Failed to index image features (backend might be offline):', idxErr);
                                }
                            }
                        });
                    }
                }).catch(enrichmentError => {
                    console.warn('⚠️ Coordinate enrichment failed, caching fast result instead:', enrichmentError);
                    // Still cache the fast result even if enrichment fails
                    if (pHash) {
                        cacheAnalysisResult(pHash, fastResult, uploadedImageUrl, finalImageBlobToCache, {
                            fingerprintPipeline: fingerprint.pipeline,
                        }).then(async (cacheResult) => {
                            if (cacheResult?.slug) {
                                console.log(
                                    '%c💾 NEW ROW CREATED (cakegenie_analysis_cache — fast result)',
                                    'color: #818cf8; font-weight: bold;',
                                    `\nSlug: "${cacheResult.slug}"`,
                                    `\nURL: https://genie.ph/customizing/${cacheResult.slug}`,
                                    `\nPrice: ₱${cacheResult.price?.toLocaleString() ?? 'n/a'}`,
                                );
                            }
                            const cacheId = cacheResult?.storedPHash;
                            if (cacheId) {
                                try {
                                    const formDataIdx = new FormData();
                                    formDataIdx.append('cache_id', cacheId);
                                    formDataIdx.append('file', file);
                                    await fetch('http://localhost:8000/api/index', {
                                        method: 'POST',
                                        body: formDataIdx,
                                    });
                                    console.log('%c🔎 ORB features indexed (fast-result fallback)', 'color: #818cf8;', `for slug "${cacheResult?.slug}"`);
                                } catch (idxErr) {
                                    console.warn('Failed to index image features (backend might be offline):', idxErr);
                                }
                            }
                        });
                    }
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
