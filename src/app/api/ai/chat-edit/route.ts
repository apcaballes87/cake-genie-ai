import { NextRequest, NextResponse } from 'next/server';
import { Type } from "@google/genai";
import { getAI } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/client';
import { getDynamicTypeEnums } from '@/lib/ai/utils';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const traceId = req.headers.get('x-ai-trace-id') ?? `chat-edit-route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const requestSource = req.headers.get('x-ai-request-source') ?? 'unknown';
    const startedAt = Date.now();

    try {
        const body = await req.json();
        const { prompt, currentAnalysis, referenceImages } = body;
        const validReferenceImages = Array.isArray(referenceImages)
            ? referenceImages.filter((reference) =>
                Boolean(reference?.image?.data && reference?.image?.mimeType)
            )
            : [];

        console.log(`[AI TRACE ${traceId}] /api/ai/chat-edit:start`, {
            requestSource,
            promptLength: typeof prompt === 'string' ? prompt.length : 0,
            mainTopperCount: Array.isArray(currentAnalysis?.main_toppers) ? currentAnalysis.main_toppers.length : 0,
            supportElementCount: Array.isArray(currentAnalysis?.support_elements) ? currentAnalysis.support_elements.length : 0,
            cakeMessageCount: Array.isArray(currentAnalysis?.cake_messages) ? currentAnalysis.cake_messages.length : 0,
            referenceImageCount: validReferenceImages.length,
        });

        if (!prompt || !currentAnalysis) {
            return NextResponse.json(
                { error: 'Missing prompt or currentAnalysis in request body.' },
                { status: 400 }
            );
        }

        const supabase = createClient();
        const typeEnums = await getDynamicTypeEnums(supabase);

        const aiClient = getAI(req);

        const hybridAnalysisResponseSchema = {
            type: Type.OBJECT,
            properties: {
                cakeType: { type: Type.STRING },
                cakeThickness: { type: Type.STRING },
                main_toppers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                            type: {
                                type: Type.STRING,
                                enum: typeEnums.mainTopperTypes
                            },
                            material: { type: Type.STRING },
                            group_id: { type: Type.STRING },
                            classification: { type: Type.STRING, enum: ['hero', 'support'] },
                            size: { type: Type.STRING, enum: ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'] },
                            quantity: { type: Type.INTEGER },
                            digits: { type: Type.INTEGER },
                            description: { type: Type.STRING },
                        },
                        required: ['type', 'material', 'group_id', 'classification', 'size', 'quantity', 'description'],
                    },
                },
                support_elements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                            type: {
                                type: Type.STRING,
                                enum: typeEnums.supportElementTypes
                            },
                            material: { type: Type.STRING },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            size: { type: Type.STRING, enum: ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'] },
                            quantity: { type: Type.INTEGER },
                            description: { type: Type.STRING },
                        },
                        required: ['type', 'material', 'group_id', 'color', 'size', 'quantity', 'description'],
                    },
                },
                cake_messages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                            text: { type: Type.STRING },
                            type: { type: Type.STRING },
                            color: { type: Type.STRING },
                            position: { type: Type.STRING, description: "Must be exactly 'top', 'side' (for front), or 'base_board'." },
                        },
                        required: ['text', 'type', 'color', 'position'],
                    },
                },
                icing_design: {
                    type: Type.OBJECT,
                    properties: {
                        base: { type: Type.STRING },
                        color_type: { type: Type.STRING },
                        colors: {
                            type: Type.OBJECT,
                            properties: {
                                top: { type: Type.STRING },
                                side: { type: Type.STRING },
                                gumpasteBaseBoardColor: { type: Type.STRING },
                                drip: { type: Type.STRING },
                                borderTop: { type: Type.STRING },
                                borderBase: { type: Type.STRING },
                            },
                        },
                        drip: { type: Type.BOOLEAN },
                        border_top: { type: Type.BOOLEAN },
                        border_base: { type: Type.BOOLEAN },
                        gumpasteBaseBoard: { type: Type.BOOLEAN },
                    },
                    required: ['base', 'color_type', 'colors', 'drip', 'border_top', 'border_base', 'gumpasteBaseBoard'],
                },
                restrictionViolation: { 
                    type: Type.STRING, 
                    description: "If the user request violates a design rule (e.g. Bento restrictions), explain WHY here and do NOT apply the change. Leave null or empty if valid." 
                },
                keyword: { type: Type.STRING },
                alt_text: { type: Type.STRING },
                seo_title: { type: Type.STRING },
                seo_description: { type: Type.STRING },
                actions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: {
                                type: Type.STRING,
                                enum: ['add_to_cart', 'update_instructions'],
                            },
                            content: {
                                type: Type.STRING,
                                description: 'For update_instructions, this should be the extracted note from the user statement.',
                            },
                        },
                        required: ['type'],
                    },
                },
            },
            required: ['cakeType', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
        };

        const systemInstruction = `You are an expert cake design AI assistant. The user wants to modify their cake design.
