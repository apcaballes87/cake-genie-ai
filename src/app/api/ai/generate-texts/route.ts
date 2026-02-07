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
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        altText: { type: Type.STRING },
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

        const aiClient = getAI();
        const response = await aiClient.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
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
