// services/geminiService.ts

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";
import { getSupabaseClient } from '../lib/supabase/client';

let ai: InstanceType<typeof GoogleGenAI> | null = null;

function getAI() {
    if (!ai) {
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!geminiApiKey) {
            throw new Error("VITE_GEMINI_API_KEY environment variable not set");
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

// Load fallback prompt from external file to avoid template literal issues
import fallbackPromptText from './prompts/fallback-prompt.txt?raw';
const FALLBACK_PROMPT = fallbackPromptText;

// The hybridAnalysisResponseSchema is now dynamically generated inside analyzeCakeImage function
// to use dynamic types from the Supabase pricing_rules table

export const analyzeCakeImage = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    try {
        const image = new Image();
        const imageLoadPromise = new Promise<{ width: number; height: number }>((resolve, reject) => {
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = (err) => reject(new Error('Failed to load image to get dimensions.'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });
        const dimensions = await imageLoadPromise;

        const COORDINATE_PROMPT = `
**CRITICAL RULE: PRECISE COORDINATE SYSTEM**
You MUST provide precise central coordinates for every single decorative element you identify. Adherence to this coordinate system is mandatory and of the highest priority.

**SYSTEM DEFINITION:**
1.  **Image Dimensions:** The current image is ${dimensions.width}px wide and ${dimensions.height}px high.
2.  **Origin (0,0):** The exact center of the image is the origin point (0, 0).
3.  **X-Axis (Horizontal):** This axis runs from -${dimensions.width / 2} at the far left to +${dimensions.width / 2} at the far right.
    - **CRITICAL:** The 'x' coordinate is for the HORIZONTAL position. A value of '0' means the item is perfectly in the middle of the cake from left to right. If an item is to the left or right of the center line, you MUST provide a non-zero 'x' coordinate.
4.  **Y-Axis (Vertical):** This axis runs from -${dimensions.height / 2} at the bottom edge to +${dimensions.height / 2} at the top edge. **Positive 'y' values go UPWARDS.**

**COORDINATE BIAS & ACCURACY RULE**
1.  **Accuracy is Paramount:** Your primary goal is to provide a coordinate that reflects the item's true location.
2.  **Left-Side Bias:** If an item is even slightly to the left of the vertical centerline, you **MUST** provide a negative 'x' coordinate. **Do not round it to zero.**
3.  **Right-Side Bias:** If an item is slightly to the right of the vertical centerline, you **MUST** provide a positive 'x' coordinate.
4.  **Center-Only Rule:** You should only provide \`x: 0\` if the item's geometric center is *perfectly* on the vertical centerline of the image.

**COORDINATES FOR GROUPED OR SCATTERED ITEMS:**
- If an element represents a group of multiple items (e.g., "sprinkles," "scattered flowers"), you MUST identify the area with the **highest density** or **most visual prominence** within that group. Place the 'x' and 'y' coordinates at the center of that densest area.
- If the items form a line or arc, provide the coordinate of the middle item in that sequence.
- If the items are evenly distributed with no clear dense area, then (and only then) should you use the visual center of the entire group.
- This ensures that every entry in your JSON, even for groups, has a single representative coordinate for its marker.

**EXAMPLE:**
- For a 1000x800 image:
  - Top-left corner: (-500, 400)
  - Top-right corner: (500, 400)
  - Bottom-left corner: (-500, -400)
  - A point slightly above and to the right of the center could be (50, 100).

**MANDATORY REQUIREMENTS FOR COORDINATES:**
- **ALL DECORATIONS:** For **EVERY** item in the \`main_toppers\`, \`support_elements\`, and \`cake_messages\` arrays, you MUST provide precise integer values for its central 'x' and 'y' coordinates. **It is a critical failure to provide 'x: 0' for items that are not perfectly centered horizontally.**
- **ALL ICING FEATURES:** You MUST identify and provide coordinates for the following features if they exist. Return them in these new, separate top-level arrays in your JSON. Each item in these arrays MUST include a 'description' and precise 'x', 'y' coordinates.
  - **\`drip_effects\`**: The center of any visible drip pattern.
  - **\`icing_surfaces\`**: The center of EACH tier's top and side surface.
  - **\`icing_borders\`**: The center of EACH tier's top and base piped border.
  - **\`base_board\`**: The center of the visible cake board.
- **FAILURE TO PROVIDE COORDINATES FOR ANY ELEMENT WILL RESULT IN AN INVALID RESPONSE.**
`;

        // Fetch the dynamic enums and the active prompt
        const activePrompt = await getActivePrompt();
        const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();

        // Modify the response schema to use the dynamic lists
        const hybridAnalysisResponseSchema = {
            type: Type.OBJECT,
            properties: {
                main_toppers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: mainTopperTypes }, // <-- CHANGE HERE
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
                            type: { type: Type.STRING, enum: supportElementTypes }, // <-- CHANGE HERE
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
                    { text: COORDINATE_PROMPT + activePrompt },
                ],
            }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema,
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
                console.error("Analysis validation error: Missing field", field, JSON.stringify(result, null, 2));
                throw new Error("The AI returned an incomplete analysis. Please try a different image.");
            }
        }

        return result as HybridAnalysisResult;

    } catch (error) {
        console.error("Error analyzing cake image:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        if (error instanceof Error && (
            error.message.includes("doesn't appear to be a cake") ||
            error.message.includes("single cake image") ||
            error.message.includes("cupcake-only images") ||
            error.message.includes("too complex for online pricing") ||
            error.message.includes("in-store consultation") ||
            error.message.includes("incomplete analysis")
        )) {
            throw error;
        }

        throw new Error("The AI failed to analyze the cake design. The image might be unclear or contain unsupported elements.");
    }
};

