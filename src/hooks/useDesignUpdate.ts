// hooks/useDesignUpdate.ts
import { useState, useRef, useCallback } from 'react';
import { updateDesign } from '@/services/designService';
import type {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI
} from '@/types';

// Declare gtag for Google Analytics event tracking
declare const gtag: (...args: any[]) => void;

interface UseDesignUpdateProps {
    originalImageData: { data: string; mimeType: string } | null;
    analysisResult: HybridAnalysisResult | null;
    cakeInfo: CakeInfoUI | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    additionalInstructions: string;
    threeTierReferenceImage: { data: string; mimeType: string } | null;
    onSuccess: (editedImage: string) => void;
    // ADDED: Optional prompt generator for specialized flows
    promptGenerator?: (
        originalAnalysis: HybridAnalysisResult | null,
        newCakeInfo: CakeInfoUI,
        mainToppers: MainTopperUI[],
        supportElements: SupportElementUI[],
        cakeMessages: CakeMessageUI[],
        icingDesign: IcingDesignUI,
        additionalInstructions: string
    ) => string;
}

export const useDesignUpdate = ({
    originalImageData,
    analysisResult,
    cakeInfo,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    additionalInstructions,
    threeTierReferenceImage,
    onSuccess,
    promptGenerator, // ADDED
}: UseDesignUpdateProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastGenerationInfoRef = useRef<{ prompt: string; systemInstruction: string; } | null>(null);
    const [isSafetyFallback, setIsSafetyFallback] = useState(false);

    const handleUpdateDesign = useCallback(async () => {
        // Analytics: Track when a user completes a customization by updating the design
        if (typeof gtag === 'function') {
            gtag('event', 'update_design', {
                'event_category': 'ecommerce_funnel'
            });
        }

        // Guard against missing critical data which is checked in the service, but good to have here too.
        if (!originalImageData || !icingDesign || !cakeInfo) {
            const missingDataError = "Cannot update design: missing original image, icing design, or cake info.";
            console.error(missingDataError);
            setError(missingDataError);
            throw new Error(missingDataError);
        }

        setIsLoading(true);
        setError(null);
        setIsSafetyFallback(false);

        try {
            const { image: editedImageResult, prompt, systemInstruction } = await updateDesign({
                originalImageData,
                analysisResult,
                cakeInfo,
                mainToppers,
                supportElements,
                cakeMessages,
                icingDesign,
                additionalInstructions,
                threeTierReferenceImage,
                promptGenerator, // ADDED: Pass the generator to the service
            });

            lastGenerationInfoRef.current = { prompt, systemInstruction };
            onSuccess(editedImageResult);
            return editedImageResult;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while updating the design.';

            // Check for safety/policy blocking errors
            // Gemini often returns "safety settings" or "blocked" in the error message
            const isSafetyError = errorMessage.toLowerCase().includes('safety') ||
                errorMessage.toLowerCase().includes('blocked') ||
                errorMessage.toLowerCase().includes('policy');

            if (isSafetyError) {
                console.warn("AI generation blocked due to safety settings. Falling back to original image.");
                setIsSafetyFallback(true);

                // Fallback: Use the original image data
                // We need to reconstruct the data URI for the original image
                const originalImageSrc = `data:${originalImageData.mimeType};base64,${originalImageData.data}`;

                // Call onSuccess with the original image so the flow continues
                onSuccess(originalImageSrc);

                // Return the original image so the caller (handleAddToCart) can proceed
                return originalImageSrc;
            }

            setError(errorMessage);
            throw err; // Re-throw other errors to be caught by the caller
        } finally {
            setIsLoading(false);
        }
    }, [
        originalImageData,
        analysisResult,
        cakeInfo,
        mainToppers,
        supportElements,
        cakeMessages,
        icingDesign,
        additionalInstructions,
        threeTierReferenceImage,
        onSuccess,
        promptGenerator, // ADDED
    ]);

    return {
        isLoading,
        error,
        isSafetyFallback,
        lastGenerationInfoRef,
        handleUpdateDesign,
        setError,
    };
};