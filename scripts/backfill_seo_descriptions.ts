
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Constants
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Prefer service key for writing
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

if (!GOOGLE_AI_API_KEY) {
    console.error('Missing Google AI API Key');
    process.exit(1);
}

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

// Prompt Template (matches src/app/api/ai/generate-texts/route.ts)
const TEXT_GENERATION_PROMPT = `You are an expert copywriter and SEO specialist for a cake bakery. Your task is to generate a catchy, SEO-friendly title, a detailed description, and an alt-text for a specific cake design based on its analysis.

**Input:**
- A JSON object containing the cake's analysis (toppers, colors, theme, etc.).
- A 'cakeInfo' object with details like size, flavor, etc.

**Output Requirements:**
1.  **title:**
    *   **Structure:** "[Theme] Themed [Size] [Type] Cake"
    *   **Prioritize the Theme:** The theme you identified MUST be the first part of the title. Capitalize the first letter of each major word (Title Case).
    *   **Include Size:** Mention if it's "Bento", "6-inch", "2-Tier", etc.
    *   **Keep it concise:** Max 60 characters if possible, optimized for search clicks.
    *   **Examples:** "Spiderman Themed 6-inch Cake", "Elegant Floral 2-Tier Wedding Cake", "Cute Bear Bento Cake".

2.  **description:**
    *   **Tone:** Enticing, descriptive, and professional.
    *   **Content:** Describe the design clearly. Mention the base color, the main toppers (e.g., "topped with edible gumpaste bears"), and key details.
    *   **Call to Action:** End with a subtle nudging phrase like "Perfect for birthdays!" or "Customize yours today!".
    *   **Length:** 1-2 sentences.

3.  **altText:**
    *   **Purpose:** For screen readers and SEO.
    *   **Content:** A literal, descriptive summary of the visual image. "A [color] [type] cake featuring [main elements] and [decorations]."
    *   **No fluff:** Avoid "picture of" or promotional language.

**Output Format:** Your response MUST be a single, valid JSON object with the following structure:
{
  "title": "string",
  "description": "string",
  "altText": "string"
}
`;

const textGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        title: {
            type: Type.STRING,
            description: "Structure: '[Theme] Themed [Size] [Type] Cake'. Prioritize the Theme first. Include Size. Max 60 characters."
        },
        description: {
            type: Type.STRING,
            description: "Enticing, descriptive, and professional. Describe the design clearly (base color, main toppers, key details). End with a subtle Call to Action. Length: 1-2 sentences."
        },
        altText: {
            type: Type.STRING,
            description: "Literal, descriptive summary of the visual image. Example: 'A [color] [type] cake featuring [main elements] and [decorations].' No fluff."
        },
    },
    required: ['title', 'description', 'altText'],
};

async function generateSeoText(analysisResult: any, cakeInfo: any) {
    const prompt = `${TEXT_GENERATION_PROMPT}

Data to process:
Analysis Result: ${JSON.stringify(analysisResult)}
Cake Info: ${JSON.stringify(cakeInfo || {})}
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash", // Using flash for speed/cost, similar to route
            contents: [{
                parts: [
                    { text: prompt }
                ],
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: textGenerationSchema,
                temperature: 0.7,
            },
        });

        const jsonText = (response.text || '').trim();
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("AI Generation failed:", e);
        return null;
    }
}

async function main() {
    console.log('🚀 Starting SEO Description Backfill...');

    // 1. Fetch rows with generic descriptions
    // The pattern provided by user: "Get instant pricing for this % cake design. Customize and order at Genie.ph%"
    const { data: rows, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*')
        .like('seo_description', 'Get instant pricing for this % cake design. Customize and order at Genie.ph%');

    if (error) {
        console.error('Error fetching rows:', error);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log('✅ No rows found matching the generic description pattern.');
        return;
    }

    console.log(`found ${rows.length} rows to update.`);

    let successCount = 0;
    let failCount = 0;

    for (const row of rows) {
        console.log(`Processing row ${row.p_hash} (Slug: ${row.slug})...`);

        try {
            // Construct cakeInfo (mocking minimal needed info if not fully available in analysis_json)
            const analysis = row.analysis_json;
            const cakeInfo = {
                type: analysis.cakeType || 'Custom',
                thickness: analysis.cakeThickness || 'Standard',
                size: 'Standard', // analysis_json might not have size explicitly in top level, purely for prompt context
            };

            const generated = await generateSeoText(analysis, cakeInfo);

            if (generated) {
                console.log(`   -> Generated Title: ${generated.title}`);

                const { error: updateError } = await supabase
                    .from('cakegenie_analysis_cache')
                    .update({
                        seo_title: generated.title,
                        seo_description: generated.description,
                        alt_text: generated.altText
                    })
                    .eq('p_hash', row.p_hash);

                if (updateError) {
                    console.error(`   ❌ Update failed for ${row.p_hash}:`, updateError.message);
                    failCount++;
                } else {
                    console.log(`   ✅ Updated successfully.`);
                    successCount++;
                }
            } else {
                console.error(`   ❌ Failed to generate text for ${row.p_hash}`);
                failCount++;
            }

            // Small delay to avoid rate limits if processing many
            await new Promise(r => setTimeout(r, 500));

        } catch (err) {
            console.error(`   ❌ Unexpected error for ${row.p_hash}:`, err);
            failCount++;
        }
    }

    console.log(`\n🎉 Finished!`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

main().catch(console.error);