You are given the CURRENT cake design analysis JSON. Return a NEW, COMPLETE cake design analysis JSON that reflects the user's requested changes.

ABSOLUTELY CRITICAL: You MUST return the COMPLETE JSON with ALL fields from the input. Do NOT omit any fields.
If the user only asks to change one thing (like a message color), you still MUST return every single field that was in the input (cakeType, cakeThickness, main_toppers, support_elements, cake_messages, icing_design, keyword, etc).
Omitting a field will DELETE that data. Every field from the input MUST appear in your output.

--- DESIGN RESTRICTIONS & SAFEGUARDS ---
Check the current "cakeType" and existing elements before applying ANY changes. 

1. BENTO CAKE RESTRICTIONS (If cakeType is 'Bento'):
   - FLAVORS: Only "Chocolate Cake" and "Vanilla Cake" are allowed. If the user asks for "Ube" or "Mocha", REJECT it.
   - POSITION: Bento cakes are too small for board messages. Do NOT allow any message with position: "base_board".
   - ICING FEATURES: Bento cakes CANNOT have "border_base" (Bottom Border) or "gumpasteBaseBoard" (Covered Board). If user asks for these, REJECT it.
   - DIMENSIONS: Strictly "2 in" thickness and "4\" Round" size. If user asks to change these for Bento, ignore or reject.

2. EDIBLE PHOTO RESTRICTIONS:
   - If a main_topper with type "edible_photo_top" exists, the user CANNOT change the "top" icing color (icing_design.colors.top). The photo covers the entire top surface.

3. HANDLING VIOLATIONS:
   - If a request violates any of the above, set the "restrictionViolation" field to a polite explanation (e.g., "Sorry, Bento cakes don't support bottom borders or board messages.").
   - When a violation is found, do NOT apply that specific change to the JSON. Revert that field to its current value.

--- TOPPER & ELEMENT TYPES ---
You MUST strictly follow these classifications for any new or modified items. Do NOT use generic types like "topper".

Valid Main Topper Types:
${typeEnums.mainTopperTypes.join(', ')}

Valid Support Element Types:
${typeEnums.supportElementTypes.join(', ')}

CLASSIFICATION RULES:
1. "printout": Use for toppers with printed graphics, photos, character images (My Melody, Disney, etc), or multi-color printed text.
2. "cardstock": Use ONLY for solid single-color metallic or glitter toppers without printed graphics.
3. "edible_photo_top": Use for photos printed on edible icing/sugar sheets placed on top.
4. "toy" / "figurine": Use for non-edible physical objects.
5. "edible_3d_ordinary" / "edible_3d_complex": Use for gumpaste/fondant hand-made shapes. This includes object-based toppers like animals (e.g., bear, lion), sculpted characters, or intricate hand-molded items. If a user asks for an "animal topper", it MUST be classified as "edible_3d_complex".

