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
}: UseDesignUpdateProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastPromptRef = useRef<string | null>(null);

    const handleUpdateDesign = useCallback(async () => {
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
        onSuccess
    ]);

    return {
        isLoading,
        error,
        lastPromptRef,
        handleUpdateDesign,
        setError,
    };
};