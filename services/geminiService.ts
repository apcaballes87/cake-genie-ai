import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
  
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

const colorListString = COLORS.map(c => `${c.name} (${c.hex})`).join(', ');

const NEW_HYBRID_PROMPT = `
You are an expert cake designer analyzing a cake image to identify design elements for pricing and customization. Your response must be a valid JSON object.

**Color Palette:** For any color field in your response (like icing or message colors), you MUST use the closest matching hex code from this specific list: ${colorListString}.

Now, analyze the image and provide a JSON object with these 6 categories:

1.  **cakeType**: Choose the best fit from this list: ${CAKE_TYPES.join(', ')}. A "Bento" cake is a small, personal-sized cake, typically 4 inches in diameter and 2 inches thick, often packaged in a clamshell box.
2.  **cakeThickness**: Choose the best fit from this list: ${CAKE_THICKNESSES.join(', ')}.

3.  **main_toppers** (focal points on top/prominent on cake):
    *   **CRITICAL DECISION FRAMEWORKS (APPLY THESE FIRST):**

    *   **1. TOPPER IDENTIFICATION LADDER (Apply in order of precedence):**
        *   **T1) PRINTOUT CHECK:** A topper is a 'printout' if it has **2 or more** of these cues: a visible thin white cut edge/halo; visible paper thickness (0.2-0.6mm); a printed dot pattern texture; or a support stick taped behind it (not embedded in the topper).
        *   **T2) TOY CHECK:** A topper is a 'toy' if it has **2 or more** of these cues: true 3D volume with parallax effect from different angles; glossy plastic specular highlights; visible injection mold seams/marks; a factory-made base or stand; or thick, rounded edges typical of molded plastic.
        *   **T3) EDIBLE 3D CHECK:** A topper is 'edible_3d' if it has **2 or more** of these cues: a matte, soft, or powdery finish; visible signs of being hand-modeled (minor imperfections, asymmetry); soft, hand-formed edges; an embedded support stick (not taped); or visible sculpting tool marks.
        *   **DEFAULT RULE:** If a topper does not meet the 2-cue threshold for any category, classify it as **'printout'**.

    *   **2. OBJECTIVE SIZE CLASSIFICATION:**
        *   First, estimate the thickness of the cake tier the topper is on.
        *   Then, classify the topper's size based on its height relative to the tier thickness:
            - **'large'**: Height is > 1.0× tier thickness.
            - **'medium'**: Height is > 0.5× and ≤ 1.0× tier thickness.
            - **'small'**: Height is ≤ 0.5× tier thickness.
            - **'partial'**: Height is < 0.25x tier thickness (e.g., small flowers, stars).

    *   **3. HERO VS SUPPORT CLASSIFICATION:**
        *   **'hero' (full price, no allowance):** Classify as 'hero' if it is:
            - Any 'medium' or 'large' 'edible_3d' topper.
            - A 'small' topper that is the clear visual focal point (e.g., occupies more than 10% of the top surface area, or is the single central character).
            - The cake has only 1 or 2 small characters in total.
        *   **'support' (subject to allowance):** Classify as 'support' if it is:
            - Part of decorative scene/panel work on the sides of the cake.
            - A cluster of 3 or more small characters/items bundled together.
            - A background element (e.g., trees, clouds behind a main character).

    *   **Material Definitions & Final instructions:**
    *   IMPORTANT: Decorations made directly from piped icing (like swirls, rosettes, or piped writing) are NOT considered main toppers. Do not include them in this list.
    *   Also identify these material types if the ladder doesn't apply:
        - **'edible_2d_gumpaste'**: Flat, cut-out shapes made from hardened sugar paste (gumpaste/fondant).
        - **'cardstock'**: A topper cut from stiff, colored paper (glitter, metallic, etc.). NOT printed.
        - **'edible_photo'**: A photo printed on an edible sheet and applied seamlessly to the icing.
    *   Group similar items (e.g., "3 unicorn printouts") and give them the same group_id.
    *   For each main topper, you MUST include: type, description, size (from Objective Size Classification), quantity, group_id, and **classification** (from Hero vs Support Classification).

4.  **support_elements** (decorative, not focal):
    *   Identify each support element and classify its material using these specific types:
        - **'gumpaste_panel'**: A significant side decoration made from flat, cut pieces of gumpaste, often forming a scene or pattern.
        - **'small_gumpaste'**: Smaller, individual gumpaste items like stars, flowers, or dots that are not the main focus.
        - **'chocolates'**: Includes chocolate bars, spheres, drips, or shards used decoratively.
        - **'sprinkles'**: Tiny decorative particles like nonpareils, jimmies, or edible glitter.
        - **'support_printout'**: Smaller printed images used as background or secondary decoration, distinct from main character toppers.
        - **'isomalt'**: Hard, clear or colored sugar work, often creating a glass-like or gemstone effect (e.g., 'sail', 'shards').
    *   Group similar items (e.g., 'small gumpaste stars') and give them the same group_id.
    *   For each group, include: type, a brief description, coverage (light/medium/heavy/none), and a group_id.

5.  **cake_messages** (array):
    *   For each distinct message on the cake, create a separate object. If no message, return an empty array.
    *   Identify text/numbers visible.
    *   Note type: gumpaste_letters, icing_script, printout, or cardstock.
    *   Record actual text content, position (top/side/base_board), and color (using the closest hex from the **Color Palette** above).

6.  **icing_design**:
    *   Base: soft_icing or fondant.
    *   Color Type: single, gradient_2, gradient_3, abstract.
    *   Colors: An object with hex codes. For each part, find the CLOSEST MATCH from the **Color Palette**. If a part (like side icing, top icing, or a drip) has a clear color, you MUST include its key and the matching hex code. Keys are: "side", "top", "borderTop", "borderBase", "drip", "gumpasteBaseBoardColor".
    *   Features: Set 'drip' to true if a drip effect is clearly visible, otherwise false. Set border_top/border_base to true if they exist. Set 'gumpasteBaseBoard' to true if the cake board is covered in fondant/gumpaste, otherwise false.

GROUPING RULES:
- Group identical/similar items as one entry with a shared group_id.
- Use coverage terms for scattered items (chocolates, sprinkles).
- Combine side decorations as "panel" or "scene" work.

FOCUS ON:
- What customers would customize (not every tiny detail).
- Material type (edible_3d, printout, toy).
- Visual prominence (main vs support).
`;

