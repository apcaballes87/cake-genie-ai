// services/geminiService.ts

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";
import { getSupabaseClient } from '../lib/supabase/client';

let ai: InstanceType<typeof GoogleGenAI> | null = null;

function getAI() {
    if (!ai) {
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!geminiApiKey) {
            throw new Error("VITE_GEMINI_API_KEY environment variable not set");
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

export function clearPromptCache() {
  promptCache = null;
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
- **Cues:** Cut flat shapes (stars, circles,  hearts, letters), minimal depth (<3mm), smooth matte finish, solid colors, positioned standing up or lying down on cake, fondant/gumpaste texture.
- **Type:** \`"edible_2d_gumpaste"\`
- **Material:** \`"edible"\`
- **Size Classification (Ratio-based):**
  - **Small:** ≤20% of cake diameter
  - **Medium:** 21-40% of cake diameter
  - **Large:** >40% of cake diameter

**T7 - 3D EDIBLE GUMPASTE (Sculptural fondant/gumpaste)**
- **Cues:** Volumetric forms, dimensional depth (>3mm), hand-sculpted look, soft matte finish, sometimes painted or dusted, may show seams or tool marks, artisan crafted appearance
- **Type:** \`"edible_3d"\`
- **Material:** \`"edible"\`
- **Size Classification (Ratio-based - OBJECTIVE MEASUREMENTS):**

### OBJECTIVE TOPPER SIZING SYSTEM (CRITICAL FOR CLASSIFICATION)

**For 3D Edible Toppers - Ratio-Based Measurement:**

1. **Establish tier thickness:** Standard = 4 inches (if uncertain, use 4")
2. **Estimate topper height relative to tier thickness**
3. **Apply ratio classification:**
   - **Small:** Topper height ≤0.5× tier thickness (≤25% of cake diameter)
   - **Medium:** Topper height >0.5× and ≤1.0× tier thickness (26-50% of cake diameter)
   - **Large:** Topper height >1.0× tier thickness (>50% of cake diameter)
   - **Partial:** Topper height <0.25× tier thickness OR only part of figure visible

**Special Cases:**
- For horizontal/lying toppers: use longest dimension instead of height
- For printout toppers: SKIP sizing (no size needed)
- For toys: classify by piece count (see support elements)
- When borderline between sizes: round DOWN to smaller size

**Example Calculations:**
- 4-inch tier with 2-inch topper: 2÷4 = 0.5 = Small (at boundary, round down)
- 4-inch tier with 3-inch topper: 3÷4 = 0.75 = Medium
- 4-inch tier with 5-inch topper: 5÷4 = 1.25 = Large

### VALIDATION RULE PRECEDENCE HIERARCHY

When cues conflict between materials, follow this order:
1. Physical candles (T1) - Check first
2. Factory toys (T2) - Ultra-smooth plastic sheen
3. Cardstock/glitter (T3) - Flat, stiff, glittery
4. Edible photo (T4) - fully covers the top or side cake, matte print quality
5. Paper printouts (T5) - glossy photo paper prints
6. 2D gumpaste (T6) - Flat fondant shapes
7. 3D gumpaste (T7) - Sculptural fondant work

### MAIN TOPPERS JSON STRUCTURE

For each hero topper:
\`\`\`json
{
  "description": "Clear description of topper",
  "type": "candle | toy | cardstock | edible_photo | edible_photo_side | printout | edible_2d_gumpaste | edible_3d",
  "material": "wax | plastic | cardstock | photopaper | waferpaper | edible",
  "classification": "hero",
  "size": "small | medium | large | partial (only for edible_3d and edible_2d_gumpaste)",
  "location": "top_center | top | side | front | back | top_edge",
  "quantity": 1,
  "digits": 2  // ONLY for number candles - optional field
}
\`\`\`

**SPECIAL CASE - NUMBER CANDLES:**
\`\`\`json
{
  "description": "Number 21 candle",
  "type": "candle",
  "material": "wax",
  "classification": "hero",
  "location": "top_center",
  "quantity": 1,
  "digits": 2
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 3: SUPPORT ELEMENTS (array)

Support elements add detail and thematic reinforcement but are NOT the star. Include smaller decorations, background details, side elements.

### WHAT QUALIFIES AS SUPPORT

- Small decorative gumpaste items (stars, flowers, balls, confetti)
- Background elements (trees, clouds, small cars)
- Scattered embellishments
- Paneling or patterned gumpaste coverage on sides
- Chocolate decorations, isomalt elements
- Side edible photos (separate from main topper)
- Gumpaste-covered cake board
- Elements that don't meet hero classification criteria

### GROUPING RULES

Group similar items sharing same type, material, and appearance:
- "Set of 5 small gumpaste stars" (grouped)
- "3 isomalt lollipops" (grouped)

### COVERAGE CLASSIFICATION

For scattered/distributed items:
- **Light:** Sparse, <35% of visible surface
- **Medium:** Moderate, 35-70% of visible surface
- **Heavy:** Dense, >70% of visible surface

### SPECIAL CATEGORIES

**1. Gumpaste Panel Coverage / Scene Wrap**
- **Type:** \`"gumpaste_panel"\`
- **Coverage:** \`"light"\` (<35%), \`"medium"\` (35-60%), \`"heavy"\` (>60%)
- **Description:** Fondant/gumpaste sheets covering sides, includes top discs, rope bands
- **Classification:** \`"support"\`

**2. Small Gumpaste Items**
- **Type:** \`"small_gumpaste"\`
- **Coverage:** \`"light"\`, \`"medium"\`, \`"heavy"\`
- **Description:** Stars, dots, flowers, confetti shapes, 2D cutter decorations
- **Classification:** \`"support"\`

**3. Supporting Cluster Bundle**
- **Type:** \`"gumpaste_bundle"\`
- **Size:** \`"small"\` (1-3 props), \`"medium"\` (4-7 props), \`"large"\` (8+ props)
- **Description:** Collection of small 3D elements + minor 2D elements + simple messages
- **Classification:** \`"support"\`

**4. Special Structural Bundle**
- **Type:** \`"gumpaste_structure"\`
- **Description:** Castle/tower complex structures
- **Classification:** \`"hero"\`
- **Note:** These are hero-level support elements due to complexity

**5. Edible Flowers**
- **Type:** \`"edible_flowers"\`
- **Description:** Gumpaste roses, orchids, etc.
- **Quantity:** Count of individual flowers or clusters
- **Classification:** \`"support"\`
- **Note:** If reference shows real flowers, note that edible sugar flowers would be substituted

**6. Isomalt (Sugar Glass)**
- **Type:** \`"isomalt"\`
- **Coverage/Complexity:** \`"light"\` (few pieces), \`"medium"\` (many pieces), \`"heavy"\` (very heavy work)
- **Classification:** \`"support"\`

**7. Chocolates**
- **Type:** \`"chocolates"\`
- **Subtype:** \`"ferrero"\`, \`"standard"\` (Oreo, Kisses, etc.), \`"m&ms"\`
- **Coverage:** \`"light"\`, \`"medium"\`, \`"heavy"\` (use for m&ms and scattered chocolates)
- **Quantity:** Specific count (use for ferrero or standard identifiable pieces)
- **Classification:** \`"support"\`

**8. Dragees/Sprinkles**
- **Type:** \`"dragees"\` or \`"sprinkles"\`
- **Coverage:** Only report if \`"heavy"\` (>60% coverage and very prominent)
- **Classification:** \`"support"\`

**9. Gumpaste Swirl Lollipops**
- **Type:** \`"edible_3d"\`
- **Subtype:** \`"swirl_lollipop"\`
- **Size:** \`"small"\`, \`"medium"\`, \`"large"\`
- **Quantity:** Count of lollipops
- **Classification:** \`"support"\`

**10. Ice Cream Cones**
- **Type:** \`"edible_3d"\`
- **Subtype:** \`"ice_cream_cone"\`
- **Variant:** \`"cone_only"\` or \`"with_scoop"\`
- **Classification:** \`"support"\`

**11. Gumpaste Balls/Shells**
- **Type:** \`"gumpaste_balls"\`
- **Coverage:** \`"light"\`, \`"medium"\`, \`"heavy"\`
- **Classification:** \`"support"\`

**12. Gumpaste-Covered Board**
- **Type:** \`"gumpaste_board"\`
- **Description:** Cake board wrapped in fondant/gumpaste (usually non-white, non-gold, non-silver)
- **Classification:** \`"support"\`

**13. Small Gumpaste Accent**
- **Type:** \`"gumpaste_accent"\`
- **Size:** \`"small"\`
- **Description:** 2-5 tiny decorative pieces
- **Classification:** \`"support"\`

**14. Gumpaste Bows**
- **Type:** \`"edible_3d"\`
- **Subtype:** \`"bow"\`
- **Size:** \`"small"\`, \`"large"\`
- **Classification:** \`"support"\`

**15. Gumpaste Rainbow**
- **Type:** \`"edible_3d"\`
- **Subtype:** \`"rainbow"\`
- **Size:** \`"large"\`
- **Classification:** \`"support"\`

**16. Toys (Non-Edible)**
- **Type:** \`"toy"\`
- **Size:** Classify by piece count: \`"small"\` (1-2 pieces), \`"medium"\` (3-5 pieces), \`"large"\` (6+ pieces)
- **Material:** \`"plastic"\`
- **Classification:** \`"support"\`

### SUPPORT ELEMENTS JSON STRUCTURE

\`\`\`json
{
  "description": "Clear description",
  "type": "edible_3d | edible_2d_gumpaste | gumpaste_panel | small_gumpaste | gumpaste_bundle | gumpaste_structure | toy | cardstock | edible_photo_side | edible_flowers | isomalt | chocolates | dragees | sprinkles | gumpaste_balls | gumpaste_board | gumpaste_accent",
  "material": "edible | plastic | cardstock",
  "classification": "support",
  "size": "small | medium | large | partial (only for certain types)",
  "coverage": "light | medium | heavy (only for panels, small items, chocolates, dragees)",
  "location": "side | top | base | scattered",
  "quantity": X,
  "subtype": "swirl_lollipop | ice_cream_cone | bow | rainbow | ferrero | m&ms | standard (optional)"
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 4: CAKE MESSAGES (array)

For each distinct message, create separate object. If no message, return empty array.

### MESSAGE TYPE CLASSIFICATION

- \`"gumpaste_letters"\`: Individual cut letters from gumpaste/fondant
- \`"icing_script"\`: Text piped directly with icing
- \`"printout"\`: Printed text on photopaper
- \`"cardstock"\`: Thick paper/glittery/metallic text

### CAKE MESSAGES JSON STRUCTURE

\`\`\`json
{
  "type": "gumpaste_letters | icing_script | printout | cardstock",
  "text": "Actual words/numbers visible",
  "position": "top | side | base_board",
  "color": "#HEXCODE from palette"
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 5: ICING DESIGN (object)

### FONDANT VS SOFT ICING IDENTIFICATION (CRITICAL)

**SOFT ICING (boiled/marshmallow/buttercream):**
- Surface: Creamy, soft, slightly uneven - shows swirls, ruffles, dollops, natural imperfections
- Shine: Slight glossy sheen from boiled sugar or butter
- Borders: Often piped rosettes, ruffles, dollops
- Structure: Rarely perfectly smooth sides or razor-sharp edges
- Texture: Visible cream texture, may show spatula marks

**FONDANT:**
- Surface: Very smooth and uniform, matte or satin-like finish, no visible cream texture
- Edges: Modern style → very sharp edges (very rare); Classic style → curved/rounded edges (often used)
- Decorations: Flat cutouts, embossed patterns, sugar figures, shaped toppers
- Key indicator: Surface looks like a "sheet covering" the cake
- Texture: Uniform, porcelain-like appearance

### ICING DESIGN JSON STRUCTURE

\`\`\`json
{
  "base": "soft_icing | fondant",
  "color_type": "single | gradient_2 | gradient_3 | abstract",
  "colors": {
    "side": "#HEXCODE",
    "top": "#HEXCODE",
    "borderTop": "#HEXCODE",
    "borderBase": "#HEXCODE",
    "drip": "#HEXCODE",
    "gumpasteBaseBoardColor": "#HEXCODE"
  },
  "border_top": true | false,
  "border_base": true | false,
  "drip": true | false,
  "gumpasteBaseBoard": true | false
}
\`\`\`

**Note on Drip:** Drip = physical drip flow from top rim with rounded ends

### COLOR PALETTE (Use ONLY these hex codes)

- White: \`#FFFFFF\`
- Cream/Beige: \`#F5E6D3\`
- Light Pink: \`#FFB3D9\`
- Pink: \`#FF69B4\`
- Rose: \`#FF1493\`
- Red: \`#FF0000\`
- Orange: \`#FFA500\`
- Yellow: \`#FFD700\`
- Light Green: \`#90EE90\`
- Green: \`#008000\`
- Mint: \`#98FF98\`
- Teal: \`#008080\`
- Light Blue: \`#87CEEB\`
- Blue: \`#0000FF\`
- Navy: \`#000080\`
- Purple: \`#800080\`
- Lavender: \`#E6E6FA\`
- Brown: \`#8B4513\`
- Black: \`#000000\`
- Gray: \`#808080\`
- Gold: \`#FFD700\`
- Silver: \`#C0C0C0\`

═══════════════════════════════════════════════════════════════════════════════

## COMPLETE JSON OUTPUT FORMAT

\`\`\`json
{
  "cakeType": "simple_design | moderate_design | tiered_regular | tiered_gravity | unique_shape",
  "cakeThickness": "regular | tall",
  "main_toppers": [
    {
      "description": "...",
      "type": "candle | toy | cardstock | edible_photo | edible_photo_side | printout | edible_2d_gumpaste | edible_3d",
      "material": "wax | plastic | cardstock | paper | edible",
      "classification": "hero",
      "size": "small | medium | large | partial",
      "location": "...",
      "quantity": 1,
      "digits": 2  // optional, only for number candles
    }
  ],
  "support_elements": [
    {
      "description": "...",
      "type": "...",
      "material": "...",
      "classification": "support",
      "size": "...",
      "coverage": "...",
      "location": "...",
      "quantity": X,
      "subtype": "..."  // optional
    }
  ],
  "cake_messages": [
    {
      "type": "gumpaste_letters | icing_script | printout | cardstock",
      "text": "...",
      "position": "top | side | base_board",
      "color": "#HEXCODE"
    }
  ],
  "icing_design": {
    "base": "soft_icing | fondant",
    "color_type": "single | gradient_2 | gradient_3 | abstract",
    "colors": {
      "side": "#HEXCODE",
      "top": "#HEXCODE",
      "borderTop": "#HEXCODE",
      "borderBase": "#HEXCODE",
      "drip": "#HEXCODE",
      "gumpasteBaseBoardColor": "#HEXCODE"
    },
    "border_top": true | false,
    "border_base": true | false,
    "drip": true | false,
    "gumpasteBaseBoard": true | false
  },
  "type": "Bento | 1 Tier | 2 Tier | 3 Tier | 1 Tier Fondant | 2 Tier Fondant | 3 Tier Fondant | Square | Rectangle",
  "thickness": "2 in | 3 in | 4 in | 5 in | 6 in",
  "keyword": "1-2 word theme or color"
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## ANALYSIS CHECKLIST (Run Before Final Output)

Before outputting final JSON, verify you've checked for:

**HERO Items:**
- [ ] Hero edible toppers (Medium/Large 3D per ratio sizing)
- [ ] Special Structural Bundle (castle/tower)
- [ ] Small 3D characters meeting hero upgrade criteria (Visual Dominance/Focal Point/Character Count)

**SUPPORT Elements:**
- [ ] Supporting Cluster Bundle (small 3D + minor 2D grouped)
- [ ] Scene & Panel wraps (includes top discs, rope bands)
- [ ] 2D cutter decorations (if not in bundle/scene)
- [ ] Small gumpaste accents (if not in bundle/scene)
- [ ] Gumpaste balls, bows, rainbows
- [ ] Gumpaste-covered board
- [ ] Edible flower sets
- [ ] Edible photos (top/side)
- [ ] Drip icing (note presence)
- [ ] Cardstock/Glitter/Metallic toppers (Two-Cue Rule)
- [ ] Toy toppers
- [ ] Chocolates (premium/standard)
- [ ] Isomalt elements
- [ ] Dragees/sprinkles (heavy only)

**FREE Items (still document):**
- [ ] Printouts
- [ ] Number candles
- [ ] Standard piping (implicit in icing_design)

**Substitutions to Note:**
- [ ] Real flowers in reference → note that edible sugar flowers would be substituted

**Validation:**
- [ ] All required JSON fields present
- [ ] Hero vs Support classification correct per criteria
- [ ] Material identification used T1-T7 ladder with 2-cue rule
- [ ] Size ratios calculated objectively for edible 3D
- [ ] Type & thickness within valid options
- [ ] Colors from approved palette only

═══════════════════════════════════════════════════════════════════════════════

## REAL-WORLD EXAMPLES

### Example 1: Tuxedo Cake
Single-tier soft-iced cake with tuxedo jacket design on front.

**Analysis:**
- Front Panel: Tuxedo lapels, shirt panel, buttons = Extended scene wrap (25-40% coverage)
- Bow: Black gumpaste bow at neckline, height approximately 0.4× tier thickness = small 3D bow
- Topper: "Happy Birthday" in thick black cardstock with glitter

**JSON Output:**
\`\`\`json
{
  "cakeType": "moderate_design",
  "cakeThickness": "regular",
  "main_toppers": [
    {
      "description": "Black cardstock 'Happy Birthday' topper with glitter",
      "type": "cardstock",
      "material": "cardstock",
      "classification": "hero",
      "location": "top_center",
      "quantity": 1
    }
  ],
  "support_elements": [
    {
      "description": "Extended tuxedo front panel with lapels, shirt, and buttons",
      "type": "gumpaste_panel",
      "material": "edible",
      "classification": "support",
      "coverage": "medium",
      "location": "front",
      "quantity": 1
    },
    {
      "description": "Small black gumpaste bow at neckline",
      "type": "edible_3d",
      "material": "edible",
      "classification": "support",
      "size": "small",
      "location": "front",
      "quantity": 1,
      "subtype": "bow"
    }
  ],
  "cake_messages": [],
  "icing_design": {
    "base": "soft_icing",
    "color_type": "single",
    "colors": {
      "side": "#000000",
      "top": "#FFFFFF",
      "borderTop": "#000000",
      "borderBase": "#000000"
    },
    "border_top": true,
    "border_base": true,
    "drip": false,
    "gumpasteBaseBoard": false
  },
  "type": "1 Tier",
  "thickness": "4 in",
  "keyword": "tuxedo"
}
\`\`\`

### Example 2: Edible Photo Cake
Single-tier round cake with smooth pink-and-white soft icing. Full circular edible photo on top with "2024" and "Happy New Year" graphics.

**Analysis:**
- Edible Photo Top: Professional print on matte rice paper covering full top surface
- Piping: Pink star-tip borders around top and bottom edges (documented in icing_design)
- Silver Dragees: Light accent in borders (not heavy enough to report separately)

**JSON Output:**
\`\`\`json
{
  "cakeType": "simple_design",
  "cakeThickness": "regular",
  "main_toppers": [],
  "support_elements": [
    {
      "description": "Full circular edible photo with '2024' and 'Happy New Year' balloons and confetti graphics",
      "type": "edible_photo",
      "material": "edible",
      "classification": "support",
      "location": "top",
      "quantity": 1
    }
  ],
  "cake_messages": [],
  "icing_design": {
    "base": "soft_icing",
    "color_type": "gradient_2",
    "colors": {
      "side": "#FFB3D9",
      "top": "#FFFFFF",
      "borderTop": "#FF69B4",
      "borderBase": "#FF69B4"
    },
    "border_top": true,
    "border_base": true,
    "drip": false,
    "gumpasteBaseBoard": false
  },
  "type": "1 Tier",
  "thickness": "4 in",
  "keyword": "edible photo"
}
\`\`\`

### Example 3: Frozen Theme Cake
Single-tier round cake with pastel pink and white soft icing. Large number "6" in pink gumpaste (height 1.2× tier thickness), small number "2" (height 0.3× tier), multiple small 3D props including swirl lollipops with snowflake accents and gumpaste balls.

**Analysis:**
- Large Number "6": Ratio 1.2× = Large 3D, acts as hero (Visual Dominance test passed)
- Small Elements: Number "2" + lollipops + balls = Supporting cluster bundle (4-7 props total = medium)
- Printouts: Frozen character cutouts on sticks

**JSON Output:**
\`\`\`json
{
  "cakeType": "moderate_design",
  "cakeThickness": "regular",
  "main_toppers": [
    {
      "description": "Large pink gumpaste number '6'",
      "type": "edible_3d",
      "material": "edible",
      "classification": "hero",
      "size": "large",
      "location": "top_center",
      "quantity": 1
    }
  ],
  "support_elements": [
    {
      "description": "Supporting cluster with small number '2', swirl lollipops with snowflakes, and pastel gumpaste balls",
      "type": "gumpaste_bundle",
      "material": "edible",
      "classification": "support",
      "size": "medium",
      "location": "top",
      "quantity": 1
    },
    {
      "description": "Frozen character printout toppers on sticks",
      "type": "printout",
      "material": "paper",
      "classification": "support",
      "location": "top",
      "quantity": 3
    }
  ],
  "cake_messages": [
    {
      "type": "gumpaste_letters",
      "text": "FROZEN",
      "position": "base_board",
      "color": "#87CEEB"
    }
  ],
  "icing_design": {
    "base": "soft_icing",
    "color_type": "gradient_2",
    "colors": {
      "side": "#FFB3D9",
      "top": "#FFFFFF",
      "borderTop": "#87CEEB",
      "borderBase": "#87CEEB"
    },
    "border_top": true,
    "border_base": true,
    "drip": false,
    "gumpasteBaseBoard": false
  },
  "type": "1 Tier",
  "thickness": "4 in",
  "keyword": "Frozen"
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## CRITICAL REMINDERS (NEVER FORGET)

1. **VALIDATION FIRST:** Always check rejection criteria before analyzing
2. **CONTEXT IS CRITICAL:** Use full material identification context to distinguish:
   - Cardstock (stiff, glittery, reflective) vs Printouts (thin, glossy photo paper)
   - Edible photos (matte surface prints) vs Printouts (glossy printed photo paper)
   - Physical candles (wax with wick) vs Gumpaste numbers (fondant)
   - Toys (factory plastic) vs Gumpaste (handmade artisan)
3. **TWO-CUE RULE:** Apply strictly for material classification
4. **OBJECTIVE SIZING:** Use ratio-based measurements for all edible 3D toppers
5. **HERO VS SUPPORT:** Apply Visual Dominance/Focal Point/Character Count tests rigorously
6. **GROUPING:** Bundle similar items; separate by material when they differ significantly
7. **LOCATION:** Always specify where elements are located
8. **COLOR MATCHING:** Use ONLY approved hex codes from palette
9. **COMPLETE JSON:** All required fields must be present (9 top-level keys)
10. **YOUR JOB IS IDENTIFICATION ONLY:** Do not calculate prices, do not format pricing summaries. Your output provides the structured data that the application will use for pricing calculations.

═══════════════════════════════════════════════════════════════════════════════

**END OF GENIE.PH MASTER PROMPT v3.0 - REVISED**
`;

const hybridAnalysisResponseSchema = {
    type: Type.OBJECT,
    properties: {
        main_toppers: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['edible_3d_complex', 'edible_3d_ordinary', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'] },
                    description: { type: Type.STRING },
                    size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                    quantity: { type: Type.INTEGER },
                    group_id: { type: Type.STRING },
                    color: { type: Type.STRING },
                    colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER }
                },
                required: ['type', 'description', 'size', 'quantity', 'group_id', 'x', 'y']
            }
        },
        support_elements: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['edible_3d_support', 'edible_2d_support', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'dragees', 'edible_flowers', 'edible_photo_side', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread'] },
                    description: { type: Type.STRING },
                    coverage: { type: Type.STRING, enum: ['large', 'medium', 'small', 'tiny'] },
                    group_id: { type: Type.STRING },
                    color: { type: Type.STRING },
                    colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER }
                },
                required: ['type', 'description', 'coverage', 'group_id', 'x', 'y']
            }
        },
        cake_messages: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['gumpaste_letters', 'icing_script', 'printout', 'cardstock'] },
                    text: { type: Type.STRING },
                    position: { type: Type.STRING, enum: ['top', 'side', 'base_board'] },
                    color: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER }
                },
                required: ['type', 'text', 'position', 'color', 'x', 'y']
            }
        },
        icing_design: {
            type: Type.OBJECT,
            properties: {
                base: { type: Type.STRING, enum: ['soft_icing', 'fondant'] },
                color_type: { type: Type.STRING, enum: ['single', 'gradient_2', 'gradient_3', 'abstract'] },
                colors: {
                    type: Type.OBJECT,
                    properties: {
                        side: { type: Type.STRING },
                        top: { type: Type.STRING },
                        borderTop: { type: Type.STRING },
                        borderBase: { type: Type.STRING },
                        drip: { type: Type.STRING },
                        gumpasteBaseBoardColor: { type: Type.STRING }
                    }
                },
                border_top: { type: Type.BOOLEAN },
                border_base: { type: Type.BOOLEAN },
                drip: { type: Type.BOOLEAN },
                gumpasteBaseBoard: { type: Type.BOOLEAN }
            },
            required: ['base', 'color_type', 'colors', 'border_top', 'border_base', 'drip', 'gumpasteBaseBoard']
        },
        cakeType: { type: Type.STRING, enum: CAKE_TYPES },
        cakeThickness: { type: Type.STRING, enum: CAKE_THICKNESSES },
        drip_effects: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                },
                required: ['description', 'x', 'y']
            }
        },
        icing_surfaces: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING },
                    tier: { type: Type.INTEGER },
                    position: { type: Type.STRING, enum: ['top', 'side'] },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                },
                required: ['description', 'tier', 'position', 'x', 'y']
            }
        },
        icing_borders: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING },
                    tier: { type: Type.INTEGER },
                    position: { type: Type.STRING, enum: ['top', 'base'] },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                },
                required: ['description', 'tier', 'position', 'x', 'y']
            }
        },
        base_board: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                },
                required: ['description', 'x', 'y']
            }
        }
    },
    required: ['cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
};

