// services/geminiService.ts

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";
import { getSupabaseClient } from '../lib/supabase/client';

const geminiApiKey = process.env.API_KEY;

if (!geminiApiKey) {
    throw new Error("API_KEY environment variable not set");
}
  
const ai = new GoogleGenAI({ apiKey: geminiApiKey });
const supabase = getSupabaseClient();

// Cache for dynamic enums
let typeEnumsCache: {
  mainTopperTypes: string[];
  supportElementTypes: string[];
  timestamp: number;
} | null = null;
const ENUM_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes


async function getDynamicTypeEnums(): Promise<{ mainTopperTypes: string[], supportElementTypes: string[] }> {
    const now = Date.now();
  
    if (typeEnumsCache && (now - typeEnumsCache.timestamp < ENUM_CACHE_DURATION)) {
        return { 
            mainTopperTypes: typeEnumsCache.mainTopperTypes, 
            supportElementTypes: typeEnumsCache.supportElementTypes 
        };
    }
  
    const { data, error } = await supabase
        .from('pricing_rules')
        .select('item_type, category')
        .eq('is_active', true)
        .not('item_type', 'is', null);
  
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

    if (result.mainTopperTypes.length === 0 || result.supportElementTypes.length === 0) {
         console.warn('Fetched dynamic enums but one or both lists are empty, using hardcoded fallback enums.');
         return fallbackEnums;
    }

    typeEnumsCache = {
        ...result,
        timestamp: now
    };
  
    return result;
}

