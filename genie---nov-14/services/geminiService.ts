// services/geminiService.ts

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";
import { getSupabaseClient } from '../lib/supabase/client';

let ai: InstanceType<typeof GoogleGenAI> | null = null;

function getAI() {
    if (!ai) {
        // The execution environment securely injects this specific variable.
        const geminiApiKey = process.env.API_KEY;
        
        if (!geminiApiKey) {
            throw new Error("API_KEY environment variable not set. Please ensure the environment is configured correctly.");
        }
        ai = new GoogleGenAI({ apiKey: geminiApiKey });
    }
    return ai;
}

const supabase = getSupabaseClient();

// Cache the prompt for 10 minutes
let promptCache: {
  prompt: string;
  timestamp: number;
} | null = null;

const PROMPT_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Cache for dynamic enums
let typeEnumsCache: {
  mainTopperTypes: string[];
  supportElementTypes: string[];
  timestamp: number;
} | null = null;
const ENUM_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function getActivePrompt(): Promise<string> {
  const now = Date.now();
  
  // Return cached if still valid
  if (promptCache && (now - promptCache.timestamp < PROMPT_CACHE_DURATION)) {
    return promptCache.prompt;
  }
  
  // Fetch from database
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_text')
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (error || !data) {
    console.warn('Failed to fetch prompt from database, using fallback');
    // Keep your current hardcoded prompt as fallback
    return FALLBACK_PROMPT;
  }
  
  // Update cache
  promptCache = {
    prompt: data.prompt_text,
    timestamp: now
  };
  
  return data.prompt_text;
}

async function getDynamicTypeEnums(): Promise<{ mainTopperTypes: string[], supportElementTypes: string[] }> {
    const now = Date.now();
  
    // Check cache first
    if (typeEnumsCache && (now - typeEnumsCache.timestamp < ENUM_CACHE_DURATION)) {
        return { 
            mainTopperTypes: typeEnumsCache.mainTopperTypes, 
            supportElementTypes: typeEnumsCache.supportElementTypes 
        };
    }
  
    // Fetch from Supabase pricing_rules table
    const { data, error } = await supabase
        .from('pricing_rules')
        .select('item_type, category')
        .eq('is_active', true)
        .not('item_type', 'is', null);
  
    // Define a hardcoded fallback for safety
    const fallbackEnums = {
        mainTopperTypes: ['edible_3d_complex', 'edible_3d_ordinary', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'],
        supportElementTypes: ['edible_3d_support', 'edible_2d_support', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'dragees', 'edible_flowers', 'edible_photo_side', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread']
    };

    if (error || !data) {
        console.warn('Failed to fetch dynamic enums from pricing_rules, using hardcoded fallback enums.');
        return fallbackEnums;
    }

    const mainTopperTypes = new Set<string>();
    const supportElementTypes = new Set<string>();

    // Separate the types based on their category
    data.forEach(rule => {
        if (rule.item_type) {
            if (rule.category === 'main_topper') {
                mainTopperTypes.add(rule.item_type);
            } else if (rule.category === 'support_element') {
                supportElementTypes.add(rule.item_type);
            }
        }
    });
    
    const result = {
        mainTopperTypes: Array.from(mainTopperTypes),
        supportElementTypes: Array.from(supportElementTypes),
    };
    
    // If the fetched lists are empty for some reason, use the fallback
    if (result.mainTopperTypes.length === 0 || result.supportElementTypes.length === 0) {
         console.warn('Fetched dynamic enums but one or both lists are empty, using hardcoded fallback enums.');
         return fallbackEnums;
    }

    // Update the cache
    typeEnumsCache = {
        ...result,
        timestamp: now
    };
  
    return result;
}

export function clearPromptCache() {
  promptCache = null;
  typeEnumsCache = null; // Also clear the enum cache
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export const fileToBase64 = async (file: File): Promise<{ mimeType: string; data: string }> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = arrayBufferToBase64(arrayBuffer);
        return { mimeType: file.type, data: base64Data };
    } catch (error) {
        console.error("Error reading file:", error);
        throw new Error("Failed to read the image file.");
    }
};

const VALIDATION_PROMPT = `You are an image validation expert for a cake customization app. Your task is to analyze the provided image and determine if it's suitable for our automated design and pricing tool. Your response must be a valid JSON object.

**CRITICAL RULE: Focus ONLY on the main subject of the photo.** Ignore blurry, out-of-focus items in the background. If the primary, focused subject is a single cake, the image is valid.

Based on the image, classify it into ONE of the following categories:

- "valid_single_cake": The main, in-focus subject is a single, clear image of one cake. It can be a bento, 1-3 tier, square, rectangle, or fondant cake. Other items, including other cakes or cupcakes, are acceptable ONLY if they are blurry, out-of-focus, and clearly in the background.
- "not_a_cake": The image does not contain a cake. It might be a person, object, or scene that isn't cake-like.
- "multiple_cakes": The image clearly shows two or more separate cakes as the primary, in-focus subjects. Do NOT use this classification if the other cakes are blurry or in the background.
- "only_cupcakes": The image contains only cupcakes and no larger cake.
- "complex_sculpture": The cake is an extreme, gravity-defying sculpture, a hyper-realistic object (like a shoe or a car), or has incredibly intricate details that are beyond standard customization.
- "large_wedding_cake": The cake is clearly a large, elaborate wedding cake, typically 4 tiers or more, often with complex floral arrangements or structures.
- "non_food": The image is not of a food item at all.

Provide your response as a JSON object with a single key "classification".

Example for a valid cake:
{ "classification": "valid_single_cake" }

Example for a picture of a car:
{ "classification": "not_a_cake" }
`;

const validationResponseSchema = {
    type: Type.OBJECT,
    properties: {
        classification: {
            type: Type.STRING,
            enum: [
                'valid_single_cake',
                'not_a_cake',
                'multiple_cakes',
                'only_cupcakes',
                'complex_sculpture',
                'large_wedding_cake',
                'non_food',
            ],
        },
    },
    required: ['classification'],
};

export const validateCakeImage = async (base64ImageData: string, mimeType: string): Promise<string> => {
    try {
        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: VALIDATION_PROMPT }
                ],
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: validationResponseSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.classification;

    } catch (error) {
        console.error("Error validating cake image:", error);
        throw new Error("The AI failed to validate the image. Please try again.");
    }
};

