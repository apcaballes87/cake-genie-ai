// services/geminiService.ts

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '@/types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "@/constants";
import { createClient } from '@/lib/supabase/client';
import {
    detectObjectsWithRoboflow,
    roboflowBboxToAppCoordinates,
    findMatchingDetection
} from './roboflowService';
import { FEATURE_FLAGS, isRoboflowConfigured } from '@/config/features';

let ai: InstanceType<typeof GoogleGenAI> | null = null;

function getAI() {
    if (!ai) {
        const geminiApiKey = process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
        if (!geminiApiKey) {
            throw new Error("NEXT_PUBLIC_GOOGLE_AI_API_KEY environment variable not set");
        }
        ai = new GoogleGenAI({ apiKey: geminiApiKey });
    }
    return ai;
}

const supabase = createClient();

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
        mainTopperTypes: ['edible_3d_complex', 'edible_3d_ordinary', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo_top', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'],
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

    // Define priority order for main toppers to fix printout vs cardstock bias
    // CRITICAL: 'printout' MUST come before 'cardstock' to prevent misclassification
    const mainTopperPriority = [
        'candle',
        'edible_photo_top',
        'printout',        // Higher priority than cardstock
        'cardstock',       // Lower priority - only for solid color glittery items
        'edible_2d_shapes',
        'edible_flowers',
        'edible_3d_ordinary',
        'edible_3d_complex',
        'figurine',
        'toy',
        'icing_doodle',
        'icing_palette_knife',
        'icing_brush_stroke',
        'icing_splatter',
        'icing_minimalist_spread',
        'meringue_pop',
        'plastic_ball'
    ];

    // Sort main toppers according to priority
    const sortedMainToppers = Array.from(mainTopperTypes).sort((a, b) => {
        const aIndex = mainTopperPriority.indexOf(a);
        const bIndex = mainTopperPriority.indexOf(b);
        // Items not in priority list go to the end
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    const result = {
        mainTopperTypes: sortedMainToppers,
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
            model: "gemini-3-flash-preview",
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
                // SECRET SAUCE: Thinking budget forces the model to analyze
                // spatial relationships before committing to coordinates
                thinkingConfig: {
                    thinkingBudget: 1024
                }
            },
        });

        const jsonText = (response.text || '').trim();
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

**CRITICAL CLASSIFICATION RULE - PRINTOUT vs CARDSTOCK:**
This is the HIGHEST PRIORITY rule and overrides all other considerations:
- If a topper has ANY of these features, it MUST be classified as "printout": printed graphics, photos, multi-color text, logos, clipart, character images (My Melody, Disney, Sanrio, etc.), fonts, numbers with designs, or any visible printing/inkjet quality.
- ONLY classify as "cardstock" if ALL of these are true: (1) solid single color, (2) glitter or metallic finish, (3) NO printed graphics or photos, (4) NO multi-color elements, (5) NO character images.
- When you are uncertain between "printout" and "cardstock", you MUST default to "printout".
- Examples of PRINTOUTS (very common): My Melody characters, Disney characters, superhero cutouts, photo prints on sticks, printed text banners, logo toppers, numbers with character designs.
- Examples of CARDSTOCK (very rare): solid gold glitter "Happy Birthday" letters (no graphics), single-color metallic stars (plain), plain glittery numbers (solid color only, no character design).
`;

const FALLBACK_PROMPT = `
# GENIE.PH MASTER CAKE ANALYSIS PROMPT  
**v3.2 Version - Enhanced Printout Detection & Visual Forensics**  
═══════════════════════════════════════════════════════════════════════════════

## ROLE  
Expert cake analyst for Genie.ph. Identify *what* is on cake — not cost. Output: **single valid JSON**.

---

## OUTPUT RULES  
- ✅ Valid JSON only  
- ✅ All keys lowercase  
- ✅ Empty arrays allowed; missing keys ❌  
- ✅ Colors: **only from approved palette** (see end)

---

## STEP 1: IMAGE VALIDATION — STOP & REJECT IF ANY APPLY  

