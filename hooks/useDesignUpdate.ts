// hooks/useDesignUpdate.ts
import { useState, useRef, useCallback } from 'react';
import { updateDesign } from '../services/designService';
import type {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI
} from '../types';

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
    const lastPromptRef = useRef<string | null>(null);

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

        try {
            const { image: editedImageResult, prompt } = await updateDesign({
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

            lastPromptRef.current = prompt;
            onSuccess(editedImageResult);
            return editedImageResult;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while updating the design.';
            setError(errorMessage);
            throw err; // Re-throw the error to be caught by the caller
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
        lastPromptRef,
        handleUpdateDesign,
        setError,
    };
};