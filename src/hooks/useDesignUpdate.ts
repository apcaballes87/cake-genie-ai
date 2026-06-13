// hooks/useDesignUpdate.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { updateDesign } from '@/services/designService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization';
import { getProxyAwareImageUrl } from '@/lib/utils/imageSelection';
import { fileToBase64 } from '@/services/geminiService';
import type {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI
} from '@/types';

// Declare gtag for Google Analytics event tracking
declare const gtag: (...args: unknown[]) => void;

const createAiTraceId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type DesignPromptGenerator = (
    originalAnalysis: HybridAnalysisResult | null,
    newCakeInfo: CakeInfoUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    additionalInstructions: string
) => string;

export interface DesignUpdateStateOverrides {
    analysisResult?: HybridAnalysisResult | null;
    cakeInfo?: CakeInfoUI | null;
    mainToppers?: MainTopperUI[];
    supportElements?: SupportElementUI[];
    cakeMessages?: CakeMessageUI[];
    icingDesign?: IcingDesignUI | null;
    additionalInstructions?: string;
}

export interface HandleDesignUpdateOptions {
    traceId?: string;
    source?: string;
    promptGenerator?: DesignPromptGenerator;
    stateOverrides?: DesignUpdateStateOverrides;
    colorMeta?: { hex: string; name: string }; // ADDED
}

interface UseDesignUpdateProps {
    originalImageData: { data: string; mimeType: string } | null;
    editedImage: string | null;
    studioEditedImageUrl?: string | null;
    analysisResult: HybridAnalysisResult | null;
    cakeInfo: CakeInfoUI | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    additionalInstructions: string;
    threeTierReferenceImage: { data: string; mimeType: string } | null;
    cacheId?: string | null; // ADDED
    slug?: string | null; // ADDED
    onSuccess: (editedImage: string, baseImageData: { data: string; mimeType: string }) => void;
    promptGenerator?: DesignPromptGenerator;
}

function parseDataUriImage(imageUri: string | null): { data: string; mimeType: string } | null {
    if (!imageUri || !imageUri.startsWith('data:')) {
        return null;
    }

    const match = imageUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
        return null;
    }

    return {
        mimeType: match[1],
        data: match[2],
    };
}