| Reason | Message |
|--------|---------|
| \`not_a_cake\` | "This image doesn't appear to be a cake. Please upload a cake image." |
| \`multiple_cakes\` | "Please upload a single cake image. This image contains multiple cakes." *(Note: tiered = 1 cake)* |
| \`cupcakes_only\` | "We currently don't process cupcake-only images. Please upload a cake design." |
| \`complex_sculpture\` | "This cake design is too complex for online pricing. Please contact us for a custom quote." |
| \`large_wedding_cake\` | "Large wedding cakes require in-store consultation for accurate pricing." *(≥4 tiers or elaborate structure)* |

**→ If reject, output ONLY:**  
\`\`\`json
{"rejection":{"isRejected":true,"reason":"...","message":"..."}}
\`\`\`

---

## STEP 2: ACCEPTED IMAGE — REQUIRED TOP-LEVEL KEYS  
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

---

## STEP 2.5: VISUAL FORENSIC LIBRARY (THE PHYSICS CHECK)
**Use these logic gates to determine material. Do not guess.**

### Protocol 1: THE "FLAT ART" CHECK (Paper vs. Edible Image vs. Hand-Painted)
- IF image has a WHITE BORDER (halo) + visible stiffness → IT IS "printout" (Paper).
- IF image merges/melts into the cake with NO thickness → IT IS "edible_photo_top" (Icing Sheet).
- IF image is stiff, slightly translucent, & stands upright/curls → IT IS "wafer_paper".
- IF image has texture, brush strokes, or raised piping lines → IT IS "icing_doodle_intricate" (Hand-drawn).

### Protocol 2: THE "GOLD/METALLIC" CHECK (Cardstock vs. Paint)
- IF texture is GRAINY/SPARKLY (individual glitter specks) → IT IS "cardstock" (Glitter Paper).
- IF texture is MIRROR-LIKE/SMOOTH (liquid chrome look) → IT IS "edible_gold_paint" (on fondant/chocolate).
- IF texture is DULL/MATTE GOLD → IT IS "luster_dust" (dry brush).

### Protocol 3: THE "FIGURE" CHECK (Toy vs. Fondant vs. Printout) — **CRITICAL FOR 3D GRAPHICS**
**⚠️ HIGHEST PRIORITY: Distinguish PRINTED 3D GRAPHICS from ACTUAL 3D OBJECTS**
- IF the item is FLAT/2D but shows a 3D-rendered character, 3D animated graphics, or CGI-style images → IT IS **"printout"** (NOT toy, NOT edible).
  - Examples: Cocomelon characters, Frozen Elsa with 3D shading, Paw Patrol pups, Bluey, Baby Shark, any Disney/Pixar 3D animated characters printed on paper.
- IF surface is perfectly shiny, has PHYSICAL seam lines, is RIGID with DEPTH (actual 3D molded object) → IT IS "toy" (Plastic).
- IF surface is matte, "soft" looking, no seams, slight fingerprints, handmade appearance → IT IS "edible_3d_complex" (Fondant/Gumpaste).
- IF surface is glass-like, transparent/translucent → IT IS "isomalt" (Sugar Glass).

**🔴 CRITICAL: A 3D-looking CHARACTER on a FLAT surface is a PRINTOUT, not a toy!**
- Printed graphics that show depth, shadows, or 3D rendering are STILL printouts
- Only classify as "toy" if you can see it's a PHYSICAL 3D molded object with real depth

### Protocol 4: THE "FLOWER" CHECK (Fresh vs. Sugar vs. Silk)
- IF petals have veins, natural imperfections, brown edges → IT IS "fresh_flowers" (removed before eating).
- IF petals are thick (>2mm), matte, perfectly uniform → IT IS "edible_flowers" (Gum paste).
- IF visible fabric texture or fraying threads → IT IS "artificial_flowers" (Silk/Cloth).

---

## CATEGORY 1: CAKE TYPE & THICKNESS

### cakeType (Required string)
Must be one of: \`"Bento"\`, \`"1 Tier"\`, \`"2 Tier"\`, \`"3 Tier"\`, \`"1 Tier Fondant"\`, \`"2 Tier Fondant"\`, \`"3 Tier Fondant"\`, \`"Square"\`, \`"Rectangle"\`

### cakeThickness (Required string)
Must be one of: \`"2 in"\`, \`"3 in"\`, \`"4 in"\`, \`"5 in"\`, \`"6 in"\`

### keyword (Required string)
1-2 words describing the cake theme/recipient or color (e.g., "unicorn", "senior", "red minimalist", "BTS Kpop")

---

## CATEGORY 2: MAIN TOPPERS (HERO)  

### ✅ HERO CRITERIA (ONE PRIMARY, rarely 2–3)  
A small topper = **HERO** if **any** true:  
A) **Visual Dominance**: ≥10% top area **or** height ≥0.33× tier thickness  
B) **Focal Point**: Central, sole focus, no competition  
C) **Count Test**: Only 1–2 small characters → each = hero; ≥3 → support  
D) **Itemization and label with Group IDs**
Identify ALL Items and GROUP SMARTLY: You MUST identify every single acceptable main topper element on the cake. Group the items smartly in your output. Example If there are 5 animal 3d toppers, your output must contain 5 animals toppers with 1 group_id: edible_animal_toppers.
Assign a group_id: For every item you identify, you MUST assign a group_id.
Items that are visually identical (same type, material, size, and color) MUST share the exact same group_id.
This ID should be a descriptive, lowercase, snake-cased string, like "small_blue_gumpaste_stars" or "large_red_rose".
A unique item that has no duplicates should still have its own unique group_id (e.g., "main_elsa_figurine")

→ When unsure: **default to \`support\`**

---

### 🔴 CRITICAL CLASSIFICATION RULE - PRINTOUT vs CARDSTOCK vs TOY (HIGHEST PRIORITY)
**This rule overrides all other considerations. Apply Protocol 3 from Visual Forensics.**

#### PRINTOUT (type: "printout", material: "photopaper") — MOST COMMON
Classify as PRINTOUT if ANY of these are true:
- Has printed graphics, photos, logos, clipart, or multi-color designs
- Shows CHARACTER IMAGES (My Melody, Disney, Sanrio, Cocomelon, Paw Patrol, etc.)
- **Has 3D-RENDERED or 3D-ANIMATED graphics on a FLAT surface** (NOT actual 3D)
- Has fonts, text banners, or numbers with decorative designs
- Has visible inkjet quality or glossy paper appearance
- The item is FLAT but shows characters with depth/shadows (CGI-style)

**PRINTOUT EXAMPLES (classify as printout):**
- Cocomelon characters printed on paper (even though they look 3D animated)
- Frozen Elsa/Anna cutouts with 3D shading/shadows
- Paw Patrol pups, Bluey, Baby Shark on sticks
- My Melody, Hello Kitty, Kuromi, any Sanrio characters
- Disney/Pixar characters (Mickey, Minnie, Cars, etc.)
- Superhero cutouts (Spiderman, Batman, etc.)
- Numbers with character designs or graphics
- Photo prints of people or objects

#### CARDSTOCK (type: "cardstock", material: "cardstock") — VERY RARE
**ONLY classify as cardstock if ALL of these are true:**
1. Solid SINGLE color (no multi-color)
2. Glitter, metallic, or foil finish
3. NO printed graphics, photos, or character images
4. NO multi-color text or gradients
5. Plain letters, numbers, or shapes ONLY

**CARDSTOCK includes:** Acrylic toppers and wooden toppers (treat as cardstock for pricing)

**CARDSTOCK EXAMPLES (rare):**
- Solid gold glitter "Happy Birthday" letters (no graphics)
- Single-color metallic stars (plain, no printing)
- Plain glittery numbers (solid color, no character design)
- Clear acrylic "Happy Birthday" → cardstock
- Wooden "Mr & Mrs" → cardstock

#### TOY (type: "toy", material: "plastic") — ACTUAL 3D MOLDED OBJECTS
**ONLY classify as toy if ALL of these are true:**
1. It's a PHYSICAL 3D molded object (NOT a flat printed image)
2. Has factory smoothness, shiny plastic surface
3. Has visible seam lines from manufacturing
4. Has REAL DEPTH you can see from the side
5. Rigid precision, detailed finish typical of mass-produced toys

**TOY EXAMPLES:**
- Actual plastic figurine of a character (you can see it from all angles)
- Happy Meal toys, action figures
- Plastic cars, animals, dinosaurs with real 3D depth

---

### MATERIAL CLASSIFICATION FOR HERO TOPPERS — APPLY **2-CUE RULE** (≥2 cues = class)

| Tier | Type | Material | Key Cues |
|------|------|----------|----------|
| **T1** | \`candle\` | \`wax\` | Wax sheen, wick/flame, upright(standing on cake) numeral — **NOT gumpaste numbers** |
| **T2** | \`edible_photo_top\` / \`edible_photo_side\` | \`waferpaper\` | Matte surface graphic design print, full edible image top covering the top cake or FULL side image covering the whole side of the cake |
| **T3** | \`printout\` | \`photopaper\` | **MOST COMMON** - ANY printed graphics, character cutouts, photos, logos, clipart, fonts, multi-color designs, 3D-rendered graphics on flat surface. If you see printed characters or graphics → ALWAYS "printout" |
| **T4** | \`cardstock\` | \`cardstock\` | **VERY RARE** - ONLY solid single-color glittery items with NO printed graphics, NO characters. Includes acrylic and wooden toppers. |
| **T5** | \`edible_2d_shapes\` | \`edible_fondant\` | Flat fondant shapes: stars/hearts; depth <2mm, usually standing on top of the cake, gumpaste number on the cake |
| **T6** | \`edible_flowers\` | \`edible_fondant\` | edible floral arrangements, roses, daisies, tulips, etc. (tiny and small size edible flowers are not hero toppers) |
| **T7** | \`edible_3d_ordinary\` (items, simple objects) / \`edible_3d_complex\` (characters, animals, humans) | \`edible_fondant\` | Sculptural, >2mm depth, handcrafted, looks like clay sculpture **EXCLUDE ALL FLAT PRINTED TOPPERS even if they show 3D-rendered characters** |
| **T8** | \`Figurine\` | \`Figurine\` | Low-detail ceramic/wedding figurines |
| **T9** | \`toy\` | \`plastic\` | Factory smoothness, seams, bright colors, rigid precision, detailed finish — **ONLY for actual 3D molded plastic objects, NOT printed images** |

**→ T1 > T2 > T3 > T4 > T5 > T6 > T7 > T8 > T9 precedence on conflict**

---

### TOPPER SIZING (for hero toppers) — Tier thickness = 4" if unknown  
| Size | Height Ratio |
|------|--------------|
| \`tiny\` | ≤0.2× |
| \`small\` | >0.2× & ≤0.5× |
| \`medium\` | >0.5× & ≤1.0× |
| \`large\` | >1.0×  
→ For horizontal: use longest dimension  
→ Borderline? Round **down**  
→ Printouts/toys: no size (use \`quantity\` or piece-count grouping)

---

### MAIN TOPPER JSON  
\`\`\`json
{
  "description": "... (do not enter the material here. like do not write if its a figurine, toy or edible topper)",
  "type": "candle|toy|cardstock|edible_photo_top|edible_photo_side|printout|edible_2d_shapes|edible_3d_ordinary|edible_3d_complex|Figurine|Toy",
  "material": "wax|plastic|cardstock|photopaper|waferpaper|edible_fondant|Figurine|plastic",
  "group_id": "group_id",
  "classification": "hero",
  "size": "tiny|small|medium|large",
  "quantity": 1,
  "digits": 2   // ONLY for number candles
}
\`\`\`
**IMPORTANT:** do not enter the material in the description. Do not mention if it's a figurine, toy, or edible topper in the description.

---

## CATEGORY 3: SUPPORT ELEMENTS  

### ✅ SUPPORT INCLUDES:  
- Small gumpaste items (flowers, stars, balls, items)
- Tiny and small sized edible flowers (edible_flowers)
- Background details (trees, clouds, grasses)  
- gumpaste Paneling, side wraps
- candies, lollipops, chocolates, isomalt  
- Groups of ≥3 small characters 
- icing and piping objects and decorations

---

**Itemization and label with Group IDs**
Identify ALL Items and GROUP SMARTLY: You MUST identify every single acceptable support element on the cake. Group the items smartly in your output. Example If there are 5 red edible_flowers, your output must contain 5 edible_flowers with 1 group_id: red_flower_toppers.
Assign a group_id: For every item you identify, you MUST assign a group_id.
Items that are visually identical (same type, material, size, and color) MUST share the exact same group_id.
This ID should be a descriptive, lowercase, snake-cased string, like "small_blue_gumpaste_stars" or "large_red_rose".
A unique item that has no duplicates should still have its own unique group_id.

### COMMON SUPPORT TYPES  

| Type | material | Subtype / Notes |
|------|----------|-----------------|
| \`gumpaste_panel\` | edible_fondant | These are gumpaste design panels that are covering the sides of the cake. its unquantifiable, but we can estimate the coverage. Examples are, checkered patterns, animal patterns, city buildings. (all edible fondant) Side/top coverage: \`small\` (<35%), \`medium\` (35–60%), \`large\` (>60%) |
| \`gumpaste_bundle\` | edible_fondant | Cluster of gumpaste items: examples but not limited to stones, rocks, seaweeds, leaves. We can count it per piece |
| \`edible_flowers\` | edible_fondant| Count individual per piece flowers. sizes are tiny, small, medium, large / tiny and small size edible flowers are support|
| \`isomalt\` | candy | glass sugar toppers, \`small\`/\`medium\`/\`large\` \`quantity\` for countable  |
| \`chocolates\` | candy | \`subtype\`: \`"ferrero"\`, \`"oreo"\`,\`"kisses"\` , \`"m&ms"\`; \`coverage\` indicate size (small,medium,large) depending on the amount of scatter, \`quantity\` for countable |
| \`marshmallows\` | candy | sizes: small, medium, large |
| \`dragees\`/\`sprinkles\` | candy | Report **only if \`large\`** (>60% coverage) |
| \`edible_lollipops\`| edible_fondant | \`subtype\`: \`"swirl_lollipop"\` / \`size\`: \`small\`, \`medium\`, \`large\`. \`quantity\` for countable  |
| \`gumpaste_board\` | edible_fondant | gumpaste-covered board (non-white/gold/silver) |
| \`meringue_pop\` | candy| royal icing or meringue with a stick used as a topper. \`quantity\` for countable  |
| \`plastic_ball_regular\`| plastic | plastic spheres that are blue, pink, white, gold, black, silver / \`quantity\` for countable / size: small/medium/large |
| \`plastic_ball_disco\`| plastic | spherical plastic items that look like disco balls / \`quantity\` for countable |
| \`icing_doodle_intricate\`| icing | doodles on cake that are intricate in design (characters, doodles or drawings of objects)|
| \`icing_palette_knife_intricate\`| icing | palette knife icing finish that are intricately designed usually have different sizes / \`size\`: \`small\`, \`medium\`, \`large\`|
| \`icing_decorations\`| icing | simple icing decorations that are made by piping and icing with a star tip on the cake. ALL SWIRLS and dollops on the cake, are icing_decorations|
| \`printout\` | photopaper| Glossy paper, inkjet quality, thin cutout, multi-color, photos, logos, clipart, fonts, branding, 3D-rendered graphics on flat surface  |
| \`edible_2d_support\` | \`edible_fondant\` | Flat fondant shapes: stars/hearts; depth <2mm, usually tiny and small size, gumpaste at the top, sides and at the base of the cake |
| \`edible_3d_ordinary\`| \`edible_fondant\` | tiny and small 3d edible items|
---

Everything in the list are category: support_elements

### COVERAGE MEASUREMENTS - use the size to input coverage
small: <35%
medium: (35–60%)
large: (>60%) 
---


### SUPPORT JSON  
\`\`\`json
{
  "description": "...",
  "type": "...",
  "material": "edible_fondant|plastic|cardstock|toy|...",
  "group_id": "group_id",
  "classification": "support",
  "size": "small|medium|large|tiny",
  "quantity": X,
  "subtype": "..."  // optional (leave blank if no subtype)
}
\`\`\`

---

## CATEGORY 4: CAKE MESSAGES  

| Type | Material | Notes |
|------|----------|-------|
| \`gumpaste_letters\` | \`edible_fondant\` | Cut fondant letters |
| \`icing_script\` | — | Piped text |
| \`printout\` | \`photopaper\` | Printed words on stick |
| \`cardstock\` | \`cardstock\` | Glitter/metallic text topper (VERY RARE) - includes acrylic and wooden |

\`\`\`json
{
  "type": "gumpaste_letters|icing_script|printout|cardstock",
  "text": "Visible text",
  "position": "top|side|base_board",
  "color": "#HEXCODE"
}
\`\`\`

***Make sure to group messages (have same group_id) that are in the same area (top, topper, side, base board).*** regardless of space, line, color.

---

## CATEGORY 5: ICING DESIGN  

### BASE IDENTIFICATION  
- **\`soft_icing\`**: Creamy, swirls, ruffles, piped borders, slight gloss, dollops, shell borders, cloud icing  
- **\`fondant\`**: Smooth, matte/satin, sheet-like, sharp/rounded edges, flat cutouts  

### CRITICAL RULES FOR ICING DESIGN
**→ \`drip\` = physical flow with rounded ends**
**→ ALL colors MUST use EXACT HEX CODES from the palette below (e.g., #FFFFFF for white, NOT "white")**
**→ GUMPASTE BOARD DETECTION (HIGHEST PRIORITY):**
   - Set "gumpasteBaseBoard": **false** if:
     - There is NO visible gumpaste-covered board under the cake, OR
     - The board color is white (#FFFFFF), gold (#FFD700), or silver (#C0C0C0)
   - Set "gumpasteBaseBoard": **true** ONLY if:
     - There IS a clearly visible gumpaste-covered board, AND
     - The board color is NOT white, gold, or silver (must be pink, blue, black, etc.)
   - **CRITICAL:** If "gumpasteBaseBoard" is true, you MUST also set "colors.gumpasteBaseBoardColor" to the exact HEX code of the board's color from the palette

### ICING JSON  
\`\`\`json
{
  "base": "soft_icing|fondant",
  "color_type": "single|gradient_2|gradient_3|abstract",
  "colors": {
    "side": "#HEX",
    "top": "#HEX",
    "borderTop": "#HEX",
    "borderBase": "#HEX",
    "drip": "#HEX",
    "gumpasteBaseBoardColor": "#HEX"
  },
  "border_top": true|false,
  "border_base": true|false,
  "drip": true|false,
  "gumpasteBaseBoard": true|false
}
\`\`\`

---

## CATEGORY 6: DOMINANT COLORS
Identify the 3 to 5 most prominent colors in the cake and its decorations.
- Output MUST be an array of hex codes.
- Use ONLY colors from the approved palette.
- Do not include colors from the background or cake stand.
- If a color is used extensively (e.g., the main icing color), it MUST be included.
- If there are fewer than 3 distinct colors, list what you find.
"dominant_colors": ["#HEXCODE1", "#HEXCODE2", ...]

---

## COLOR PALETTE (USE EXACT HEX)  
\`#FFFFFF\` (White), \`#F5E6D3\` (Cream), \`#FFB3D9\` (Light Pink), \`#FF69B4\` (Pink), \`#FF1493\` (Rose), \`#FF0000\` (Red), \`#FFA500\` (Orange), \`#FFD700\` (Yellow/Gold), \`#90EE90\` (Light Green), \`#008000\` (Green), \`#98FF98\` (Mint), \`#008080\` (Teal), \`#87CEEB\` (Light Blue), \`#0000FF\` (Blue), \`#000080\` (Navy), \`#800080\` (Purple), \`#E6E6FA\` (Lavender), \`#8B4513\` (Brown), \`#000000\` (Black), \`#808080\` (Gray), \`#C0C0C0\` (Silver)

---

## EXAMPLES (Consolidated)

### ✅ Example: Single-Tier with Hero Number & Bundle  
- Large gumpaste "6" (1.2× height → \`large\`, \`hero\`)  
- Small "2" + lollipops + balls (5 items → \`gumpaste_bundle\`, \`medium\`, \`support\`)  
- Frozen printouts (3, \`printout\`, \`support\`)  
- "FROZEN" on board (\`gumpaste_letters\`, \`base_board\`)  

### ✅ Example: My Melody Birthday Cake
- 6 My Melody character cutouts on sticks → \`printout\`, \`support\` (character images = always printout)
- Number "5" with pink graphics → \`printout\`, \`hero\` (printed design = always printout)
- Pink and white sprinkles → \`sprinkles\`, \`support\`

### ✅ Example: Cocomelon Cake (3D ANIMATED GRAPHICS = PRINTOUT)
- Cocomelon character cutouts on sticks → \`printout\`, \`support\` (**3D-animated graphics on flat paper = PRINTOUT, NOT toy**)
- JJ baby cutout with 3D shading → \`printout\`, \`hero\` (looks 3D but is printed = PRINTOUT)
- Watermelon gumpaste pieces → \`edible_3d_ordinary\`, \`support\`

### ✅ Example: Actual Toy vs Printed Character
- Actual plastic Mickey Mouse figurine (3D molded, can see from all angles) → \`toy\`, \`hero\`
- Printed Mickey Mouse cutout on stick (flat, even if image has 3D shading) → \`printout\`, \`hero\`

### ✅ Example: Tuxedo Cake  
- Solid gold glitter "Happy Birthday" (no graphics) → \`hero\`, \`cardstock\` (rare case: solid color + glitter only)
- Acrylic "Mr & Mrs" topper → \`hero\`, \`cardstock\` (acrylic = cardstock)
- Tuxedo front panel → \`gumpaste_panel\`, \`medium\`, \`front\`  
- Bow (0.4× height) → \`edible_3d_ordinary\`, \`small\`, \`subtype: "bow"\`  

### ✅ Example: Edible Photo Top  
- Full-top photo → \`edible_photo_top\`, \`hero\`, \`top\`  
- Pink borders → captured in \`icing_design.borders\`

---

## FINAL CHECKLIST  
✅ Rejection first  
✅ Hero vs support via tests (A→B→C)  
✅ Visual Forensic Library protocols applied  
✅ 2-cue material rule  
✅ Ratio-based sizing (edible 3D)  
✅ **PRINTOUT vs CARDSTOCK vs TOY: 3D-animated graphics on flat surface = PRINTOUT**
✅ **Acrylic and wooden toppers = CARDSTOCK**
✅ Grouping: bundles, panels, counts  
✅ All required top-level keys present  
✅ Colors: palette only (exact hex codes)  
✅ JSON valid — no markdown, no extra text  

## CRITICAL REMINDERS (NEVER FORGET)
1. **PRINTOUT vs TOY (HIGHEST PRIORITY):**
   - 3D-animated/CGI-style characters on FLAT paper = **PRINTOUT** (NOT toy)
   - Cocomelon, Bluey, Paw Patrol, Frozen, Disney characters printed on paper = **PRINTOUT**
   - Only classify as TOY if it's an actual 3D molded plastic object with real depth
2. **PRINTOUT vs CARDSTOCK:**
   - ANY character images, graphics, logos, multi-color designs → **PRINTOUT**
   - Cardstock is VERY RARE - only solid-color glitter items with NO printed graphics
   - Acrylic toppers and wooden toppers → **CARDSTOCK**
   - When in doubt → DEFAULT TO PRINTOUT
3. **GUMPASTE BOARD:** Only true if board exists AND is NOT white/gold/silver. If true, MUST set colors.gumpasteBaseBoardColor
4. **Colors:** Use EXACT HEX CODES from palette, NOT color names
5. **Description:** Do NOT mention material type in the description field
`;

