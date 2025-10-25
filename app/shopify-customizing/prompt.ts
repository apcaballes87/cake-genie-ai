// app/shopify-customizing/prompt.ts

import { COLORS } from '../../constants';
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI } from '../../types';

const colorName = (hex: string | undefined) => {
    if (!hex) return 'not specified';
    const foundColor = COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
    return foundColor ? `${foundColor.name} (${hex})` : hex;
};

/**
 * Creates a specialized prompt for editing a professional Shopify product photo.
 * This prompt emphasizes photorealism and preserving the original image's quality.
 */
export const createShopifyEditPrompt = (
    originalAnalysis: HybridAnalysisResult | null,
    newCakeInfo: CakeInfoUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    additionalInstructions: string
): string => {
    if (!originalAnalysis) return ""; // Guard clause

    let prompt = `You are a professional food photography editor. Your task is to perform a precise, photorealistic edit on the provided cake product photo. Your goal is to preserve the original image's style, lighting, shadows, and composition, applying ONLY the specific changes listed below.

---
### **Core Editing Principles (VERY IMPORTANT)**
---
1.  **Maintain Photorealism:** The final image must look like a real photograph, not a digital drawing. Match the original lighting and shadows perfectly.
2.  **Modification, Not Replacement:** When asked to change a color (e.g., "Change the side icing to blue"), you must **recolor the existing surface** while preserving all decorations, textures, and details on that surface. Do NOT replace the area with a plain color.
3.  **Realistic Interaction:** When adding an element like a drip, it must interact realistically with existing decorations, flowing **around or partially over** them. Original decorations must remain visible and integrated.
4.  **Preserve Unmentioned Details:** If a feature from the original image is not explicitly mentioned as changed, it MUST be preserved exactly as it is.

---
### **List of Changes to Apply**
---
`;

    const changes: string[] = [];

    // --- Note: Structural changes like type/thickness are omitted for the Shopify flow ---
    // The size is noted for context.
    changes.push(`- The cake's **size** is "${newCakeInfo.size}". This is for context; do not change the visual proportions unless other instructions imply it.`);

    // --- Topper, Support Element, Icing, and Message changes (logic is largely the same) ---
    mainToppers.forEach(t => {
        if (!t.isEnabled) {
            changes.push(`- **Remove the main topper** described as: "${t.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (t.type !== t.original_type) itemChanges.push(`change its material to **${t.type}**`);
            
            if (t.replacementImage) {
                if (t.type === 'printout') {
                    itemChanges.push(`replace its image with the new one provided. The printout topper should be **standing vertically** on the top surface of the cake, as if supported by a small stick from behind.`);
                } else {
                    itemChanges.push(`replace its image with the new one provided`);
                }
            }
            
            if (t.color && t.original_color && t.color !== t.original_color) itemChanges.push(`recolor it to **${colorName(t.color)}**`);
            if (itemChanges.length > 0) changes.push(`- For the main topper "${t.description}": ${itemChanges.join(' and ')}.`);
        }
    });

    supportElements.forEach(s => {
        if (!s.isEnabled) {
            changes.push(`- **Remove the support element** described as: "${s.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (s.type !== s.original_type) itemChanges.push(`change its material to **${s.type}**`);
            if (s.replacementImage) itemChanges.push(`replace its image with the new one provided`);
            if (s.color && s.original_color && s.color !== s.original_color) itemChanges.push(`recolor it to **${colorName(s.color)}**`);
            if (itemChanges.length > 0) changes.push(`- For the support element "${s.description}": ${itemChanges.join(' and ')}.`);
        }
    });
    
    // Icing Design Changes
    const originalIcing = originalAnalysis.icing_design;
    const newIcing = icingDesign;

    if (newIcing.drip && !originalIcing.drip) {
        changes.push(`- **Add a drip effect**. Make it look realistic on the existing cake texture. The drip color should be **${colorName(newIcing.colors.drip)}**.`);
    } else if (!newIcing.drip && originalIcing.drip) {
        changes.push(`- **Remove the drip effect**.`);
    } else if (newIcing.drip && originalIcing.drip && newIcing.colors.drip !== originalIcing.colors.drip) {
        changes.push(`- **Recolor the drip** to **${colorName(newIcing.colors.drip!)}**. Preserve all other details.`);
    }
    
    // Handle Gumpaste Base Board
    if (newIcing.gumpasteBaseBoard && !originalIcing.gumpasteBaseBoard) {
        let instruction = `- **let's cover the whole base board with a colored gumpaste covered base board**. Preserve any existing decorations on the base area.`;
        if (newIcing.colors.gumpasteBaseBoardColor) {
            instruction += ` The GUMPASTE COVERED BASE BOARD color should be **${colorName(newIcing.colors.gumpasteBaseBoardColor)}**.`;
        }
        changes.push(instruction);
    } else if (!newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard) {
        changes.push(`- **Remove the gumpaste-covered base board**.`);
    } else if (newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard && newIcing.colors.gumpasteBaseBoardColor !== originalIcing.colors.gumpasteBaseBoardColor) {
        changes.push(`- **Recolor the gumpaste base board** to **${colorName(newIcing.colors.gumpasteBaseBoardColor!)}**. Preserve all other details.`);
    }

    // Core icing colors
    if (newIcing.colors.side !== undefined && newIcing.colors.side !== originalIcing.colors.side) {
        changes.push(`- **Recolor the side icing** to **${colorName(newIcing.colors.side)}**. Preserve all original textures and decorations on this surface.`);
    }
    if (newIcing.colors.top !== undefined && newIcing.colors.top !== originalIcing.colors.top) {
        changes.push(`- **Recolor the top icing** to **${colorName(newIcing.colors.top)}**. Preserve all original textures and decorations on this surface.`);
    }
    // ... (other icing features like borders can be added here if needed)

    // Cake Message Changes
    cakeMessages.forEach(uiMsg => {
        if (uiMsg.isEnabled && uiMsg.text.trim()) {
            // A color is considered "customized" by the user if they've explicitly turned off the default toggle.
            const isColorCustomizedByUser = uiMsg.useDefaultColor === false;

            if (uiMsg.position === 'base_board') {
                let instruction = `- **On the cake's base board, add or replace any existing text** with the message: "${uiMsg.text}".`;

                if (isColorCustomizedByUser) {
                    instruction += ` The text should be written in an 'icing_script' style with the color ${colorName(uiMsg.color)}.`;
                } else { // useDefaultColor is true or undefined
                    instruction += ` If replacing existing text, match the original style and color. If adding new text to a blank board, use an 'icing_script' style in a color that contrasts well with the board.`;
                }
                changes.push(instruction);
            } else { // 'top' or 'side'
                let styleInstruction: string;
                if (isColorCustomizedByUser) {
                    styleInstruction = `using the **exact same style** as the original message, but change the **color to ${colorName(uiMsg.color)}**.`;
                } else { // useDefaultColor is true or undefined
                    styleInstruction = "using the **exact same style (e.g., piped icing, gumpaste letters) and color** as the original message.";
                }

                changes.push(`- **Find the primary message on the cake (e.g., "Happy Birthday [Name]" or just a name). Identify its style and color, then completely replace the text** with "${uiMsg.text}", ${styleInstruction} Preserve the original text's general location and size.`);
            }
        }
    });

    if (additionalInstructions.trim()) {
        changes.push(`- **Special Instructions:** ${additionalInstructions.trim()}`);
    }

    if (changes.length === 0) {
        prompt += "- No changes were requested. The image should remain exactly the same.";
    } else {
        prompt += changes.join('\n');
    }

    prompt += `\n\n---
**Final Reminder:** Maintain photorealistic quality. All changes must look like a seamless, professional photo edit. Preserve all details not mentioned in the list of changes.
`;
    
    return prompt;
};