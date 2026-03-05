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
                            position: { type: Type.STRING },
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

CRITICAL RULES FOR "colors" OBJECT:
- The "colors" object under "icing_design" maps the design element to its color.
- Valid keys are: top, side, drip, borderTop, borderBase, gumpasteBaseBoardColor.
- When adding or changing a design element (like a drip or border), you MUST include its color in the "colors" object.

CRITICAL RULES:
1. All colors must be valid CSS HEX codes (e.g., #0000FF for blue). Do not use color words like "blue".
2. Set booleans strictly to true or false.
3. NEVER add "drip", "border", or "board" to support_elements. They MUST ONLY BE CONFIGURED inside the icing_design object.

SPECIFIC BEHAVIORS:
- MESSAGES: If the user asks to "change the message to X", do NOT remove the existing message object from the cake_messages array. Instead, FIND the existing message object and CHANGE its "text" property to X. Only remove the message object if the user explicitly asks to "remove the message" or "delete the message".
- MESSAGE COLOR: If the user asks to "change the message color to X", FIND the existing message object in cake_messages and change its "color" property to the HEX code. Keep the "text" and all other properties the same.
- ICING EFFECTS (drip, borders, base board): If the user asks to add an effect and specifies a color (e.g., "add a blue drip"), you MUST do BOTH inside icing_design:
  a. Set the corresponding boolean flag to true (e.g., icing_design.drip = true).
  b. Add or update the corresponding key in icing_design.colors with the correct HEX code (e.g., "drip": "#0000FF").

EXAMPLES:
- Prompt: "remove the drip" -> Action: set icing_design.drip to false. Return ALL other fields unchanged.
- Prompt: "make the cake green" -> Action: change colors in icing_design.colors to #00FF00. Return ALL other fields unchanged.
- Prompt: "change message color to red" -> Action: find the message in cake_messages and set its "color" to "#FF0000". Keep text and other fields the same.
- Prompt: "change message to Happy Anniversary" -> Action: find the existing item in cake_messages and change its "text" field. DO NOT delete the item.
- Prompt: "add a red drip" -> Action: set icing_design.drip = true AND set icing_design.colors.drip = "#FF0000". Return ALL other fields unchanged.

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