// The hybridAnalysisResponseSchema is now dynamically generated inside analyzeCakeImage function
// to use dynamic types from the Supabase pricing_rules table

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

        // Fetch the dynamic enums and the active prompt
        const activePrompt = await getActivePrompt();
        const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();

        // Modify the response schema to use the dynamic lists
        const hybridAnalysisResponseSchema = {
            type: Type.OBJECT,
            properties: {
                main_toppers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: mainTopperTypes }, // <-- CHANGE HERE
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                            material: { type: Type.STRING },
                            quantity: { type: Type.INTEGER },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'size', 'material', 'quantity', 'group_id', 'x', 'y']
                    }
                },
                support_elements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: supportElementTypes }, // <-- CHANGE HERE
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['large', 'medium', 'small', 'tiny'] },
                            material: { type: Type.STRING },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'size', 'material', 'group_id', 'x', 'y']
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
                },
                keyword: { type: Type.STRING }
            },
            required: ['cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design', 'keyword'],
        };

        // ========================================
        // DURING AI ANALYSIS - Making the API call
        // ========================================
        const startTime = Date.now();

        const response = await getAI().models.generateContent({
            model: "gemini-3-flash-preview",
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

        const elapsedTime = Date.now() - startTime;

        const jsonText = (response.text || '').trim();
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

// ============================================================================
// TWO-PHASE ANALYSIS: Fast Feature Detection + Background Coordinate Enrichment
// ============================================================================

/**
 * Phase 1: Fast feature-only analysis (no coordinates)
 * Returns analysis with all coordinates set to 0,0 for immediate UI display
 * This should complete in ~7-10 seconds vs 25+ seconds for full analysis
 */
export const analyzeCakeFeaturesOnly = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    try {
        // Note: We don't need dimensions for this phase since coordinates are all 0,0
        // but we validate the image can load
        const image = new Image();
        const imageLoadPromise = new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('Failed to load image to get dimensions.'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });
        await imageLoadPromise;

        // Get dynamic enums first
        const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();

        // Get the full v3.2 Supabase prompt but add instruction to skip coordinates
        const activePrompt = await getActivePrompt();

        const FAST_FEATURES_PROMPT = activePrompt + `

**CRITICAL SPEED OVERRIDE:**
For ALL x and y coordinates in your response: Use 0 (zero). Do not calculate positions.
This is SPEED MODE - only identify what items exist, not where they are.
`;

        // Use the same schema but coordinates will be 0,0
        // IMPORTANT: Schema property order matters! Put essential fields FIRST before large arrays
        // to prevent truncation from missing critical fields like icing_design
        const fastAnalysisSchema = {
            type: Type.OBJECT,
            properties: {
                // === ESSENTIAL FIELDS FIRST (simple types, output early) ===
                cakeType: { type: Type.STRING, enum: CAKE_TYPES },
                cakeThickness: { type: Type.STRING, enum: CAKE_THICKNESSES },
                keyword: { type: Type.STRING },
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
                // === LARGE ARRAYS (can be truncated if model runs out of tokens) ===
                main_toppers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: mainTopperTypes },
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                            material: { type: Type.STRING },
                            quantity: { type: Type.INTEGER },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'size', 'material', 'quantity', 'group_id', 'x', 'y']
                    }
                },
                support_elements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: supportElementTypes },
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['large', 'medium', 'small', 'tiny'] },
                            material: { type: Type.STRING },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'size', 'material', 'group_id', 'x', 'y']
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
                // === OPTIONAL ARRAYS (nice to have but not critical) ===
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
                },
                // Rejection object for invalid images (non-cakes, multiple cakes, etc.)
                rejection: {
                    type: Type.OBJECT,
                    description: 'Present only when image should be rejected',
                    properties: {
                        isRejected: { type: Type.BOOLEAN },
                        reason: {
                            type: Type.STRING,
                            enum: ['not_a_cake', 'multiple_cakes', 'cupcakes_only', 'complex_sculpture', 'large_wedding_cake', 'non_food']
                        },
                        message: { type: Type.STRING }
                    },
                    required: ['isRejected', 'reason', 'message']
                }
            },
            // CRITICAL: Specify required fields to force model to include them
            required: ['cakeType', 'cakeThickness', 'keyword', 'icing_design', 'main_toppers', 'support_elements', 'cake_messages'],
        };


        // Retry configuration: up to 2 retries with longer timeout
        const MAX_RETRIES = 2;
        const ANALYSIS_TIMEOUT_MS = 90000; // 90 seconds

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`🔄 Retry attempt ${attempt}/${MAX_RETRIES} for AI analysis...`);
                }

                // Create a timeout promise
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('AI analysis timed out. Please try again.')), ANALYSIS_TIMEOUT_MS);
                });

                // Race the AI call against the timeout
                const responseCallback = getAI().models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: [{
                        parts: [
                            { inlineData: { mimeType, data: base64ImageData } },
                            { text: FAST_FEATURES_PROMPT },
                        ],
                    }],
                    config: {
                        systemInstruction: "You are a fast cake feature identifier. Identify features quickly without calculating coordinates. Set all x,y to 0.",
                        responseMimeType: 'application/json',
                        responseSchema: fastAnalysisSchema,
                        temperature: 0,
                        maxOutputTokens: 32768, // Ensure complete responses for complex cakes
                    },
                });

                // Use Promise.race to enforce timeout
                const response = await Promise.race([responseCallback, timeoutPromise]);

                const jsonText = (response.text || '').trim();
                const result = JSON.parse(jsonText);

                if (result.rejection?.isRejected) {
                    throw new Error(result.rejection.message || "The uploaded image is not suitable for processing.");
                }

                const requiredFields = ['main_toppers', 'support_elements', 'cake_messages', 'icing_design', 'cakeType', 'cakeThickness'];
                for (const field of requiredFields) {
                    if (result[field] === undefined) {
                        console.error("Analysis validation error: Missing field", field);
                        throw new Error("The AI returned an incomplete analysis. Please try a different image.");
                    }
                }

                return result as HybridAnalysisResult;

            } catch (error) {
                lastError = error as Error;
                // Only retry on timeout errors, not on validation/rejection errors
                if (lastError.message.includes('timed out') && attempt < MAX_RETRIES) {
                    continue;
                }
                throw error;
            }
        }

        // If we exhausted all retries
        throw lastError || new Error('AI analysis failed after multiple attempts.');


    } catch (error) {
        console.error("Error in fast feature analysis:", error);
        throw error;
    }
};