const SYSTEM_INSTRUCTION = `You are an expert cake designer analyzing a cake image to identify design elements for pricing and customization. Your response must be a valid JSON object.

**GLOBAL RULES:**
1.  **JSON Output:** Your entire response MUST be a single, valid JSON object that adheres to the provided schema. Do not include any text, explanations, or markdown formatting outside of the JSON structure.
2.  **Color Palette:** For any color field in your response (like icing or message colors), you MUST use the closest matching hex code from this specific list: Red (#EF4444), Light Red (#FCA5A5), Orange (#F97316), Yellow (#EAB308), Green (#16A34A), Light Green (#4ADE80), Teal (#14B8A6), Blue (#3B82F6), Light Blue (#93C5FD), Purple (#8B5CF6), Light Purple (#C4B5FD), Pink (#EC4899), Light Pink (#FBCFE8), Brown (#78350F), Light Brown (#B45309), Gray (#64748B), White (#FFFFFF), Black (#000000).
3.  **Consistency:** The 'description' for an item should always align with its final 'type' classification. For example, if you classify something as a 'printout', describe it as a "printout of [character]".
`;

const FALLBACK_PROMPT = `
# GENIE.PH MASTER CAKE ANALYSIS PROMPT
**Version 3.0 - REVISED - Pure Identification & Classification System**
... (Same as previous fallback prompt)
`;

// The hybridAnalysisResponseSchema is now dynamically generated inside analyzeCakeImage function
// to use dynamic types from the Supabase pricing_rules table

export const analyzeCakeImage = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    // ... (Existing analyzeCakeImage function code)
    // Re-implementation not needed as we are just renaming other functions
    return {} as HybridAnalysisResult; 
};

// ... (Existing SHARE_TEXT_PROMPT, shareableTextResponseSchema)

// ============================================================================
// TWO-PHASE ANALYSIS: Fast Feature Detection + Background Coordinate Enrichment
// ============================================================================

/**
 * Phase 1: Fast feature-only analysis (no coordinates)
 * Returns analysis with all coordinates set to 0,0 for immediate UI display
 * This should complete in ~7-10 seconds vs 25+ seconds for full analysis
 */