export const analyzeCakeImage = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    try {
        const image = new Image();
        const imageLoadPromise = new Promise<{ width: number; height: number }>((resolve, reject) => {
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = (err) => reject(new Error('Failed to load image to get dimensions.'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });
        const dimensions = await imageLoadPromise;

        const COORDINATE_PROMPT = `
**CRITICAL RULE: PRECISE COORDINATE SYSTEM**
You MUST provide precise central coordinates for every single decorative element you identify. Adherence to this coordinate system is mandatory and of the highest priority.

**SYSTEM DEFINITION:**
1.  **Image Dimensions:** The current image is ${dimensions.width}px wide and ${dimensions.height}px high.
2.  **Origin (0,0):** The exact center of the image is the origin point (0, 0).
3.  **X-Axis (Horizontal):** This axis runs from -${dimensions.width / 2} at the far left to +${dimensions.width / 2} at the far right.
    - **CRITICAL:** The 'x' coordinate is for the HORIZONTAL position. A value of '0' means the item is perfectly in the middle of the cake from left to right. If an item is to the left or right of the center line, you MUST provide a non-zero 'x' coordinate.
4.  **Y-Axis (Vertical):** This axis runs from -${dimensions.height / 2} at the bottom edge to +${dimensions.height / 2} at the top edge. **Positive 'y' values go UPWARDS.**

**COORDINATE BIAS & ACCURACY RULE**
1.  **Accuracy is Paramount:** Your primary goal is to provide a coordinate that reflects the item's true location.
2.  **Left-Side Bias:** If an item is even slightly to the left of the vertical centerline, you **MUST** provide a negative 'x' coordinate. **Do not round it to zero.**
3.  **Right-Side Bias:** If an item is slightly to the right of the vertical centerline, you **MUST** provide a positive 'x' coordinate.
4.  **Center-Only Rule:** You should only provide \`x: 0\` if the item's geometric center is *perfectly* on the vertical centerline of the image.

**COORDINATES FOR GROUPED OR SCATTERED ITEMS:**
- If an element represents a group of multiple items (e.g., "sprinkles," "scattered flowers"), you MUST identify the area with the **highest density** or **most visual prominence** within that group. Place the 'x' and 'y' coordinates at the center of that densest area.
- If the items form a line or arc, provide the coordinate of the middle item in that sequence.
- If the items are evenly distributed with no clear dense area, then (and only then) should you use the visual center of the entire group.
- This ensures that every entry in your JSON, even for groups, has a single representative coordinate for its marker.

**EXAMPLE:**
- For a 1000x800 image:
  - Top-left corner: (-500, 400)
  - Top-right corner: (500, 400)
  - Bottom-left corner: (-500, -400)
  - A point slightly above and to the right of the center could be (50, 100).

**MANDATORY REQUIREMENTS FOR COORDINATES:**
- **ALL DECORATIONS:** For **EVERY** item in the \`main_toppers\`, \`support_elements\`, and \`cake_messages\` arrays, you MUST provide precise integer values for its central 'x' and 'y' coordinates. **It is a critical failure to provide 'x: 0' for items that are not perfectly centered horizontally.**
- **ALL ICING FEATURES:** You MUST identify and provide coordinates for the following features if they exist. Return them in these new, separate top-level arrays in your JSON. Each item in these arrays MUST include a 'description' and precise 'x', 'y' coordinates.
  - **\`drip_effects\`**: The center of any visible drip pattern.
  - **\`icing_surfaces\`**: The center of EACH tier's top and side surface.
  - **\`icing_borders\`**: The center of EACH tier's top and base piped border.
  - **\`base_board\`**: The center of the visible cake board.
- **FAILURE TO PROVIDE COORDINATES FOR ANY ELEMENT WILL RESULT IN AN INVALID RESPONSE.**
`;

        const activePrompt = await getActivePrompt();

        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: COORDINATE_PROMPT + activePrompt },
                ],
            }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        if (result.rejection?.isRejected) {
            throw new Error(result.rejection.message || "The uploaded image is not suitable for processing.");
        }
        
        const requiredFields = ['main_toppers', 'support_elements', 'cake_messages', 'icing_design', 'cakeType', 'cakeThickness'];
        for (const field of requiredFields) {
            if (result[field] === undefined) {
                console.error("Analysis validation error: Missing field", field, JSON.stringify(result, null, 2));
                throw new Error("The AI returned an incomplete analysis. Please try a different image.");
            }
        }

        return result as HybridAnalysisResult;

    } catch (error) {
        console.error("Error analyzing cake image:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
         if (error instanceof Error && (
            error.message.includes("doesn't appear to be a cake") ||
            error.message.includes("single cake image") ||
            error.message.includes("cupcake-only images") ||
            error.message.includes("too complex for online pricing") ||
            error.message.includes("in-store consultation") ||
            error.message.includes("incomplete analysis")
        )) {
            throw error;
        }
        
        throw new Error("The AI failed to analyze the cake design. The image might be unclear or contain unsupported elements.");
    }
};