const hybridAnalysisResponseSchema = {
    type: Type.OBJECT,
    properties: {
        main_toppers: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['edible_3d', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo', 'edible_2d_gumpaste'] },
                    description: { type: Type.STRING },
                    size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'partial'] },
                    quantity: { type: Type.INTEGER },
                    group_id: { type: Type.STRING },
                    classification: { type: Type.STRING, enum: ['hero', 'support'] }
                },
                required: ['type', 'description', 'size', 'quantity', 'group_id', 'classification']
            }
        },
        support_elements: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['gumpaste_panel', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'small_gumpaste'] },
                    description: { type: Type.STRING },
                    coverage: { type: Type.STRING, enum: ['light', 'medium', 'heavy', 'none'] },
                    group_id: { type: Type.STRING }
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
                    color: { type: Type.STRING }
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
    },
    required: ['main_toppers', 'support_elements', 'cake_messages', 'icing_design', 'cakeType', 'cakeThickness']
};

export const analyzeCakeImage = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: NEW_HYBRID_PROMPT },
                ],
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema,
                temperature: 0.1,
            },
        });

        // The response text is a JSON string, so we parse it.
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as HybridAnalysisResult;

    } catch (error) {
        console.error("Error analyzing cake image:", error);
        throw new Error("The AI failed to analyze the cake design. The image might be unclear or contain unsupported elements.");
    }
};


