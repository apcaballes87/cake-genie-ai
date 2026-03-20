'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, type SetStateAction } from 'react'
import { usePathname } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { toast as toastHot } from 'react-hot-toast'
import { fileToBase64, validateCakeImage, analyzeCakeFeaturesOnly, enrichAnalysisWithRoboflow } from '@/services/geminiService'
import { createClient } from '@/lib/supabase/client'
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization'
import { showSuccess, showError, showLoading } from '@/lib/utils/toast'
import { HybridAnalysisResult, CacheSEOMetadata } from '@/types'
import { findSimilarAnalysisByHash, cacheAnalysisResult } from '@/services/supabaseService'
import { hasBoundingBoxData } from '@/lib/utils/analysisUtils'
import { COMMON_ASSETS } from '@/constants'
import { generateCakeAnalysisSlug } from '@/lib/utils/urlHelpers'

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

interface ImageContextType {
    originalImageData: { data: string; mimeType: string } | null;
    sourceImageData: { data: string; mimeType: string } | null;
    previousImageData: { data: string; mimeType: string } | null;
    originalImagePreview: string | null;
    editedImage: string | null;
    threeTierReferenceImage: { data: string; mimeType: string } | null;
    isLoading: boolean;
    error: string | null;
    currentSlug: string | null;
    setEditedImage: (image: string | null) => void;
    setError: (error: string | null) => void;
    setIsLoading: (isLoading: boolean) => void;
    setOriginalImageData: (data: { data: string; mimeType: string } | null) => void;
    setPreviousImageData: (data: { data: string; mimeType: string } | null) => void;
    setCurrentSlug: (slug: string | null) => void;
    handleImageUpload: (
        file: File,
        onSuccess: (result: HybridAnalysisResult) => void,
        onError: (error: Error) => void,
        options?: HandleImageUploadOptions
    ) => Promise<void>;
    loadImageWithoutAnalysis: (imageUrl: string, options?: LoadImageWithoutAnalysisOptions) => Promise<{ data: string; mimeType: string }>;
    handleSave: () => Promise<void>;
    uploadCartImages: (options?: { editedImageDataUri?: string | null; userId?: string; slug?: string }) => Promise<{ originalImageUrl: string; finalImageUrl: string }>;
    clearImages: () => void;
    seoMetadata: CacheSEOMetadata | null;
    isAnalysisCached: boolean;
}

interface HandleImageUploadOptions {
    imageUrl?: string;
    onCoordinatesEnriched?: (result: HybridAnalysisResult) => void;
    precomputedAnalysis?: HybridAnalysisResult;
    knownSeoMetadata?: CacheSEOMetadata;
}

interface LoadImageWithoutAnalysisOptions {
    fileName?: string;
    fallbackMimeType?: string;
    knownSeoMetadata?: CacheSEOMetadata;
    errorMessage?: string;
    preferProxy?: boolean;
    directTimeoutMs?: number;
    proxyTimeoutMs?: number;
}

const ImageContext = createContext<ImageContextType | null>(null)

