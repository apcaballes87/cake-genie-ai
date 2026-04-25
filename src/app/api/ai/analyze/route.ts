import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from "@google/genai";
import { getAI } from '@/lib/ai/client';
import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { createClient } from '@/lib/supabase/client';
import { normalizeAiRouteError } from '@/lib/ai/routeError';

export const maxDuration = 60; // Allow up to 60 seconds for AI processing

// Helper to get active prompt from Supabase (server-side)
// Note: We're not using the complex caching logic from the client service here 
// to keep the API route stateless and simple. If performance is an issue, we can add simple memory cache.
async function getActivePrompt(supabase: any): Promise<string> {
    const { data, error } = await supabase
        .from('ai_prompts')
        .select('prompt_text')
        .eq('is_active', true)
        .limit(1)
        .single();

    // In a real serverless environment, we might fallback if DB fails
    if (error || !data) {
        console.warn('Failed to fetch prompt from database in API route');
        // We'll rely on the default fallback prompt logic or throw
        throw new Error('Could not retrieve active prompt configuration');
    }

    return data.prompt_text;
}

import { getDynamicTypeEnums } from '@/lib/ai/utils';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageData, mimeType } = body;

        if (!imageData || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: imageData and mimeType' },
                { status: 400 }
            );
        }

        const supabase = createClient();

        // Fetch inputs required for prompt construction
        const [activePrompt, typeEnums] = await Promise.all([
            getActivePrompt(supabase).catch(() => null), // Fallback handled later if null
            getDynamicTypeEnums(supabase)
        ]);

        if (!activePrompt) {
            return NextResponse.json(
                { error: 'Failed to load analysis prompt configuration' },
                { status: 500 }
            );
        }

        // Construct schema dynamically
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
                                enum: typeEnums.mainTopperTypes,
                            },
                            material: { type: Type.STRING },
                            group_id: { type: Type.STRING },
                            classification: { type: Type.STRING, enum: ['hero', 'support'] },
                            size: { type: Type.STRING, enum: ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'] },
                            quantity: { type: Type.INTEGER },
                            digits: { type: Type.INTEGER },
                            description: { type: Type.STRING },
                        },
                        required: ['x', 'y', 'type', 'material', 'group_id', 'classification', 'size', 'quantity', 'description'],
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
                                enum: typeEnums.supportElementTypes,
                            },
                            material: { type: Type.STRING },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            size: { type: Type.STRING, enum: ['tiny', 'xsmall', 'small', 'medium', 'large', 'xlarge'] },
                            quantity: { type: Type.INTEGER },
                            description: { type: Type.STRING },
                        },
                        required: ['x', 'y', 'type', 'material', 'group_id', 'color', 'size', 'quantity', 'description'],
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
                        required: ['x', 'y', 'text', 'type', 'color', 'position'],
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
                            },
                        },
                        drip: { type: Type.BOOLEAN },
                        border_top: { type: Type.BOOLEAN },
                        border_base: { type: Type.BOOLEAN },
                        gumpasteBaseBoard: { type: Type.BOOLEAN },
                    },
                    required: ['base', 'color_type', 'colors'],
                },
                keyword: { type: Type.STRING },
                alt_text: { type: Type.STRING },
                seo_title: {
                    type: Type.STRING,
                    description: "SEO optimized title for the cake product."
                },
                seo_description: {
                    type: Type.STRING,
                    description: "Meta description for search engines, exactly 5 to 6 sentences. Requirements: 1) Start with the cake type and occasion. 2) Include descriptive features (tiers, decorations, color, toppers). 3) Include icing or design techniques. 4) Include the message on the cake. 5) Include potential outcome or who it is for (what makes this specific design special). 6) End with action phrase mentioning Genie.ph and a natural mention of the location Cebu City, Mandaue, Lapu-lapu City, or Talisay Cebu."
                },
                rejection: {
                    type: Type.OBJECT,
                    properties: {
                        isRejected: { type: Type.BOOLEAN },
                        reason: { type: Type.STRING },
                        message: { type: Type.STRING },
                    },
                    required: ['isRejected', 'reason', 'message'],
                },
                is_tall_proportion: {
                    type: Type.BOOLEAN,
                    description: "Set to true ONLY if the cake in the image is notably tall, meaning its physical width is clearly less than its physical height."
                },
            },
            required: ['cakeType', 'cakeThickness', 'alt_text', 'seo_title', 'seo_description', 'rejection'],
        };

        const aiClient = getAI();
        const response = await aiClient.models.generateContent({
            model: "gemini-1.5-flash-002",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: imageData } },
                    { text: activePrompt }
                ],
            }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema,
                temperature: 0,
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW, // Low thinking for faster feature detection
                },
            },
        });

        const jsonText = (response.text || '').trim();
        let result;
        try {
            result = JSON.parse(jsonText);

            // Adjust cake thickness based on custom business logic
            if (result.is_tall_proportion) {
                result.cakeThickness = '6 in';
            } else {
                switch(result.cakeThickness) {
                    case '6 in':
                        result.cakeThickness = '5 in';
                        break;
                    case '5 in':
                        result.cakeThickness = '4 in';
                        break;
                    case '4 in':
                        result.cakeThickness = '3 in';
                        break;
                }
            }
            delete result.is_tall_proportion;

            // Post-process result to fulfill feature-only promise
            // Set all coordinates to 0,0 for now
            if (result.main_toppers) {
                result.main_toppers.forEach((t: any) => { t.x = 0; t.y = 0; });
            }
            if (result.support_elements) {
                result.support_elements.forEach((t: any) => { t.x = 0; t.y = 0; });
            }
            if (result.cake_messages) {
                result.cake_messages.forEach((t: any) => { t.x = 0; t.y = 0; });
            }

        } catch (e) {
            console.error("Failed to parse AI response:", jsonText);
            return NextResponse.json(
                { error: 'Invalid response format from AI' },
                { status: 500 }
            );
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error analyzing cake image:", error);

        const normalizedError = normalizeAiRouteError(error, {
            defaultMessage: 'Failed to analyze image',
            quotaMessage: 'AI cake analysis is temporarily unavailable due to quota limits. Please try again later.',
            authorizationMessage: 'AI cake analysis is not authorized. Please check the Google AI API key and project access.',
        });

        return NextResponse.json(
            { error: normalizedError.message },
            { status: normalizedError.status }
        );
    }
}
