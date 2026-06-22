'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, type SetStateAction } from 'react'
import { usePathname } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { toast as toastHot } from 'react-hot-toast'
import { fileToBase64, analyzeCakeFeaturesOnly, enrichAnalysisWithRoboflow, triggerStudioEditFromUpload } from '@/services/geminiService'
import { createClient } from '@/lib/supabase/client'
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization'
import { showSuccess, showError, showLoading, showStatus } from '@/lib/utils/toast'
import { HybridAnalysisResult, CacheSEOMetadata } from '@/types'
import { findSimilarAnalysisByHash, cacheAnalysisResult } from '@/services/supabaseService'
import { hasBoundingBoxData } from '@/lib/utils/analysisUtils'
import { COMMON_ASSETS } from '@/constants'
import { generateCakeAnalysisSlug } from '@/lib/utils/urlHelpers'
import {
    generateServerImageFingerprint,
    toFingerprintLookup,
    type ClientImageFingerprint,
} from '@/lib/utils/serverFingerprint.client'
import { FEATURE_FLAGS } from '@/config/features'

const fetchImageAsBase64 = async (url: string): Promise<{ data: string; mimeType: string }> => {
    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/webp';
    const arrayBuffer = await blob.arrayBuffer();
    
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = window.btoa(binary);
    return { data: base64Data, mimeType };
};

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
    currentPHash: string | null;
    currentCacheId: string | null;
    loadedImageUrl: string | null;
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
    isComposingSelfie: boolean;
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
    const [isComposingSelfie, setIsComposingSelfie] = useState<boolean>(false);

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
    const [currentPHash, setCurrentPHash] = useState<string | null>(null);
    const [currentCacheId, setCurrentCacheId] = useState<string | null>(null);
    const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
    const [seoMetadata, setSeoMetadata] = useState<CacheSEOMetadata | null>(null);
    const [isAnalysisCached, setIsAnalysisCached] = useState<boolean>(false);
    const persistedImageStateRef = React.useRef<{
        original: string | null;
        source: string | null;
        edited: string | null;
        slug: string | null;
        loadedImageUrl: string | null;
    }>({
        original: null,
        source: null,
        edited: null,
        slug: null,
        loadedImageUrl: null,
    });
    const hasInMemoryImageState = !!(originalImageData || sourceImageData || editedImage || currentSlug || loadedImageUrl);

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
        setLoadedImageUrl(null);
        setError(null);
        setIsLoading(false);
        setCurrentSlugState(null);
        setCurrentPHash(null);
        setCurrentCacheId(null);
        setSeoMetadata(null);
        setIsAnalysisCached(false);
        setIsComposingSelfie(false);
        persistedImageStateRef.current = {
            original: null,
            source: null,
            edited: null,
            slug: null,
            loadedImageUrl: null,
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
                setLoadedImageUrl(null);
                setCurrentCacheId(null);
                persistedImageStateRef.current = {
                    original: null,
                    source: null,
                    edited: null,
                    slug: null,
                    loadedImageUrl: null,
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

        // When arriving via a ref param (e.g. new upload from landing page),
        // skip restoring old images from IndexedDB — the ref handler will
        // load the new image instead.
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('ref') || urlParams.get('source') === 'shopify_cse') {
                return;
            }
        }

        const loadImages = async () => {
            try {
                const { getFromIndexedDB } = await import('@/lib/utils/storage');
                const [original, source, edited, storedSlug, storedLoadedImageUrl] = await Promise.all([
                    getFromIndexedDB('originalImageData'),
                    getFromIndexedDB('sourceImageData'),
                    getFromIndexedDB('editedImage'),
                    getFromIndexedDB('imageSlug'),
                    getFromIndexedDB('loadedImageUrl')
                ]);

                persistedImageStateRef.current = {
                    original: original || null,
                    source: source || null,
                    edited: edited || null,
                    slug: storedSlug || null,
                    loadedImageUrl: storedLoadedImageUrl || null,
                };

                // Store the slug that was persisted so we can compare later
                if (storedSlug) {
                    setCurrentSlugState(storedSlug);
                }

                if (storedLoadedImageUrl) {
                    setLoadedImageUrl(storedLoadedImageUrl);
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
                loadedImageUrl: loadedImageUrl,
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

            if (nextPersistedState.loadedImageUrl !== persistedImageStateRef.current.loadedImageUrl) {
                operations.push(
                    nextPersistedState.loadedImageUrl
                        ? saveToIndexedDB('loadedImageUrl', nextPersistedState.loadedImageUrl)
                        : removeFromIndexedDB('loadedImageUrl')
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

        // Dismiss all active toasts (including any page-level loading messages) to ensure a clean transition
        toastHot.dismiss();

        // --- PREVENT FLICKERING: Clear old image states immediately ---
        setEditedImage(null);
        setPreviousImageData(null);
        setOriginalImagePreview(null);

        // Clear stale slug and seoMetadata from any previous upload
        // so the share button won't show an old link
        setCurrentSlugState(null);
        setCurrentPHash(null);
        setCurrentCacheId(null);
        setSeoMetadata(null);
        setIsAnalysisCached(false);
        setIsComposingSelfie(false);
        try {
            const imageData = await fileToBase64(file);
            const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;
            setOriginalImageData(imageData);
            setSourceImageData(imageData); // Store the true original that will never be overwritten
            setLoadedImageUrl(options?.imageUrl || null);
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
            const uploadedImageUrl = options?.imageUrl; // Use existing URL if from web search
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

                // Fallback resize — extra-large images (rare with our 0.5MB/1024 target) get a
                // tighter retry through compressImage. Avoids the previous canvas + JPEG re-encode
                // path, which decoded the original full-size file a second time.
                if (compressedImageData.data.length > 2 * 1024 * 1024) { // > ~1.5MB base64
                    try {
                        const tightFile = await compressImage(compressedFile, {
                            maxSizeMB: 0.4,
                            maxWidthOrHeight: 1024,
                            fileType: 'image/webp',
                        });
                        finalImageBlobToCache = tightFile;
                        compressedImageData = await fileToBase64(tightFile);
                    } catch (resizeErr) {
                        // Silently handle resize failure
                    }
                }
            } catch (compressionErr) {
                // Silently handle compression failure — continue with original imageData
            }

            // --- STEP 2: SINGLE SERVER FINGERPRINT LOOKUP ---
            // The standalone Gemini validate call has been removed because the analyzer in
            // STEP 3 already returns `rejection.isRejected` with the same labels and
            // human-readable messages, and cache hits come from rows that were already
            // validated when they were first analyzed.
            // Single in-place updating toast — feels faster than 3 dismiss+show cycles.
            const uploadToastId = 'upload-progress';
            const showProgressToast = (message: string, durationMs?: number) => {
                showStatus(message, { id: uploadToastId, duration: durationMs ?? 30000 });
            };
            showProgressToast('Checking your image…');

            let cacheHit = null;
            let fingerprint: ClientImageFingerprint | null = null;
            let pHash: string | null = null;

            // Generate canonical server fingerprint using the Sharp dHash pipeline.
            fingerprint = await generateServerImageFingerprint(
                finalImageBlobToCache ?? file
            );
            pHash = fingerprint.pHash;
            console.log(
                `🔍 Server pHash result: ${pHash
                    ? pHash
                    : `FAILED (${fingerprint.error || 'unknown error'}) — new cache writes will be skipped`}`
            );

            const shouldUseSimilarCacheLookup = !knownSeoMetadata && pHash !== null;

            if (shouldUseSimilarCacheLookup) {
                const cacheHitRaw = await findSimilarAnalysisByHash(toFingerprintLookup(fingerprint), options?.imageUrl);
                if (cacheHitRaw) {
                    showProgressToast('We found your cake photo! 🎉', 3000);
                    cacheHit = cacheHitRaw;
                    console.log(`✅ pHash Cache HIT! Found matching analysis for hash: ${pHash}`);
                } else {
                    showProgressToast('Analyzing your design with AI…', 15000);
                    console.log('⚫️ Cache MISS. No matching pHash found in database.');
                }
            } else {
                showProgressToast('Analyzing your design with AI…', 15000);
            }

            // --- PROCESS CACHE HIT (IF ANY) ---
            if (cacheHit) {
                const cachedAnalysis = cacheHit.analysisResult;
                setCurrentCacheId(cacheHit.id ?? null);
                setCurrentPHash(cacheHit.pHash || null);
                setSeoMetadata(cacheHit.seoMetadata ?? null);

                // Set slug from cache so share button has access to it
                if (cacheHit.seoMetadata?.slug) {
                    setCurrentSlugState(cacheHit.seoMetadata.slug);
                }
                setIsAnalysisCached(true);

                onSuccess(cachedAnalysis);

                // Check if cached result has bbox data
                const hasBbox = hasBoundingBoxData(cachedAnalysis);

                if (!hasBbox && FEATURE_FLAGS.USE_ROBOFLOW_COORDINATES) {

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

                            // On a confirmed cache hit, keep enrichment in-memory only.
                            // Rewriting through cacheAnalysisResult() can split the hit into
                            // a second row when the incoming fingerprint is "similar enough"
                            // for lookup but not strict enough for write-time dedupe.
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
                const parallelStudioTriggerPromise =
                    pHash
                        ? triggerStudioEditFromUpload(pHash, compressedImageData)
                        : null;

                // PHASE 1: Fast feature-only analysis with v3.2 prompt (coordinates all 0,0)
                const fastResult = await analyzeCakeFeaturesOnly(
                    compressedImageData.data,
                    compressedImageData.mimeType
                );

                if (fastResult.rejection && fastResult.rejection.isRejected && fastResult.rejection.reason === 'selfie') {
                    showStatus('Selfie detected! Loading your edible photo cake... 🎂', { id: uploadToastId, duration: 15000 });
                    try {
                        const baseCakeUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/cold-caking/6in-1layer-cake.webp';
                        const baseCakeImage = await fetchImageAsBase64(baseCakeUrl);

                        // Show the placeholder cake immediately so the user is not staring
                        // at a loading bar while the AI composite runs (which can take 30-60s).
                        // The composite is kicked off in the background; on success we silently
                        // swap editedImage/originalImageData to the result.
                        const placeholderSrc = `data:${baseCakeImage.mimeType};base64,${baseCakeImage.data}`;
                        setIsComposingSelfie(true);
                        setEditedImage(placeholderSrc);
                        setOriginalImageData(baseCakeImage);

                        // Synthesize a valid HybridAnalysisResult for the edible photo cake.
                        // We call onSuccess NOW (with the placeholder) so the user transitions
                        // to the customizing workspace without waiting for the composite.
                        const synthesizedResult: HybridAnalysisResult = {
                            cakeType: '1 Tier',
                            cakeThickness: '4 in',
                            main_toppers: [
                                {
                                    x: 0,
                                    y: 0,
                                    type: 'edible_photo_top',
                                    material: 'waferpaper',
                                    group_id: 'selfie_photo_print',
                                    classification: 'hero',
                                    size: 'medium',
                                    quantity: 1,
                                    description: 'Edible photo of human portrait'
                                }
                            ],
                            support_elements: [],
                            cake_messages: [],
                            icing_design: {
                                base: 'soft_icing',
                                color_type: 'single',
                                colors: {
                                    top: '#FFFFFF',
                                    side: '#FFFFFF'
                                },
                                drip: false,
                                border_top: true,
                                border_base: true,
                                gumpasteBaseBoard: false
                            },
                            keyword: 'Edible Photo',
                            alt_text: 'Personalized edible photo cake featuring custom portrait print',
                            seo_title: 'Custom Edible Photo Birthday Cake Cebu | Genie.ph',
                            seo_description: 'A beautiful custom edible photo cake featuring a personalized printed portrait top. Made with premium soft icing in Cebu.',
                            rejection: {
                                isRejected: false,
                                reason: '',
                                message: ''
                            }
                        };

                        toastHot.dismiss(uploadToastId);
                        onSuccess(synthesizedResult);

                        // Fire-and-forget background composite. The user is already in the
                        // customizing workspace — on completion we silently swap the
                        // placeholder for the composite; on failure we surface a soft
                        // toast and let them re-upload if they want a fresh composite.
                        void (async () => {
                            try {
                                const compositeResponse = await fetch('/api/ai/cold-cake-edit', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        baseImage: baseCakeImage,
                                        overlayImage: compressedImageData,
                                    }),
                                });

                                if (!compositeResponse.ok) {
                                    if (compositeResponse.status === 429) {
                                        showError("We're getting a lot of cake designs right now 🍰 — please try uploading your selfie again in a moment.");
                                    } else {
                                        showError("Couldn't add your photo to the cake. Please try uploading your selfie again.");
                                    }
                                    return;
                                }

                                const compositeResult = await compositeResponse.json();
                                const compositeSrc = `data:${compositeResult.mimeType};base64,${compositeResult.imageData}`;
                                setEditedImage(compositeSrc);
                                setOriginalImageData({
                                    data: compositeResult.imageData,
                                    mimeType: compositeResult.mimeType,
                                });
                            } catch (err) {
                                console.error('Background selfie composite failed:', err);
                                showError("Couldn't add your photo to the cake. Please try uploading your selfie again.");
                            } finally {
                                setIsComposingSelfie(false);
                            }
                        })();

                        return;
                    } catch (setupErr) {
                        // Failed to even fetch the placeholder cake (network/storage issue).
                        // Fall back to the standard rejection so the user is not left
                        // without feedback.
                        console.error('Selfie placeholder setup failed:', setupErr);
                        toastHot.dismiss(uploadToastId);
                        throw new Error('This image doesn\'t appear to be a cake. Please upload a cake image.');
                    }
                }

                // Clean up the active analysis toast
                toastHot.dismiss(uploadToastId);

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

                const studioTriggerStarted = parallelStudioTriggerPromise
                    ? await parallelStudioTriggerPromise
                    : false;

                const fastCacheWritePromise: ReturnType<typeof cacheAnalysisResult> | null =
                    pHash && fingerprint
                        ? cacheAnalysisResult(pHash, fastResult, uploadedImageUrl, finalImageBlobToCache, {
                            fingerprintPipeline: fingerprint.pipeline,
                            triggerStudioEdit: !studioTriggerStarted,
                        })
                        : null;

                if (fastCacheWritePromise) {
                    void fastCacheWritePromise
                        .then(cacheWrite => {
                            if (cacheWrite) {
                                setCurrentCacheId(cacheWrite.id ?? null);
                                setCurrentPHash(cacheWrite.storedPHash);
                                console.log(`✅ Fast analysis result cached successfully with pHash: ${cacheWrite.storedPHash}`);
                                setIsAnalysisCached(true);
                            } else {
                                console.warn('⚠️ Fast analysis cache write returned null before enrichment update');
                            }
                        })
                        .catch(cacheError => {
                            console.warn('⚠️ Failed to cache fast analysis result before enrichment:', cacheError);
                        });
                } else {
                    console.warn('⚠️ Skipping fast cache save — pHash was null or fingerprint was not generated');
                }

                // PHASE 2: Background coordinate enrichment with Roboflow + Florence-2
                // Skipped entirely when the feature flag is off — Phase 1's cache write already
                // contains the final analysis, so re-running enrichAnalysisWithRoboflow (a no-op
                // in disabled mode) and writing the same payload a second time was pure waste.
                if (FEATURE_FLAGS.USE_ROBOFLOW_COORDINATES) {
                    enrichAnalysisWithRoboflow(
                        compressedImageData.data,
                        compressedImageData.mimeType,
                        fastResult
                    ).then(async enrichedResult => {
                        // Notify the UI to update with enriched coordinates
                        if (options?.onCoordinatesEnriched) {
                            options.onCoordinatesEnriched(enrichedResult);
                        }

                        if (pHash && fingerprint) {
                            const initialCacheWrite = fastCacheWritePromise
                                ? await fastCacheWritePromise.catch(() => null)
                                : null;

                            const cacheWrite = initialCacheWrite
                                ? await cacheAnalysisResult(
                                    pHash,
                                    enrichedResult,
                                    initialCacheWrite.original_image_url ?? uploadedImageUrl,
                                    undefined,
                                    {
                                        fingerprintPipeline: fingerprint.pipeline,
                                        triggerStudioEdit: false,
                                        persistSourceAsset: false,
                                    }
                                )
                                : await cacheAnalysisResult(pHash, enrichedResult, uploadedImageUrl, finalImageBlobToCache, {
                                    fingerprintPipeline: fingerprint.pipeline,
                                });

                            if (cacheWrite) {
                                setCurrentCacheId(cacheWrite.id ?? null);
                                setCurrentPHash(cacheWrite.storedPHash);
                                console.log(`✅ Enriched analysis cache update completed with pHash: ${cacheWrite.storedPHash}`);
                                setIsAnalysisCached(true);
                            } else {
                                console.warn('⚠️ Enriched analysis cache update returned null');
                            }
                        } else {
                            console.warn('⚠️ Skipping enriched cache update — pHash was null or fingerprint was not generated');
                        }
                    }).catch(async enrichmentError => {
                        console.warn('⚠️ Roboflow enrichment failed; keeping fast analysis cache profile:', enrichmentError);

                        if (pHash && fingerprint) {
                            const initialCacheWrite = fastCacheWritePromise
                                ? await fastCacheWritePromise.catch(() => null)
                                : null;

                            if (!initialCacheWrite) {
                                const cacheWrite = await cacheAnalysisResult(pHash, fastResult, uploadedImageUrl, finalImageBlobToCache, {
                                    fingerprintPipeline: fingerprint.pipeline,
                                });
                                if (cacheWrite) {
                                    setCurrentCacheId(cacheWrite.id ?? null);
                                    setCurrentPHash(cacheWrite.storedPHash);
                                    console.log(`✅ Analysis result (fast profile) cached successfully with pHash: ${cacheWrite.storedPHash}`);
                                    setIsAnalysisCached(true);
                                } else {
                                    console.warn('⚠️ Fast analysis fallback cache write returned null after enrichment failure');
                                }
                            } else {
                                setIsAnalysisCached(true);
                            }
                        } else {
                            console.warn('⚠️ Skipping fallback cache save — pHash was null or fingerprint was not generated');
                        }
                    });
                }

            } catch (error) {
                // Clean up the active analysis toast on error
                toastHot.dismiss(uploadToastId);
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
        setCurrentPHash(null);
        setCurrentCacheId(null);
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
            setLoadedImageUrl(imageUrl);

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
        currentPHash,
        currentCacheId,
        loadedImageUrl,
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
        isComposingSelfie,
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
        currentPHash,
        currentCacheId,
        loadedImageUrl,
        setCurrentSlug,
        handleImageUpload,
        loadImageWithoutAnalysis,
        handleSave,
        uploadCartImages,
        clearImages,
        seoMetadata,
        isAnalysisCached,
        isComposingSelfie,
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
