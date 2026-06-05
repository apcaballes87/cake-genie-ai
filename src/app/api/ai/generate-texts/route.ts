import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from "@google/genai";
import { getAI } from '@/lib/ai/client';

export const maxDuration = 30;

const TEXT_GENERATION_PROMPT = `You are an expert copywriter and SEO specialist for a cake bakery. Your task is to generate a catchy, SEO-friendly title, a detailed description, and an alt-text for a specific cake design based on its analysis.

**Input:**
- A JSON object containing the cake's analysis (toppers, colors, theme, etc.).
- A 'cakeInfo' object with details like size, flavor, etc.

**Output Requirements:**
1.  **title:**
    *   **Structure:** "[Theme] Themed [Size] [Type] Cake" (For cupcakes, the structure must be "[Theme] Cupcakes" or "[Theme] Cupcakes with [Topper Type]". NEVER append "Cake" or "Cake Design" to cupcake titles).
    *   **Prioritize the Theme:** The theme you identified MUST be the first part of the title. Capitalize the first letter of each major word (Title Case).
    *   **Include Size:** Mention if it's "Bento", "6-inch", "2-Tier", etc. (Not applicable for cupcakes).
    *   **Keep it concise:** Max 60 characters if possible, optimized for search clicks.
    *   **Examples:** "Spiderman Themed 6-inch Cake", "Elegant Floral 2-Tier Wedding Cake", "Cute Bear Bento Cake", "Cinderella Cupcakes with Printout Toppers".

2.  **description:**
    *   **Tone:** Enticing, highly descriptive, unique, and professional.
    *   **Content:** Describe the design clearly. Mention the base color, the main toppers (e.g., "topped with edible gumpaste bears"), and key details.
    *   **GMC Compliance Rules (Strict):**
        *   Absolutely NO pricing references (no starts at, no ₱, no PHP, no prices).
        *   Absolutely NO URLs or website names (no genie.ph, no Genie.ph, no website).
        *   Absolutely NO transactional calls-to-action (do not say "order now", "buy yours today", "get instant pricing").
        *   Safe Suitability Closing: End with a subtle, celebration-oriented phrase like "Perfect for birthdays!" or "A wonderful centerpiece for themed celebrations."
    *   **Length:** 2 sentences.

3.  **altText:**
    *   **Purpose:** For screen readers and SEO.
    *   **Content:** A literal, objective, and descriptive summary of the visual image. "A [color] [type] cake featuring [main elements] and [decorations]." (Or for cupcakes: "A set of [color] cupcakes featuring [main elements] and [decorations].")
    *   **No fluff:** Avoid subjective words ("beautiful", "delicious") or promotional language.

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
            description: "Structure: '[Theme] Themed [Size] [Type] Cake' (or '[Theme] Cupcakes' for cupcakes - NEVER append 'Cake' to cupcakes). Prioritize Theme first. Max 60 characters."
        },
        description: {
            type: Type.STRING,
            description: "Enticing and professional. Describe the design clearly. End with a subtle, occasion-suited phrase. STRICTLY no pricing, no website URLs, and no transactional CTAs."
        },
        altText: {
            type: Type.STRING,
            description: "Literal, objective descriptive summary of the visual image. Example: 'A [color] [type] cake featuring [main elements]' (or 'A set of [color] cupcakes featuring [main elements]' for cupcakes). No promotional words."
        },
    },
    required: ['title', 'description', 'altText'],
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { analysisResult, cakeInfo } = body;

        if (!analysisResult) {
            return NextResponse.json(
                { error: 'Missing analysis result' },
                { status: 400 }
            );
        }

        const prompt = `${TEXT_GENERATION_PROMPT}

Data to process:
Analysis Result: ${JSON.stringify(analysisResult)}
Cake Info: ${JSON.stringify(cakeInfo || {})}
`;

        const aiClient = getAI(req);
        const response = await aiClient.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt }
                ],
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: textGenerationSchema,
                temperature: 0.7, // Slightly higher creative temperature for copy
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                },
            },
        });

        const jsonText = (response.text || '').trim();
        let result;
        try {
            result = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse AI response used for text generation:", jsonText);
            return NextResponse.json(
                { error: 'Invalid response format from AI' },
                { status: 500 }
            );
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error generating text:", error);
        return NextResponse.json(
            { error: 'Failed to generate text' },
            { status: 500 }
        );
    }
}
