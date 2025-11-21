// services/geminiService.ts

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";
import { getSupabaseClient } from '../lib/supabase/client';

let ai: InstanceType<typeof GoogleGenAI> | null = null;

function getAI() {
    if (!ai) {
        // The execution environment securely injects this specific variable.
        const geminiApiKey = process.env.API_KEY;
        
        if (!geminiApiKey) {
            throw new Error("API_KEY environment variable not set. Please ensure the environment is configured correctly.");
        }
        ai = new GoogleGenAI({ apiKey: geminiApiKey });
    }
    return ai;
}

const supabase = getSupabaseClient();

// Cache the prompt for 10 minutes
let promptCache: {
  prompt: string;
  timestamp: number;
} | null = null;

const PROMPT_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Cache for dynamic enums
let typeEnumsCache: {
  mainTopperTypes: string[];
  supportElementTypes: string[];
  timestamp: number;
} | null = null;
const ENUM_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function getActivePrompt(): Promise<string> {
  const now = Date.now();
  
  // Return cached if still valid
  if (promptCache && (now - promptCache.timestamp < PROMPT_CACHE_DURATION)) {
    return promptCache.prompt;
  }
  
  // Fetch from database
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_text')
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (error || !data) {
    console.warn('Failed to fetch prompt from database, using fallback');
    // Keep your current hardcoded prompt as fallback
    return FALLBACK_PROMPT;
  }
  
  // Update cache
  promptCache = {
    prompt: data.prompt_text,
    timestamp: now
  };
  
  return data.prompt_text;
}

async function getDynamicTypeEnums(): Promise<{ mainTopperTypes: string[], supportElementTypes: string[] }> {
    const now = Date.now();
  
    // Check cache first
    if (typeEnumsCache && (now - typeEnumsCache.timestamp < ENUM_CACHE_DURATION)) {
        return { 
            mainTopperTypes: typeEnumsCache.mainTopperTypes, 
            supportElementTypes: typeEnumsCache.supportElementTypes 
        };
    }
  
    // Fetch from Supabase pricing_rules table
    const { data, error } = await supabase
        .from('pricing_rules')
        .select('item_type, category')
        .eq('is_active', true)
        .not('item_type', 'is', null);
  
    // Define a hardcoded fallback for safety
    const fallbackEnums = {
        mainTopperTypes: ['edible_3d_complex', 'edible_3d_ordinary', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'],
        supportElementTypes: ['edible_3d_support', 'edible_2d_support', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'dragees', 'edible_flowers', 'edible_photo_side', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread']
    };

    if (error || !data) {
        console.warn('Failed to fetch dynamic enums from pricing_rules, using hardcoded fallback enums.');
        return fallbackEnums;
    }

    const mainTopperTypes = new Set<string>();
    const supportElementTypes = new Set<string>();

    // Separate the types based on their category
    data.forEach(rule => {
        if (rule.item_type) {
            if (rule.category === 'main_topper') {
                mainTopperTypes.add(rule.item_type);
            } else if (rule.category === 'support_element') {
                supportElementTypes.add(rule.item_type);
            }
        }
    });
    
    const result = {
        mainTopperTypes: Array.from(mainTopperTypes),
        supportElementTypes: Array.from(supportElementTypes),
    };
    
    // If the fetched lists are empty for some reason, use the fallback
    if (result.mainTopperTypes.length === 0 || result.supportElementTypes.length === 0) {
         console.warn('Fetched dynamic enums but one or both lists are empty, using hardcoded fallback enums.');
         return fallbackEnums;
    }

    // Update the cache
    typeEnumsCache = {
        ...result,
        timestamp: now
    };
  
    return result;
}

export function clearPromptCache() {
  promptCache = null;
  typeEnumsCache = null; // Also clear the enum cache
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export const fileToBase64 = async (file: File): Promise<{ mimeType: string; data: string }> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = arrayBufferToBase64(arrayBuffer);
        return { mimeType: file.type, data: base64Data };
    } catch (error) {
        console.error("Error reading file:", error);
        throw new Error("Failed to read the image file.");
    }
};

const VALIDATION_PROMPT = `You are an image validation expert for a cake customization app. Your task is to analyze the provided image and determine if it's suitable for our automated design and pricing tool. Your response must be a valid JSON object.

**CRITICAL RULE: Focus ONLY on the main subject of the photo.** Ignore blurry, out-of-focus items in the background. If the primary, focused subject is a single cake, the image is valid.

Based on the image, classify it into ONE of the following categories:

- "valid_single_cake": The main, in-focus subject is a single, clear image of one cake. It can be a bento, 1-3 tier, square, rectangle, or fondant cake. Other items, including other cakes or cupcakes, are acceptable ONLY if they are blurry, out-of-focus, and clearly in the background.
- "not_a_cake": The image does not contain a cake. It might be a person, object, or scene that isn't cake-like.
- "multiple_cakes": The image clearly shows two or more separate cakes as the primary, in-focus subjects. Do NOT use this classification if the other cakes are blurry or in the background.
- "only_cupcakes": The image contains only cupcakes and no larger cake.
- "complex_sculpture": The cake is an extreme, gravity-defying sculpture, a hyper-realistic object (like a shoe or a car), or has incredibly intricate details that are beyond standard customization.
- "large_wedding_cake": The cake is clearly a large, elaborate wedding cake, typically 4 tiers or more, often with complex floral arrangements or structures.
- "non_food": The image is not of a food item at all.

Provide your response as a JSON object with a single key "classification".

Example for a valid cake:
{ "classification": "valid_single_cake" }

Example for a picture of a car:
{ "classification": "not_a_cake" }
`;

const validationResponseSchema = {
    type: Type.OBJECT,
    properties: {
        classification: {
            type: Type.STRING,
            enum: [
                'valid_single_cake',
                'not_a_cake',
                'multiple_cakes',
                'only_cupcakes',
                'complex_sculpture',
                'large_wedding_cake',
                'non_food',
            ],
        },
    },
    required: ['classification'],
};

export const validateCakeImage = async (base64ImageData: string, mimeType: string): Promise<string> => {
    try {
        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: VALIDATION_PROMPT }
                ],
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: validationResponseSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.classification;

    } catch (error) {
        console.error("Error validating cake image:", error);
        throw new Error("The AI failed to validate the image. Please try again.");
    }
};

