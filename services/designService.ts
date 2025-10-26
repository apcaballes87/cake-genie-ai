import {
    EDIT_CAKE_PROMPT_TEMPLATE
} from './geminiService';
import {
    editCakeImage
} from './geminiService.lazy';
import {
    DEFAULT_THICKNESS_MAP
} from '../constants';
import type {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI
} from '../types';

/**
 * Generates a new cake design by calling the Gemini API.
 * This function encapsulates all business logic for updating a design.
 * @returns A promise that resolves to an object containing the new image data URI and the prompt used.
 */
export async function updateDesign({
    originalImageData,
    analysisResult,
    cakeInfo,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    additionalInstructions,
    threeTierReferenceImage,
    promptGenerator, // ADDED
}: {
    originalImageData: { data: string; mimeType: string } | null;
    analysisResult: HybridAnalysisResult | null;
    cakeInfo: CakeInfoUI;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI;
    additionalInstructions: string;
    threeTierReferenceImage: { data: string; mimeType: string } | null;
    // ADDED: Optional prompt generator function
    promptGenerator?: (
        originalAnalysis: HybridAnalysisResult | null,
        newCakeInfo: CakeInfoUI,
        mainToppers: MainTopperUI[],
        supportElements: SupportElementUI[],
        cakeMessages: CakeMessageUI[],
        icingDesign: IcingDesignUI,
        additionalInstructions: string
    ) => string;
}): Promise<{ image: string, prompt: string }> {

    // 1. Validate inputs
    if (!originalImageData || !icingDesign || !cakeInfo) {
        throw new Error("Missing required data to update design.");
    }

    // 2. Validate special instructions with intelligent pattern matching
    const validateSpecialInstructions = (instructions: string): { isValid: boolean; error?: string } => {
        const lowerInstructions = instructions.toLowerCase();

        // Forbidden patterns that try to add NEW items
        const forbiddenPatterns = [
            // Adding new toppers/figures/characters
            /(add|put|include|place)\s+(new|another|more|extra|a)\s+(topper|figure|character|item|decoration|element)/i,
            // Creating new items
            /create\s+(new|a|an)\s+(topper|figure|character|item|decoration)/i,
            // Extra toppers (not "extra vibrant" or "extra shine")
            /extra\s+(topper|figure|character|decoration)/i,
            // Put a new X
            /put\s+a\s+new/i,
            // Include another X
            /include\s+(another|more)\s+(topper|figure|character)/i,
        ];

        // Check if any forbidden pattern matches
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(lowerInstructions)) {
                return {
                    isValid: false,
                    error: "Instructions cannot add new items. Please use it only to clarify changes like color, size, or position of existing elements."
                };
            }
        }

        // Valid patterns that are explicitly allowed (these override simple keyword matches)
        const allowedPatterns = [
            // Color intensification: "add more red", "add more pink to the icing"
            /(add|put)\s+more\s+(red|pink|blue|green|yellow|orange|purple|white|black|color)/i,
            // Size adjustments: "make the stars bigger", "make unicorn smaller"
            /make\s+(the\s+)?\w+\s+(bigger|smaller|larger|taller|shorter|wider)/i,
            // Effect enhancements: "add more sparkle", "extra vibrant", "more shine"
            /(add\s+more|extra)\s+(sparkle|shine|glitter|vibrant|intensity)/i,
        ];

        // If it matches an allowed pattern, it's valid
        for (const pattern of allowedPatterns) {
            if (pattern.test(lowerInstructions)) {
                return { isValid: true };
            }
        }

        // No forbidden patterns matched, instructions are valid
        return { isValid: true };
    };

    const validation = validateSpecialInstructions(additionalInstructions);
    if (!validation.isValid) {
        throw new Error(validation.error || "Invalid instructions.");
    }

    // 3. Build the prompt
    const analysisForPrompt = analysisResult || {
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
        icing_design: {
            base: 'soft_icing',
            color_type: 'single',
            colors: {
                side: '#FFFFFF'
            },
            border_top: false,
            border_base: false,
            drip: false,
            gumpasteBaseBoard: false
        },
        cakeType: '1 Tier',
        cakeThickness: DEFAULT_THICKNESS_MAP['1 Tier']
    };
    
    // Use the provided prompt generator, or fall back to the default one
    const prompt = promptGenerator
        ? promptGenerator(
            analysisForPrompt, cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions
          )
        : EDIT_CAKE_PROMPT_TEMPLATE(
            analysisForPrompt, cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions
          );

    // 4. Handle timeout
    const timeoutPromise = new Promise < never > ((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out after 60 seconds.")), 60000)
    );

    try {
        // 5. Call editCakeImage
        const editedImageResult: string | unknown = await Promise.race([
            editCakeImage(prompt, originalImageData, mainToppers, supportElements, cakeInfo.type.includes('3 Tier') ? threeTierReferenceImage : null),
            timeoutPromise
        ]);
        
        // 6. Return the edited image or throw an error
        if (typeof editedImageResult !== 'string') {
            throw new Error("Image generation did not return a valid string response.");
        }
        
        return { image: editedImageResult, prompt };

    } catch (err) {
        // Re-throw the caught error to be handled by the component
        throw err;
    }
}
