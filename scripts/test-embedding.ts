import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY });

async function run() {
    try {
        console.log("Testing gemini-embedding-2-preview with image + text...");
        // 1x1 pixel PNG
        const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        
        const response = await ai.models.embedContent({
            model: 'gemini-embedding-2-preview',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: "Spiderman Cake 2 Tier Boys Birthday Red Blue" },
                        { inlineData: { mimeType: 'image/png', data: base64Image } }
                    ]
                }
            ],
             config: {
                outputDimensionality: 768
            }
        });

        console.log("Embedding vector dimensions:", response.embeddings?.[0]?.values?.length);
        console.log("First 5 values:", response.embeddings?.[0]?.values?.slice(0, 5));
    } catch (e: unknown) {
        if (e instanceof Error) {
            console.error("Error with gemini-embedding-2-preview:", e.message);
        } else {
            console.error("Error with gemini-embedding-2-preview:", e);
        }
    }
}

run();
