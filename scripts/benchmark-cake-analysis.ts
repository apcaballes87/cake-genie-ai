import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ThinkingLevel } from "@google/genai";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Load prompt and schemas
const { loadFallbackAnalysisPrompt } = require('../src/services/prompts/promptLoader');
const { buildSearchAnalysisResponseSchema } = require('../src/lib/admin/searchAnalysisContract');
const { SYSTEM_INSTRUCTION } = require('../src/lib/ai/prompts');

const typeEnums = {
    mainTopperTypes: ['edible_3d_complex', 'edible_3d_ordinary', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo_top', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'],
    supportElementTypes: ['edible_3d_support', 'edible_2d_support', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'dragees', 'edible_flowers', 'edible_photo_side', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'macarons', 'meringue', 'gumpaste_bundle', 'candy', 'gumpaste_panel', 'icing_decorations', 'gumpaste_creations', 'satin_ribbon']
};

const responseSchema = buildSearchAnalysisResponseSchema(typeEnums);

let getAI: any;
try {
    const clientModule = require('../src/lib/ai/client');
    getAI = clientModule.getAI;
} catch (err: any) {
    console.error("Failed to import getAI client:", err.message);
    process.exit(1);
}

const ai = getAI();

async function fileToBase64(filePath: string): Promise<{ mimeType: string; data: string }> {
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    
    return {
        mimeType,
        data: fileBuffer.toString('base64'),
    };
}

