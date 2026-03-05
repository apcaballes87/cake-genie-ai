import { NextRequest, NextResponse } from 'next/server';
import { Type } from "@google/genai";
import { getAI } from '@/lib/ai/client';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt, currentAnalysis } = body;

        if (!prompt || !currentAnalysis) {
            return NextResponse.json(
                { error: 'Missing prompt or currentAnalysis in request body.' },
                { status: 400 }
            );
        }

        const aiClient = getAI();

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
                            type: { type: Type.STRING },
                            material: { type: Type.STRING },
                            group_id: { type: Type.STRING },
                            classification: { type: Type.STRING },
                            size: { type: Type.STRING },
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
                            type: { type: Type.STRING },
                            material: { type: Type.STRING },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            size: { type: Type.STRING },
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
                keyword: { type: Type.STRING },
                alt_text: { type: Type.STRING },
                seo_title: { type: Type.STRING },
                seo_description: { type: Type.STRING },
            },
            required: ['cakeType', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
        };

        const systemInstruction = `You are an expert cake design AI assistant. The user wants to modify their cake design.
You are given the CURRENT cake design analysis JSON. Return a NEW, COMPLETE cake design analysis JSON that reflects the user's requested changes.

ABSOLUTELY CRITICAL: You MUST return the COMPLETE JSON with ALL fields from the input. Do NOT omit any fields.
If the user only asks to change one thing (like a message color), you still MUST return every single field that was in the input (cakeType, cakeThickness, main_toppers, support_elements, cake_messages, icing_design, keyword, etc).
Omitting a field will DELETE that data. Every field from the input MUST appear in your output.

--- UI MAPPING & INSTRUCTIONS ---
COLORS:
You must strictly use these HEX codes for colors whenever possible to match our UI palette:
White: #FFFFFF, Black: #000000, Gold: #FFD700, Silver: #C0C0C0, Light Blue: #87CEEB, Pink: #FFC0CB, Light Pink: #FFB6C1, Hot Pink: #FF69B4, Red: #FF0000, Dark Red: #8B0000, Orange: #FFA500, Yellow: #FFFF00, Light Yellow: #FFFFE0, Green: #008000, Light Green: #90EE90, Teal: #008080, Blue: #0000FF, Navy: #000080, Purple: #800080, Lavender: #E6E6FA, Brown: #8B4513, Tan: #D2B48C, Beige: #F5F5DC, Peach: #FFDAB9, Coral: #FF7F50, Mint: #98FF98, Rose Gold: #B76E79, Champagne: #F7E7CE, Ivory: #FFFFF0.
If a user asks for a vague color like "mint green" or "dark blue", pick the closest hex from this list (e.g. Mint: #98FF98, Navy: #000080). Do not use color words like "blue".

CAKE MESSAGES:
- Text: Managed in "cake_messages" array. To "change the message to X", FIND the existing object and CHANGE its "text".
- Color: Change the "color" property to the HEX code.
- Position: Valid values are exactly "top", "side", or "base_board".
  - If user says "front", "front side", or "face": set position to "side".
  - If user says "bottom", "board", or "base": set position to "base_board".
  - If user says "top": set position to "top".

ICING DESIGN & EFFECTS:
- "colors" object under "icing_design" maps design elements to colors. Valid keys: top, side, drip, borderTop, borderBase, gumpasteBaseBoardColor.
- Drip: If user asks for a drip (e.g., "add gold drip"), set icing_design.drip = true AND icing_design.colors.drip = "#FFD700". To remove, set drip = false.
- Borders: "Top border" -> border_top = true & colors.borderTop. "Bottom border" -> border_base = true & colors.borderBase.
- Base Board: "Base board" -> gumpasteBaseBoard = true & colors.gumpasteBaseBoardColor.
- Cake Color: "make the cake [color]" -> change colors.side and colors.top to the matching HEX code.

CRITICAL RULES:
1. All colors must be valid CSS HEX codes.
2. Set booleans strictly to true or false.
3. NEVER add "drip", "border", or "board" to support_elements. They MUST ONLY BE CONFIGURED inside the icing_design object.
4. Do NOT remove any existing message or element unless explicitly asked to "remove" or "delete" it.

EXAMPLES:
- Prompt: "add message Happy Birthday in front side" -> Action: add to cake_messages { text: "Happy Birthday", position: "side", type: "icing_script", color: "#000000" }.
- Prompt: "make the cake mint green" -> Action: set icing_design.colors.top and side to "#98FF98". Return ALL other fields unchanged.
- Prompt: "add a gold drip" -> Action: set icing_design.drip = true AND icing_design.colors.drip = "#FFD700". Return ALL other fields unchanged.

Return the FULL, COMPLETE updated JSON with every field from the input included.`;

        const promptText = `
User Prompt: ${prompt}

Current Cake Design JSON:
${JSON.stringify(currentAnalysis, null, 2)}
`;

        const response = await aiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [promptText],
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema as any,
                temperature: 0,
            },
        });

        const jsonText = (response.text || '').trim();
        let result;
        try {
            result = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse AI response:", jsonText);
            return NextResponse.json(
                { error: 'Invalid response format from AI' },
                { status: 500 }
            );
        }

        return NextResponse.json({ analysis_json: result });

    } catch (error: any) {
        console.error('Error in /api/ai/chat-edit:', error);
        return NextResponse.json(
            { error: error.message || 'An error occurred during chat-edit.' },
            { status: 500 }
        );
    }
}
