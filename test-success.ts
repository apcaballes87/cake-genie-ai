import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY });

async function run() {
    const { data } = await supabase.from('cakegenie_analysis_cache').select('original_image_url').eq('p_hash', 'ff30adadf3a80408').single();
    if (!data) return;
    const url = data.original_image_url;
    console.log("URL:", url);
    
    const imageRes = await fetch(url);
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = imageRes.headers.get('content-type') || 'image/webp';
    console.log("Mime type:", mimeType);
    console.log("Buffer length (bytes):", buffer.length);
    
    try {
        const response = await ai.models.embedContent({
            model: 'gemini-embedding-2-preview',
            contents: [{
                role: 'user',
                parts: [
                    { text: 'test' },
                    { inlineData: { mimeType: mimeType, data: buffer.toString('base64') } }
                ]
            }],
        });
        console.log("Success:", response.embeddings?.[0]?.values?.slice(0, 3));
    } catch (e: any) {
        console.log("Failed:", e.message);
    }
}
run();
