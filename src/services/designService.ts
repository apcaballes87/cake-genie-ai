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
}): Promise<{ image: string, prompt: string }> {

    // 1. Validate inputs
    if (!originalImageData || !icingDesign || !cakeInfo) {
        throw new Error("Missing required data to update design.");
    }

    // 2. Check for forbidden keywords
    const forbiddenKeywords = ['add', 'extra', 'another', 'include', 'new topper', 'new figure', 'create', 'put a new'];
    if (forbiddenKeywords.some(keyword => additionalInstructions.toLowerCase().includes(keyword))) {
        throw new Error("Instructions cannot add new items. Please use it only to clarify changes like color or position.");
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
    const prompt = EDIT_CAKE_PROMPT_TEMPLATE(analysisForPrompt, cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions);

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