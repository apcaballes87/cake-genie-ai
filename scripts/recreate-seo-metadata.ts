#!/usr/bin/env npx tsx
// scripts/recreate-seo-metadata.ts

import { createClient } from '@supabase/supabase-js';
import { Type } from "@google/genai";
import * as dotenv from 'dotenv';
import * as path from 'path';

// --- Configuration & Initialization ---

// Force Vertex AI to use us-central1 region where models are fully active
process.env.VERTEX_AI_LOCATION = 'us-central1';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// CLI Arguments
const WRITE = process.argv.includes('--write');
const ALL_RECORDS = process.argv.includes('--all');

const limitArgIndex = process.argv.indexOf('--limit');
const LIMIT = limitArgIndex !== -1 ? parseInt(process.argv[limitArgIndex + 1], 10) : null;

// Concurrency and rate limit configuration
const CONCURRENCY_LIMIT = 2;
const RETRY_ATTEMPTS = 5;
const DELAY_BETWEEN_BATCHES_MS = 600;

// Prompt Template for compliance
const SYSTEM_PROMPT = `You are a professional SEO copywriter and e-commerce product specialist.
Your task is to write:
1. An SEO-compliant, highly engaging product description.
2. A literal, descriptive alt-text for screen readers.

Input will contain the cake's theme keyword, type/size, and a detailed visual analysis in JSON format (toppers, colors, icing borders, decorative elements, accents, text messages).

CRITICAL COMPLIANCE RULES (MANDATORY):
1. Absolutely NO pricing references. Never mention "starts at", "price", "₱", "PHP", or cost of any kind.
2. Absolutely NO URLs or website names. Never mention "genie.ph", "Genie.ph", "Genie", or any other site.
3. Absolutely NO transaction-oriented calls-to-action (e.g. "order yours now", "get instant pricing", "visit our site", "buy today").
4. Absolutely NO promotional words like "free delivery", "discount", "sale", "cheap", or taste/texture descriptors like "yummy", "delicious", "tasty", "moist".

OUTPUT REQUIREMENTS:
- description: A beautiful, creative, and highly specific description of the cake's design, theme, base colors, specific toppers, and decorative details. Write 2 to 3 sentences (150-350 characters). It must feel unique and celebrate the occasion naturally.
- altText: An objective, literal description of what the cake looks like in the image. Format: "A [Colors] [Cake Type] cake themed around [Theme], featuring [Main Toppers] and [Decorative Accents]." Keep it between 60-120 characters. No promotional or subjective words.

Your response MUST be a single, valid JSON object with the following structure:
{
  "description": "string",
  "altText": "string"
}
`;

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        description: {
            type: Type.STRING,
            description: "Highly engaging and GMC-compliant product description. 2-3 sentences. No pricing, no URLs, no promotional calls-to-action."
        },
        altText: {
            type: Type.STRING,
            description: "Literal descriptive alt text for search engines and accessibility. No promotional or subjective words."
        }
    },
    required: ["description", "altText"]
};

// --- Helpers ---

// Delay utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Exponential backoff retry utility
async function callAiWithRetry(ai: any, prompt: string, attempt = 1): Promise<any> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
                temperature: 0.7,
            }
        });

        const jsonText = (response.text || '').trim();
        return JSON.parse(jsonText);
    } catch (error: any) {
        if (attempt <= RETRY_ATTEMPTS) {
            const backoffTime = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
            console.warn(`⚠️ Attempt ${attempt} failed. Retrying in ${backoffTime}ms... (Error: ${error.message})`);
            await delay(backoffTime);
            return callAiWithRetry(ai, prompt, attempt + 1);
        }
        throw error;
    }
}

// Check for simple formatting errors or forbidden words in generated text
function isCompliant(text: string): boolean {
    const lower = text.toLowerCase();
    const forbidden = ['genie.ph', 'genie', 'starts at', '₱', 'php', 'order now', 'get instant', 'free delivery', 'delicious', 'yummy'];
    return !forbidden.some(word => lower.includes(word));
}

// --- Main Script Logic ---