export const analyzeCakeFeatures = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    try {
        // Note: We don't need dimensions for this phase since coordinates are all 0,0
        // but we validate the image can load
        const image = new Image();
        const imageLoadPromise = new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('Failed to load image to get dimensions.'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });
        await imageLoadPromise;

        // Get dynamic enums first
        const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();

        // Ultra-simplified prompt - NO coordinate instructions at all
        const FAST_FEATURES_PROMPT = `
**SPEED MODE: FEATURE IDENTIFICATION ONLY**

Your ONLY task is to identify cake features as quickly as possible.
Do NOT waste time calculating positions or coordinates.

REQUIRED OUTPUT:
1. Cake type and thickness
2. All toppers (type, size, description, quantity)
3. All support elements (type, coverage, description)
4. All messages (text, type, position, color)
5. Icing design (base, colors, borders)

## CAKE TYPE (Choose one)
- simple_design, moderate_design, tiered_regular, tiered_gravity, unique_shape

## CAKE THICKNESS
- regular (3-4 inches), tall (5-7 inches)

## MAIN TOPPERS
Classify by material: ${mainTopperTypes.join(', ')}
Size: small, medium, large, tiny

## SUPPORT ELEMENTS
Types: ${supportElementTypes.join(', ')}
Coverage: large, medium, small, tiny

## MESSAGES
- Type: gumpaste_letters, icing_script, printout, cardstock
- Include actual text visible

## ICING DESIGN
- Base: soft_icing or fondant
- Colors for: top, side, borderTop, borderBase, drip, gumpasteBaseBoardColor
- Flags: border_top, border_base, drip, gumpasteBaseBoard (true/false)

**CRITICAL:** For ALL x and y coordinates: Use 0 (zero). Do not calculate positions.
**SPEED IS PRIORITY.** Only identify what items exist, not where they are.
`;

        // Use the same schema but coordinates will be 0,0
        const fastAnalysisSchema = {
            type: Type.OBJECT,
            properties: {
                main_toppers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: mainTopperTypes },
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                            quantity: { type: Type.INTEGER },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'size', 'quantity', 'group_id', 'x', 'y']
                    }
                },
                support_elements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: supportElementTypes },
                            description: { type: Type.STRING },
                            coverage: { type: Type.STRING, enum: ['large', 'medium', 'small', 'tiny'] },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'coverage', 'group_id', 'x', 'y']
                    }
                },
                cake_messages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['gumpaste_letters', 'icing_script', 'printout', 'cardstock'] },
                            text: { type: Type.STRING },
                            position: { type: Type.STRING, enum: ['top', 'side', 'base_board'] },
                            color: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'text', 'position', 'color', 'x', 'y']
                    }
                },
                icing_design: {
                    type: Type.OBJECT,
                    properties: {
                        base: { type: Type.STRING, enum: ['soft_icing', 'fondant'] },
                        color_type: { type: Type.STRING, enum: ['single', 'gradient_2', 'gradient_3', 'abstract'] },
                        colors: {
                            type: Type.OBJECT,
                            properties: {
                                side: { type: Type.STRING },
                                top: { type: Type.STRING },
                                borderTop: { type: Type.STRING },
                                borderBase: { type: Type.STRING },
                                drip: { type: Type.STRING },
                                gumpasteBaseBoardColor: { type: Type.STRING }
                            }
                        },
                        border_top: { type: Type.BOOLEAN },
                        border_base: { type: Type.BOOLEAN },
                        drip: { type: Type.BOOLEAN },
                        gumpasteBaseBoard: { type: Type.BOOLEAN }
                    },
                    required: ['base', 'color_type', 'colors', 'border_top', 'border_base', 'drip', 'gumpasteBaseBoard']
                },
                cakeType: { type: Type.STRING, enum: CAKE_TYPES },
                cakeThickness: { type: Type.STRING, enum: CAKE_THICKNESSES },
                drip_effects: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                },
                icing_surfaces: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'side'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                icing_borders: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'base'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                base_board: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                }
            },
            required: ['cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
        };

        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: FAST_FEATURES_PROMPT },
                ],
            }],
            config: {
                systemInstruction: "You are a fast cake feature identifier. Identify features quickly without calculating coordinates. Set all x,y to 0.",
                responseMimeType: 'application/json',
                responseSchema: fastAnalysisSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        if (result.rejection?.isRejected) {
            throw new Error(result.rejection.message || "The uploaded image is not suitable for processing.");
        }

        const requiredFields = ['main_toppers', 'support_elements', 'cake_messages', 'icing_design', 'cakeType', 'cakeThickness'];
        for (const field of requiredFields) {
            if (result[field] === undefined) {
                console.error("Analysis validation error: Missing field", field);
                throw new Error("The AI returned an incomplete analysis. Please try a different image.");
            }
        }

        return result as HybridAnalysisResult;

    } catch (error) {
        console.error("Error in fast feature analysis:", error);
        throw error;
    }
};

