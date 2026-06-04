import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ThinkingLevel } from "@google/genai";
import { GoogleAuth } from 'google-auth-library';
import { computeImageFingerprint } from '../src/lib/server/imageFingerprint';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Try to load getAI from local client for the Gemini Flash-Lite calls
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

async function getVertexAccessToken(): Promise<string> {
    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
        throw new Error("Failed to get Google Cloud access token");
    }
    return tokenResponse.token;
}

async function runBenchmark() {
    console.log("==================================================");
    console.log("   GENIE.PH IMAGE ANALYSIS PIPELINE BENCHMARK    ");
    console.log("==================================================");

    const imagePath = path.resolve(process.cwd(), 'cinnamoroll-test.webp');
    if (!fs.existsSync(imagePath)) {
        console.error(`❌ Sample image not found at ${imagePath}`);
        process.exit(1);
    }

    console.log(`Loading test image: ${path.basename(imagePath)}`);
    const imgData = await fileToBase64(imagePath);
    const fileBuffer = fs.readFileSync(imagePath);

    // 1. Local Image Perceptual Hashing (ahash)
    console.log("\n1. Running Local Perceptual Hashing (ahash)...");
    const hashStart = performance.now();
    const fingerprint = await computeImageFingerprint(fileBuffer);
    const hashDuration = performance.now() - hashStart;
    console.log(`   - pHash generated: ${fingerprint.pHash}`);
    console.log(`   - Duration: ${hashDuration.toFixed(2)} ms`);

    // 2. Multimodal Embedding (Vertex AI multimodalembedding@001 REST call)
    console.log("\n2. Running Multimodal Embedding (Vertex AI REST endpoint) - Direct & Corrected...");
    const embedLatencies: number[] = [];
    try {
        console.log("   Fetching Google Cloud auth token...");
        const token = await getVertexAccessToken();
        const projectId = process.env.VERTEX_AI_PROJECT || 'project-d823a677-2d5f-4826-aaf';
        const location = 'us-central1';
        const modelId = 'multimodalembedding@001';
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

        const payload = {
            instances: [
                {
                    image: {
                        bytesBase64Encoded: imgData.data
                    }
                }
            ]
        };

        // Run 4 times: run 1 is cold run, runs 2-4 are warm runs
        for (let i = 0; i < 4; i++) {
            const start = performance.now();
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            }

            const result = await res.json();
            const duration = performance.now() - start;
            const values = result.predictions?.[0]?.imageEmbedding?.values;
            const dims = values ? values.length : 0;

            if (i === 0) {
                console.log(`   - Cold Run: ${duration.toFixed(2)} ms (Dims: ${dims})`);
            } else {
                embedLatencies.push(duration);
                console.log(`   - Warm Run ${i}: ${duration.toFixed(2)} ms (Dims: ${dims})`);
            }
        }
    } catch (e: any) {
        console.error("   ❌ Multimodal embedding failed:", e.message);
    }
    const embedAvg = embedLatencies.length ? (embedLatencies.reduce((a, b) => a + b) / embedLatencies.length) : 0;
    if (embedAvg) console.log(`   -> Average Warm Latency: ${embedAvg.toFixed(2)} ms`);

    // 3. Gemini 3.1 Flash-Lite (gemini-3.1-flash-lite-preview)
    console.log("\n3. Running Gemini 3.1 Flash-Lite (gemini-3.1-flash-lite-preview) - Generative Analysis...");
    const genLatencies: number[] = [];
    
    // Run 4 times: run 1 is cold run, runs 2-4 are warm runs
    for (let i = 0; i < 4; i++) {
        const start = performance.now();
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite-preview',
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: imgData.mimeType, data: imgData.data } },
                        { text: "Output JSON specifying if this image contains a custom cake, and list the dominant colors." }
                    ]
                }],
                config: {
                    responseMimeType: 'application/json',
                    temperature: 0,
                    thinkingConfig: {
                        thinkingLevel: ThinkingLevel.MINIMAL
                    }
                }
            });
            const duration = performance.now() - start;
            if (i === 0) {
                console.log(`   - Cold Run: ${duration.toFixed(2)} ms`);
            } else {
                genLatencies.push(duration);
                console.log(`   - Warm Run ${i}: ${duration.toFixed(2)} ms (Output length: ${response.text?.length} chars)`);
            }
        } catch (e: any) {
            console.error(`   - Run ${i + 1} failed:`, e.message);
        }
    }
    const genAvg = genLatencies.length ? (genLatencies.reduce((a, b) => a + b) / genLatencies.length) : 0;
    if (genAvg) console.log(`   -> Average Warm Latency: ${genAvg.toFixed(2)} ms`);

    // 4. Llama 3.2 11B Vision on Groq (Alternative 2)
    console.log("\n4. Evaluating Llama 3.2 11B Vision on Groq...");
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
        console.log("   - GROQ_API_KEY not found in environment. Skipping live Groq run.");
        console.log("   - Technical Analysis of Llama 3.2 11B Vision on Groq:");
        console.log("     * Groq has no native visual embedding endpoint; standard text-only embeddings like nomic or mixedbread cannot handle images.");
        console.log("     * Generative vision tasks suffer from a ~0.8s to 1.5s vision encoder delay (two-stage 32-layer local + 8-layer global ViT).");
        console.log("     * Despite high generation speeds (800+ TPS), the Time-to-First-Token (TTFT) for visual inputs is bottlenecked by this initial encoding step.");
    } else {
        console.log("   - GROQ_API_KEY found. Sending request to Groq api...");
        const groqLatencies: number[] = [];
        // Run 4 times: run 1 is cold run, runs 2-4 are warm runs
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
                                    { type: 'text', text: 'Output JSON specifying if this image contains a custom cake, and list the dominant colors.' },
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
                if (i === 0) {
                    console.log(`   - Cold Run: ${duration.toFixed(2)} ms`);
                } else {
                    groqLatencies.push(duration);
                    console.log(`   - Warm Run ${i}: ${duration.toFixed(2)} ms (Output: ${data.choices?.[0]?.message?.content?.trim()})`);
                }
            } catch (e: any) {
                console.error(`   - Run ${i + 1} failed:`, e.message);
            }
        }
        const groqAvg = groqLatencies.length ? (groqLatencies.reduce((a, b) => a + b) / groqLatencies.length) : 0;
        if (groqAvg) console.log(`   -> Average Warm Latency: ${groqAvg.toFixed(2)} ms`);
    }

    console.log("\n==================================================");
    console.log("                  BENCHMARK SUMMARY               ");
    console.log("==================================================");
    console.log(`- Local Perceptual Hashing (ahash)     : ${hashDuration.toFixed(2)} ms`);
    if (embedAvg) console.log(`- Multimodal Embedding (Vertex AI REST): ${embedAvg.toFixed(2)} ms`);
    if (genAvg) console.log(`- Gemini 3.1 Flash-Lite (Generative)   : ${genAvg.toFixed(2)} ms`);
    console.log("==================================================");
}

runBenchmark().catch(console.error);