async function main() {
    console.log(`🚀 Starting GMC/SEO Compliant Re-creation Script...`);
    console.log(`Mode: ${WRITE ? '💾 WRITE (Updates will be committed)' : '🔍 DRY RUN (Previews only)'}`);
    console.log(`Target: ${ALL_RECORDS ? 'All records in cache' : 'Non-compliant promotional records only'}`);
    if (LIMIT !== null) console.log(`Limit: ${LIMIT} records`);

    // 1. Initialize AI client
    let ai: any;
    try {
        const { getAI } = require('../src/lib/ai/client');
        ai = getAI();
        console.log(`✅ AI Client successfully initialized via Vertex AI.`);
    } catch (e: any) {
        console.error(`❌ Failed to initialize AI client:`, e.message);
        process.exit(1);
    }

    // 2. Fetch candidate records using pagination to bypass 1,000 row limits
    let records: any[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;
    
    console.log('Fetching candidate records from cakegenie_analysis_cache in pages...');
    while (true) {
        let query = supabase
            .from('cakegenie_analysis_cache')
            .select('p_hash, slug, keywords, seo_title, seo_description, alt_text, analysis_json, tags')
            .not('analysis_json', 'is', null)
            .not('slug', 'is', null)
            .range(offset, offset + PAGE_SIZE - 1);

        if (!ALL_RECORDS) {
            // Targets promotional footprints that fail GMC compliance
            query = query.or('seo_description.ilike.%genie.ph%,seo_description.ilike.%pricing%,seo_description.ilike.%order%');
        }

        const { data: pageData, error } = await query;

        if (error) {
            console.error('❌ Error fetching records:', error.message);
            process.exit(1);
        }

        if (!pageData || pageData.length === 0) break;

        records.push(...pageData);
        process.stdout.write(`Fetched page of size ${pageData.length} (Total accumulated: ${records.length})\r`);

        if (LIMIT !== null && records.length >= LIMIT) {
            records = records.slice(0, LIMIT);
            break;
        }

        if (pageData.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
    }
    console.log(`\n✅ Loaded ${records.length} records successfully.`);

    if (records.length === 0) {
        console.log('✅ No candidate records found matching compliance requirements.');
        return;
    }

    console.log(`Found ${records.length} records to process.`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // Concurrency queue processing
    const runQueue = async (candidates: any[]) => {
        const workers = Array.from({ length: CONCURRENCY_LIMIT }, async (_, workerId) => {
            while (candidates.length > 0) {
                const record = candidates.shift();
                if (!record) break;

                const index = ++processedCount;
                console.log(`[Worker ${workerId + 1}] [${index}/${records.length}] Processing "${record.slug}"...`);

                try {
                    // Construction of contextual prompt containing core analysis
                    const promptInput = {
                        keywords: record.keywords || record.seo_title || 'custom themed',
                        cakeType: record.analysis_json?.cakeType || 'custom cake',
                        tags: record.tags || [],
                        analysis: record.analysis_json
                    };

                    const generated = await callAiWithRetry(ai, JSON.stringify(promptInput));

                    if (!generated || !generated.description || !generated.altText) {
                        throw new Error('AI output missing required fields.');
                    }

                    // Check compliance safeguards on the generated data
                    if (!isCompliant(generated.description) || !isCompliant(generated.altText)) {
                        console.warn(`   ⚠️ AI output violated compliance checks. Filtering out promotional phrases...`);
                        generated.description = generated.description
                            .replace(/genie\.ph|genie/gi, '')
                            .replace(/starts at \b\d+/gi, '')
                            .replace(/order now|get instant/gi, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                    }

                    if (WRITE) {
                        const { error: updateError } = await supabase
                            .from('cakegenie_analysis_cache')
                            .update({
                                seo_description: generated.description,
                                alt_text: generated.altText
                            })
                            .eq('p_hash', record.p_hash);

                        if (updateError) {
                            console.error(`   ❌ Supabase update failed for ${record.slug}: ${updateError.message}`);
                            failedCount++;
                        } else {
                            console.log(`   ✅ Successfully updated "${record.slug}" in database.`);
                            successCount++;
                        }
                    } else {
                        // DRY RUN printing
                        console.log(`\n------------------------------------------------`);
                        console.log(`Slug: ${record.slug}`);
                        console.log(`OLD Desc: "${record.seo_description}"`);
                        console.log(`NEW Desc: "${generated.description}"`);
                        console.log(`OLD Alt : "${record.alt_text}"`);
                        console.log(`NEW Alt : "${generated.altText}"`);
                        console.log(`------------------------------------------------\n`);
                        successCount++;
                    }

                } catch (e: any) {
                    console.error(`   ❌ Failed to process "${record.slug}": ${e.message}`);
                    failedCount++;
                }

                // Minor delay to prevent aggressive bursts
                await delay(DELAY_BETWEEN_BATCHES_MS);
            }
        });

        await Promise.all(workers);
    };

    // Trigger run queue
    const queue = [...records];
    await runQueue(queue);

    console.log(`\n🎉 Execution Finished!`);
    console.log(`Total Scanned     : ${records.length}`);
    console.log(`Successfully Processed: ${successCount}`);
    console.log(`Failed / Skipped      : ${failedCount}`);
    if (!WRITE) {
        console.log(`\nℹ️ This was a DRY RUN. Run with --write to persist changes in Supabase.`);
    }
}

main().catch(console.error);