async function fetchUrlAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
        const targetUrl = getProxyAwareImageUrl(url);

        const response = await fetch(targetUrl, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch image (status ${response.status}).`);
        }

        const blob = await response.blob();
        const file = new File([blob], 'studio-edited.webp', { type: blob.type || 'image/webp' });
        return await fileToBase64(file);
    } finally {
        clearTimeout(timeoutId);
    }
}

export const useDesignUpdate = ({
    originalImageData,
    editedImage,
    studioEditedImageUrl = null,
    analysisResult,
    cakeInfo,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    additionalInstructions,
    threeTierReferenceImage,
    cacheId = null, // ADDED
    slug = null, // ADDED
    onSuccess,
    promptGenerator, // ADDED
}: UseDesignUpdateProps) => {
    const supabase = getSupabaseClient(); // ADDED
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastGenerationInfoRef = useRef<{ prompt: string; systemInstruction: string; } | null>(null);
    const inFlightPromiseRef = useRef<Promise<string> | null>(null);
    const [isSafetyFallback, setIsSafetyFallback] = useState(false);

    // Local cache for color variants (maps colorHex.toLowerCase() -> imageUrl)
    const localCacheRef = useRef<Record<string, string>>({}); // ADDED
    const [colorVariants, setColorVariants] = useState<Record<string, string>>({}); // ADDED

    // Fetch existing color variants on mount or cacheId change
    useEffect(() => {
        if (!cacheId) {
            localCacheRef.current = {};
            setColorVariants({});
            return;
        }
        const fetchVariants = async () => {
            try {
                const { data, error: fetchError } = await supabase
                    .from('cakegenie_color_variants')
                    .select('color_hex, image_url')
                    .eq('cache_id', cacheId);
                
                if (fetchError) throw fetchError;
                
                if (data) {
                    const cacheMap: Record<string, string> = {};
                    data.forEach(item => {
                        cacheMap[item.color_hex.toLowerCase()] = item.image_url;
                    });
                    localCacheRef.current = cacheMap;
                    setColorVariants(cacheMap);
                    console.log(`🔌 Loaded ${data.length} cached color variants for design ${cacheId}`);
                }
            } catch (err) {
                console.warn('Failed to prefetch color variants:', err);
            }
        };
        fetchVariants();
    }, [cacheId, supabase]);

    const handleUpdateDesign = useCallback((
        overrideInstruction?: string,
        options?: HandleDesignUpdateOptions
    ) => {
        const traceId = options?.traceId ?? createAiTraceId('design');
        const requestSource = options?.source ?? 'manual-design-update';
        const resolvedAnalysisResult = options?.stateOverrides?.analysisResult ?? analysisResult;
        const resolvedCakeInfo = options?.stateOverrides?.cakeInfo ?? cakeInfo;
        const resolvedMainToppers = options?.stateOverrides?.mainToppers ?? mainToppers;
        const resolvedSupportElements = options?.stateOverrides?.supportElements ?? supportElements;
        const resolvedCakeMessages = options?.stateOverrides?.cakeMessages ?? cakeMessages;
        const resolvedIcingDesign = options?.stateOverrides?.icingDesign ?? icingDesign;
        const resolvedAdditionalInstructions = options?.stateOverrides?.additionalInstructions ?? additionalInstructions;
        const resolvedPromptGenerator = options?.promptGenerator ?? promptGenerator;
        const colorMeta = options?.colorMeta;

        if (inFlightPromiseRef.current) {
            return inFlightPromiseRef.current;
        }


        // Analytics: Track when a user completes a customization by updating the design
        if (typeof gtag === 'function') {
            gtag('event', 'update_design', {
                'event_category': 'ecommerce_funnel'
            });
        }

        // Guard against missing critical data which is checked in the service, but good to have here too.
        const syncEditedImageData = parseDataUriImage(editedImage);
        const canResolveStudioFallbackBase =
            requestSource === 'icing-mask-fallback' && !!studioEditedImageUrl && !syncEditedImageData;

        if ((!syncEditedImageData && !originalImageData && !canResolveStudioFallbackBase) || !resolvedIcingDesign || !resolvedCakeInfo) {
            const missingDataError = "Cannot update design: missing original image, icing design, or cake info.";
            // setError(missingDataError); // Removed per instruction
            throw new Error(missingDataError);
        }

        const requestPromise = (async () => {
            setIsLoading(true);
            setError(null);
            setIsSafetyFallback(false);

            console.log(`🤖 [AI DESIGN UPDATE] Started automated AI image edit: overrideInstruction="${overrideInstruction || 'none'}", requestSource="${requestSource}", traceId="${traceId}"`);

            // Hoist outside try so the catch block can reference it in the safety fallback
            let currentBaseImageData: { data: string; mimeType: string } | null = parseDataUriImage(editedImage);

            try {
                if (!currentBaseImageData && requestSource === 'icing-mask-fallback' && studioEditedImageUrl) {
                    try {
                        currentBaseImageData = await fetchUrlAsBase64(studioEditedImageUrl);
                    } catch (studioImageError) {
                        console.warn('Failed to resolve studio-edited image for icing fallback; using original upload instead.', studioImageError);
                        currentBaseImageData = originalImageData;
                    }
                } else if (!currentBaseImageData) {
                    currentBaseImageData = originalImageData;
                }

                if (colorMeta && cacheId && currentBaseImageData) {
                    const cachedUrl = localCacheRef.current[colorMeta.hex.toLowerCase()];
                    if (cachedUrl) {
                        console.log(`🎯 Color Variant Cache Hit! Instantly loading ${colorMeta.name} (${colorMeta.hex})`);
                        onSuccess(cachedUrl, currentBaseImageData);
                        return cachedUrl;
                    }
                }

                if (!currentBaseImageData) {
                    throw new Error("Cannot update design: missing original image, icing design, or cake info.");
                }

                const combinedInstructions = overrideInstruction
                    ? (resolvedAdditionalInstructions ? `${resolvedAdditionalInstructions}. ${overrideInstruction}` : overrideInstruction)
                    : resolvedAdditionalInstructions;


                const { image: editedImageResult, prompt, systemInstruction } = await updateDesign({
                    originalImageData: currentBaseImageData,
                    analysisResult: resolvedAnalysisResult,
                    cakeInfo: resolvedCakeInfo,
                    mainToppers: resolvedMainToppers,
                    supportElements: resolvedSupportElements,
                    cakeMessages: resolvedCakeMessages,
                    icingDesign: resolvedIcingDesign,
                    additionalInstructions: combinedInstructions,
                    threeTierReferenceImage,
                    traceId,
                    requestSource,
                    promptGenerator: resolvedPromptGenerator,
                });

                lastGenerationInfoRef.current = { prompt, systemInstruction };
                onSuccess(editedImageResult, currentBaseImageData);

                // --- Background Cache Save (on Miss) ---
                if (colorMeta && cacheId) {
                    void (async () => {
                        try {
                            console.log(`💾 Caching new color variant in background: ${colorMeta.name} (${colorMeta.hex})`);
                            const editedImageBlob = dataURItoBlob(editedImageResult);
                            const editedImageFile = new File([editedImageBlob], 'color-variant.webp', { type: 'image/webp' });
                            const compressedEditedFile = await compressImage(editedImageFile, { maxSizeMB: 1, fileType: 'image/webp' });
                            
                            // Safe file name using sanitized hex code (remove #)
                            const cleanHex = colorMeta.hex.replace('#', '').toLowerCase();
                            const filename = `color-variants/${cacheId}/${cleanHex}.webp`;

                            const { error: uploadError } = await supabase.storage
                                .from('cakegenie')
                                .upload(filename, compressedEditedFile, { contentType: 'image/webp', upsert: true });

                            if (uploadError) throw uploadError;

                            const { data: urlData } = supabase.storage.from('cakegenie').getPublicUrl(filename);
                            if (!urlData?.publicUrl) throw new Error("Failed to get public URL for color variant.");

                            const publicUrl = urlData.publicUrl;

                            const { error: dbError } = await supabase
                                .from('cakegenie_color_variants')
                                .insert({
                                    cache_id: cacheId,
                                    color_hex: colorMeta.hex,
                                    color_name: colorMeta.name,
                                    image_url: publicUrl
                                });

                            if (dbError) throw dbError;

                            // Cache locally for subsequent clicks
                            localCacheRef.current[colorMeta.hex.toLowerCase()] = publicUrl;
                            setColorVariants(prev => ({
                                ...prev,
                                [colorMeta.hex.toLowerCase()]: publicUrl
                            }));
                            console.log(`✅ Color variant saved successfully: ${publicUrl}`);
                        } catch (cacheErr) {
                            console.warn('Failed to background-cache new color variant:', cacheErr);
                        }
                    })();
                }

                return editedImageResult;

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while updating the design.';

                // Check for safety/policy blocking errors
                // Gemini often returns "safety settings" or "blocked" in the error message
                const isSafetyError = errorMessage.toLowerCase().includes('safety') ||
                    errorMessage.toLowerCase().includes('blocked') ||
                    errorMessage.toLowerCase().includes('policy');

                if (isSafetyError) {
                    setIsSafetyFallback(true);

                    // Fallback: Use the current working base image, falling back to the
                    // original upload if nothing was resolved during the try block.
                    const safeBaseImageData = currentBaseImageData ?? originalImageData;
                    if (safeBaseImageData) {
                        const originalImageSrc = `data:${safeBaseImageData.mimeType};base64,${safeBaseImageData.data}`;
                        // Call onSuccess with the original image so the flow continues
                        onSuccess(originalImageSrc, safeBaseImageData);
                        // Return the original image so the caller (handleAddToCart) can proceed
                        return originalImageSrc;
                    }
                }

                setError(errorMessage);
                throw err; // Re-throw other errors to be caught by the caller
            } finally {
                setIsLoading(false);
                inFlightPromiseRef.current = null;
            }

        })();

        inFlightPromiseRef.current = requestPromise;
        return requestPromise;
    }, [
        originalImageData,
        editedImage,
        studioEditedImageUrl,
        analysisResult,
        cakeInfo,
        mainToppers,
        supportElements,
        cakeMessages,
        icingDesign,
        additionalInstructions,
        threeTierReferenceImage,
        cacheId,
        onSuccess,
        promptGenerator,
        supabase,
    ]);

    return {
        isLoading,
        error,
        isSafetyFallback,
        lastGenerationInfoRef,
        handleUpdateDesign,
        setError,
        colorVariants, // ADDED
    };
};
