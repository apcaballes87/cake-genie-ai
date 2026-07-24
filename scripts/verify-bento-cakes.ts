import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenAI({ apiKey: geminiKey });

// We'll use the model mentioned in the codebase
const modelName = "gemini-3.5-flash-lite";

async function getImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const buffer = await response.buffer();
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    return {
        data: buffer.toString('base64'),
        mimeType
    };
}

async function verifyBentoCakes() {
    console.log("🚀 Starting Bento Cake Verification...");

    const { data: cakes, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, original_image_url, analysis_json')
        .eq('analysis_json->>cakeType', 'Bento');

    if (error) {
        console.error("❌ Error fetching cakes:", error);
        return;
    }

    if (!cakes || cakes.length === 0) {
        console.log("✅ No bento cakes found in cache.");
        return;
    }

    console.log(`📡 Found ${cakes.length} bento cakes to verify.`);

    const reportPath = path.join(process.cwd(), 'bento-verification-report.json');
    let results: any[] = [];
    if (fs.existsSync(reportPath)) {
        try {
            results = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            console.log(`📁 Loaded ${results.length} existing results from report.`);
        } catch (e) {
            console.error("⚠️ Error reading existing report, starting fresh.");
        }
    }

    const processedHashes = new Set(results.map(r => r.p_hash));
    const toProcess = cakes.filter(c => !processedHashes.has(c.p_hash));

    console.log(`⏳ Remaining to process: ${toProcess.length}`);

    const batchSize = 10;
    for (let i = 0; i < toProcess.length; i += batchSize) {
        const batch = toProcess.slice(i, i + batchSize);
        console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)...`);

        const batchPromises = batch.map(async (cake) => {
            try {
                const imageUrl = cake.original_image_url;
                if (!imageUrl) return null;

                const { data: imageData, mimeType } = await getImageAsBase64(imageUrl);

                const prompt = `Is this cake a 'bento cake'? 
The defining characteristic is that it MUST be in a **clamshell box** (styrofoam, sugarcane, or cardboard). 
If it is a small cake but NOT in a clamshell box (e.g., on a board or in a standard cake box), it is NOT a bento cake.
Respond strictly in JSON format with:
{
  "isBento": boolean,
  "reason": "short explanation referring to the clamshell box"
}`;

                const response = await genAI.models.generateContent({
                    model: modelName,
                    contents: [{
                        parts: [
                            { inlineData: { mimeType, data: imageData } },
                            { text: prompt }
                        ],
                    }],
                    config: {
                        responseMimeType: 'application/json',
                    },
                });

                const jsonText = (response.text || '').trim();
                const analysis = JSON.parse(jsonText);

                console.log(`   [${cake.p_hash}] ${analysis.isBento ? '✅ YES' : '❌ NO'} - ${analysis.reason}`);

                return {
                    p_hash: cake.p_hash,
                    imageUrl,
                    originalCakeType: (cake.analysis_json as any).cakeType,
                    isBento: analysis.isBento,
                    reason: analysis.reason,
                    verifiedAt: new Date().toISOString()
                };
            } catch (err: any) {
                console.error(`   ❌ Error verifying [${cake.p_hash}]:`, err.message);
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(r => r !== null);
        
        results.push(...validResults);
        
        // Incremental save
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    }

    const flagged = results.filter(r => !r.isBento);
    console.log("\n✨ Verification Complete!");
    console.log(`📊 Total Verified: ${results.length}`);
    console.log(`🚩 Flagged (Not Bento): ${flagged.length}`);
    console.log(`📄 Report saved to: ${reportPath}`);
}

verifyBentoCakes();
