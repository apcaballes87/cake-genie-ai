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

// --- NEW SPECIALIZED SYSTEM INSTRUCTIONS ---

const INPAINTING_STYLE_SYSTEM_INSTRUCTION = `You are an expert, non-destructive photo editor.

### **Core Editing Principles**
---
1.  **CRITICAL: TEXTURE-PRESERVING COLOR TINTING (Your ONLY Job)**
    *   When asked to change a color, you MUST perform a "hue-shift" or "color tinting" operation only."
    *   Analogy: You are applying a "Hue/Saturation" adjustment layer in Photoshop.
2.  **PRESERVE EVERYTHING ELSE:** Do NOT add, remove, or change the shape of any element. The final output image MUST have the exact same dimensions, aspect ratio, background, lighting, shadows, and all other unmentioned details as the original input image.`;

const GENERATIVE_DESIGN_SYSTEM_INSTRUCTION = `You are a master digital cake artist performing photorealistic edits on a cake image. Your goal is to apply ONLY the specific changes listed in the prompt, while preserving the original image's style, lighting, and composition.

---
### **Core Editing Principles**
---
1.  **Master Prioritization:** If any rules conflict, preserving the original physical texture of unedited areas is the highest priority.
2.  **Technical Quality:** The final output MUST be a high-resolution, photorealistic image. Your task is technical cleanup: "Enhance" means you must upscale the final resolution and remove digital artifacts (like JPEG compression noise or pixelation). It does NOT mean artistically redrawing or repainting existing physical textures.
3.  **Realistic Interaction:** When adding a new element (like a drip or a base board), it must interact realistically with the scene. It should adopt the same lighting, cast subtle shadows, and flow around existing decorations, not erase them.
4.  **Preserve Unmentioned Details:** Any feature from the original image not mentioned in the list of changes MUST be preserved exactly as it is. This includes background, cake stand, and non-targeted decorations.
5.  **Clean Removals:** When asked to remove an element, you must cleanly erase it and realistically in-paint the background area to seamlessly match the surrounding texture and lighting.
6.  **Texture-Preserving Color Changes:** When asked to change an existing color, you MUST perform a "hue-shift" or "color tinting" operation. Preserve 100% of the original surface details and micro-textures (like icing strokes). The brightness and darkness (luminance) of every pixel should remain identical to the original; only the hue and saturation should change. Avoid flat, "plastic" looks.`;