export const EDIT_CAKE_PROMPT_TEMPLATE = (
    originalSpec: { type: CakeType, thickness: CakeThickness, icing_design: IcingDesign },
    newCakeInfo: CakeInfoUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    additionalInstructions: string
) => {

    const colorName = (hex: string | undefined) => {
        if (!hex) return 'not specified';
        const foundColor = COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
        return foundColor ? `${foundColor.name} (${hex})` : hex;
    }

    let prompt = `You are a master digital cake artist. Your task is to meticulously edit the provided cake image according to the detailed list of modifications below. Your final output must be ONLY the new, edited image.

**Overall Goal:** Recreate the cake with the following changes, preserving the original style, lighting, and camera angle.

---

### **1. Foundational Change: Cake Structure (HIGHEST PRIORITY)**
This is the most important instruction. You must transform the cake's core structure from its original form to the new target.
- **Original Structure:** A "${originalSpec.type}" cake with "${originalSpec.thickness}" thickness.
- **NEW Target Structure:** A "${newCakeInfo.type}" cake, "${newCakeInfo.thickness}" thick, with a size of "${newCakeInfo.size}".

---

### **2. Detailed Design Edits**
Apply these changes sequentially to the new cake structure.

#### **A. Main Toppers (Focal Decorations)**
`;
    const activeToppers = mainToppers.filter(t => t.isEnabled);
    const removedToppers = mainToppers.filter(t => !t.isEnabled);

    if (activeToppers.length > 0) {
        prompt += "**ADD/KEEP/MODIFY the following toppers:**\n";

        const toConvertPrintout = activeToppers.filter(t => t.type === 'printout' && t.original_type !== 'printout' && !t.replacementImage);
        const toReplaceWithImage = activeToppers.filter(t => t.type === 'printout' && t.replacementImage);
        const otherToppers = activeToppers.filter(t => !toConvertPrintout.includes(t) && !toReplaceWithImage.includes(t));

        // Instruction for converting to printout - very explicit and per-item
        toConvertPrintout.forEach(t => {
            prompt += `- Change the "${t.description}" main edible topper to a 2D printed cut-out topper with white outlines. This replaces the original topper. The printout should depict a 2d flat graphic design version of the subject, have the same size (${t.size}), and quantity (${t.quantity}).\n`;
        });

        // Instruction for replacing with uploaded image
        toReplaceWithImage.forEach(t => {
            prompt += `- Replace the original "${t.description}" topper with a new printout topper featuring the subject from the separate user-provided image. Size: ${t.size}, Quantity: ${t.quantity}.\n`;
        });

        // Instruction for keeping other toppers as is
        otherToppers.forEach(t => {
            prompt += `- Keep the ${t.quantity}x "${t.description}" (size: ${t.size}) topper as a ${t.type}.\n`;
        });

    } else {
        prompt += "**REMOVE ALL main toppers.**\n";
    }

    if (removedToppers.length > 0) {
        prompt += "\n**REMOVE the following specific toppers:**\n";
        removedToppers.forEach(t => {
            prompt += `- Do NOT include the original "${t.description}" topper.\n`;
        });
    }


    prompt += `
#### **B. Support Elements (Secondary Decorations)**
`;

    const activeSupport = supportElements.filter(s => s.isEnabled);
    const removedSupport = supportElements.filter(s => !s.isEnabled);

    if (activeSupport.length > 0) {
        prompt += "**ADD/KEEP the following support elements:**\n";
        activeSupport.forEach(s => {
            prompt += `- "${s.description}" (${s.coverage} coverage, as ${s.type}).\n`;
        });
    } else {
        prompt += "**REMOVE ALL support elements.**\n";
    }

    if (removedSupport.length > 0) {
        prompt += "**REMOVE the following specific support elements:**\n";
        removedSupport.forEach(s => {
            prompt += `- Do NOT include the original "${s.description}".\n`;
        });
    }
    
    prompt += `
#### **C. Icing & Surface Design**
- **Base Icing Type:** The cake must be covered in **${icingDesign.base}**.
`;
    // Icing Colors
    if (icingDesign.colors.side) {
        prompt += `- **Side Icing Color:** Change to **${colorName(icingDesign.colors.side)}**. Do not keep the original color.\n`;
    } else {
        prompt += `- **Side Icing Color:** Keep the original color and pattern.\n`;
    }
    if (icingDesign.colors.top) {
        prompt += `- **Top Icing Color:** Change to **${colorName(icingDesign.colors.top)}**. Do not keep the original color.\n`;
    } else {
        prompt += `- **Top Icing Color:** Keep the original color and pattern.\n`;
    }

    // Borders
    if (icingDesign.border_top) {
        if (originalSpec.icing_design.border_top) {
            prompt += `- **Top Border:** Change the color of the existing pipe shell border to **${colorName(icingDesign.colors.borderTop)}**.\n`;
        } else {
            prompt += `- **Top Border:** Add a pipe shell border with color **${colorName(icingDesign.colors.borderTop)}**.\n`;
        }
    } else {
        prompt += `- **Top Border:** REMOVE any top border.\n`;
    }
    if (icingDesign.border_base) {
        if (originalSpec.icing_design.border_base) {
            prompt += `- **Base Border:** Change the color of the existing pipe shell border to **${colorName(icingDesign.colors.borderBase)}**.\n`;
        } else {
            prompt += `- **Base Border:** Add a pipe shell border with color **${colorName(icingDesign.colors.borderBase)}**.\n`;
        }
    } else {
        prompt += `- **Base Border:** REMOVE any base border.\n`;
    }

    // Drip
    if (icingDesign.drip) {
        prompt += `- **Drip Effect:** Add/change to a drip effect with color **${colorName(icingDesign.colors.drip)}**. Retain the original drip coverage, just change the color.\n`;
    } else {
        prompt += `- **Drip Effect:** REMOVE any drip effect.\n`;
    }

    // Baseboard
    if (icingDesign.gumpasteBaseBoard) {
        prompt += `- **Cake Board:** The cake board must be covered in gumpaste with the color **${colorName(icingDesign.colors.gumpasteBaseBoardColor)}**.\n`;
    } else {
        prompt += `- **Cake Board:** The cake board should NOT be covered in gumpaste; show a standard silver or white board.\n`;
    }

    prompt += `
#### **D. Cake Messages**
- **Message Editing Rule:** You must edit the cake's message. First, find any text written on the original cake. Carefully erase **only the letters/script** of that original text. **DO NOT remove any background element the text is on**, such as a gumpaste banner, plaque, or the cake's surface icing. The area should be clean.
`;

    const activeMessages = cakeMessages.filter(m => m.isEnabled);
    if (activeMessages.length > 0) {
        prompt += "- **Now, add the following new messages onto the cake:**\n";
        activeMessages.forEach(m => {
            prompt += `- Write the text **"${m.text}"** on the **${m.position}** of the cake. The message must be made of ${m.type} and have the color **${colorName(m.color)}**.\n`;
        });
    } else {
        prompt += "- **Final State:** The cake should have no messages on it. Ensure the area where the original text was is seamlessly blended with the background.\n";
    }

    prompt += "\n---";

    if (additionalInstructions.trim()) {
        prompt += `
### **3. Overriding User Instructions**
These are special instructions from the user. Apply them carefully after all the above edits.
- ${additionalInstructions.trim()}
`;
    }

    prompt += `
---
**Final Check:** Before generating, double-check that every single instruction above has been followed, especially the **foundational structure change**. The final image should be a photorealistic representation of the customized cake. Do not output any text, only the image.`;

    return prompt;
}

export const editCakeImage = async (
    prompt: string,
    originalImage: { data: string; mimeType: string; },
    mainToppers: MainTopperUI[]
): Promise<string> => {

    const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [
        { inlineData: { mimeType: originalImage.mimeType, data: originalImage.data } },
        { text: prompt },
    ];
    
    // Add replacement images for printouts
    mainToppers.forEach(topper => {
        if (topper.isEnabled && topper.type === 'printout' && topper.replacementImage) {
            parts.push({ 
                inlineData: { 
                    mimeType: topper.replacementImage.mimeType, 
                    data: topper.replacementImage.data 
                } 
            });
        }
    });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        
        // If no image is returned, check for text which might contain an error/refusal
        const refusalText = response.text?.trim();
        if (refusalText) {
             throw new Error(`The AI could not generate the image. Reason: ${refusalText}`);
        }

        throw new Error("The AI did not return an image. Please try again.");

    } catch (error) {
        console.error("Error editing cake image:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings. Please modify your instructions and try again.");
        }
        throw error;
    }
};