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
    analysisResult: HybridAnalysisResult | null;
    cakeInfo: CakeInfoUI | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    additionalInstructions: string;
    threeTierReferenceImage: { data: string; mimeType: string } | null;
    onSuccess: (editedImage: string) => void;
    promptGenerator?: DesignPromptGenerator;
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

        if (inFlightPromiseRef.current) {
            console.log(`[AI TRACE ${traceId}] handleUpdateDesign:reusing-in-flight`, { requestSource });
            return inFlightPromiseRef.current;
        }

        console.log(`[AI TRACE ${traceId}] handleUpdateDesign:start`, {
            requestSource,
            hasOverrideInstruction: Boolean(overrideInstruction),
            hasOriginalImageData: Boolean(originalImageData),
            hasCakeInfo: Boolean(resolvedCakeInfo),
            hasIcingDesign: Boolean(resolvedIcingDesign),
        });

        // Analytics: Track when a user completes a customization by updating the design
        if (typeof gtag === 'function') {
            gtag('event', 'update_design', {
                'event_category': 'ecommerce_funnel'
            });
        }

        // Guard against missing critical data which is checked in the service, but good to have here too.
        if (!originalImageData || !resolvedIcingDesign || !resolvedCakeInfo) {
            const missingDataError = "Cannot update design: missing original image, icing design, or cake info.";
            console.error(missingDataError);
            setError(missingDataError);
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

                console.log(`[AI TRACE ${traceId}] handleUpdateDesign:calling-updateDesign`, {
                    requestSource,
                    combinedInstructionsLength: combinedInstructions?.length ?? 0,
                });

                const { image: editedImageResult, prompt, systemInstruction } = await updateDesign({
                    originalImageData,
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
                console.log(`[AI TRACE ${traceId}] handleUpdateDesign:success`, {
                    requestSource,
                    imageLength: editedImageResult.length,
                });
                onSuccess(editedImageResult);
                return editedImageResult;

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while updating the design.';
                console.error(`[AI TRACE ${traceId}] handleUpdateDesign:error`, {
                    requestSource,
                    errorMessage,
                });

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
                console.log(`[AI TRACE ${traceId}] handleUpdateDesign:finish`, { requestSource });
                setIsLoading(false);
                inFlightPromiseRef.current = null;
            }

        })();

        inFlightPromiseRef.current = requestPromise;
        return requestPromise;
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