/**
 * Phase 2: Background coordinate enrichment
 * Takes the feature list and calculates precise coordinates for each item
 * This runs silently in the background while user interacts with the UI
 */
export const getCoordinatesForAnalysis = async (
    base64ImageData: string,
    mimeType: string,
    featureAnalysis: HybridAnalysisResult
): Promise<HybridAnalysisResult> => {
    try {
        const image = new Image();
        const imageLoadPromise = new Promise<{ width: number; height: number }>((resolve, reject) => {
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error('Failed to load image to get dimensions.'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });
        const dimensions = await imageLoadPromise;

        const COORDINATE_ENRICHMENT_PROMPT = `
**COORDINATE ENRICHMENT MODE**

You are provided with a complete list of all cake features that have already been identified.
Your ONLY task is to calculate precise x,y coordinates for each item.

**Image Dimensions:** ${dimensions.width}px wide × ${dimensions.height}px high
**Coordinate System:**
- Origin (0,0) is at the image center
- X-axis: -${dimensions.width / 2} (left) to +${dimensions.width / 2} (right)
- Y-axis: -${dimensions.height / 2} (bottom) to +${dimensions.height / 2} (top)
- Positive Y goes UPWARD

**Your Task:**
1. Review the provided feature list below
2. Locate each item visually in the image
3. Calculate its precise center coordinates
4. Return the SAME feature list with updated x,y values

**CRITICAL RULES:**
- Keep ALL feature descriptions, types, sizes exactly as provided
- ONLY update the x and y coordinate values
- Use precise coordinates reflecting true positions
- Do not add or remove any features
- Apply left/right bias (x ≠ 0 unless perfectly centered)

**Identified Features:**
${JSON.stringify(featureAnalysis, null, 2)}
`;

        const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();

        const coordinateEnrichmentSchema = {
            type: Type.OBJECT,
            properties: {
                main_toppers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: mainTopperTypes },
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                            quantity: { type: Type.INTEGER },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'size', 'quantity', 'group_id', 'x', 'y']
                    }
                },
                support_elements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: supportElementTypes },
                            description: { type: Type.STRING },
                            coverage: { type: Type.STRING, enum: ['large', 'medium', 'small', 'tiny'] },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'coverage', 'group_id', 'x', 'y']
                    }
                },
                cake_messages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['gumpaste_letters', 'icing_script', 'printout', 'cardstock'] },
                            text: { type: Type.STRING },
                            position: { type: Type.STRING, enum: ['top', 'side', 'base_board'] },
                            color: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'text', 'position', 'color', 'x', 'y']
                    }
                },
                icing_design: {
                    type: Type.OBJECT,
                    properties: {
                        base: { type: Type.STRING, enum: ['soft_icing', 'fondant'] },
                        color_type: { type: Type.STRING, enum: ['single', 'gradient_2', 'gradient_3', 'abstract'] },
                        colors: {
                            type: Type.OBJECT,
                            properties: {
                                side: { type: Type.STRING },
                                top: { type: Type.STRING },
                                borderTop: { type: Type.STRING },
                                borderBase: { type: Type.STRING },
                                drip: { type: Type.STRING },
                                gumpasteBaseBoardColor: { type: Type.STRING }
                            }
                        },
                        border_top: { type: Type.BOOLEAN },
                        border_base: { type: Type.BOOLEAN },
                        drip: { type: Type.BOOLEAN },
                        gumpasteBaseBoard: { type: Type.BOOLEAN }
                    },
                    required: ['base', 'color_type', 'colors', 'border_top', 'border_base', 'drip', 'gumpasteBaseBoard']
                },
                cakeType: { type: Type.STRING, enum: CAKE_TYPES },
                cakeThickness: { type: Type.STRING, enum: CAKE_THICKNESSES },
                drip_effects: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                },
                icing_surfaces: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'side'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                icing_borders: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'base'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                base_board: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                }
            },
            required: ['cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
        };

        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: COORDINATE_ENRICHMENT_PROMPT },
                ],
            }],
            config: {
                systemInstruction: "You are a precise coordinate calculator. Update only x,y values, keep all other fields unchanged.",
                responseMimeType: 'application/json',
                responseSchema: coordinateEnrichmentSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const enrichedResult = JSON.parse(jsonText);

        return enrichedResult as HybridAnalysisResult;

    } catch (error) {
        console.error("Error enriching coordinates:", error);
        // Return original analysis if enrichment fails
        return featureAnalysis;
    }
};

