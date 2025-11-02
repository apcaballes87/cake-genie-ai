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

    let prompt = `---
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
                const isFigure = t.description.toLowerCase().includes('person') || 
                                 t.description.toLowerCase().includes('character') || 
                                 t.description.toLowerCase().includes('human') ||
                                 t.description.toLowerCase().includes('figure');

                if (t.type === 'icing_doodle' && isFigure) {
                    itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **piped icing doodle style**. Capture the likeness from the reference photo but render it as a simple, elegant line art portrait using piped icing.`);
                } else if (t.type === 'icing_palette_knife' && isFigure) {
                    itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **painterly palette knife style**. Capture the likeness from the reference photo but render it as a textured, abstract portrait using palette knife strokes.`);
                } else if ((t.type === 'edible_3d_complex' || t.type === 'edible_3d_ordinary') && isFigure) {
                    itemChanges.push(`**re-sculpt this 3D gumpaste figure based on the new reference image provided**. The new figure must be in the same **3D gumpaste style**. Capture the likeness, pose, and details from the reference photo but render it as a hand-sculpted, edible gumpaste figure.`);
                } else if (t.type === 'printout') {
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
            if (s.replacementImage) {
                const isFigure = s.description.toLowerCase().includes('person') || 
                                 s.description.toLowerCase().includes('character') || 
                                 s.description.toLowerCase().includes('human') || 
                                 s.description.toLowerCase().includes('figure');
                if (s.type === 'edible_3d_support' && isFigure) {
                    itemChanges.push(`**re-sculpt this small 3D gumpaste item based on the new reference image provided**. The new item must be in the same **3D gumpaste style** as the original cake. Capture the likeness, pose, and details from the reference photo but render it as a small, hand-sculpted, edible gumpaste figure.`);
                } else {
                    itemChanges.push(`replace its image with the new one provided`);
                }
            }
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
    
    return prompt;
};