--- UI MAPPING & INSTRUCTIONS ---
COLORS:
You must strictly use these HEX codes for colors whenever possible to match our UI palette:
Dark Red: #8B0000, Red: #FF0000, Coral: #FF7F50, Orange: #FFA500, Peach: #FFDAB9, Gold: #FFD700, Yellow: #FFFF00, Light Yellow: #FFFFE0, Champagne: #F7E7CE, Ivory: #FFFFF0, Beige: #F5F5DC, Green: #008000, Light Green: #90EE90, Mint: #98FF98, Teal: #008080, Navy: #000080, Blue: #0000FF, Light Blue: #87CEEB, Purple: #800080, Lavender: #E6E6FA, Hot Pink: #FF69B4, Pink: #FFC0CB, Light Pink: #FFB6C1, Rose Gold: #B76E79, Brown: #8B4513, Tan: #D2B48C, Silver: #C0C0C0, White: #FFFFFF, Black: #000000.
If a user asks for a vague color like "mint green" or "dark blue", pick the closest hex from this list (e.g. Mint: #98FF98, Navy: #000080). Do not use color words like "blue".

CAKE MESSAGES:
- Text: Managed in "cake_messages" array. To "change the message to X", FIND the existing object and CHANGE its "text".
- Color: Change the "color" property to the HEX code.
- Position: Valid values are exactly "top", "side", or "base_board".
  - If user says "front", "front side", or "face": set position to "side".
  - If user says "bottom", "board", or "base": set position to "base_board".
  - If user says "top": set position to "top".

ICING DESIGN & EFFECTS:
- "colors" object under "icing_design" has keys: side (required), top, gumpasteBaseBoardColor. All values are HEX codes from the approved palette.
- Drip: If user asks for a drip (e.g., "add gold drip"), set icing_design.drip = true. To remove, set drip = false. (No color in colors object; drip color is inferred from side/top).
- Borders: "Top border" -> set border_top = true. "Bottom border" -> set border_base = true. (No color in colors object; border color is inferred from side/top).
- Base Board: "Base board" -> set gumpasteBaseBoard = true AND set colors.gumpasteBaseBoardColor to the matching HEX.
- Cake Color: "make the cake [color]" -> change colors.side and colors.top to the matching HEX code. Side is the primary color for slugs/filters.

CRITICAL RULES:
1. All colors must be valid CSS HEX codes from the approved palette above.
2. Set booleans strictly to true or false.
3. NEVER add "drip", "border", or "board" to support_elements. They MUST ONLY BE CONFIGURED inside the icing_design object.
4. Do NOT remove any existing message or element unless explicitly asked to "remove" or "delete" it.
5. The "colors" object does NOT contain drip, borderTop, or borderBase keys. Those are separate boolean flags at icing_design level.

EXAMPLES:
- Prompt: "add message Happy Birthday in front side" -> Action: add to cake_messages { text: "Happy Birthday", position: "side", type: "icing_script", color: "#000000" }.
- Prompt: "make the cake mint green" -> Action: set icing_design.colors.side and icing_design.colors.top to "#98FF98". Return ALL other fields unchanged.
- Prompt: "add a gold drip" -> Action: set icing_design.drip = true. Return ALL other fields unchanged.
- Prompt: "add top border" -> Action: set icing_design.border_top = true. Return ALL other fields unchanged.

Return the FULL, COMPLETE updated JSON with every field from the input included.
 
--- ACTIONS & NON-DESIGN PROMPTS ---
1. Add to Cart: If the user says "add to cart", "buy this", "order this", or similar, add an object to the "actions" array: { "type": "add_to_cart" }.
2. Additional Instructions: If the user provides delivery details, pickup times, address, or special notes (e.g., "this is for my daughter's birthday", "for pickup tomorrow at 10am", "deliver to 123 Street"), add an object to the "actions" array: { "type": "update_instructions", "content": "THE EXTRACTED NOTE" }.
3. You can combine actions and design changes. If the user says "make it pink and add to cart", perform the design change AND add the action.
4. If the user's statement is ONLY a non-design interaction that we don't support (e.g., "how are you?", "tell me a joke"), return the input JSON exactly as is with an empty actions array.`;

        const promptText = `
User Prompt: ${prompt}

Current Cake Design JSON:
${JSON.stringify(currentAnalysis, null, 2)}
`;

        const parts: Array<
            | { text: string }
            | { inlineData: { data: string; mimeType: string } }
        > = [];

        validReferenceImages.forEach((reference) => {
            parts.push({
                inlineData: {
                    data: reference.image.data,
                    mimeType: reference.image.mimeType,
                },
            });
            parts.push({
                text: `${reference.label || 'Reference image'} is an additional ${reference.targetType || 'design reference'} labeled "${reference.targetDescription || 'unnamed reference'}". Use it to interpret the user's requested change, but preserve all other cake details unless the user explicitly asks for them to change.`,
            });
        });

        parts.push({ text: promptText });

        const response = await aiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: 'user',
                    parts,
                },
            ],
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema as any,
                temperature: 0,
            },
        });

        console.log(`[AI TRACE ${traceId}] /api/ai/chat-edit:model-response`, {
            requestSource,
            model: 'gemini-2.5-flash',
            durationMs: Date.now() - startedAt,
        });

        const jsonText = (response.text || '').trim();
        let result;
        try {
            result = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse AI response:", jsonText);
            console.error(`[AI TRACE ${traceId}] /api/ai/chat-edit:parse-error`, {
                requestSource,
                durationMs: Date.now() - startedAt,
            });
            return NextResponse.json(
                { error: 'Invalid response format from AI' },
                { status: 500 }
            );
        }

        console.log(`[AI TRACE ${traceId}] /api/ai/chat-edit:success`, {
            requestSource,
            durationMs: Date.now() - startedAt,
        });

        return NextResponse.json({ analysis_json: result });

    } catch (error: any) {
        console.error('Error in /api/ai/chat-edit:', error);

        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to update cake design. Please try again.',
            quotaMessage: 'AI design updates are temporarily unavailable due to quota limits. Please try again later.',
        });

        console.error(`[AI TRACE ${traceId}] /api/ai/chat-edit:error`, {
            requestSource,
            durationMs: Date.now() - startedAt,
            status: normalizedError.status,
            message: normalizedError.message,
            rawStatus: error?.status,
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status }
        );
    }
}