export function clearPromptCache() {
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

const SYSTEM_INSTRUCTION = `You are an expert cake designer analyzing a cake image to identify design elements for pricing and customization. Your response must be a valid JSON object.

**GLOBAL RULES:**
1.  **JSON Output:** Your entire response MUST be a single, valid JSON object that adheres to the provided schema. Do not include any text, explanations, or markdown formatting outside of the JSON structure.
2.  **Color Palette:** For any color field in your response (like icing or message colors), you MUST use the closest matching hex code from this specific list: Red (#EF4444), Light Red (#FCA5A5), Orange (#F97316), Yellow (#EAB308), Green (#16A34A), Light Green (#4ADE80), Teal (#14B8A6), Blue (#3B82F6), Light Blue (#93C5FD), Purple (#8B5CF6), Light Purple (#C4B5FD), Pink (#EC4899), Light Pink (#FBCFE8), Brown (#78350F), Light Brown (#B45309), Gray (#64748B), White (#FFFFFF), Black (#000000).
3.  **Consistency:** The 'description' for an item should always align with its final 'type' classification. For example, if you classify something as a 'printout', describe it as a "printout of [character]".
`;

const FALLBACK_PROMPT = `# GENIE.PH MASTER CAKE ANALYSIS PROMPT  
**v3.4 Version**  
═══════════════════════════════════════════════════════════════════════════════

## ROLE  
Expert cake analyst for Genie.ph. Identify *what* is on cake — not cost. Output: **single valid JSON**.

---

## OUTPUT RULES  
- ✅ Valid JSON only  
- ✅ All keys lowercase  
- ✅ Empty arrays allowed; missing keys ❌  
- ✅ Colors: **only from approved palette** (see end)

---

## STEP 1: IMAGE VALIDATION — STOP & REJECT IF ANY APPLY  

| Reason | Message |
|--------|---------|
| \`not_a_cake\` | "This image doesn't appear to be a cake. Please upload a cake image." |
| \`multiple_cakes\` | "Please upload a single cake image. This image contains multiple cakes." *(Note: tiered = 1 cake)* |
| \`cupcakes_only\` | "We currently don't process cupcake-only images. Please upload a cake design." |
| \`complex_sculpture\` | "This cake design is too complex for online pricing. Please contact us for a custom quote." |
| \`large_wedding_cake\` | "Large wedding cakes require in-store consultation for accurate pricing." *(≥4 tiers or elaborate structure)* |

**→ If reject, output ONLY:**  
\`\`\`json
{"rejection":{"isRejected":true,"reason":"...","message":"..."}}
\`\`\`

---

## STEP 2: ACCEPTED IMAGE — REQUIRED TOP-LEVEL KEYS  
\`\`\`json
{
  "cakeType": "...",
  "cakeThickness": "...",
  "main_toppers": [...],
  "support_elements": [...],
  "cake_messages": [...],
  "icing_design": {...},
  "dominant_colors": [...]
}
\`\`\`

---

## CATEGORY 1: TYPE & THICKNESS  

| Field | Options |
|-------|---------|
| \`cakeType\` | \`"1 Tier"\`, \`"2 Tier"\`, \`"3 Tier"\`, \`"1 Tier Fondant"\`, \`"2 Tier Fondant"\`, \`"3 Tier Fondant"\`, \`"Square"\`, \`"Rectangle"\`, \`"Bento"\` |
| \`cakeThickness\` | \`"2 in"\`, \`"3 in"\`, \`"4 in"\`, \`"5 in"\`, \`"6 in"\` |

---

## CATEGORY 2 & 3: MAIN TOPPERS & SUPPORT ELEMENTS
- Identify ALL elements. Group identical items using a descriptive, snake_cased \`group_id\`.
- Classify as 'hero' (main focus) or 'support' (background detail).

**CRITICAL TOPPER IDENTIFICATION GUIDE (Follow Strictly):**
Differentiating \`printout\` from \`cardstock\` is your most critical task.

| Type | **\`cardstock\` (STRICT DEFINITION)** | **\`printout\` (BROAD DEFINITION)** |
|---|---|---|
| **Material** | Shapes cut from **SOLID-COLORED** paper. Can have special textures: matte, **glittery, or metallic/foil**. | A **full-color IMAGE PRINTED** onto paper, then cut out. |
| **Colors** | Each piece is a **single, flat color**. Can be layered with other solid colors. | Contains **gradients, shading, photographic detail**. Many colors in one piece. |
| **Examples** | A glittery "Happy Birthday", a black silhouette, simple layered shapes. | A photo of a character (like Super Mario), a detailed anime drawing, any complex logo. |
| **CRITICAL RULE** | **NEVER** use for a full-color printed character. | **ALWAYS** use for a full-color printed character. |


### MAIN TOPPER JSON
\`\`\`json
{
  "description": "...",
  "type": "candle|toy|cardstock|edible_photo|printout|edible_3d_ordinary|edible_3d_complex|...",
  "group_id": "group_id",
  "classification": "hero",
  "size": "tiny|small|medium|large",
  "quantity": 1
}
\`\`\`

### SUPPORT ELEMENT JSON
\`\`\`json
{
  "description": "...",
  "type": "...",
  "group_id": "group_id",
  "classification": "support",
  "coverage": "light|medium|heavy",
  "quantity": X,
  "subtype": "..."
}
\`\`\`

---

## CATEGORY 4: CAKE MESSAGES
**NOTE:** Apply the same logic for 'printout' vs 'cardstock' as defined above. A printed message is a 'printout'.

\`\`\`json
{
  "type": "gumpaste_letters|icing_script|printout|cardstock",
  "text": "Visible text",
  "position": "top|side|base_board",
  "color": "#HEXCODE"
}
\`\`\`

---

## CATEGORY 5: ICING DESIGN  

**→ Rule for \`gumpasteBaseBoard\`:** Set to \`true\` **ONLY** if the cake board is covered in a colored, edible material (fondant/gumpaste). If the board is a standard white, silver, or gold foil board, set to \`false\`.

\`\`\`json
{
  "base": "soft_icing|fondant",
  "color_type": "single|gradient_2|gradient_3|abstract",
  "colors": {
    "side": "#HEX",
    "top": "#HEX",
    "borderTop": "#HEX",
    "borderBase": "#HEX",
    "drip": "#HEX",
    "gumpasteBaseBoardColor": "#HEX"
  },
  "border_top": true|false,
  "border_base": true|false,
  "drip": true|false,
  "gumpasteBaseBoard": true|false
}
\`\`\`

---

## CATEGORY 6: DOMINANT COLORS
Identify the **3 to 7 most visually significant colors** in the cake and its main decorations.
- Focus ONLY on major areas like icing, large toppers, and prominent patterns.
- **IGNORE** tiny, insignificant specks of color like individual sprinkles, small dots, or reflections.
- The goal is to provide a user with a concise, useful palette for customization, not a list of every single color present.
- Output MUST be an array of hex codes from the approved palette.
"dominant_colors": ["#HEXCODE1", "#HEXCODE2", ...]

---

## COLOR PALETTE (USE EXACT HEX)  
\`#EF4444\` (Red), \`#FCA5A5\` (Light Red), \`#F97316\` (Orange), \`#EAB308\` (Yellow), \`#16A34A\` (Green), \`#4ADE80\` (Light Green), \`#14B8A6\` (Teal), \`#3B82F6\` (Blue), \`#93C5FD\` (Light Blue), \`#8B5CF6\` (Purple), \`#C4B5FD\` (Light Purple), \`#EC4899\` (Pink), \`#FBCFE8\` (Light Pink), \`#78350F\` (Brown), \`#B45309\` (Light Brown), \`#64748B\` (Gray), \`#FFFFFF\` (White), \`#000000\` (Black)
`;

const getBaseSchema = async () => {
    const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();
    return {
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
                        subtype: { type: Type.STRING },
                    },
                    required: ['type', 'description', 'size', 'quantity', 'group_id']
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
                        subtype: { type: Type.STRING },
                        quantity: { type: Type.INTEGER },
                    },
                    required: ['type', 'description', 'coverage', 'group_id']
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
                    },
                    required: ['type', 'text', 'position', 'color']
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
            dominant_colors: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
        },
        required: ['cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
    };
};

const handleGeminiError = (error: unknown) => {
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
};

export const analyzeCakeFeatures = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    try {
        const activePrompt = FALLBACK_PROMPT;
        const schema = await getBaseSchema();

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: activePrompt },
                ],
            }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: schema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        if (result.rejection?.isRejected) {
            throw new Error(result.rejection.message || "The uploaded image is not suitable for processing.");
        }
        return result as HybridAnalysisResult;

    } catch (error) {
        handleGeminiError(error);
        return {} as HybridAnalysisResult; // Should be unreachable
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