export function ImageProvider({ children }: { children: React.ReactNode }) {
    const supabase = createClient();
    const pathname = usePathname();
    const shouldDeferImageBootstrap = pathname === '/';

    // State
    const [originalImageData, setOriginalImageDataRaw] = useState<{ data: string; mimeType: string } | null>(null);
    const [sourceImageData, setSourceImageData] = useState<{ data: string; mimeType: string } | null>(null); // True original, never overwritten
    const [previousImageData, setPreviousImageData] = useState<{ data: string; mimeType: string } | null>(null); // For undo functionality
    const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);

    // Wrap setOriginalImageData to keep originalImagePreview in sync
    const setOriginalImageData = useCallback((update: SetStateAction<{ data: string; mimeType: string } | null>) => {
        setOriginalImageDataRaw(prev => {
            const next = typeof update === 'function' ? update(prev) : update;
            setOriginalImagePreview(next ? `data:${next.mimeType};base64,${next.data}` : null);
            return next;
        });
    }, []);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [threeTierReferenceImage, setThreeTierReferenceImage] = useState<{ data: string; mimeType: string } | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [currentSlug, setCurrentSlugState] = useState<string | null>(null);
    const [seoMetadata, setSeoMetadata] = useState<CacheSEOMetadata | null>(null);
    const [isAnalysisCached, setIsAnalysisCached] = useState<boolean>(false);
    const persistedImageStateRef = React.useRef<{
        original: string | null;
        source: string | null;
        edited: string | null;
        slug: string | null;
    }>({
        original: null,
        source: null,
        edited: null,
        slug: null,
    });
    const hasInMemoryImageState = !!(originalImageData || sourceImageData || editedImage || currentSlug);

    // Fetch 3-tier reference image on mount
    useEffect(() => {
        if (shouldDeferImageBootstrap || threeTierReferenceImage) return;

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
    }, [shouldDeferImageBootstrap, threeTierReferenceImage]);

    const clearImages = useCallback(() => {
        setOriginalImageData(null);
        setSourceImageData(null);
        setPreviousImageData(null);
        setEditedImage(null);
        setError(null);
        setIsLoading(false);
        setCurrentSlugState(null);
        setSeoMetadata(null);
        setIsAnalysisCached(false);
        persistedImageStateRef.current = {
            original: null,
            source: null,
            edited: null,
            slug: null,
        };

        // Clear IndexedDB
        import('@/lib/utils/storage').then(({ clearIndexedDB }) => {
            clearIndexedDB();
        });
    }, []);

    // Set current slug and clear images if slug changed (prevents stale image persistence)
    const setCurrentSlug = useCallback((newSlug: string | null) => {
        setCurrentSlugState(prevSlug => {
            // If slug is changing to a different value, clear persisted images
            if (prevSlug !== null && newSlug !== null && prevSlug !== newSlug) {
                // Clear state immediately
                setOriginalImageData(null);
                setSourceImageData(null);
                setPreviousImageData(null);
                setEditedImage(null);
                persistedImageStateRef.current = {
                    original: null,
                    source: null,
                    edited: null,
                    slug: null,
                };
                // Clear persistence
                import('@/lib/utils/storage').then(({ clearIndexedDB }) => {
                    clearIndexedDB();
                });
            }
            return newSlug;
        });
    }, []);

    // --- Persistence Logic ---
    useEffect(() => {
        if (shouldDeferImageBootstrap || hasInMemoryImageState) return;

        const loadImages = async () => {
            try {
                const { getFromIndexedDB } = await import('@/lib/utils/storage');
                const [original, source, edited, storedSlug] = await Promise.all([
                    getFromIndexedDB('originalImageData'),
                    getFromIndexedDB('sourceImageData'),
                    getFromIndexedDB('editedImage'),
                    getFromIndexedDB('imageSlug')
                ]);

                persistedImageStateRef.current = {
                    original: original || null,
                    source: source || null,
                    edited: edited || null,
                    slug: storedSlug || null,
                };

                // Store the slug that was persisted so we can compare later
                if (storedSlug) {
                    setCurrentSlugState(storedSlug);
                }

                if (original) {
                    const parsed = JSON.parse(original);
                    setOriginalImageData(parsed);
                }
                if (source) setSourceImageData(JSON.parse(source));
                if (edited) setEditedImage(edited);
            } catch (err) {
                // Silently handle persistence load error
            }
        };
        loadImages();
    }, [shouldDeferImageBootstrap, hasInMemoryImageState]);

    useEffect(() => {
        if (shouldDeferImageBootstrap) return;

        const saveImages = async () => {
            const { saveToIndexedDB, removeFromIndexedDB } = await import('@/lib/utils/storage');
            const serializedOriginal = originalImageData ? JSON.stringify(originalImageData) : null;
            const serializedSource = sourceImageData ? JSON.stringify(sourceImageData) : null;
            const nextPersistedState = {
                original: serializedOriginal,
                source: serializedSource,
                edited: editedImage,
                slug: currentSlug,
            };
            const operations: Promise<void>[] = [];

            if (nextPersistedState.original !== persistedImageStateRef.current.original) {
                operations.push(
                    nextPersistedState.original
                        ? saveToIndexedDB('originalImageData', nextPersistedState.original)
                        : removeFromIndexedDB('originalImageData')
                );
            }

            if (nextPersistedState.source !== persistedImageStateRef.current.source) {
                operations.push(
                    nextPersistedState.source
                        ? saveToIndexedDB('sourceImageData', nextPersistedState.source)
                        : removeFromIndexedDB('sourceImageData')
                );
            }

            if (nextPersistedState.edited !== persistedImageStateRef.current.edited) {
                operations.push(
                    nextPersistedState.edited
                        ? saveToIndexedDB('editedImage', nextPersistedState.edited)
                        : removeFromIndexedDB('editedImage')
                );
            }

            if (nextPersistedState.slug !== persistedImageStateRef.current.slug) {
                operations.push(
                    nextPersistedState.slug
                        ? saveToIndexedDB('imageSlug', nextPersistedState.slug)
                        : removeFromIndexedDB('imageSlug')
                );
            }

            if (operations.length === 0) return;

            await Promise.all(operations);
            persistedImageStateRef.current = nextPersistedState;
        };
        saveImages();
    }, [originalImageData, sourceImageData, editedImage, currentSlug, shouldDeferImageBootstrap]);

    const handleImageUpload = useCallback(async (
        file: File,
        onSuccess: (result: HybridAnalysisResult) => void,
        onError: (error: Error) => void,
        options?: HandleImageUploadOptions
    ) => {
        setIsLoading(true); // For file processing
        setError(null);
        
        // --- PREVENT FLICKERING: Clear old image states immediately ---
        setEditedImage(null);
        setPreviousImageData(null);
        setOriginalImagePreview(null);
        
        // Clear stale slug and seoMetadata from any previous upload
        // so the share button won't show an old link
        setCurrentSlugState(null);
        setSeoMetadata(null);
        setIsAnalysisCached(false);
        try {
            const imageData = await fileToBase64(file);
            const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;
            setOriginalImageData(imageData);
            setSourceImageData(imageData); // Store the true original that will never be overwritten
            setIsLoading(false); // File processing done

            const knownSeoMetadata = options?.knownSeoMetadata ?? null;

            if (knownSeoMetadata) {
                setSeoMetadata(knownSeoMetadata);

                if (knownSeoMetadata.slug) {
                    setCurrentSlugState(knownSeoMetadata.slug);
                }
            }

            // --- STEP 0: CHECK PRECOMPUTED ANALYSIS ---
            if (options?.precomputedAnalysis) {
                setIsAnalysisCached(true);
                onSuccess(options.precomputedAnalysis);
                return;
            }

            // --- STEP 1: COMPRESS IMAGE + pHash CACHE LOOKUP (in parallel) ---
            // Compression and pHash generation run concurrently to minimize latency.
            // IMPORTANT: Validation MUST happen before we honour any cache hit —
            // a pHash collision could otherwise return a cached result for an image
            // that should be rejected (e.g. multiple cakes → Stranger Things cake bug).
            let uploadedImageUrl = options?.imageUrl; // Use existing URL if from web search
            let compressedImageData = imageData; // Default to original
            let finalImageBlobToCache: Blob | undefined;

            // Compress first — we need compressed data for both validation and pHash
            try {
                const imageBlob = dataURItoBlob(imageSrc);
                const fileToUpload = new File([imageBlob], file.name, { type: file.type });
                finalImageBlobToCache = fileToUpload; // Default

                const compressedFile = await compressImage(fileToUpload, {
                    maxSizeMB: 0.5,
                    maxWidthOrHeight: 1024,
                    fileType: 'image/webp',
                });
                finalImageBlobToCache = compressedFile;

                // Convert compressed file to base64 for AI
                compressedImageData = await fileToBase64(compressedFile);

                // Fallback resizing — guarantees we never send a massive payload to Gemini
                if (compressedImageData.data.length > 2 * 1024 * 1024) { // > ~1.5MB base64
                    try {
                        const img = new Image();
                        img.src = imageSrc;
                        await new Promise((resolve) => { img.onload = resolve; });

                        const canvas = document.createElement('canvas');
                        const MAX_DIMENSION = 1024;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_DIMENSION) { height *= MAX_DIMENSION / width; width = MAX_DIMENSION; }
                        } else {
                            if (height > MAX_DIMENSION) { width *= MAX_DIMENSION / height; height = MAX_DIMENSION; }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0, width, height);

                        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        compressedImageData = { data: resizedDataUrl.split(',')[1], mimeType: 'image/jpeg' };
                    } catch (resizeErr) {
                        // Silently handle resize failure
                    }
                }
            } catch (compressionErr) {
                // Silently handle compression failure — continue with original imageData
            }

            // --- STEP 2: VALIDATE + pHash LOOKUP IN PARALLEL ---
            // Run image validation and cache lookup simultaneously.
            // Validation result gates the cache hit — a rejected image must NEVER
            // return a cached result, even if pHash collides with a valid cached entry.
            const pHash = await generatePerceptualHash(imageSrc);
            console.log(`🔍 Starting pHash cache lookup for hash: ${pHash}`);
            const shouldUseSimilarCacheLookup = !knownSeoMetadata;

            const [validationClassification, cacheHitRaw] = await Promise.all([
                // Validation — always runs, even on potential cache hits
                validateCakeImage(compressedImageData.data, compressedImageData.mimeType).catch(() => 'valid_single_cake' as const),
                // Cache lookup — only when not using known SEO metadata
                shouldUseSimilarCacheLookup
                    ? findSimilarAnalysisByHash(pHash, options?.imageUrl)
                    : Promise.resolve(null),
            ]);

            // Gate: reject invalid images before honouring cache or running AI
            const rejectionMessages: Record<string, string> = {
                not_a_cake: "This image doesn't appear to be a cake. Please upload a cake image.",
                non_food: "This image doesn't appear to be a cake. Please upload a cake image.",
                multiple_cakes: "Please upload a single cake image. This image contains multiple cakes.",
                only_cupcakes: "We currently don't process cupcake-only images. Please upload a cake design.",
                complex_sculpture: "This cake design is too complex for online pricing. Please contact us for a custom quote.",
                large_wedding_cake: "Large wedding cakes require in-store consultation for accurate pricing.",
            };

            if (validationClassification !== 'valid_single_cake') {
                const message = rejectionMessages[validationClassification] ?? "This image is not suitable for processing. Please upload a valid cake image.";
                console.log(`🚫 Validation rejected image: ${validationClassification}`);
                onError(new Error(message));
                return;
            }

            // Validation passed — honour cache hit if present
            const cacheHit = cacheHitRaw;

            if (cacheHit) {
                console.log(`✅ pHash Cache HIT! Found matching analysis for hash: ${pHash}`);
            } else if (shouldUseSimilarCacheLookup) {
                console.log('⚫️ Cache MISS. No matching pHash found in database.');
            }

            // --- PROCESS CACHE HIT (IF ANY) ---
            if (cacheHit) {
                const cachedAnalysis = cacheHit.analysisResult;
                setSeoMetadata(cacheHit.seoMetadata);

                // Set slug from cache so share button has access to it
                if (cacheHit.seoMetadata.slug) {
                    setCurrentSlugState(cacheHit.seoMetadata.slug);
                }
                setIsAnalysisCached(true);

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
                            await cacheAnalysisResult(pHash, enrichedResult, undefined, blobToPass);
                            setIsAnalysisCached(true);

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
            // --- END OF COMPRESSION LOGIC AND CACHE CHECKS ---

            // --- STEP 3: TWO-PHASE AI ANALYSIS ---


            try {
                // PHASE 1: Fast feature-only analysis with v3.2 prompt (coordinates all 0,0)
                const fastResult = await analyzeCakeFeaturesOnly(
                    compressedImageData.data,
                    compressedImageData.mimeType
                );

                onSuccess(fastResult); // User can now see features and price immediately!

                // Generate slug immediately so share button works right away,
                // but preserve the exact slug for known products/designs.
                if (knownSeoMetadata?.slug) {
                    setCurrentSlugState(knownSeoMetadata.slug);
                } else {
                    const icingColor = fastResult.icing_design?.colors?.top || fastResult.icing_design?.colors?.side || null;
                    const generatedSlug = generateCakeAnalysisSlug({
                        keyword: fastResult.keyword,
                        icingColor,
                        cakeType: fastResult.cakeType,
                        pHash,
                    });
                    setCurrentSlugState(generatedSlug);
                }

                // PHASE 2: Background coordinate enrichment with Roboflow + Florence-2
                // (Falls back to Gemini if Roboflow fails or is disabled)
                enrichAnalysisWithRoboflow(
                    compressedImageData.data,
                    compressedImageData.mimeType,
                    fastResult
                ).then(async enrichedResult => {
                    // Notify the UI to update with enriched coordinates
                    if (options?.onCoordinatesEnriched) {
                        options.onCoordinatesEnriched(enrichedResult);
                    }

                    await cacheAnalysisResult(pHash, enrichedResult, uploadedImageUrl, finalImageBlobToCache);
                    console.log(`✅ Analysis result cached successfully with pHash: ${pHash}`);
                    setIsAnalysisCached(true);
                }).catch(async enrichmentError => {
                    // Still cache the fast result even if enrichment fails
                    await cacheAnalysisResult(pHash, fastResult, uploadedImageUrl, finalImageBlobToCache);
                    console.log(`✅ Analysis result (fast profile) cached successfully with pHash: ${pHash}`);
                    setIsAnalysisCached(true);
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

    const loadImageWithoutAnalysis = useCallback(async (imageUrl: string, options?: LoadImageWithoutAnalysisOptions) => {
        setIsLoading(true);
        setError(null);
        // --- PREVENT FLICKERING: Clear old image states immediately ---
        setEditedImage(null);
        setPreviousImageData(null);
        setOriginalImagePreview(null);
        setSeoMetadata(null);
        setCurrentSlugState(null);
        try {
            const fetchWithTimeout = async (targetUrl: string, timeoutMs: number) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                try {
                    const response = await fetch(targetUrl, { signal: controller.signal });
                    if (!response.ok) {
                        throw new Error(`Failed to fetch image (status: ${response.status}).`);
                    }

                    return response;
                } finally {
                    clearTimeout(timeoutId);
                }
            };

            let blob: Blob | null = null;

            if (!options?.preferProxy) {
                try {
                    const response = await fetchWithTimeout(imageUrl, options?.directTimeoutMs ?? 8000);
                    blob = await response.blob();
                } catch {
                    blob = null;
                }
            }

            if (!blob) {
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
                const response = await fetchWithTimeout(proxyUrl, options?.proxyTimeoutMs ?? 15000);
                blob = await response.blob();
            }

            if (blob.type && !blob.type.startsWith('image/') && !blob.type.startsWith('application/octet-stream')) {
                throw new Error('Fetched content is not an image. The proxy may have failed.');
            }
            const file = new File(
                [blob],
                options?.fileName || 'shopify-product-image.webp',
                { type: options?.fallbackMimeType || blob.type || 'image/webp' }
            );

            const imageData = await fileToBase64(file);
            setOriginalImageData(imageData);
            setSourceImageData(imageData); // Store the true original that will never be overwritten

            if (options?.knownSeoMetadata) {
                setSeoMetadata(options.knownSeoMetadata);

                if (options.knownSeoMetadata.slug) {
                    setCurrentSlugState(options.knownSeoMetadata.slug);
                    setIsAnalysisCached(true);
                }
            }

            return imageData;
        } catch (err) {
            let errorMessage = options?.errorMessage || 'Could not load product image.';
            if (err instanceof Error) {
                errorMessage = !options?.errorMessage && err.name === 'AbortError'
                    ? 'Image loading timed out. Please try again.'
                    : errorMessage;
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
            const watermarkUrl = COMMON_ASSETS.watermark;

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

    const value = useMemo(() => ({
        originalImageData,
        sourceImageData,
        previousImageData,
        originalImagePreview,
        editedImage,
        threeTierReferenceImage,
        isLoading,
        error,
        currentSlug,
        setEditedImage,
        setError,
        setIsLoading,
        setOriginalImageData,
        setPreviousImageData,
        setCurrentSlug,
        handleImageUpload,
        loadImageWithoutAnalysis,
        handleSave,
        uploadCartImages,
        clearImages,
        seoMetadata,
        isAnalysisCached,
    }), [
        originalImageData,
        sourceImageData,
        previousImageData,
        originalImagePreview,
        editedImage,
        threeTierReferenceImage,
        isLoading,
        error,
        currentSlug,
        setCurrentSlug,
        handleImageUpload,
        loadImageWithoutAnalysis,
        handleSave,
        uploadCartImages,
        clearImages,
        seoMetadata,
        isAnalysisCached,
    ]);

    return (
        <ImageContext.Provider value={value}>
            {children}
        </ImageContext.Provider>
    )
}

export function useImageContext() {
    const context = useContext(ImageContext)
    if (!context) {
        throw new Error('useImageContext must be used within ImageProvider')
    }
    return context
}

// Also export as useImageManagement for backward compatibility
export const useImageManagement = useImageContext
