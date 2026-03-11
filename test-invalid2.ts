import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY });

async function run() {
    const url = "https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/analysis-cache/e8578170-eee9-49bb-9955-46f65195fe07.webp";
    
    const imageRes = await fetch(url);
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    try {
        const response = await ai.models.embedContent({
            model: 'gemini-embedding-2-preview',
            contents: [{
                role: 'user',
                parts: [
                    { text: 'test' },
                    { inlineData: { mimeType: 'image/jpeg', data: buffer.toString('base64') } }
                ]
            }],
        });
        console.log("Success with overriding mimeType");
    } catch (e) {
        console.log("Failed with override:", e.message);
    }
}
run();