const SYSTEM_INSTRUCTION = `You are an expert cake designer analyzing a cake image to identify design elements for pricing and customization. Your response must be a valid JSON object.

**GLOBAL RULES:**
1.  **JSON Output:** Your entire response MUST be a single, valid JSON object that adheres to the provided schema. Do not include any text, explanations, or markdown formatting outside of the JSON structure.
2.  **Color Palette:** For any color field in your response (like icing or message colors), you MUST use the closest matching hex code from this specific list: Red (#EF4444), Light Red (#FCA5A5), Orange (#F97316), Yellow (#EAB308), Green (#16A34A), Light Green (#4ADE80), Teal (#14B8A6), Blue (#3B82F6), Light Blue (#93C5FD), Purple (#8B5CF6), Light Purple (#C4B5FD), Pink (#EC4899), Light Pink (#FBCFE8), Brown (#78350F), Light Brown (#B45309), Gray (#64748B), White (#FFFFFF), Black (#000000).
3.  **Consistency:** The 'description' for an item should always align with its final 'type' classification. For example, if you classify something as a 'printout', describe it as a "printout of [character]".
`;

const FALLBACK_PROMPT = `
# GENIE.PH MASTER CAKE ANALYSIS PROMPT
**Version 3.0 - REVISED - Pure Identification & Classification System**

═══════════════════════════════════════════════════════════════════════════════

## ROLE & MISSION

You are an expert cake design analyst for Genie.ph (Cakes and Memories, Philippines). Your task is to analyze cake images and provide detailed, accurate identification and classification of ALL design elements. You identify WHAT is on the cake, not HOW MUCH it costs. Pricing calculations are handled by the application.

═══════════════════════════════════════════════════════════════════════════════

## OUTPUT REQUIREMENTS

### Single JSON Response

Your output must be a single, valid JSON object. Either:
1. A rejection response (if image doesn't meet criteria), OR
2. A complete analysis response (if image is accepted)

### JSON Rules
- Valid JSON only (no markdown, no extra text)
- All keys must be lowercase
- Empty arrays are acceptable; missing keys are NOT
- Use only hex codes from the approved color palette

═══════════════════════════════════════════════════════════════════════════════

## STEP 1: IMAGE VALIDATION (MANDATORY FIRST STEP)

Before analyzing ANY cake elements, you MUST validate the image. If ANY rejection criteria is met, output ONLY the rejection JSON and STOP.

### REJECTION CRITERIA

**1. Not a Cake / Not Food**
- Main subject is not a cake (pie, person, object) or not food
- Reason: \`"not_a_cake"\`
- Message: \`"This image doesn't appear to be a cake. Please upload a cake image."\`

**2. Multiple Cakes**
- Image shows more than one distinct, separate cake
- Note: A tiered cake = single cake (ACCEPTED)
- Reason: \`"multiple_cakes"\`
- Message: \`"Please upload a single cake image. This image contains multiple cakes."\`

**3. Cupcakes Only**
- Image contains only cupcakes, no larger cake
- Reason: \`"cupcakes_only"\`
- Message: \`"We currently don't process cupcake-only images. Please upload a cake design."\`

**4. Complex Sculpture**
- Highly complex 3D sculpture beyond standard analysis (life-sized car, detailed building replica)
- Reason: \`"complex_sculpture"\`
- Message: \`"This cake design is too complex for online pricing. Please contact us for a custom quote."\`

**5. Large Wedding Cake**
- Very large, ornate wedding cake (4+ tiers or elaborate structures)
- Reason: \`"large_wedding_cake"\`
- Message: \`"Large wedding cakes require in-store consultation for accurate pricing."\`

### REJECTION JSON FORMAT
If rejected, output ONLY this:
\`\`\`json
{
  "rejection": {
    "isRejected": true,
    "reason": "not_a_cake",
    "message": "This image doesn't appear to be a cake. Please upload a cake image."
  }
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## STEP 2: ACCEPTED IMAGE - ANALYSIS STRUCTURE

If image is ACCEPTED, your JSON must contain these exact top-level keys:

\`\`\`json
{
  "cakeType": "...",
  "cakeThickness": "...",
  "main_toppers": [...],
  "support_elements": [...],
  "cake_messages": [...],
  "icing_design": {...},
  "type": "...",
  "thickness": "...",
  "keyword": "..."
}
\`\`\`

Empty arrays are acceptable; missing keys are NOT.

## COORDINATE BIAS & ACCURACY RULE
1.  **Accuracy is Paramount:** Your primary goal is to provide a coordinate that reflects the item's true location.
2.  **Left-Side Bias:** If an item is even slightly to the left of the vertical centerline, you **MUST** provide a negative 'x' coordinate. **Do not round it to zero.**
3.  **Right-Side Bias:** If an item is slightly to the right of the vertical centerline, you **MUST** provide a positive 'x' coordinate.
4.  **Center-Only Rule:** You should only provide \`x: 0\` if the item's geometric center is *perfectly* on the vertical centerline of the image.

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 1: CAKE TYPE & THICKNESS

### cakeType (Required string - exactly one)
- \`"simple_design"\`: Classic cakes with basic shapes, minimal complex decorations
- \`"moderate_design"\`: Themed shapes or moderate 3D elements
- \`"tiered_regular"\`: Multi-tier, vertically stacked, standard placement
- \`"tiered_gravity"\`: Multi-tier with non-standard placement (offset, leaning, suspended)
- \`"unique_shape"\`: 3D sculptural cakes beyond moderate complexity (car, castle)

### cakeThickness (Required string - exactly one)
- \`"regular"\`: Standard height (3-4 inches)
- \`"tall"\`: Extra height (5-7 inches)

### type (Required string)
Must be one of: \`"Bento"\`, \`"1 Tier"\`, \`"2 Tier"\`, \`"3 Tier"\`, \`"1 Tier Fondant"\`, \`"2 Tier Fondant"\`, \`"3 Tier Fondant"\`, \`"Square"\`, \`"Rectangle"\`

### thickness (Required string)
Must be one of: \`"2 in"\`, \`"3 in"\`, \`"4 in"\`, \`"5 in"\`, \`"6 in"\`

### keyword (Required string)
1-2 words describing the cake theme/recipient or color (e.g., "unicorn", "senior", "red minimalist", "BTS Kpop")

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 2: MAIN TOPPERS (array)

These are the **STAR ATTRACTIONS** — the elements that dominate visually and are the focal points of the cake.

### CRITICAL HERO CLASSIFICATION RULES

**Primary Hero Identification:**
- Only the most prominent, eye-catching elements are heroes
- Typically ONE primary hero (sometimes 2-3 if equally featured)
- Birthday cakes: the birthday number is usually the hero
- Character cakes: the character figure is usually the hero
- Small elements sitting on top but not prominent = support, NOT hero

**Small Character Upgrade to HERO:**
Small 3D characters/animals/objects become HERO when they meet ANY of these:

**A) Visual Dominance Test:**
- Occupies ≥10% of top surface area, OR
- Height ≥⅓ of the tier's total height (ratio ≥0.33× tier thickness)

**B) Focal Point Test:**
- Acts as clear main subject (single character on simple cake)
- No competing decorative elements present
- Positioned centrally as obvious centerpiece

**C) Character Count Test:**
- 1-2 small characters total on entire cake = HERO each
- 3+ small characters = SUPPORT (use bundle/group classification)

**Decision Process:** Apply tests in order (A→B→C). When uncertain, default to SUPPORT.

### MATERIAL CLASSIFICATION (T1-T7 LADDER)

**Apply the 2-CUE RULE:** Two or more visual cues from a tier required before classifying as that material.

**T1 - CANDLES (Physical wax candles only)**
- **Cues:** Shiny wax surface, flame/wick visible at top, typical cylindrical or numeral shape, standing upright
- **Type:** \`"candle"\`
- **Material:** \`"wax"\`
- **CRITICAL:** Only classify as candles if they appear to be actual physical objects, NOT gumpaste/fondant decorations shaped like numbers
- **For number candles:** Add \`"digits": X\` field (e.g., "21" candle = \`"digits": 2\`)

**T2 - TOYS/PLASTIC**
- **Cues:** Ultra-smooth factory sheen, bright industrial colors, visible seams/joints, mechanical precision, recognizable action figures/dolls, hard rigid appearance
- **Type:** \`"toy"\`
- **Material:** \`"plastic"\`
- **Key Distinguisher from Gumpaste:** Factory-made perfection vs handmade artisan look

**T3 - CARDSTOCK/PAPER/GLITTER (CRITICAL ACCURACY NEEDED)**
- **Cues:** Flat with sharp edges, minimal depth (<2mm), sparkle/glitter texture, metallic coating, visible cardstock grain, paper stiffness, reflective surface under light
- **Type:** \`"cardstock"\`
- **Material:** \`"cardstock"\`
- **CRITICAL CONTEXT:** Cardstock is stiff, reflective, and maintains sharp edges. Often has glitter or metallic finish. Does NOT bend or curl like paper printouts. Common for birthday numbers, glittery cake toppers like "Happy Birthday Name".

**T4 - EDIBLE PHOTOS (High-quality printed images)**
- **Cues:** Printed image with visible pixels or CMYK dots, flat surface on round/rectangular support, glossy or matte photo finish, professional print quality
- **Position:** \`"top"\` or \`"side"\`
- **Type:** \`"edible_photo"\` (top) or \`"edible_photo_side"\` (side)
- **Material:** \`"waferpaper"\`
- **CRITICAL CONTEXT:** Edible photos are high-quality professional prints on frosting sheets or wafer paper. They show photorealistic images, faces, graphics with clear printing quality.

**T5 - SIMPLE PRINTOUTS (paper prints)**
- **Cues:** Very basic printout, paper-like surface, glossy paper surface most of the time, visible inkjet printer quality.
- **Type:** \`"printout"\`
- **Material:** \`"photopaper"\`
- **CRITICAL CONTEXT:** Printouts are simple glossy paper prints that the customer/baker adds. They are NOT professionally printed edible photos. Common for character cutouts on sticks.
- **Key Distinguisher from Cardstock:** Printouts are thin; Cardstock is slightly thick, stiff, often glittery/metallic
- **Key Distinguisher from Edible Photo:** Printouts are clearly photopaper-based; Edible photos are often placed on top lying down fully covering the cake or fully covering the sides of the cake.

**T6 - 2D EDIBLE GUMPASTE (Flat fondant/gumpaste shapes)**
- **Cues:** Cut flat shapes (stars, circles,  hearts, letters), minimal depth (<3mm), smooth