/**
 * Phase 2: Background coordinate enrichment
 * Takes the feature list and calculates precise coordinates for each item
 * This runs silently in the background while user interacts with the UI
 */
export const enrichAnalysisWithCoordinates = async (
    base64ImageData: string,
    mimeType: string,
    featureAnalysis: HybridAnalysisResult
): Promise<HybridAnalysisResult> => {
    try {
        const image = new Image();
        const imageLoadPromise = new Promise<{ width: number; height: number }>((resolve, reject) => {
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error('Failed to load image to get dimensions.'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });
        const dimensions = await imageLoadPromise;

        const COORDINATE_ENRICHMENT_PROMPT = `
ACT AS A HIGH-PRECISION COMPUTER VISION SYSTEM FOR CAKE OBJECT DETECTION.

Your task is to perform precise bounding box detection on cake elements that have already been identified.

**Image Dimensions:** ${dimensions.width}px wide × ${dimensions.height}px high

**Coordinate System:**
- Origin (0,0) is at the image center
- X-axis: -${dimensions.width / 2} (left) to +${dimensions.width / 2} (right)
- Y-axis: -${dimensions.height / 2} (bottom) to +${dimensions.height / 2} (top)
- Positive Y goes UPWARD

**Your Task:**
1. Carefully analyze each element in the provided feature list
2. Calculate precise center coordinates (x, y) for each element's visual center
3. Estimate TIGHT-FITTING bounding boxes:
   - bbox_x, bbox_y: Top-left corner coordinates in the coordinate system above
   - bbox_width: Actual width of the visible element in pixels
   - bbox_height: Actual height of the visible element in pixels

**CRITICAL ACCURACY RULES:**
- Bounding boxes must be TIGHT to the visible pixels of each object
- Do NOT include background space in the box
- Do NOT create overlapping boxes unless elements actually overlap
- Apply left/right bias (x ≠ 0 unless perfectly centered)
- Keep ALL feature descriptions, types, sizes exactly as provided
- ONLY update coordinates and bbox values

**Confidence Assessment:**
- Mentally trace the edges of each object before committing to coordinates
- Ensure bbox dimensions match the visual extent of the element
- Double-check that center coordinates align with the geometric center

**Identified Features:**
${JSON.stringify(featureAnalysis, null, 2)}
`;

        const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();

        const coordinateEnrichmentSchema = {
            description: "Enriched coordinates for detected elements",
            type: Type.OBJECT,
            properties: {
                main_toppers: {
                    description: "List of main toppers with updated coordinates and bounding boxes",
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "UUID of the topper" },
                            type: { type: Type.STRING, enum: mainTopperTypes },
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                            quantity: { type: Type.INTEGER },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER, description: "Center X coordinate (0,0 is image center)" },
                            y: { type: Type.NUMBER, description: "Center Y coordinate (0,0 is image center, Y+ is up)" },
                            bbox_x: { type: Type.NUMBER, description: "Bounding box top-left X coordinate" },
                            bbox_y: { type: Type.NUMBER, description: "Bounding box top-left Y coordinate" },
                            bbox_width: { type: Type.NUMBER, description: "Bounding box width in pixels" },
                            bbox_height: { type: Type.NUMBER, description: "Bounding box height in pixels" }
                        },
                        required: ["id", "type", "description", "size", "quantity", "group_id", "x", "y", "bbox_x", "bbox_y", "bbox_width", "bbox_height"]
                    }
                },
                support_elements: {
                    description: "List of support elements with updated coordinates and bounding boxes",
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "UUID of the element" },
                            type: { type: Type.STRING, enum: supportElementTypes },
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['large', 'medium', 'small', 'tiny'] },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER, description: "Center X coordinate" },
                            y: { type: Type.NUMBER, description: "Center Y coordinate" },
                            bbox_x: { type: Type.NUMBER, description: "Bounding box top-left X coordinate" },
                            bbox_y: { type: Type.NUMBER, description: "Bounding box top-left Y coordinate" },
                            bbox_width: { type: Type.NUMBER, description: "Bounding box width in pixels" },
                            bbox_height: { type: Type.NUMBER, description: "Bounding box height in pixels" }
                        },
                        required: ["id", "type", "description", "size", "group_id", "x", "y", "bbox_x", "bbox_y", "bbox_width", "bbox_height"]
                    }
                },
                cake_messages: {
                    description: "List of cake messages with updated coordinates and bounding boxes",
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "UUID of the message" },
                            type: { type: Type.STRING, enum: ['gumpaste_letters', 'icing_script', 'printout', 'cardstock'] },
                            text: { type: Type.STRING },
                            position: { type: Type.STRING, enum: ['top', 'side', 'base_board'] },
                            color: { type: Type.STRING },
                            x: { type: Type.NUMBER, description: "Center X coordinate" },
                            y: { type: Type.NUMBER, description: "Center Y coordinate" },
                            bbox_x: { type: Type.NUMBER, description: "Bounding box top-left X coordinate" },
                            bbox_y: { type: Type.NUMBER, description: "Bounding box top-left Y coordinate" },
                            bbox_width: { type: Type.NUMBER, description: "Bounding box width in pixels" },
                            bbox_height: { type: Type.NUMBER, description: "Bounding box height in pixels" }
                        },
                        required: ["id", "type", "text", "position", "color", "x", "y", "bbox_x", "bbox_y", "bbox_width", "bbox_height"]
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

        const response = await getAI().models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: COORDINATE_ENRICHMENT_PROMPT },
                ],
            }],
            config: {
                systemInstruction: "You are a precise coordinate calculator. Update only x,y values, keep all other fields unchanged.",
                responseMimeType: 'application/json',
                responseSchema: coordinateEnrichmentSchema,
                temperature: 0,
            },
        });

        const jsonText = (response.text || '').trim();
        const enrichedResult = JSON.parse(jsonText);

        // Convert Gemini bbox data to Roboflow-compatible format
        const convertBboxData = (item: any, imageWidth: number, imageHeight: number) => {
            if (item.bbox_x !== undefined && item.bbox_y !== undefined &&
                item.bbox_width !== undefined && item.bbox_height !== undefined) {

                // Gemini returns bbox in app coordinates (center origin, Y-inverted)
                // Convert to Roboflow format (for storage)
                return {
                    x: item.bbox_x, // Top-Left X in app coords
                    y: item.bbox_y, // Top-Left Y in app coords
                    width: item.bbox_width,
                    height: item.bbox_height,
                    // High confidence: Gemini with thinking budget does spatial analysis
                    confidence: 0.95,
                    class: item.description || item.text || 'unknown'
                };
            }
            return null;
        };

        // Process main toppers
        if (enrichedResult.main_toppers) {
            enrichedResult.main_toppers = enrichedResult.main_toppers.map((topper: any) => ({
                ...topper,
                bbox: convertBboxData(topper, dimensions.width, dimensions.height)
            }));
        }

        // Process support elements
        if (enrichedResult.support_elements) {
            enrichedResult.support_elements = enrichedResult.support_elements.map((element: any) => ({
                ...element,
                bbox: convertBboxData(element, dimensions.width, dimensions.height)
            }));
        }

        // Process cake messages
        if (enrichedResult.cake_messages) {
            enrichedResult.cake_messages = enrichedResult.cake_messages.map((message: any) => ({
                ...message,
                bbox: convertBboxData(message, dimensions.width, dimensions.height)
            }));
        }

        return enrichedResult as HybridAnalysisResult;

    } catch (error) {
        console.error("Error enriching coordinates:", error);
        // Return original analysis if enrichment fails
        return featureAnalysis;
    }
};