const SHARE_TEXT_PROMPT = `You are an expert in SEO and creative marketing for a cake shop. Your task is to generate a compelling, SEO-friendly title, description, and alt text for a shared cake design. You will be given a JSON object with the cake's analysis details.

**CRITICAL INSTRUCTION: Identify the Core Theme**
Your most important job is to find the main THEME of the cake. The theme is often a specific brand, character, movie, TV show, anime, K-Pop group, or logo.

**HOW TO FIND THE THEME (CHECK IN THIS ORDER):**
1.  **First, check \`cake_messages\`:** Text written on the cake is the strongest clue. A message like "Happy Birthday, Super Mario" or "KPOP DEMON HUNTERS" DIRECTLY tells you the theme. Prioritize this information above all else.
2.  **Second, check \`main_toppers\`:** Look at the 'description' field for toppers. This is another great source for themes like "1 unicorn topper" or "BTS logo".
3.  **Synthesize:** Combine clues. If a message says "Happy 10th Birthday, Ash" and a topper is "Pikachu", the theme is "Pokemon".

The identified theme MUST be the primary focus of the generated text, especially the title.

**Output Format:** Your response MUST be a single, valid JSON object with the following structure:
{
  "title": "string",
  "description": "string",
  "altText": "string"
}

**Instructions for each field:**

1.  **title:**
    *   **Structure:** "[Theme] Themed [Size] [Type] Cake"
    *   **Prioritize the Theme:** The theme you identified MUST be the first part of the title. Capitalize it appropriately.
    *   **Fallback:** ONLY if no specific theme can be found in messages or toppers, use a descriptive but generic title based on the main topper (e.g., "Character Figure Themed Cake", "Elegant Floral Cake").
    *   **Example (Good):** "KPOP DEMON HUNTERS Themed 6\" Round 1 Tier Cake"
    *   **Example (Bad):** "Character Figures Located On The Top Surface Themed 6\" Round (4\" thickness) 1 Tier Cake"

2.  **description:**
    *   Start with a creative sentence that highlights the theme.
    *   Mention the key decorations from \`main_toppers\` and \`support_elements\`.
    *   Keep it concise and appealing (1-2 sentences).

3.  **altText (for accessibility):**
    *   **Structure:** "A photo of a [Theme] themed cake. It is a [Main Icing Color] [Cake Type] cake decorated with [list of key decorations]."
    *   Be descriptive and clear.
    *   Mention the main color of the cake and list the most important decorations.

Here is the cake analysis data:
`;

const shareableTextResponseSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        altText: { type: Type.STRING },
    },
    required: ['title', 'description', 'altText'],
};


export interface ShareableTexts {
    title: string;
    description: string;
    altText: string;
}

// ============================================================================
// TWO-PHASE ANALYSIS: Fast Feature Detection + Background Coordinate Enrichment
// ============================================================================

/**
 * Phase 1: Fast feature-only analysis (no coordinates)
 * Returns analysis with all coordinates set to 0,0 for immediate UI display
 * This should complete in ~7-10 seconds vs 25+ seconds for full analysis
 */
export const analyzeCakeFeaturesOnly = async (
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
export const enrichAnalysisWithCoordinates = async (
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

// ============================================================================

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

    // Helper function to strip data URI prefix and return only base64 data
    const stripDataUriPrefix = (dataUri: string): string => {
        const base64Prefix = 'base64,';
        const base64Index = dataUri.indexOf(base64Prefix);
        if (base64Index !== -1) {
            return dataUri.substring(base64Index + base64Prefix.length);
        }
        return dataUri; // Already base64 only
    };

    const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];

    // 1. Original Image (Source for style)
    parts.push({ inlineData: { mimeType: originalImage.mimeType, data: stripDataUriPrefix(originalImage.data) } });

    // 2. Reference Image (Source for structure, if provided)
    if (threeTierReferenceImage) {
        parts.push({ inlineData: { mimeType: threeTierReferenceImage.mimeType, data: stripDataUriPrefix(threeTierReferenceImage.data) } });
    }

    // 3. Replacement images for printouts, edible photos, and doodles (main toppers)
    mainToppers.forEach(topper => {
        if (topper.isEnabled && (topper.type === 'printout' || topper.type === 'edible_photo_top' || topper.type === 'icing_doodle') && topper.replacementImage) {
            parts.push({
                inlineData: {
                    mimeType: topper.replacementImage.mimeType,
                    data: stripDataUriPrefix(topper.replacementImage.data)
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
                    data: stripDataUriPrefix(element.replacementImage.data)
                }
            });
        }
    });

    // 5. Text prompt (last, to provide context for all images)
    parts.push({ text: prompt });

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-3-pro-image-preview',
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