const SHARE_TEXT_PROMPT = `You are an expert in SEO and creative marketing for a cake shop. Your task is to generate a compelling, SEO-friendly title, description, and alt text for a shared cake design. You will be given a JSON object with the cake's analysis details.

**CRITICAL INSTRUCTION: Identify the Core Theme**
Your most important job is to find the main THEME of the cake. The theme is often a specific brand, character, movie, TV show, anime, K-Pop group, or logo.

**HOW TO FIND THE THEME (CHECK IN THIS ORDER):**
1.  **First, check \`cake_messages\`:** Text written on the cake is the strongest clue. A message like "Happy Birthday, Super Mario" or "KPOP DEMON HUNTERS" DIRECTLY tells you the theme. Prioritize this information above all else.
2.  **Second, check \`main_toppers\`:** Look at the 'description' field for toppers. This is another great source for themes like "1 unicorn topper" or "BTS logo".
3.  **Synthesize:** Combine clues. If a message says "Happy 10th Birthday, Ash" and a topper is "Pikachu", the theme is "Pokemon".

The identified theme MUST be the primary focus of the generated text, especially the title.

**Output Format:** Your response MUST be a single, valid JSON object with the following structure:
{
  "title": "string",
  "description": "string",
  "altText": "string"
}

**Instructions for each field:**

1.  **title:**
    *   **Structure:** "[Theme] Themed [Size] [Type] Cake"
    *   **Prioritize the Theme:** The theme you identified MUST be the first part of the title. Capitalize it appropriately.
    *   **Fallback:** ONLY if no specific theme can be found in messages or toppers, use a descriptive but generic title based on the main topper (e.g., "Character Figure Themed Cake", "Elegant Floral Cake").
    *   **Example (Good):** "KPOP DEMON HUNTERS Themed 6\" Round 1 Tier Cake"
    *   **Example (Bad):** "Character Figures Located On The Top Surface Themed 6\" Round (4\" thickness) 1 Tier Cake"

2.  **description:**
    *   Start with a creative sentence that highlights the theme.
    *   Mention the key decorations from \`main_toppers\` and \`support_elements\`.
    *   Keep it concise and appealing (1-2 sentences).

3.  **altText (for accessibility):**
    *   **Structure:** "A photo of a [Theme] themed cake. It is a [Main Icing Color] [Cake Type] cake decorated with [list of key decorations]."
    *   Be descriptive and clear.
    *   Mention the main color of the cake and list the most important decorations.

Here is the cake analysis data:
`;

const shareableTextResponseSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        altText: { type: Type.STRING },
    },
    required: ['title', 'description', 'altText'],
};


export interface ShareableTexts {
    title: string;
    description: string;
    altText: string;
}

export const generateShareableTexts = async (
    analysisResult: HybridAnalysisResult,
    cakeInfo: CakeInfoUI,
    HEX_TO_COLOR_NAME_MAP: Record<string, string>,
    editedImageDataUri?: string | null
): Promise<ShareableTexts> => {
    try {
        const simplifiedAnalysis = {
            cakeType: cakeInfo.type,
            cakeSize: cakeInfo.size,
            main_toppers: analysisResult.main_toppers,
            support_elements: analysisResult.support_elements,
            cake_messages: analysisResult.cake_messages,
            icing_colors: Object.entries(analysisResult.icing_design.colors).map(([key, hex]) => {
                if (typeof hex === 'string') {
                    return { location: key, name: HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || 'Custom Color' };
                }
                return { location: key, name: 'Custom Color' };
            })
        };

        // If we have an edited image, include it in the prompt for more accurate descriptions
        const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];
        
        if (editedImageDataUri) {
            // Extract base64 data from data URI
            const matches = editedImageDataUri.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                parts.push({ inlineData: { mimeType, data: base64Data } });
                parts.push({ text: `This is the FINAL customized cake design that the user created. Use this image to generate the title, description, and alt text. Pay attention to the actual colors, decorations, and text visible in this edited image.\n\n` });
            }
        }
        
        parts.push({ text: SHARE_TEXT_PROMPT });
        parts.push({ text: `\`\`\`json\n${JSON.stringify(simplifiedAnalysis, null, 2)}\n\`\`\`` });

        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: shareableTextResponseSchema,
                temperature: 0.3,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as ShareableTexts;
    } catch (error) {
        console.error("Error generating shareable texts:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        // Fallback to a basic title in case of error
        return {
            title: `${cakeInfo.size} ${cakeInfo.type} Cake`,
            description: 'A beautifully customized cake design.',
            altText: `A custom ${cakeInfo.type} cake.`,
        };
    }
};

