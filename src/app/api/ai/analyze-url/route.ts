import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from "@google/genai";
import { getAI } from '@/lib/ai/client';
import { SYSTEM_INSTRUCTION } from '@/lib/ai/prompts';
import { createClient } from '@/lib/supabase/client';
import { createServerClient } from '@supabase/ssr';
import { computeImageHash, convertToWebPBuffer, getImageDimensions } from '@/lib/utils/imageHash';

export const maxDuration = 60;

const ALLOWED_HOSTNAME_PATTERNS = [
    /\.supabase\.co$/,
    /\.supabase\.in$/,
    /\.gstatic\.com$/,
    /\.googleusercontent\.com$/,
    /\.googleapis\.com$/,
    /\.ggpht\.com$/,
    /\.unsplash\.com$/,
    /^images\.unsplash\.com$/,
    /\.fbcdn\.net$/,
    /\.facebook\.com$/,
    /\.fb\.com$/,
    /\.cdninstagram\.com$/,
    /\.instagram\.com$/,
    /\.pinimg\.com$/,
    /\.pinterest\.com$/,
];

const PRIVATE_IP_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
];

function isAllowedHostname(hostname: string): boolean {
    return ALLOWED_HOSTNAME_PATTERNS.some(pattern => pattern.test(hostname));
}

function isPrivateIP(hostname: string): boolean {
    return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
}

async function getActivePrompt(supabase: any): Promise<string> {
    const { data, error } = await supabase
        .from('ai_prompts')
        .select('prompt_text')
        .eq('is_active', true)
        .limit(1)
        .single();

    if (error || !data) {
        throw new Error('Could not retrieve active prompt configuration');
    }

    return data.prompt_text;
}

import { getDynamicTypeEnums } from '@/lib/ai/utils';

export async function POST(req: NextRequest) {
    let supabase: any;

    try {
        const body = await req.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json(
                { error: 'Missing required field: url' },
                { status: 400 }
            );
        }

        const parsedUrl = new URL(url);
        if (isPrivateIP(parsedUrl.hostname)) {
            return NextResponse.json(
                { error: 'Private IP addresses are not allowed' },
                { status: 400 }
            );
        }

        if (!isAllowedHostname(parsedUrl.hostname)) {
            return NextResponse.json(
                { error: 'Hostname not allowed' },
                { status: 400 }
            );
        }

        supabase = createClient();

        const imageResponse = await fetch(url, {
            headers: {
                'Accept': 'image/*',
            },
        });

        if (!imageResponse.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch image from URL' },
                { status: 400 }
            );
        }

        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        if (imageBuffer.length > 10 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'Image too large (max 10MB)' },
                { status: 400 }
            );
        }

        const webpBuffer = await convertToWebPBuffer(imageBuffer);
        const pHash = await computeImageHash(imageBuffer);

        const existingCache = await supabase
            .rpc('find_similar_analysis', { new_hash: pHash });

        if (!existingCache.error && existingCache.data && existingCache.data.length > 0) {
            const cached = existingCache.data[0];
            console.log('✅ Cache HIT for pHash:', pHash);

            const slug = cached.slug || `url-${pHash.substring(0, 8)}`;
            const filePath = `url-analysis/${slug}.webp`;

            const { error: uploadError } = await supabase.storage
                .from('cakegenie')
                .upload(filePath, webpBuffer, {
                    contentType: 'image/webp',
                    upsert: true,
                });

            const { data: urlData } = supabase.storage
                .from('cakegenie')
                .getPublicUrl(filePath);

            return NextResponse.json({
                analysis_json: cached.analysis_json,
                image_url: urlData?.publicUrl || url,
                cached: true,
            });
        }

        console.log('🔄 Cache MISS for pHash:', pHash);

        const [activePrompt, typeEnums] = await Promise.all([
            getActivePrompt(supabase).catch(() => null),
            getDynamicTypeEnums(supabase)
        ]);

        if (!activePrompt) {
            return NextResponse.json(
                { error: 'Failed to load analysis prompt configuration' },
                { status: 500 }
            );
        }

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
                            type: { type: Type.STRING, enum: typeEnums.mainTopperTypes },
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
                            type: { type: Type.STRING, enum: typeEnums.supportElementTypes },
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
                is_tall_proportion: { type: Type.BOOLEAN },
            },
            required: ['cakeType', 'cakeThickness', 'alt_text', 'seo_title', 'seo_description', 'rejection'],
        };

        const base64Image = webpBuffer.toString('base64');

        const aiClient = getAI();
        const response = await aiClient.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
                parts: [
                    { inlineData: { mimeType: 'image/webp', data: base64Image } },
                    { text: activePrompt }
                ],
            }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema,
                temperature: 0,
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                },
            },
        });

        const jsonText = (response.text || '').trim();
        let result;
        try {
            result = JSON.parse(jsonText);

            if (result.is_tall_proportion) {
                result.cakeThickness = '6 in';
            } else {
                switch(result.cakeThickness) {
                    case '6 in': result.cakeThickness = '5 in'; break;
                    case '5 in': result.cakeThickness = '4 in'; break;
                    case '4 in': result.cakeThickness = '3 in'; break;
                }
            }
            delete result.is_tall_proportion;

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

        const slug = `url-${pHash.substring(0, 8)}`;
        const filePath = `url-analysis/${slug}.webp`;

        const { error: uploadError } = await supabase.storage
            .from('cakegenie')
            .upload(filePath, webpBuffer, {
                contentType: 'image/webp',
                upsert: true,
            });

        if (uploadError) {
            console.error('Failed to upload image:', uploadError);
        }

        const { data: urlData } = supabase.storage
            .from('cakegenie')
            .getPublicUrl(filePath);

        const publicUrl = urlData?.publicUrl || url;

        try {
            const dimensions = await getImageDimensions(webpBuffer);
            const keywords = result.keyword || '';
            const icingColor = result.icing_design?.colors?.top || result.icing_design?.colors?.side || null;
            const cakeType = result.cakeType || 'Unknown';
            
            const slugForCache = `${keywords.toLowerCase().replace(/\s+/g, '-')}-${cakeType.toLowerCase().replace(/\s+/g, '-')}-${pHash.substring(0, 4)}`;

            const seoTitle = result.seo_title || `${keywords || 'Custom'} Cake | Genie.ph`;
            const seoDescription = result.seo_description || `Get instant pricing for this ${keywords || 'custom'} cake design. Customize and order at Genie.ph.`;
            const altText = result.alt_text || `${keywords || 'Custom'} cake design`;

            await supabase.from('cakegenie_analysis_cache').insert({
                p_hash: pHash,
                slug: slugForCache,
                analysis_json: result,
                original_image_url: publicUrl,
                keywords,
                alt_text: altText,
                seo_title: seoTitle,
                seo_description: seoDescription,
                image_width: dimensions.width,
                image_height: dimensions.height,
            });

            console.log('✅ Cached analysis result for pHash:', pHash);
        } catch (cacheError) {
            console.error('Failed to cache analysis result:', cacheError);
        }

        return NextResponse.json({
            analysis_json: result,
            image_url: publicUrl,
            cached: false,
        });

    } catch (error) {
        console.error("Error analyzing image from URL:", error);
        return NextResponse.json(
            { error: 'Failed to analyze image from URL' },
            { status: 500 }
        );
    }
}