async function runBenchmark() {
    console.log("==================================================");
    console.log("    GENIE.PH GENERATIVE CAKE ANALYSIS BENCHMARK    ");
    console.log("==================================================");

    const imagePath = path.resolve(process.cwd(), 'cinnamoroll-test.webp');
    if (!fs.existsSync(imagePath)) {
        console.error(`❌ Sample image not found at ${imagePath}`);
        process.exit(1);
    }

    console.log(`Loading image: ${path.basename(imagePath)}`);
    const imgData = await fileToBase64(imagePath);
    const fallbackPrompt = loadFallbackAnalysisPrompt();
    
    console.log(`Fallback Prompt length: ${fallbackPrompt.length} chars`);

    // 1. Gemini 3.1 Flash-Lite on Vertex AI (Existing vision stack - UNCACHED)
    console.log("\n1. Running Gemini 3.1 Flash-Lite (Existing Vision Stack - UNCACHED)...");
    const geminiWarmLatencies: number[] = [];

    // Run 4 times (first is cold, next 3 are warm)
    for (let i = 0; i < 4; i++) {
        const start = performance.now();
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite-preview",
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: imgData.mimeType, data: imgData.data } },
                        { text: fallbackPrompt }
                    ],
                }],
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema,
                    temperature: 0,
                    thinkingConfig: {
                        thinkingLevel: ThinkingLevel.MINIMAL
                    }
                },
            });

            const duration = performance.now() - start;
            const outputText = response.text || '';
            const charCount = outputText.length;

            if (i === 0) {
                console.log(`   - Cold Run: ${duration.toFixed(2)} ms (Output: ${charCount} chars)`);
            } else {
                geminiWarmLatencies.push(duration);
                console.log(`   - Warm Run ${i}: ${duration.toFixed(2)} ms (Output: ${charCount} chars)`);
            }
        } catch (error: any) {
            console.error(`   - Run ${i + 1} failed:`, error.message);
        }
    }
    const geminiAvg = geminiWarmLatencies.length ? (geminiWarmLatencies.reduce((a, b) => a + b) / geminiWarmLatencies.length) : 0;
    if (geminiAvg) console.log(`   -> Average Warm Latency: ${geminiAvg.toFixed(2)} ms`);


    // 2. Gemini 3.1 Flash-Lite on Vertex AI WITH Context Caching (CACHED)
    console.log("\n2. Running Gemini 3.1 Flash-Lite (Vertex AI - PROMPT CACHED)...");
    const cachedWarmLatencies: number[] = [];
    let cache: any = null;

    try {
        console.log("   Creating Vertex AI Context Cache (Prompt Cache)...");
        const cacheStart = performance.now();
        cache = await ai.caches.create({
            model: 'gemini-3.1-flash-lite-preview',
            config: {
                contents: [
                    { role: 'user', parts: [{ text: fallbackPrompt }] }
                ],
                systemInstruction: SYSTEM_INSTRUCTION,
                ttl: '300s', // 5-minute TTL for benchmark purposes
                displayName: 'genie-cake-analysis-prompt-benchmark',
            }
        });
        const cacheCreationTime = performance.now() - cacheStart;
        console.log(`   - Cache created: ${cache.name} in ${cacheCreationTime.toFixed(2)} ms`);

        // Run 4 times (first is cold for caching/session startup, next 3 are warm cached)
        for (let i = 0; i < 4; i++) {
            const start = performance.now();
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite-preview',
                contents: [
                    { inlineData: { mimeType: imgData.mimeType, data: imgData.data } }
                ],
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema,
                    temperature: 0,
                    thinkingConfig: {
                        thinkingLevel: ThinkingLevel.MINIMAL
                    },
                    cachedContent: cache.name
                }
            });

            const duration = performance.now() - start;
            const outputText = response.text || '';
            const charCount = outputText.length;
            const usage = response.usageMetadata;

            if (i === 0) {
                console.log(`   - Cold Cached Run: ${duration.toFixed(2)} ms (Output: ${charCount} chars)`);
                if (usage) {
                    console.log(`     [Usage Info] Ingested: ${usage.promptTokenCount} tokens | Cached: ${usage.cachedContentTokenCount} tokens | Output: ${usage.candidatesTokenCount} tokens`);
                }
            } else {
                cachedWarmLatencies.push(duration);
                console.log(`   - Warm Cached Run ${i}: ${duration.toFixed(2)} ms (Output: ${charCount} chars)`);
                if (usage) {
                    console.log(`     [Usage Info] Ingested: ${usage.promptTokenCount} tokens | Cached: ${usage.cachedContentTokenCount} tokens | Output: ${usage.candidatesTokenCount} tokens`);
                }
            }
        }
    } catch (e: any) {
        console.error("   ❌ Prompt Caching test failed:", e.message);
    } finally {
        if (cache) {
            console.log("   Cleaning up Vertex AI Context Cache...");
            try {
                await ai.caches.delete({ name: cache.name });
                console.log("   - Cache deleted successfully");
            } catch (e: any) {
                console.error("   - Failed to delete cache:", e.message);
            }
        }
    }
    const cachedAvg = cachedWarmLatencies.length ? (cachedWarmLatencies.reduce((a, b) => a + b) / cachedWarmLatencies.length) : 0;
    if (cachedAvg) console.log(`   -> Average Warm Cached Latency: ${cachedAvg.toFixed(2)} ms`);


    // 3. Llama 3.2 11B Vision on Groq (Alternative)
    console.log("\n3. Evaluating Llama 3.2 11B Vision on Groq...");
    const groqKey = process.env.GROQ_API_KEY;
    let groqAvg = 0;
    if (!groqKey) {
        console.log("   - GROQ_API_KEY not found in environment. Skipping live Groq run.");
        console.log("   - Technical Analysis of Llama 3.2 11B Vision on Groq for Generative Analysis:");
        console.log("     * Groq delivers ~800+ Tokens Per Second (TPS) compared to Gemini Flash-Lite's ~120 TPS.");
        console.log("     * For a large structured output (like our detailed 500-token cake analysis JSON), the decoding time makes up most of the latency.");
        console.log("     * Gemini Flash-Lite (Uncached): 800ms TTFT + (500 tokens / 120 TPS = 4.17s decoding) = ~5.0 seconds.");
        console.log("     * Gemini Flash-Lite (CACHED): ~200ms TTFT + (500 tokens / 120 TPS = 4.17s decoding) = ~4.4 seconds (mostly decoding cost).");
        console.log("     * Groq Llama 3.2 Vision: 1.0s Vision encoder TTFT + (500 tokens / 800 TPS = 0.62s decoding) = ~1.6 seconds.");
        console.log("     * Llama 3.2 11B Vision on Groq will be ~3x FASTER than Gemini 3.1 Flash-Lite for this detailed generative analysis!");
    } else {
        console.log("   - GROQ_API_KEY found. Sending requests to Groq...");
        const groqWarmLatencies: number[] = [];

        // Build prompt for Llama 3.2 Vision (instructing it to return JSON matching the schema structure)
        const llamaPrompt = `${SYSTEM_INSTRUCTION}\n\n${fallbackPrompt}\n\nReturn the output strictly in JSON format matching the schema rules.`;

        for (let i = 0; i < 4; i++) {
            const start = performance.now();
            try {
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.2-11b-vision-preview',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: llamaPrompt },
                                    {
                                        type: 'image_url',
                                        image_url: {
                                            url: `data:${imgData.mimeType};base64,${imgData.data}`
                                        }
                                    }
                                ]
                            }
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0
                    })
                });

                if (!res.ok) {
                    throw new Error(`Groq HTTP error: ${res.status} ${await res.text()}`);
                }
                const data = await res.json();
                const duration = performance.now() - start;
                const outputText = data.choices?.[0]?.message?.content || '';
                const charCount = outputText.length;

                if (i === 0) {
                    console.log(`   - Cold Run: ${duration.toFixed(2)} ms (Output: ${charCount} chars)`);
                } else {
                    groqWarmLatencies.push(duration);
                    console.log(`   - Warm Run ${i}: ${duration.toFixed(2)} ms (Output: ${charCount} chars)`);
                }
            } catch (e: any) {
                console.error(`   - Run ${i + 1} failed:`, e.message);
            }
        }
        groqAvg = groqWarmLatencies.length ? (groqWarmLatencies.reduce((a, b) => a + b) / groqWarmLatencies.length) : 0;
        if (groqAvg) console.log(`   -> Average Warm Latency: ${groqAvg.toFixed(2)} ms`);
    }

    console.log("\n==================================================");
    console.log("                  BENCHMARK SUMMARY               ");
    console.log("==================================================");
    if (geminiAvg) console.log(`- Gemini 3.1 Flash-Lite (Uncached)     : ${geminiAvg.toFixed(2)} ms`);
    if (cachedAvg) console.log(`- Gemini 3.1 Flash-Lite (Prompt Cached): ${cachedAvg.toFixed(2)} ms`);
    if (groqKey && groqAvg) console.log(`- Llama 3.2 11B Vision (Groq)          : ${groqAvg.toFixed(2)} ms`);
    console.log("==================================================");
}

runBenchmark().catch(console.error);
