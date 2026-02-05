import { GoogleGenAI } from "@google/genai";

let ai: InstanceType<typeof GoogleGenAI> | null = null;

export function getAI() {
    if (!ai) {
        // Use server-only environment variable FIRST
        const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;

        if (!apiKey) {
            console.error('Missing GOOGLE_AI_API_KEY environment variable');
            throw new Error('AI service is not configured. Please contact support if this problem persists.');
        }

        try {
            ai = new GoogleGenAI({ apiKey });
        } catch (initError) {
            console.error('Failed to initialize Google AI:', initError);
            throw new Error('Failed to initialize AI service. Please try again later.');
        }
    }
    return ai;
}