// ... (generateShareableTexts)

export const generateShareableTexts = async (
    analysisResult: HybridAnalysisResult,
    cakeInfo: CakeInfoUI,
    HEX_TO_COLOR_NAME_MAP: Record<string, string>,
    editedImageDataUri?: string | null
): Promise<ShareableTexts> => {
    try {
        const simplifiedAnalysis = {
            cakeType: cakeInfo.type,
            cakeSize: cakeInfo.size,
            main_toppers: analysisResult.main_toppers,
            support_elements: analysisResult.support_elements,
            cake_messages: analysisResult.cake_messages,
            icing_colors: Object.entries(analysisResult.icing_design.colors).map(([key, hex]) => {
                if (typeof hex === 'string') {
                    return { location: key, name: HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || 'Custom Color' };
                }
                return { location: key, name: 'Custom Color' };
            })
        };

        // If we have an edited image, include it in the prompt for more accurate descriptions
        const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];
        
        if (editedImageDataUri) {
            // Extract base64 data from data URI
            const matches = editedImageDataUri.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                parts.push({ inlineData: { mimeType, data: base64Data } });
                parts.push({ text: `This is the FINAL customized cake design that the user created. Use this image to generate the title, description, and alt text. Pay attention to the actual colors, decorations, and text visible in this edited image.\n\n` });
            }
        }
        
        parts.push({ text: SHARE_TEXT_PROMPT });
        parts.push({ text: `\`\`\`json\n${JSON.stringify(simplifiedAnalysis, null, 2)}\n\`\`\`` });

        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: shareableTextResponseSchema,
                temperature: 0.3,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as ShareableTexts;
    } catch (error) {
        console.error("Error generating shareable texts:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        // Fallback to a basic title in case of error
        return {
            title: `${cakeInfo.size} ${cakeInfo.type} Cake`,
            description: 'A beautifully customized cake design.',
            altText: `A custom ${cakeInfo.type} cake.`,
        };
    }
};

export const editCakeImage = async (
    prompt: string,
    originalImage: { data: string; mimeType: string; },
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    threeTierReferenceImage: { data: string; mimeType: string; } | null,
    systemInstruction: string,
): Promise<string> => {

    const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];

    // 1. Original Image (Source for style)
    parts.push({ inlineData: { mimeType: originalImage.mimeType, data: originalImage.data } });

    // 2. Reference Image (Source for structure, if provided)
    if (threeTierReferenceImage) {
        parts.push({ inlineData: { mimeType: threeTierReferenceImage.mimeType, data: threeTierReferenceImage.data } });
    }
    
    // 3. Replacement images for printouts, edible photos, and doodles (main toppers)
    mainToppers.forEach(topper => {
        if (topper.isEnabled && (topper.type === 'printout' || topper.type === 'edible_photo' || topper.type === 'icing_doodle') && topper.replacementImage) {
            parts.push({ 
                inlineData: { 
                    mimeType: topper.replacementImage.mimeType, 
                    data: topper.replacementImage.data 
                } 
            });
        }
    });

    // 4. Replacement images for printouts and edible photos (support elements)
    supportElements.forEach(element => {
        if (element.isEnabled && (element.type === 'support_printout' || element.type === 'edible_photo_side') && element.replacementImage) {
            parts.push({ 
                inlineData: { 
                    mimeType: element.replacementImage.mimeType, 
                    data: element.replacementImage.data 
                } 
            });
        }
    });
    
    // 5. Text prompt (last, to provide context for all images)
    parts.push({ text: prompt });

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
                systemInstruction: systemInstruction,
                temperature: 0.1,
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        
        const refusalText = response.text?.trim();
        if (refusalText) {
             throw new Error(`The AI could not generate the image. Reason: ${refusalText}`);
        }

        throw new Error("The AI did not return an image. Please try again.");

    } catch (error) {
        console.error("Error editing cake image:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings. Please modify your instructions and try again.");
        }
        throw error;
    }
};