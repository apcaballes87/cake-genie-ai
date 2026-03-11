import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import sharp from 'sharp';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY });

async function fileToBase64(buffer: Buffer, mimeType: string): Promise<{ mimeType: string; data: string }> {
    return {
        mimeType,
        data: buffer.toString('base64'),
    };
}

async function run() {
    console.log('Fetching cached analyses without embeddings...');
    
    // Fetch records needing backfill
    const { data: records, error } = await supabase
        .from('cakegenie_analysis_cache')
        .select('p_hash, original_image_url, seo_title, seo_description, keywords, tags')
        .is('image_embedding', null)
        .not('original_image_url', 'is', null);

    if (error) {
        console.error('Error fetching records:', error);
        return;
    }

    console.log(`Found ${records?.length || 0} records to backfill.`);

    if (!records || records.length === 0) {
        return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const record of records) {
        console.log(`\nProcessing p_hash: ${record.p_hash}`);
        try {
            // 1. Download image
            const imageRes = await fetch(record.original_image_url);
            if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.statusText}`);
            
            const arrayBuffer = await imageRes.arrayBuffer();
            const originalBuffer = Buffer.from(arrayBuffer);
            
            // Convert to JPEG using sharp to avoid Gemini 'INVALID_ARGUMENT' errors parsing webps
            const buffer = await sharp(originalBuffer).jpeg({ quality: 80 }).toBuffer();
            const mimeType = 'image/jpeg';
            
            const imageBase64 = await fileToBase64(buffer, mimeType);

            // 2. Build text payload
            const textParts = [
                record.seo_title,
                record.seo_description,
                record.keywords,
                (record.tags || []).join(', ')
            ].filter(Boolean);
            const textPayload = textParts.join(' | ');

            console.log(`Generating embedding for image and text ("${textPayload.substring(0, 50)}...")...`);

            // 3. Generate embedding
            const parts: any[] = [];
            if (textPayload) {
                parts.push({ text: textPayload });
            }
            parts.push({ inlineData: { mimeType: imageBase64.mimeType, data: imageBase64.data } });

            const response = await ai.models.embedContent({
                model: 'gemini-embedding-2-preview',
                contents: [{
                    role: 'user',
                    parts: parts
                }],
                config: {
                    outputDimensionality: 768
                }
            });

            const embeddingValues = response.embeddings?.[0]?.values;

            if (!embeddingValues || embeddingValues.length === 0) {
                throw new Error('Failed to generate embedding array from AI response');
            }

            // 4. Update Database
            const { error: updateError } = await supabase
                .from('cakegenie_analysis_cache')
                .update({ image_embedding: embeddingValues })
                .eq('p_hash', record.p_hash);

            if (updateError) {
                throw new Error(`Database update failed: ${updateError.message}`);
            }

            console.log(`✅ Successfully backfilled embedding for ${record.p_hash}`);
            successCount++;

            // Rate limiting pause (e.g., 2 requests per second)
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (err: unknown) {
            if (err instanceof Error) {
                console.error(`❌ Failed to process ${record.p_hash}:`, err.message);
            } else {
                console.error(`❌ Failed to process ${record.p_hash}:`, err);
            }
            failureCount++;
        }
    }

    console.log(`\nBackfill complete! Success: ${successCount}, Failures: ${failureCount}`);
}

run();
