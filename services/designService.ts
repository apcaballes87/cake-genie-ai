import {
    editCakeImage
} from './geminiService.lazy';
import {
    DEFAULT_THICKNESS_MAP,
    COLORS
} from '../constants';
import type {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI
} from '../types';

const EDIT_CAKE_PROMPT_TEMPLATE = (
    originalAnalysis: HybridAnalysisResult | null,
    newCakeInfo: CakeInfoUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    additionalInstructions: string
): string => {
    if (!originalAnalysis) return ""; // Guard clause

    const isThreeTierReconstruction = newCakeInfo.type !== originalAnalysis.cakeType && newCakeInfo.type.includes('3 Tier');

    const colorName = (hex: string | undefined) => {
        if (!hex) return 'not specified';
        const foundColor = COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
        return foundColor ? `${foundColor.name} (${hex})` : hex;
    };

    let prompt: string;

    if (isThreeTierReconstruction) {
        prompt = `You are a master digital cake artist tasked with reconstructing a cake design into a new 3-tier structure. You will be given an original cake image for its design language and a reference image for the 3-tier structure.

---
### **Core Reconstruction Principles (VERY IMPORTANT)**
---
1.  **Reconstruct Proportionally:** Rebuild the cake with a 3-tier count, distributing height and width realistically. The final structure and proportions MUST strictly follow the provided plain white 3-tier reference image. Maintain the original cake’s visual proportions if possible (e.g., if it was tall and narrow, keep that ratio across the new tiers).
2.  **Preserve Design Language, Not Layout:** Your primary task is to harvest the colors, textures, icing style, and decorative motifs from the original cake and apply them to the new 3-tier structure.
3.  **Redistribute Decorations Logically:**
    - Main toppers go on the top tier.
    - Side decorations (e.g., florals, lace) should appear on all tiers or follow a cascading pattern.
    - Cake messages should remain readable and be centered on an appropriate tier.
4.  **Maintain Theme & Style Consistency:** If the original had a drip effect, apply it to all tiers consistently. If it used gold leaf, fresh flowers, or geometric patterns, replicate that aesthetic across the new structure.
5.  **Do NOT Preserve Spatial Layout:** It is expected that elements will move to fit the new tier structure. The goal is stylistic continuity, not pixel-perfect replication of element positions.

---
### **List of Changes to Apply to the New 3-Tier Structure**
---
`;
    } else {
        prompt = `You are a master digital cake artist performing a precise photo edit on the provided cake image. Your goal is to preserve the original image's style, lighting, and composition, applying ONLY the specific changes listed below.

---
### **Core Editing Principles (VERY IMPORTANT)**
---
1.  **Layer-Based Editing:** Imagine you are working in a photo editor with layers. Your changes must be applied as non-destructive layers on top of the original image features.
2.  **Modification only:** When asked to change a color (e.g., "Change the side icing to blue"), your task is to **recolor the existing surface** while preserving all decorations, textures, and details on that surface. You are NOT replacing the entire area with a plain blue color.
3.  **Realistic Interaction:** When adding an element like a drip, it must interact realistically with existing decorations. The drip should flow **around or partially over** decorations on the side of the cake, not completely erase them. The original decorations must remain visible and integrated with the new element.
4.  **Preserve Unmentioned Details:** If a decoration or feature from the original image is not explicitly mentioned as changed or removed in the list below, it MUST be preserved exactly as it is.
5.  **Remove Superimposed Overlays:** Identify and cleanly remove any non-diegetic logos, watermarks, text, or graphic overlays that have been digitally added on top of the cake image. In-paint the cleared area to seamlessly match the surrounding cake icing or background. Do NOT remove decorations that are physically part of the cake, such as printout toppers or piped messages.

---
### **List of Changes to Apply**
---
`;
    }

    const changes: string[] = [];

    // 1. Core Structure Changes
    if (newCakeInfo.type !== originalAnalysis.cakeType) {
        if (isThreeTierReconstruction) {
            changes.push(`- **Reconstruct the cake** from its original "${originalAnalysis.cakeType}" form into a new "${newCakeInfo.type}" structure based on the provided reference image.`);
        } else {
            let typeChangeInstruction = `- **Change the cake type** from "${originalAnalysis.cakeType}" to "${newCakeInfo.type}".`;
            if (newCakeInfo.type.includes('2 Tier')) {
                typeChangeInstruction += ' This means the cake must be rendered with two distinct levels (tiers) stacked vertically.';
            }
            changes.push(typeChangeInstruction);
        }
    }
    if (newCakeInfo.thickness !== originalAnalysis.cakeThickness) {
        changes.push(`- **Change the cake thickness** to "${newCakeInfo.thickness}".`);
    }

    // A more descriptive size instruction for multi-tier cakes.
    const tiers = newCakeInfo.size.match(/\\d+"/g); // e.g., ["6\"", "8\"", "10\""]
    if ((newCakeInfo.type.includes('2 Tier')) && tiers && tiers.length === 2) {
        changes.push(`- The final **cake size** represents a 2-tier structure: a ${tiers[0]} diameter top tier stacked on a ${tiers[1]} diameter bottom tier.`);
    } else if ((newCakeInfo.type.includes('3 Tier')) && tiers && tiers.length === 3) {
        changes.push(`- The final **cake size** represents a 3-tier structure: a ${tiers[0]} diameter top tier, an ${tiers[1]} diameter middle tier, and a ${tiers[2]} diameter bottom tier.`);
    } else {
        changes.push(`- The final **cake size** must be "${newCakeInfo.size}".`);
    }

    // 2. Topper Changes
    mainToppers.forEach(t => {
        if (!t.isEnabled) {
            changes.push(`- **Remove the main topper** described as: "${t.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (t.type !== t.original_type) {
                itemChanges.push(`change its material to **${t.type}**`);
            }
            if (t.replacementImage) {
                if (t.type === 'icing_doodle') {
                    itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **piped icing doodle style** as the original cake. Capture the likeness from the reference photo but render it as a simple, elegant line art portrait using piped icing.`);
                } else {
                    itemChanges.push(`replace its image with the new one provided`);
                }
            }
            
            const isPaletteKnife = t.type === 'icing_palette_knife';
            const hasSingleColorChanged = t.color && t.original_color && t.color !== t.original_color;
            const hasMultipleColorsChanged = t.colors && t.original_colors && JSON.stringify(t.colors) !== JSON.stringify(t.original_colors);

            if (isPaletteKnife && hasMultipleColorsChanged) {
                const originalColorNames = t.original_colors!.map(c => colorName(c || undefined)).join(', ');
                const newColorNames = t.colors!.map(c => colorName(c || undefined)).join(', ');
                itemChanges.push(`**remap its entire color palette**. The original color scheme was based on ${originalColorNames}. The new scheme MUST be based on **${newColorNames}**. It is critical that you preserve the original's textured strokes and relative light/dark variations, but translate them to the new color family.`);
            } else if (hasSingleColorChanged) {
                itemChanges.push(`recolor it to **${colorName(t.color)}**`);
            }

            if (itemChanges.length > 0) {
                 changes.push(`- For the main topper "${t.description}": ${itemChanges.join(' and ')}.`);
            }
        }
    });

    // 3. Support Element Changes
    supportElements.forEach(s => {
        if (!s.isEnabled) {
            changes.push(`- **Remove the support element** described as: "${s.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (s.type !== s.original_type) {
                itemChanges.push(`change its material to **${s.type}**`);
            }
            if (s.replacementImage) {
                itemChanges.push(`replace its image with the new one provided`);
            }
            
            const isPaletteKnife = s.type === 'icing_palette_knife';
            const hasSingleColorChanged = s.color && s.original_color && s.color !== s.original_color;
            const hasMultipleColorsChanged = s.colors && s.original_colors && JSON.stringify(s.colors) !== JSON.stringify(s.original_colors);

            if (isPaletteKnife && hasMultipleColorsChanged) {
                const originalColorNames = s.original_colors!.map(c => colorName(c || undefined)).join(', ');
                const newColorNames = s.colors!.map(c => colorName(c || undefined)).join(', ');
                itemChanges.push(`**remap its entire color palette**. The original color scheme was based on ${originalColorNames}. The new scheme MUST be based on **${newColorNames}**. It is critical that you preserve the original's textured strokes and relative light/dark variations, but translate them to the new color family.`);
            } else if (hasSingleColorChanged) {
                itemChanges.push(`recolor it to **${colorName(s.color)}**`);
            }
            
            if (itemChanges.length > 0) {
                 changes.push(`- For the support element "${s.description}": ${itemChanges.join(' and ')}.`);
            }
        }
    });


    // 4. Icing Design Changes
    const icingChanges: string[] = [];
    const originalIcing = originalAnalysis.icing_design;
    const newIcing = icingDesign;

    if (newIcing.base !== originalIcing.base) {
        icingChanges.push(`- **Change the base icing** to be **${newIcing.base}**.`);
    }

    // Handle Drip
    if (newIcing.drip && !originalIcing.drip) {
        let instruction = `- **Add a drip effect**. The drip should flow naturally from the top edge and interact realistically with any existing side decorations, flowing around them, not erasing them.`;
        if (newIcing.colors.drip) {
            instruction += ` The DRIP color should be **${colorName(newIcing.colors.drip)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.drip && originalIcing.drip) {
        icingChanges.push(`- **Remove the drip effect**.`);
    } else if (newIcing.drip && originalIcing.drip && newIcing.colors.drip !== originalIcing.colors.drip) {
        icingChanges.push(`- **Recolor the drip**. The new DRIP color should be **${colorName(newIcing.colors.drip!)}**. Preserve all other details.`);
    }

    // Handle Top Border
    if (newIcing.border_top && !originalIcing.border_top) {
        let instruction = `- **Add a decorative top border**.`;
        if (newIcing.colors.borderTop) {
            instruction += ` The TOP border color should be **${colorName(newIcing.colors.borderTop)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.border_top && originalIcing.border_top) {
        icingChanges.push(`- **Remove the top border**.`);
    } else if (newIcing.border_top && originalIcing.border_top && newIcing.colors.borderTop !== originalIcing.colors.borderTop) {
        icingChanges.push(`- **Recolor the top border**. The new TOP border color should be **${colorName(newIcing.colors.borderTop!)}**. Preserve all other details.`);
    }
    
    // Handle Base Border
    if (newIcing.border_base && !originalIcing.border_base) {
        let instruction = `- **Add a decorative base border**.`;
        if (newIcing.colors.borderBase) {
            instruction += ` The BASE border color should be **${colorName(newIcing.colors.borderBase)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.border_base && originalIcing.border_base) {
        icingChanges.push(`- **Remove the base border**.`);
    } else if (newIcing.border_base && originalIcing.border_base && newIcing.colors.borderBase !== originalIcing.colors.borderBase) {
        icingChanges.push(`- **Recolor the base border**. The new BASE border color should be **${colorName(newIcing.colors.borderBase!)}**. Preserve all other details.`);
    }

    // Handle Gumpaste Base Board
    if (newIcing.gumpasteBaseBoard && !originalIcing.gumpasteBaseBoard) {
        let instruction = `- **Add a round gumpaste-covered base board**. Preserve any existing decorations on the base area.(White base is not a decoration and is ok not to be preserved when changing from 1 tier to 2 tier or 1 tier to 3 tier.).`;
        if (newIcing.colors.gumpasteBaseBoardColor) {
            instruction += ` The BASE BOARD color should be **${colorName(newIcing.colors.gumpasteBaseBoardColor)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard) {
        icingChanges.push(`- **Remove the gumpaste-covered base board**.`);
    } else if (newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard && newIcing.colors.gumpasteBaseBoardColor !== originalIcing.colors.gumpasteBaseBoardColor) {
        icingChanges.push(`- **Recolor the gumpaste base board**. The new BASE BOARD color should be **${colorName(newIcing.colors.gumpasteBaseBoardColor!)}**. Preserve all other details.`);
    }

    // Handle core icing colors (side, top) which are always present
    const originalIcingColors = originalIcing.colors;
    if (newIcing.colors.side !== undefined && newIcing.colors.side !== originalIcingColors.side) {
        icingChanges.push(`- **Recolor the side icing**. The new SIDE icing color should be **${colorName(newIcing.colors.side)}**. Important: This is a color change only. All original decorations, patterns, or details on this surface must be preserved and remain visible.`);
    }
    if (newIcing.colors.top !== undefined && newIcing.colors.top !== originalIcingColors.top) {
        icingChanges.push(`- **Recolor the top icing**. The new TOP icing color should be **${colorName(newIcing.colors.top)}**. Important: This is a color change only. All original decorations, patterns, or details on this surface must be preserved and remain visible.`);
    }

    changes.push(...icingChanges);


    // 5. Cake Message Changes (more specific and robust)
    const messageChanges: string[] = [];
    const originalMessages = originalAnalysis.cake_messages || [];
    const currentUIMessages = cakeMessages;

    // Process original messages to see if they were kept, modified, or removed.
    originalMessages.forEach(originalMsg => {
        // Find the UI representation of this original message.
        const correspondingUIMsg = currentUIMessages.find(uiMsg => {
            if (!uiMsg.originalMessage) return false;
            const o = uiMsg.originalMessage;
            return o.text === originalMsg.text &&
                   o.position === originalMsg.position &&
                   o.type === originalMsg.type &&
                   o.color === originalMsg.color;
        });

        if (!correspondingUIMsg || !correspondingUIMsg.isEnabled) {
            // Case 1: Message was removed (deleted from UI or toggled off).
            messageChanges.push(`- **Erase the text** that says "${originalMsg.text}" from the cake's **${originalMsg.position}**. The area should be clean as if the text was never there.`);
        } else {
            // Case 2: Message exists and is enabled. Check for modifications.
            const uiMsg = correspondingUIMsg;
            const changesInMessage = [];
            if (uiMsg.text !== originalMsg.text) {
                changesInMessage.push(`change the text from "${originalMsg.text}" to "${uiMsg.text}"`);
            }
            if (uiMsg.color !== originalMsg.color) {
                changesInMessage.push(`change the color to ${colorName(uiMsg.color)}`);
            }
            if (uiMsg.position !== originalMsg.position) {
                changesInMessage.push(`move it from the ${originalMsg.position} to the ${uiMsg.position}`);
            }
            if (uiMsg.type !== originalMsg.type) {
                changesInMessage.push(`change the style to ${uiMsg.type}`);
            }
            
            if (changesInMessage.length > 0) {
                messageChanges.push(`- Regarding the message on the **${originalMsg.position}** that originally said "${originalMsg.text}", please ${changesInMessage.join(' and ')}.`);
            }
        }
    });

    // Process new messages (those in UI state without an originalMessage).
    currentUIMessages.forEach(uiMsg => {
        if (uiMsg.isEnabled && !uiMsg.originalMessage) {
            // Case 3: A new message was added.
            messageChanges.push(`- **Add new text**: Write "${uiMsg.text}" on the **${uiMsg.position}** using ${uiMsg.type} style in the color ${colorName(uiMsg.color)}.`);
        }
    });

    // Add unique changes to the main prompt changes list.
    if (messageChanges.length > 0) {
        changes.push(...[...new Set(messageChanges)]);
    }

    // 6. Bento-specific instruction
    if (newCakeInfo.type === 'Bento') {
        changes.push(`- **Bento Box Presentation:** The final image MUST show the cake placed inside a classic, open, light brown clamshell bento box. The box should be visible around the base of the cake, framing it.`);
    }

    // 7. Additional Instructions
    if (additionalInstructions.trim()) {
        changes.push(`- **Special Instructions:** ${additionalInstructions.trim()}`);
    }

    // Assemble the final prompt
    if (changes.length > 0) {
        prompt += changes.join('\\n');
    } else {
        prompt += "- No changes were requested. The image should remain exactly the same.";
    }
    
    let finalReminder: string;
    if (isThreeTierReconstruction) {
        finalReminder = `---
**Final Reminder:** Reconstruct the cake structure while faithfully preserving the original design language, color palette, and decorative theme. Do not attempt to keep elements in their original positions—redistribute them naturally across the new tier configuration.`;
    } else {
        finalReminder = `---
**Final Reminder:** Adhere strictly to the Core Editing Principles. You are ONLY editing the provided image based on the specific changes listed above. All other features, decorations, lighting, and style must be perfectly preserved from the original.`;
    }

    prompt += `\\n\\n${finalReminder}`;
    
    return prompt;
};

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