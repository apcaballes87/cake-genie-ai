import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from "@google/genai";
import { getAI } from '@/lib/ai/client';
import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { createClient } from '@/lib/supabase/client';

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

// Helper to get dynamic enums (simplified version of client service logic)
async function getDynamicTypeEnums(supabase: any) {
    const { data, error } = await supabase
        .from('pricing_rules')
        .select('item_type, category, sub_item_type')
        .eq('is_active', true)
        .not('item_type', 'is', null);

    if (error || !data) {
        console.warn('Failed to fetch dynamic enums in API route');
        return {
            mainTopperTypes: ['edible_3d_complex', 'edible_3d_ordinary', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo_top', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'],
            supportElementTypes: ['edible_3d_support', 'edible_2d_support', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'dragees', 'edible_flowers', 'edible_photo_side', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'macarons', 'meringue', 'gumpaste_bundle', 'candy', 'gumpaste_panel', 'icing_decorations', 'gumpaste_creations'],
            subtypesByType: {}
        };
    }

    const mainTopperTypes = new Set<string>();
    const supportElementTypes = new Set<string>();
    const subtypesByType: Record<string, string[]> = {};

    data.forEach((rule: any) => {
        if (rule.item_type) {
            if (rule.category === 'main_topper') {
                mainTopperTypes.add(rule.item_type);
            } else if (rule.category === 'support_element') {
                supportElementTypes.add(rule.item_type);
            }

            if (rule.sub_item_type) {
                if (!subtypesByType[rule.item_type]) {
                    subtypesByType[rule.item_type] = [];
                }
                if (!subtypesByType[rule.item_type].includes(rule.sub_item_type)) {
                    subtypesByType[rule.item_type].push(rule.sub_item_type);
                }
            }
        }
    });

    const mainTopperPriority = [
        'candle', 'edible_photo_top', 'printout', 'cardstock', 'edible_2d_shapes',
        'edible_flowers', 'edible_3d_ordinary', 'edible_3d_complex', 'figurine', 'toy',
        'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter',
        'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'
    ];

    const sortedMainToppers = Array.from(mainTopperTypes).sort((a, b) => {
        const aIndex = mainTopperPriority.indexOf(a);
        const bIndex = mainTopperPriority.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    return {
        mainTopperTypes: sortedMainToppers,
        supportElementTypes: Array.from(supportElementTypes),
        subtypesByType,
    };
}

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
                            size: { type: Type.STRING, enum: ['tiny', 'small', 'medium', 'large'] },
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
                            size: { type: Type.STRING, enum: ['tiny', 'small', 'medium', 'large'] },
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
                seo_title: { type: Type.STRING },
                seo_description: { type: Type.STRING },
                rejection: {
                    type: Type.OBJECT,
                    properties: {
                        isRejected: { type: Type.BOOLEAN },
                        reason: { type: Type.STRING },
                        message: { type: Type.STRING },
                    },
                    required: ['isRejected', 'reason', 'message'],
                },
            },
            required: [],
        };

        const aiClient = getAI();
        const response = await aiClient.models.generateContent({
            model: "gemini-3-flash-preview",
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
        return NextResponse.json(
            { error: 'Failed to analyze image' },
            { status: 500 }
        );
    }
}
