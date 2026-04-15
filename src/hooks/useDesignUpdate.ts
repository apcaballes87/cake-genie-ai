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
}

interface UseDesignUpdateProps {
    originalImageData: { data: string; mimeType: string } | null;
    editedImage: string | null;
    analysisResult: HybridAnalysisResult | null;
    cakeInfo: CakeInfoUI | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    additionalInstructions: string;
    threeTierReferenceImage: { data: string; mimeType: string } | null;
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

export const useDesignUpdate = ({
    originalImageData,
    editedImage,
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
    const inFlightPromiseRef = useRef<Promise<string> | null>(null);
    const [isSafetyFallback, setIsSafetyFallback] = useState(false);

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
        const currentBaseImageData = parseDataUriImage(editedImage) ?? originalImageData;

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
        if (!currentBaseImageData || !resolvedIcingDesign || !resolvedCakeInfo) {
            const missingDataError = "Cannot update design: missing original image, icing design, or cake info.";
            // setError(missingDataError); // Removed per instruction
            throw new Error(missingDataError);
        }

        const requestPromise = (async () => {
            setIsLoading(true);
            setError(null);
            setIsSafetyFallback(false);

            try {
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

                    // Fallback: Use the original image data
                    // We need to reconstruct the data URI for the current working base image
                    const originalImageSrc = `data:${currentBaseImageData.mimeType};base64,${currentBaseImageData.data}`;

                    // Call onSuccess with the original image so the flow continues
                    onSuccess(originalImageSrc, currentBaseImageData);

                    // Return the original image so the caller (handleAddToCart) can proceed
                    return originalImageSrc;
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
        analysisResult,
        cakeInfo,
        mainToppers,
        supportElements,
        cakeMessages,
        icingDesign,
        additionalInstructions,
        threeTierReferenceImage,
        onSuccess,
        promptGenerator,
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
