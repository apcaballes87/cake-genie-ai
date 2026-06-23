import { NextRequest, NextResponse, after } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAI } from '@/lib/ai/client';
import { buildSearchAnalysisGenerationConfig, postProcessSearchAnalysisResult } from '@/lib/admin/searchAnalysisContract';
import { cacheAnalysisResult } from '@/services/supabaseService';
import { computeImageFingerprint } from '@/lib/server/imageFingerprint';
import { convertToWebPBuffer } from '@/lib/utils/imageHash';
import type { HybridAnalysisResult } from '@/types';
import { getAnalysisPromptWithFallback } from '@/services/prompts/promptLoader';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_HOSTNAME_PATTERNS = [
    // Supabase
    /\.supabase\.co$/,
    /\.supabase\.in$/,
    // Google
    /\.gstatic\.com$/,
    /\.googleusercontent\.com$/,
    /\.googleapis\.com$/,
    /\.ggpht\.com$/,
    // Unsplash
    /\.unsplash\.com$/,
    /^images\.unsplash\.com$/,
    // Facebook
    /\.fbcdn\.net$/,
    /\.facebook\.com$/,
    /\.fb\.com$/,
    // Instagram
    /\.cdninstagram\.com$/,
    /\.instagram\.com$/,
    // Pinterest
    /\.pinimg\.com$/,
    /\.pinterest\.com$/,
    // Apple / iCloud
    /\.icloud\.com$/,
    /\.apple\.com$/,
    /media\.icloud\.com$/,
    // Shopify
    /\.shopify\.com$/,
    /\.cdn\.shopify\.com$/,
    // E-commerce
    /\.amazon\.com$/,
    /\.amazon\.co\.jp$/,
    /\.walmart\.com$/,
    /\.ebay\.com$/,
    /\.target\.com$/,
    /\.bestbuy\.com$/,
    // Discord
    /\.discord\.com$/,
    /\.discordapp\.com$/,
    // Twitter / X
    /\.twimg\.com$/,
    /\.x\.com$/,
    // TikTok
    /\.tiktok\.com$/,
    /\.tiktok\.net$/,
    /\.cdn\.tiktok\.com$/,
    // LINE
    /\.line\.me$/,
    // WordPress (common patterns)
    /\.wordpress\.com$/,
    /\.wp\.com$/,
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

import { getDynamicTypeEnums } from '@/lib/ai/utils';

export async function POST(req: NextRequest) {
    let supabase: SupabaseClient;

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

        supabase = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { auth: { persistSession: false } }
        );

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

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        if (imageBuffer.length > 10 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'Image too large (max 10MB)' },
                { status: 400 }
            );
        }

        const webpBuffer = await convertToWebPBuffer(imageBuffer);
        const fingerprint = await computeImageFingerprint(imageBuffer);
        const pHash = fingerprint.pHash;

        const existingCache = await supabase
            .rpc('find_similar_analysis_by_fingerprint', {
                new_hash: pHash,
                new_pipeline: fingerprint.pipeline,
            });

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

            if (uploadError) {
                console.error('Failed to upload cached URL analysis image:', uploadError);
            }

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
            getAnalysisPromptWithFallback(supabase as unknown as Parameters<typeof getAnalysisPromptWithFallback>[0]).catch(() => null),
            getDynamicTypeEnums(supabase)
        ]);

        if (!activePrompt) {
            return NextResponse.json(
                { error: 'Failed to load analysis prompt configuration' },
                { status: 500 }
            );
        }
        const baseConfig = buildSearchAnalysisGenerationConfig(typeEnums);

        const base64Image = webpBuffer.toString('base64');

        const aiClient = getAI(req);
        const response = await aiClient.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/webp', data: base64Image } },
                    { text: activePrompt }
                ],
            }],
            config: {
                ...baseConfig,
            },
        });

        const jsonText = (response.text || '').trim();
        let result: HybridAnalysisResult;
        try {
            const parsed = JSON.parse(jsonText) as HybridAnalysisResult;
            result = postProcessSearchAnalysisResult(parsed);

        } catch {
            console.error("Failed to parse AI response:", jsonText);
            return NextResponse.json(
                { error: 'Invalid response format from AI' },
                { status: 500 }
            );
        }

        const uploadSlug = `url-${pHash.substring(0, 8)}`;
        const filePath = `url-analysis/${uploadSlug}.webp`;

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
            const webpBlob = new Blob([Uint8Array.from(webpBuffer)], { type: 'image/webp' });

            const cachedResult = await cacheAnalysisResult(
                pHash,
                result,
                publicUrl,
                webpBlob,
                {
                    client: supabase,
                    fingerprintPipeline: fingerprint.pipeline,
                    triggerStudioEdit: false,
                }
            );

            if (!cachedResult) {
                throw new Error('Shared cache writer returned null');
            }

            console.log('✅ Cached analysis result for pHash:', cachedResult.storedPHash);

            // Trigger background studio edit in parallel with the canonical stored hash.
            after(async () => {
                console.log(`[Background] Triggering studio edit for ${cachedResult.storedPHash} at ${req.nextUrl.origin}/api/admin/cake-cache-images`);
                try {
                    const res = await fetch(`${req.nextUrl.origin}/api/admin/cake-cache-images`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-admin-pin': '231323',
                        },
                        body: JSON.stringify({ pHash: cachedResult.storedPHash })
                    });
                    const text = await res.text();
                    console.log(`[Background] Studio edit fetch response: ${res.status} ${res.statusText} - ${text.slice(0, 200)}`);
                } catch (e) {
                    console.error('[Background] Background studio edit failed:', e);
                }
            });

            return NextResponse.json({
                analysis_json: result,
                image_url: cachedResult.original_image_url || publicUrl,
                cached: false,
                slug: cachedResult.slug,
                p_hash: cachedResult.storedPHash,
            });
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