const THREE_TIER_RECONSTRUCTION_SYSTEM_INSTRUCTION = `You are a master digital cake artist tasked with reconstructing a cake design into a new 3-tier structure. You will be given an original cake image for its design language and a reference image for the 3-tier structure.

---
### **Core Reconstruction Principles (VERY IMPORTANT)**
---
1.  **High-Quality Output:** The final output MUST be a high-resolution, photorealistic image. Even if the original design source image is low-quality, the new 3-tier cake image you generate must be crisp, clear, and professional-grade.
2.  **Preserve Aspect Ratio:** The final output image MUST have the exact same dimensions and aspect ratio as the original input image. Do not change the image from portrait to landscape, square to rectangle, etc.
3.  **Reconstruct Proportionally:** Rebuild the cake with a 3-tier count, distributing height and width realistically. The final structure and proportions MUST strictly follow the provided plain white 3-tier reference image. Maintain the original cake’s visual proportions if possible (e.g., if it was tall and narrow, keep that ratio across the new tier structure).
4.  **Preserve Design Language, Not Layout:** Your primary task is to harvest the colors, textures, icing style, and decorative motifs from the original cake and apply them to the new 3-tier structure.
5.  **Redistribute Decorations Logically:**
    - Main toppers go on the top tier.
    - Side decorations (e.g., florals, lace) should appear on all tiers or follow a cascading pattern.
    - Cake messages should remain readable and be centered on an appropriate tier.
6.  **Maintain Theme & Style Consistency:** If the original had a drip effect, apply it to all tiers consistently. If it used gold leaf, fresh flowers, or geometric patterns, replicate that aesthetic across the new structure.
7.  **Do NOT Preserve Spatial Layout:** It is expected that elements will move to fit the new tier structure. The goal is stylistic continuity, not pixel-perfect replication of element positions.`;


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
        prompt = `---
### **List of Changes to Apply to the New 3-Tier Structure**
---
`;
    } else {
        prompt = `---
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
    const tiers = newCakeInfo.size.match(/\d+"/g); // e.g., ["6\"", "8\"", "10\""]
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
                } else if (t.type === 'icing_palette_knife') {
                    const isFigure = t.description.toLowerCase().includes('person') || 
                                     t.description.toLowerCase().includes('character') || 
                                     t.description.toLowerCase().includes('human') ||
                                     t.description.toLowerCase().includes('figure');
                    if (isFigure) {
                        itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **painterly palette knife style** as the original cake. Capture the likeness from the reference photo but render it as a textured, abstract portrait using palette knife strokes.`);
                    } else {
                        // Default behavior if not a figure
                        itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                    }
                } else if (t.type === 'edible_3d_complex' || t.type === 'edible_3d_ordinary') {
                    itemChanges.push(`**re-sculpt this 3D gumpaste figure based on the new reference image provided**. The new figure must be in the same **3D gumpaste style** as the original cake. Capture the likeness, pose, and details from the reference photo but render it as a hand-sculpted, edible gumpaste figure.`);
                } else if (t.type === 'edible_photo') {
                    let instruction = `replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it. Crop it if necessary to fit the original edible photo's shape on the cake.`;
                    // Check if original description implies full coverage
                    if (t.description.toLowerCase().includes('full top') || t.description.toLowerCase().includes('entire top')) {
                        instruction += ` The new image MUST cover the **entire top surface of the cake**, just like the original one did. Ensure it is flat, perfectly aligned, and integrated seamlessly with the cake's top icing.`;
                    }
                    itemChanges.push(instruction);
                } else { // This applies to 'printout'
                    itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                }
            }
            
            const isPaletteKnife = t.type === 'icing_palette_knife';
            const hasSingleColorChanged = t.color && t.original_color && t.color !== t.original_color;
            const hasMultipleColorsChanged = t.colors && t.original_colors && JSON.stringify(t.colors) !== JSON.stringify(t.original_colors);

            if (isPaletteKnife && hasMultipleColorsChanged) {
                const originalColorNames = t.original_colors!.map(c => colorName(c || undefined)).join(', ');
                const newColorNames = t.colors!.map(c => colorName(c || undefined)).join(', ');
                itemChanges.push(`**remap its entire color palette**. The original color scheme was based on ${originalColorNames}. The new scheme MUST be based on **${newColorNames}**.`);
            } else if (hasSingleColorChanged) {
                const isTexturedIcing = ['icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread'].includes(t.type);
                if (isTexturedIcing) {
                    itemChanges.push(`**change the color texture** to color **${colorName(t.color)}**. Simply shift the hue of the existing texture to the new color.`);
                } else {
                    itemChanges.push(`recolor it to **${colorName(t.color)}**`);
                }
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
                if (s.type === 'icing_doodle') {
                    itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **piped icing doodle style** as the original cake. Capture the likeness from the reference photo but render it as a simple, elegant line art portrait using piped icing.`);
                } else if (s.type === 'icing_palette_knife') {
                    const isFigure = s.description.toLowerCase().includes('person') || 
                                     s.description.toLowerCase().includes('character') || 
                                     s.description.toLowerCase().includes('human') ||
                                     s.description.toLowerCase().includes('figure');
                    if (isFigure) {
                        itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **painterly palette knife style** as the original cake. Capture the likeness from the reference photo but render it as a textured, abstract portrait using palette knife strokes.`);
                    } else {
                        // Default behavior for other palette knife changes (e.g. textures)
                        itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                    }
                } else if (s.type === 'edible_3d_support') {
                    const isFigure = s.description.toLowerCase().includes('person') || 
                                     s.description.toLowerCase().includes('character') || 
                                     s.description.toLowerCase().includes('human') || 
                                     s.description.toLowerCase().includes('figure') ||
                                     s.description.toLowerCase().includes('silhouette');
                    if (isFigure) {
                        itemChanges.push(`**re-sculpt this small 3D gumpaste item based on the new reference image provided**. The new item must be in the same **3D gumpaste style** as the original cake. Capture the likeness, pose, and details from the reference photo but render it as a small, hand-sculpted, edible gumpaste figure.`);
                    } else {
                        // This else block handles non-figure gumpaste support elements with replacement images, which is an unlikely scenario. But to be safe:
                        itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                    }
                } else { // Default for support_printout, edible_photo_side, etc.
                    itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                }
            }
            
            const isPaletteKnife = s.type === 'icing_palette_knife';
            const hasSingleColorChanged = s.color && s.original_color && s.color !== s.original_color;
            const hasMultipleColorsChanged = s.colors && s.original_colors && JSON.stringify(s.colors) !== JSON.stringify(s.original_colors);

            if (isPaletteKnife && hasMultipleColorsChanged) {
                const originalColorNames = s.original_colors!.map(c => colorName(c || undefined)).join(', ');
                const newColorNames = s.colors!.map(c => colorName(c || undefined)).join(', ');
                itemChanges.push(`**remap its entire color palette**. The original color scheme was based on ${originalColorNames}. The new scheme MUST be based on **${newColorNames}**. It is critical that you preserve the original's textured strokes and relative light/dark variations, but translate them to the new color family.`);
            } else if (hasSingleColorChanged) {
                const isTexturedIcing = ['icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread'].includes(s.type);
                if (isTexturedIcing) {
                    itemChanges.push(`**rehue the texture** to a monochromatic palette based on the new color **${colorName(s.color)}**. It is critical that you **PRESERVE THE ORIGINAL STROKES, TEXTURE, AND LIGHTING (shadows/highlights)**. Simply shift the hue of the existing texture to the new color, maintaining all its original detail and form.`);
                } else {
                    itemChanges.push(`recolor it to **${colorName(s.color)}**`);
                }
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
            instruction += ` The TOP border color shade should be **${colorName(newIcing.colors.borderTop)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.border_top && originalIcing.border_top) {
        icingChanges.push(`- **Remove the top border**.`);
    } else if (newIcing.border_top && originalIcing.border_top && newIcing.colors.borderTop !== originalIcing.colors.borderTop) {
        icingChanges.push(`- **Recolor the top border shade**. The new TOP border color shade should be **${colorName(newIcing.colors.borderTop!)}**. Preserve all other details.`);
    }
    
    // Handle Base Border
    if (newIcing.border_base && !originalIcing.border_base) {
        let instruction = `- **Add a decorative base border**.`;
        if (newIcing.colors.borderBase) {
            instruction += ` The BASE border color shade should be **${colorName(newIcing.colors.borderBase)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.border_base && originalIcing.border_base) {
        icingChanges.push(`- **Remove the base border**.`);
    } else if (newIcing.border_base && originalIcing.border_base && newIcing.colors.borderBase !== originalIcing.colors.borderBase) {
        icingChanges.push(`- **Recolor the base border shade**. The new BASE border color shade should be **${colorName(newIcing.colors.borderBase!)}**. Preserve all other details.`);
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
        icingChanges.push(`- **Recolor the gumpaste base board shade**. to **${colorName(newIcing.colors.gumpasteBaseBoardColor!)}**. Preserve all other details.`);
    }

    // Handle core icing colors with explicit preservation
    const originalIcingColors = originalIcing.colors;
    const sideColorChanged = newIcing.colors.side !== undefined && newIcing.colors.side !== originalIcingColors.side;
    const topColorChanged = newIcing.colors.top !== undefined && newIcing.colors.top !== originalIcingColors.top;

    if (sideColorChanged && !topColorChanged) {
        const instruction = `- **Re-hue the side icing shade ONLY** to shades of**${colorName(newIcing.colors.side)}**.`;
        icingChanges.push(instruction);
    } else if (topColorChanged && !sideColorChanged) {
        const instruction = `- **Re-hue the top icing shade ONLY** to shades of**${colorName(newIcing.colors.top)}**.`;
        icingChanges.push(instruction);
    } else if (sideColorChanged && topColorChanged) {
        // Both colors changed, so no preservation needed, but remove "ONLY"
        icingChanges.push(`- **Re-hue the side icing shade** to shades of **${colorName(newIcing.colors.side)}**.`);
        icingChanges.push(`- **Re-hue the top icing shade** to shades of**${colorName(newIcing.colors.top)}**.`);
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
            messageChanges.push(`- **Add new text**: Write "${uiMsg.text}" on the **${uiMsg.position}** using small ${uiMsg.type} style in the color ${colorName(uiMsg.color)}.`);
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
        prompt += changes.join('\n');
    } else {
        prompt += "- No changes were requested. The image should remain exactly the same.";
    }
    
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
}): Promise<{ image: string, prompt: string, systemInstruction: string }> {

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
    let prompt = promptGenerator
        ? promptGenerator(
            analysisForPrompt, cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions
          )
        : EDIT_CAKE_PROMPT_TEMPLATE(
            analysisForPrompt, cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions
          );

    // 4. Determine change type and select system instruction
    const changesList = prompt.split('### **List of Changes to Apply**')[1]?.trim().split('\n').filter(line => line.startsWith('- ')) || [];
    
    const isColorOnlyChange = (changes: string[]): boolean => {
        if (changes.length === 0) return true; // No changes, inpainting prompt is safer.
        const designChangeKeywords = [
            'remove', 'add', 'change the cake type', 'change the cake thickness', 'reconstruct', 'erase', 'move',
            'change the style', 'redraw', 're-sculpt', 'replace its image', 'bento box presentation'
        ];
        // Check if ANY change is NOT just a color change
        return !changes.some(change => 
            designChangeKeywords.some(keyword => change.toLowerCase().includes(keyword))
        );
    };

    const isThreeTierReconstruction = cakeInfo.type !== (analysisResult?.cakeType || cakeInfo.type) && cakeInfo.type.includes('3 Tier');
    const useInpaintingStyle = isColorOnlyChange(changesList);

    console.log('[Design Service] Change analysis:', { isThreeTierReconstruction, useInpaintingStyle });
    
    let systemInstruction = 
        isThreeTierReconstruction ? THREE_TIER_RECONSTRUCTION_SYSTEM_INSTRUCTION :
        useInpaintingStyle ? INPAINTING_STYLE_SYSTEM_INSTRUCTION :
        GENERATIVE_DESIGN_SYSTEM_INSTRUCTION;

    // 5. Smart Prompt Filtering for Inpainting
    if (useInpaintingStyle && !isThreeTierReconstruction) {
        const colorKeywords = ['re-hue', 'recolor', 'color shade', 'color to'];
        const colorChanges = changesList.filter(change =>
            colorKeywords.some(keyword => change.toLowerCase().includes(keyword))
        );

        if (colorChanges.length > 0) {
            prompt = `---
### **List of Changes to Apply**
---
${colorChanges.join('\n')}`;
        } else {
             prompt = `---
### **List of Changes to Apply**
---
- No changes were requested. The image should remain exactly the same.`;
        }
    }


    // 6. Handle timeout
    const timeoutPromise = new Promise < never > ((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out after 60 seconds.")), 60000)
    );

    try {
        // 7. Call editCakeImage
        const editedImageResult: string | unknown = await Promise.race([
            editCakeImage(
                prompt,
                originalImageData,
                mainToppers,
                supportElements,
                isThreeTierReconstruction ? threeTierReferenceImage : null,
                systemInstruction
            ),
            timeoutPromise
        ]);
        
        // 8. Return the edited image or throw an error
        if (typeof editedImageResult !== 'string') {
            throw new Error("Image generation did not return a valid string response.");
        }
        
        return { image: editedImageResult, prompt, systemInstruction };

    } catch (err) {
        // Re-throw the caught error to be handled by the component
        throw err;
    }
}