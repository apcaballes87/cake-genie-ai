// services/geminiService.ts

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!geminiApiKey) {
    throw new Error("VITE_GEMINI_API_KEY environment variable not set. Please add it to your .env.local file or Vercel environment variables.");
}
  
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

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

Based on the image, classify it into ONE of the following categories:

- "valid_single_cake": A single, clear image of one cake. It can be a bento, 1-3 tier, square, rectangle, or fondant cake. Cupcakes may be present on the side, but the main focus is a single cake.
- "not_a_cake": The image does not contain a cake. It might be a person, object, or scene that isn't cake-like.
- "multiple_cakes": The image clearly shows two or more separate cakes of significant size (not including a main cake with cupcakes).
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
        const response = await ai.models.generateContent({
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
`;

const ANALYSIS_PROMPT_CONTENTS = `
**CORE DECORATION PHILOSOPHY: Hero vs. Support (VERY IMPORTANT)**
Before you begin, you must understand the two fundamental types of decorations. Your primary task is to classify every single decoration into one of these two roles. Location (top vs. side) DOES NOT determine the category; the item's function does.

1.  **HERO Elements**:
    *   **Function**: These are the main subject and focal point of the cake. They define the theme. A cake typically has only 1 or 2 Hero elements.
    *   **Ask Yourself**: Is this item the *reason* for the cake's design? If you removed it, would the theme be lost?
    *   **Examples**: A detailed, hand-sculpted Spider-Man figure; a large, elegant "Mr. & Mrs." wedding topper; a prominent printed logo that *is* the theme.
    *   **Placement**: Hero elements will be placed in the \`main_toppers\` array.

2.  **SUPPORT Elements**:
    *   **Function**: These are all other decorations. They build the atmosphere, add texture, or act as fillers and accents. They support the theme but are not the main subject.
    *   **Ask Yourself**: Is this item part of the background, a texture, or a scattered decorative flourish?
    *   **Examples**: Sprinkles, small gumpaste stars/hearts, chocolate bars, meringue pops, isomalt shards, individual flowers in a bouquet, and ALL textural icing finishes (like palette knife strokes or splatters).
    *   **CRITICAL**: Support elements belong in the \`support_elements\` array **REGARDLESS of their location**. A small flower on top of the cake is still a Support element. Palette knife strokes on the top and sides are one group of Support elements.
    *   **Placement**: ALL Support elements go into the \`support_elements\` array.

**GROUPING IS MANDATORY FOR SUPPORT ELEMENTS**
This is a critical rule for pricing. You MUST group similar Support Elements into a single entry, even if their colors or exact sizes differ.
-   **Example 1 (Flowers):** If there are 3 pink roses and 2 white roses scattered on the cake, they MUST become a single entry in \`support_elements\` with \`description: 'group of 5 assorted roses'\`.
-   **Example 2 (Textures):** If abstract palette knife strokes in blue and white appear on the sides AND on the top edge, you MUST create a single entry in \`support_elements\` for 'abstract blue and white palette knife strokes'. DO NOT create a separate entry in \`main_toppers\` for the strokes on top. They are one single, continuous design feature.

**OBJECTIVE SIZING & COVERAGE SYSTEMS**

*   **Topper Sizing (for Hero elements):**
    1.  Establish cake tier thickness (default 4 inches).
    2.  Estimate topper height relative to tier thickness.
    3.  Classify size: 'large' (>1.0x tier), 'medium' (0.6x-1.0x), 'small' (0.4x-0.6x), 'tiny' (≤0.4x).

*   **Support Group Coverage (for Support elements):**
    1.  Assess the entire group of similar items.
    2.  Classify coverage: 'large' (>15 items or >40% of a tier's side), 'medium' (6-15 items), 'small' (2-5 items), 'tiny' (1 item or sparse scatter).

**CRITICAL RULE: ICING DECORATION IDENTIFICATION**
-   **Simple piped icing** (swirls, rosettes, shell borders) are part of the fundamental icing design and MUST NOT be listed as a decoration.
-   **Complex icing techniques** ARE decorations. Classify them as **Support Elements** and place them in the \`support_elements\` array. These include: 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread'.

**CRITICAL RULE: FLOWER CLASSIFICATION**
You MUST distinguish between 3D gumpaste flowers and painterly icing flowers.
-   **Gumpaste Flowers (type: 'edible_flowers'):** 3D, sculptural, matte finish. Classify as a **Support Element**.
-   **Icing Flowers (type: 'icing_palette_knife'):** 2D, painterly, glossy. Classify as a **Support Element**.

Now, analyze the image and provide a JSON object with these 6 categories:

1. **cakeType**: Choose the best fit from this list: 1 Tier, 2 Tier, 3 Tier, 1 Tier Fondant, 2 Tier Fondant, 3 Tier Fondant, Square, Rectangle, Bento. 
   - **Bento Definition:** A "Bento" cake is a small, personal-sized cake, typically 4 inches in diameter and 2 inches thick.

2. **cakeThickness**: Choose the best fit from this list: 2 in, 3 in, 4 in, 5 in, 6 in.
   - **Heuristics:** Bento (2-3 in), Standard (4 in), Tall (5-6 in). Default to 4 in if uncertain.

3. **main_toppers** (array for HERO ELEMENTS ONLY):
   - This array is for the primary, focal-point decorations that you identified as **Hero Elements**.
   - If an item is just a decorative accent (like a sprinkle or small flower), it does NOT belong here, even if it's on top of the cake. Put it in \`support_elements\`.
   - If there are no Hero elements, this array MUST be empty.
   
   **GUMPASTE TOPPER CLASSIFICATION (High Priority)**
   You MUST classify 3D gumpaste/fondant Hero toppers into one of two categories:
   1.  **'edible_3d_complex'**: Highly detailed, hand-sculpted figures (characters, animals, complex structures).
   2.  **'edible_3d_ordinary'**: Simpler 3D items (ribbons, bows, simple 3D shapes).

   **TOPPER IDENTIFICATION LADDER (Apply in order of precedence):**
   - **T1) PRINTOUT CHECK:** A topper is 'printout' if it has 2+ cues: visible white cut edge, paper thickness, printed dot pattern, support stick taped behind, flat 2D look, printed logos.
   - **T2) TOY CHECK:** A topper is 'toy' if it has 2+ cues: known licensed character, glossy plastic look, mold seams, factory base.
   - **T3) EDIBLE 3D CHECK:** A topper is 'edible_3d_...' if it has a matte/powdery finish, hand-modeled imperfections, or an embedded support stick. Then, classify its complexity.
   - **DEFAULT:** If unsure, classify as **'printout'**.

   **Material Definitions:**
   - **'edible_3d_complex'**: Hand-sculpted, detailed gumpaste figures.
   - **'edible_3d_ordinary'**: Simpler hand-sculpted gumpaste objects.
   - **'printout'**: Printed images on paper/card.
   - **'toy'**: Plastic/resin factory-made figures.
   - **'plastic_ball'**: Non-edible plastic spheres.
   - **'cardstock'**: Stiff colored paper (glitter, metallic).
   - **'edible_photo'**: Photo printed on edible sheet applied to icing.
   - **'meringue_pop'**: Piped icing swirls on sticks.

4. **support_elements** (array for ALL SUPPORT ELEMENTS):
    - This array is for ALL decorative items that you identified as **Support Elements**.
    - This includes all fillers, textures, and scattered items, **regardless of whether they are on the top, sides, or base board of the cake**.
    - Remember to follow the **GROUPING IS MANDATORY** rule defined at the top for all items in this array.

    **SPECIAL COVERAGE RULE FOR 'edible_photo_side' (PRIORITY)**
    If you identify an 'edible_photo_side' (a printed image wrap), use these specific rules for 'coverage':
    - **'large'**: Full wrap on a large cake ('10" Round', 'Rectangle', '2 Tier', '3 Tier').
    - **'medium'**: Full wrap on a small/medium cake ('6" Round', '8" Round', 'Square').
    - **'small'**: Partial or half wrap.
    - **'tiny'**: Small, isolated logo or 1-3 characters.

    **SUPPORT GUMPASTE CLASSIFICATION**
    - **'edible_3d_support'**: Small, simple 3D gumpaste items (rocks, tiny clouds).
    - **'edible_2d_support'**: Flat 2D gumpaste shapes, stripes, or panels.

   **Material Definitions:**
   - **'edible_3d_support'**: Small, simple 3D gumpaste items.
   - **'edible_2d_support'**: Flat 2D gumpaste shapes, stripes.
   - **'chocolates'**: Chocolate bars, spheres, drips, shards.
   - **'sprinkles'**: Tiny decorative particles.
   - **'dragees'**: Sugar pearls.
   - **'support_printout'**: Smaller printed images.
   - **'isomalt'**: Hard, clear or colored sugar work.
   - **'edible_flowers'**: Sugar flowers.
   - **'edible_photo_side'**: Edible photo wrap on the side.
   - **'icing_doodle'**: Piped line-art.
   - **'icing_palette_knife'**: Textured icing.
   
5. **cake_messages** (array):
   - type: 'gumpaste_letters', 'icing_script', 'printout', 'cardstock'
   - text: Actual words/numbers visible
   - position: top/side/base_board
   - color: Closest hex from Global Color Palette

6. **icing_design**:
   - **Base**: 'soft_icing' (sharp top edge) or 'fondant' (rounded top edge).
   - **gumpasteBaseBoard**: \`true\` only if the board is a solid color, has a ribbon, or matches fondant texture.
   - **Color Type**: single, gradient_2, gradient_3, abstract
   - **Colors**: Object with hex codes for: "side", "top", "borderTop", "borderBase", "drip", "gumpasteBaseBoardColor"
   - **Features**: 'drip', 'border_top', 'border_base', 'gumpasteBaseBoard' (all true/false).
`;

const hybridAnalysisResponseSchema = {
    type: Type.OBJECT,
    properties: {
        main_toppers: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['edible_3d_complex', 'edible_3d_ordinary', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'] },
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
                    type: { type: Type.STRING, enum: ['edible_3d_support', 'edible_2d_support', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'dragees', 'edible_flowers', 'edible_photo_side', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread'] },
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
3.  **X-Axis:** The horizontal axis. It ranges from -${dimensions.width / 2} (far left edge) to +${dimensions.width / 2} (far right edge).
4.  **Y-Axis:** The vertical axis. It ranges from -${dimensions.height / 2} (bottom edge) to +${dimensions.height / 2} (top edge). **Positive Y values go UPWARDS.**

**COORDINATES FOR GROUPED OR SCATTERED ITEMS:**
- If an element represents a group of multiple items (e.g., "5 assorted stars," "sprinkles," "scattered paw prints"), you MUST determine the visual center of the entire group and provide the 'x' and 'y' coordinates for that single, central point.
- If the items form a line or arc, provide the coordinate of the middle item in that sequence.
- If the items are scattered across an area, provide the coordinate for the geometric center of that area.
- This ensures that every entry in your JSON, even for groups, has a single representative coordinate for its marker.

**EXAMPLE:**
- For a 1000x800 image:
  - Top-left corner: (-500, 400)
  - Top-right corner: (500, 400)
  - Bottom-left corner: (-500, -400)
  - A point slightly above and to the right of the center could be (50, 100).

**MANDATORY REQUIREMENTS FOR COORDINATES:**
- **ALL DECORATIONS:** For **EVERY** item in the \`main_toppers\`, \`support_elements\`, and \`cake_messages\` arrays, you MUST provide precise integer values for its central 'x' and 'y' coordinates. This is not optional.
- **ALL ICING FEATURES:** You MUST identify and provide coordinates for the following features if they exist. Return them in these new, separate top-level arrays in your JSON. Each item in these arrays MUST include a 'description' and precise 'x', 'y' coordinates.
  - **\`drip_effects\`**: The center of any visible drip pattern.
  - **\`icing_surfaces\`**: The center of EACH tier's top and side surface.
  - **\`icing_borders\`**: The center of EACH tier's top and base piped border.
  - **\`base_board\`**: The center of the visible cake board.
- **FAILURE TO PROVIDE COORDINATES FOR ANY ELEMENT WILL RESULT IN AN INVALID RESPONSE.**
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: COORDINATE_PROMPT + ANALYSIS_PROMPT_CONTENTS },
                ],
            }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema,
                temperature: 0.1,
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

export const generateShareableTexts = async (
    analysisResult: HybridAnalysisResult,
    cakeInfo: CakeInfoUI,
    HEX_TO_COLOR_NAME_MAP: Record<string, string>
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

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { text: SHARE_TEXT_PROMPT },
                    { text: `\`\`\`json\n${JSON.stringify(simplifiedAnalysis, null, 2)}\n\`\`\`` },
                ],
            }],
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
                systemInstruction: systemInstruction,
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