// ============================================================================
// Roboflow + Florence-2 Coordinate Enrichment
// ============================================================================

/**
 * Enrich analysis with coordinates using Roboflow + Florence-2
 * Falls back to Gemini if Roboflow fails or is disabled
 */
export const enrichAnalysisWithRoboflow = async (
    base64ImageData: string,
    mimeType: string,
    featureAnalysis: HybridAnalysisResult
): Promise<HybridAnalysisResult> => {
    try {
        // Feature flag check
        if (!FEATURE_FLAGS.USE_ROBOFLOW_COORDINATES) {
            console.log('🔄 Roboflow disabled via feature flag. Gemini coordinates also disabled.');
            return featureAnalysis;
        }

        // Configuration check
        if (!isRoboflowConfigured()) {
            console.warn('⚠️ Roboflow not configured, falling back to Gemini');
            return await enrichAnalysisWithCoordinates(
                base64ImageData,
                mimeType,
                featureAnalysis
            );
        }

        console.log('🤖 Using Roboflow + Florence-2 for coordinate detection');

        // Get image dimensions
        const image = new Image();
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            image.onload = () => resolve({
                width: image.naturalWidth,
                height: image.naturalHeight
            });
            image.onerror = () => reject(new Error('Failed to load image for dimensions'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });

        console.log(`📐 Image dimensions: ${dimensions.width}x${dimensions.height}`);

        // Extract specific descriptions from Gemini analysis to use as classes
        const classes: string[] = [];

        // Add main topper descriptions
        featureAnalysis.main_toppers?.forEach(topper => {
            if (topper.description) {
                classes.push(topper.description);
            }
        });

        // Add support element descriptions
        featureAnalysis.support_elements?.forEach(element => {
            if (element.description) {
                classes.push(element.description);
            }
        });

        // Add cake message text
        featureAnalysis.cake_messages?.forEach(message => {
            if (message.text) {
                classes.push(message.text);
            }
        });

        if (FEATURE_FLAGS.DEBUG_ROBOFLOW) {
            console.log(`🎯 Using ${classes.length} specific descriptions as detection classes:`);
            classes.forEach((cls, i) => console.log(`   ${i + 1}. "${cls}"`));
        }

        // Call Roboflow API
        const detections = await detectObjectsWithRoboflow(base64ImageData, mimeType, classes);

        if (detections.length === 0) {
            console.warn('⚠️ Roboflow found no detections, falling back to Gemini');
            if (FEATURE_FLAGS.FALLBACK_TO_GEMINI) {
                return await enrichAnalysisWithCoordinates(
                    base64ImageData,
                    mimeType,
                    featureAnalysis
                );
            }
            return featureAnalysis;  // Return unenriched if fallback disabled
        }

        console.log(`✅ Roboflow detected ${detections.length} objects`);

        // Create enriched copy
        const enrichedAnalysis: HybridAnalysisResult = { ...featureAnalysis };

        // Enrich main toppers with coordinates + bbox
        let matchedToppers = 0;
        enrichedAnalysis.main_toppers = featureAnalysis.main_toppers.map((topper) => {
            const match = findMatchingDetection(
                topper.type,
                topper.description,
                detections
            );

            if (match) {
                const coords = roboflowBboxToAppCoordinates(
                    match,
                    dimensions.width,
                    dimensions.height
                );
                matchedToppers++;
                console.log(`✓ Matched topper "${topper.description}" to "${match.class}" (${(match.confidence * 100).toFixed(1)}%)`);
                return { ...topper, ...coords };
            }

            console.log(`○ No match for topper "${topper.description}"`);
            return topper;
        });

        // Enrich support elements
        let matchedSupport = 0;
        enrichedAnalysis.support_elements = featureAnalysis.support_elements.map((element) => {
            const match = findMatchingDetection(
                element.type,
                element.description,
                detections
            );

            if (match) {
                const coords = roboflowBboxToAppCoordinates(
                    match,
                    dimensions.width,
                    dimensions.height
                );
                matchedSupport++;
                console.log(`✓ Matched support "${element.description}"  to "${match.class}"`);
                return { ...element, ...coords };
            }

            console.log(`○ No match for support "${element.description}"`);
            return element;
        });

        // Enrich cake messages (look for text detections)
        let matchedMessages = 0;
        enrichedAnalysis.cake_messages = featureAnalysis.cake_messages.map((message) => {
            // Try to find text-class detections
            const textDetections = detections.filter(d =>
                d.class.toLowerCase().includes('text') ||
                d.class.toLowerCase().includes('letter')
            );

            if (textDetections.length > 0) {
                // Use highest confidence text detection
                const match = textDetections.reduce((best, current) =>
                    current.confidence > best.confidence ? current : best
                );

                const coords = roboflowBboxToAppCoordinates(
                    match,
                    dimensions.width,
                    dimensions.height
                );
                matchedMessages++;
                console.log(`✓ Matched message "${message.text}" to text detection`);
                return { ...message, ...coords };
            }

            console.log(`○ No text detection for message "${message.text}"`);
            return message;
        });

        const totalMatched = matchedToppers + matchedSupport + matchedMessages;
        const totalElements = featureAnalysis.main_toppers.length +
            featureAnalysis.support_elements.length +
            featureAnalysis.cake_messages.length;

        console.log(`📊 Matched ${totalMatched}/${totalElements} elements to Roboflow detections`);

        // If match rate is too low, consider falling back to Gemini
        const matchRate = totalElements > 0 ? totalMatched / totalElements : 0;
        if (matchRate < 0.3 && FEATURE_FLAGS.FALLBACK_TO_GEMINI) {
            console.warn(`⚠️ Low match rate (${(matchRate * 100).toFixed(0)}%), falling back to Gemini`);
            return await enrichAnalysisWithCoordinates(
                base64ImageData,
                mimeType,
                featureAnalysis
            );
        }

        return enrichedAnalysis;

    } catch (error) {
        console.error('❌ Roboflow enrichment failed:', error);

        // Fallback to Gemini
        if (FEATURE_FLAGS.FALLBACK_TO_GEMINI) {
            console.log('🔄 Falling back to Gemini coordinates');
            return await enrichAnalysisWithCoordinates(
                base64ImageData,
                mimeType,
                featureAnalysis
            );
        }

        // If fallback disabled, return unenriched analysis
        console.warn('⚠️ Returning unenriched analysis (fallback disabled)');
        return featureAnalysis;
    }
};