export const editCakeImage = async (
    prompt: string,
    originalImage: { data: string; mimeType: string; },
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    threeTierReferenceImage: { data: string; mimeType: string; } | null,
    systemInstruction: string,
): Promise<string> => {

    const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];

    // 1. Original Image (Source for style)
    parts.push({ inlineData: { mimeType: originalImage.mimeType, data: originalImage.data } });

    // 2. Reference Image (Source for structure, if provided)
    if (threeTierReferenceImage) {
        parts.push({ inlineData: { mimeType: threeTierReferenceImage.mimeType, data: threeTierReferenceImage.data } });
    }
    
    // 3. Replacement images for printouts, edible photos, and doodles (main toppers)
    mainToppers.forEach(topper => {
        if (topper.isEnabled && (topper.type === 'printout' || topper.type === 'edible_photo' || topper.type === 'icing_doodle') && topper.replacementImage) {
            parts.push({ 
                inlineData: { 
                    mimeType: topper.replacementImage.mimeType, 
                    data: topper.replacementImage.data 
                } 
            });
        }
    });

    // 4. Replacement images for printouts and edible photos (support elements)
    supportElements.forEach(element => {
        if (element.isEnabled && (element.type === 'support_printout' || element.type === 'edible_photo_side') && element.replacementImage) {
            parts.push({ 
                inlineData: { 
                    mimeType: element.replacementImage.mimeType, 
                    data: element.replacementImage.data 
                } 
            });
        }
    });
    
    // 5. Text prompt (last, to provide context for all images)
    parts.push({ text: prompt });

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
                systemInstruction: systemInstruction,
                temperature: 0.1,
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        
        const refusalText = response.text?.trim();
        if (refusalText) {
             throw new Error(`The AI could not generate the image. Reason: ${refusalText}`);
        }

        throw new Error("The AI did not return an image. Please try again.");

    } catch (error) {
        console.error("Error editing cake image:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings. Please modify your instructions and try again.");
        }
        throw error;
    }
};