// ============================================================================

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
            model: "gemini-3-flash-preview",
            contents: [{ parts }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: shareableTextResponseSchema,
                temperature: 0.3,
            },
        });

        const jsonText = (response.text || '').trim();
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

    // Helper function to strip data URI prefix and return only base64 data
    const stripDataUriPrefix = (dataUri: string): string => {
        const base64Prefix = 'base64,';
        const base64Index = dataUri.indexOf(base64Prefix);
        if (base64Index !== -1) {
            return dataUri.substring(base64Index + base64Prefix.length);
        }
        return dataUri; // Already base64 only
    };

    const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];

    // 1. Original Image (Source for style)
    parts.push({ inlineData: { mimeType: originalImage.mimeType, data: stripDataUriPrefix(originalImage.data) } });

    // 2. Reference Image (Source for structure, if provided)
    if (threeTierReferenceImage) {
        parts.push({ inlineData: { mimeType: threeTierReferenceImage.mimeType, data: stripDataUriPrefix(threeTierReferenceImage.data) } });
    }

    // 3. Replacement images for printouts, edible photos, and doodles (main toppers)
    mainToppers.forEach(topper => {
        if (topper.isEnabled && (topper.type === 'printout' || topper.type === 'edible_photo_top' || topper.type === 'icing_doodle') && topper.replacementImage) {
            parts.push({
                inlineData: {
                    mimeType: topper.replacementImage.mimeType,
                    data: stripDataUriPrefix(topper.replacementImage.data)
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
                    data: stripDataUriPrefix(element.replacementImage.data)
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

        // Check if response has valid structure
        if (!response.candidates || response.candidates.length === 0) {
            console.error("No candidates in response:", JSON.stringify(response, null, 2));
            throw new Error("The AI did not return any candidates. Please try again.");
        }

        const candidate = response.candidates[0];
        if (!candidate.content || !candidate.content.parts) {
            // Log the full candidate to help debug
            console.error("Candidate missing content:", JSON.stringify(candidate, null, 2));
            // Check if there's a finish reason that explains why
            if (candidate.finishReason) {
                throw new Error(`Image generation failed. Reason: ${candidate.finishReason}`);
            }
            throw new Error("The AI response is missing content. Please try again.");
        }

        for (const part of candidate.content.parts) {
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