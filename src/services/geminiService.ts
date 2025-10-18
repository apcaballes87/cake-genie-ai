import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";

if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error("VITE_GEMINI_API_KEY environment variable not set");
}

// Log the API key (first 20 chars only for debugging)
console.log('🔑 Gemini API Key being used:', import.meta.env.VITE_GEMINI_API_KEY?.substring(0, 20) + '...');

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

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

const NEW_HYBRID_PROMPT = `You are an expert cake designer analyzing a cake image for an online customization and pricing tool. Your first and most critical task is to validate the image before proceeding with a detailed analysis.

**1. IMAGE VALIDATION (DO THIS FIRST):**

If the image meets any of the following rejection criteria, you MUST stop analysis. Your entire JSON response must contain ONLY a "rejection" field with the appropriate reason and message.

**Rejection Criteria:**
- **Not a Cake / Not Food:** The main subject is not a cake (e.g., a pie, a person, an object) or is not a food item.
  - **Reason:** \`"not_a_cake"\`
  - **Message:** \`"This image doesn't appear to be a cake. Please upload a cake image."\`
- **Multiple Cakes:** The image clearly shows more than one distinct, separate cake. (A tiered cake is a single cake).
  - **Reason:** \`"multiple_cakes"\`
  - **Message:** \`"Please upload a single cake image. This image contains multiple cakes."\`
- **Cupcakes Only:** The image contains only cupcakes and no larger cake.
  - **Reason:** \`"cupcakes_only"\`
  - **Message:** \`"We currently don't process cupcake-only images. Please upload a cake design."\`
- **Complex Sculpture:** The cake is a highly complex 3D sculpture (e.g., a life-sized car, detailed building replica) that is beyond standard pricing rules.
  - **Reason:** \`"complex_sculpture"\`
  - **Message:** \`"This cake design is too complex for online pricing. Please contact us for a custom quote."\`
- **Large Wedding Cake:** The cake is a very large, ornate wedding cake, typically 4+ tiers or with elaborate structures requiring special consultation.
  - **Reason:** \`"large_wedding_cake"\`
  - **Message:** \`"Large wedding cakes require in-store consultation for accurate pricing."\`

**REJECTION JSON FORMAT:**
If rejected, respond ONLY with this structure:
\`\`\`json
{
  "rejection": {
    "isRejected": true,
    "reason": "REJECTION_REASON_CODE_FROM_ABOVE",
    "message": "REJECTION_MESSAGE_FROM_ABOVE"
  }
}
\`\`\`

**ACCEPTANCE CRITERIA:**
- The image contains one single cake (Bento, 1-3 tiers, Square, Rectangle, Fondant).
- A main cake is present, even with cupcakes on the side. **In this case, IGNORE the cupcakes and analyze only the main cake.**

**2. DETAILED ANALYSIS (IF IMAGE IS ACCEPTED):**

If the image is ACCEPTABLE, proceed with the detailed analysis below. Your response must be a valid JSON object and MUST NOT include the "rejection" field.

**OBJECTIVE TOPPER SIZING SYSTEM**
Use ratio-based size classification for all 3D toppers:

MEASUREMENT PROTOCOL:
1. Establish the cake tier thickness (2-6 inches)
2. Estimate topper height relative to tier thickness
3. Apply ratio classification:
   - **'large'**: Height > 1.0× tier thickness
   - **'medium'**: Height > 0.5× and ≤ 1.0× tier thickness
   - **'small'**: Height ≤ 0.5× tier thickness
   - **'partial'**: Height < 0.25× tier thickness (e.g., small flowers, stars)

SPECIAL CASES:
- For horizontal/lying toppers: use longest dimension instead of height
- For printout toppers: SKIP sizing (always note as printout, size not relevant)
- When tier thickness is uncertain, default to 4 inches for calculations
- When borderline between sizes, round DOWN to smaller category

**Color Palette:** For any color field in your response (like icing or message colors), you MUST use the closest matching hex code from this specific list: Red (#EF4444), Light Red (#FCA5A5), Orange (#F97316), Yellow (#EAB308), Green (#16A34A), Light Green (#4ADE80), Teal (#14B8A6), Blue (#3B82F6), Light Blue (#93C5FD), Purple (#8B5CF6), Light Purple (#C4B5FD), Pink (#EC4899), Light Pink (#FBCFE8), Brown (#78350F), Light Brown (#B45309), Gray (#64748B), White (#FFFFFF), Black (#000000).

**LOCATION DESCRIPTION:**
When describing toppers and support elements, you MUST specify their location on the cake. Use clear and concise terms.
- **For multi-tier cakes:** "top tier", "middle tier", "bottom tier".
- **General location:** "top surface", "side", "base board", "top edge", "base edge".
- **Directional:** "front", "back", "left side", "right side".
- **Example:** "located on the side of the top tier", "scattered around the base", "at the front of the base board".

Now, analyze the image and provide a JSON object. For a successful analysis, you MUST include ALL of the following 6 categories:

1. **cakeType**: Choose the best fit from this list: 1 Tier, 2 Tier, 3 Tier, 1 Tier Fondant, 2 Tier Fondant, 3 Tier Fondant, Square, Rectangle, Bento. 
   
   **TIER RECOGNITION GUARDRAILS:**
   - Default to "1 Tier" unless there is CLEAR physical separation between tiers:
     * A distinct second cake body with its own vertical side and top plane
     * Shadow line and diameter change visible; top tier's base is flat and not just a piped crown
     * Top décor resting on a same-diameter top (NOT just a mound of piping)
   - Top-view photos: use side cues (shadows, board edge, visible side height) before claiming multiple tiers
   
   **Bento Definition:** A "Bento" cake is a small, personal-sized cake, typically 4 inches in diameter and 2 inches thick, often packaged in a light brown clamshell box.

2. **cakeThickness**: Choose the best fit from this list: 2 in, 3 in, 4 in, 5 in, 6 in.
   
   **THICKNESS HEURISTICS:**
   - Bento: 2–3 in
   - Standard single tier: 4 in (most common)
   - Tall/double-barrel look: 6 in (or 5 in when clearly taller than standard but not double)
   - Small but not bento: 3 in
   - If uncertain: default to 4 in

3. **main_toppers** (focal points on top/prominent on cake):
   
   **CRITICAL DECISION FRAMEWORKS (APPLY IN ORDER):**

   **TOPPER IDENTIFICATION LADDER (Apply in order of precedence):**
   
   **T1) PRINTOUT CHECK:** A topper is a 'printout' if it has **2 or more** of these cues:
- Visible thin white cut edge/halo
- Visible paper thickness (0.2-0.6mm)
- Printed dot pattern texture (visible halftone/CMYK dots under close inspection)
- Support stick taped behind it (not embedded in the topper)
- Flat 2D card/paper appearance with no side volume
- Printed brand logos, character images with licensing marks
- Multiple colors (font color different from stroke/outline color)
- Uniform matte/inkjet surface
- **Perfect symmetry on paired elements** (e.g., butterfly wings with identical patterns on both sides - indicates digital printing/mirroring)
- **Photorealistic printed details** (gradient patterns, photo-quality images) that would be impossible to hand-paint on gumpaste
- **Clean die-cut edges without white borders** - professionally printed items can have precision-cut edges that match the design color (no white halo)
- **Uniform thickness across entire piece** (0.3-0.8mm) - gumpaste varies in thickness due to hand-rolling
- **Glossy laminated finish** or **photo paper sheen** distinct from gumpaste's matte/powdery surface

**EDGE CASE - NO WHITE EDGE PRINTOUTS:**
Some high-quality printouts are printed on colored cardstock or have digitally designed backgrounds that eliminate white edges. Identify these by:
- Perfect pattern repetition or symmetry (especially on butterflies, flowers)
- Photo-quality gradients or details impossible to hand-paint
- Uniform paper-thin consistency throughout
- Sharp, laser/die-cut edges (too perfect for hand-cutting gumpaste)
- May have slight paper curl or warping under cake lights

**NOTE:** Even without white edges, if an item shows ≥2 printout cues (especially perfect symmetry + paper-thin + photorealistic details), classify as PRINTOUT.

   **T2) TOY CHECK:** A topper is a 'toy' if it has **2 or more** of these cues:
   - True 3D volume with parallax effect from different angles
   - Glossy plastic specular highlights that "travel" smoothly
   - Visible injection mold seams/marks
   - Factory-made base or stand
   - Thick, rounded edges typical of molded plastic
   - Printed licensing text under feet/base
   - Uniform factory-made appearance
   
   **BABY FIGURINE OVERRIDE:** Realistic proportioned baby + glossy/hard finish → TOY/figurine (classify as toy regardless of other cues)

   **T3) EDIBLE 3D CHECK:** A topper is 'edible_3d' if it has **2 or more** of these cues:
   - Matte, soft, or powdery finish (may show cornstarch dusting)
   - Visible signs of being hand-modeled (minor imperfections, asymmetry)
   - Soft, hand-formed edges
   - Embedded support stick (not taped behind)
   - Visible sculpting tool marks
   - Solid-through color (not surface print)
   - Tiny cracks at bends/joints
   - Sits flush on icing without manufactured base

   **DEFAULT RULE:** If a topper does not meet the 2-cue threshold for any category, classify it as **'printout'**.

   **VALIDATION RULE PRECEDENCE:**
   - **White-Edge Forcing Rule:** Any visible white cut edge or taped stick behind figure → PRINTOUT (override all other classifications)
   - **Printout Priority Guardrail:** Visible printed edges, logos, flat inkjet/glossy surface → PRINTOUT
   - **Stricter Toy Gate:** For small/low-res photos, require ≥3 toy cues (at least one being factory base or mold seam)

   **HERO VS SUPPORT CLASSIFICATION:**
   
   Classify as **'hero'** (full price, no allowance) if:
   - Any 'medium' or 'large' 'edible_3d' topper (based on ratio sizing)
   - A 'small' topper that is the clear visual focal point:
     * Occupies more than 10% of the top surface area, OR
     * Height ≥⅓ of the tier's total height (ratio ≥0.33×), OR
     * Single central character on otherwise simple cake, OR
     * Cake has only 1-2 small characters in total
   
   Classify as **'support'** (subject to allowance) if:
   - Part of decorative scene/panel work on the sides of the cake
   - A cluster of 3 or more small characters/items bundled together
   - A background element (e.g., trees, clouds behind a main character)

   **Material Definitions:**
   - **'edible_3d'**: Hand-sculpted gumpaste/fondant figures with 3D volume
   - **'printout'**: Printed images on paper/card (always ₱0)
   - **'toy'**: Plastic/resin factory-made figures
   - **'edible_2d_gumpaste'**: Flat, cut-out shapes made from hardened sugar paste
   - **'cardstock'**: Stiff colored paper (glitter, metallic) - NOT printed. Must have ≥2 cues: visible edge thickness/layers, real glitter granules, or mirror-foil highlights
   - **'edible_photo'**: Photo printed on edible sheet applied seamlessly to icing. If the entire top surface is covered by a single, seamless image (like a photograph or complex graphic), classify it as ONE 'edible_photo' topper with size 'large'.

   **IMPORTANT EXCLUSIONS:**
   - Decorations made directly from piped icing (swirls, rosettes, piped writing) are NOT main toppers
   - Dollop icing borders (piped icing blobs) are never toppers
   - Simple piping and sprinkles are not toppers

    **GROUPING RULES:**

**SHAPE-BASED GROUPING (Priority Rule):**
Group items by their PRIMARY SHAPE/FORM, regardless of:
- Color variations (red stars + yellow stars = 1 star group)
- Size variations (large stars + small stars = 1 star group)
- Material variations (gumpaste stars + printout stars = may be 1 group, see below)
- Classification differences (hero stars + support stars = note both classifications in same group)

**When to group as ONE:**
- Same base shape: stars, hearts, flowers, circles, butterflies, balloons, etc.
- Example: "5 gumpaste stars (2 red hero medium, 3 yellow support small)" = 1 group entry
- Example: "8 butterflies (3 large printout, 5 small gumpaste)" = 1 group entry

**When to keep SEPARATE (only these exceptions):**
- Different materials that affect pricing differently:
  * Edible 3D vs Printout (different pricing) → separate groups
  * Toy vs Edible 3D (different pricing) → separate groups
- Completely different shapes (stars vs hearts → separate groups)
- Elements that belong to different functional categories:
  * Main focal topper vs scattered decorative accents
  * Example: 1 large hero butterfly topper + 20 tiny printout butterfly confetti → can be 2 groups

**GROUPING FORMAT:**
For each group, include:
- type: material classification
- description: "[quantity] [shape] ([size/classification details if varied]) located at [specific location on cake]"
- size: if all same size use that; if mixed use "mixed" and detail in description
- quantity: total count in group
- group_id: same ID for this shape family
- classification: if mixed, note "hero + support" or detail in description
- color: (optional) The single, dominant color hex code from the Color Palette if clearly identifiable (e.g., a solid red star is '#EF4444'). Omit for multi-colored items or if color is ambiguous.

**Examples:**
{
  "type": "edible_3d",
  "description": "7 gumpaste stars: 2 large red (hero), 3 medium blue (hero), 2 small yellow (support) located on the side of the top tier",
  "size": "mixed",
  "quantity": 7,
  "group_id": "stars_01",
  "classification": "hero + support"
}
   
4. **support_elements** (decorative, not focal):
   
   Identify each support element and classify its material:
   
   - **'gumpaste_panel'**: Significant side decoration made from flat gumpaste pieces forming a scene or pattern. Examples: camo patches, stripes, cloud blobs, silhouettes, badges, top flat discs/panels
   
   - **'small_gumpaste'**: Smaller individual gumpaste items like stars, flowers, or dots that are not the main focus
   
   - **'chocolates'**: Chocolate bars, spheres, drips, or shards used decoratively
     * **For expensive chocolates** (Ferrero, Kinder, Cadbury, Snickers, KitKat): note as premium
     * **For cheap/generic chocolates** (Oreos, Kisses): note as standard
     * **M&M chocolates**: specify as M&Ms
   
   - **'sprinkles'**: Tiny decorative particles like nonpareils, jimmies, or edible glitter
   
   - **'dragees'**: Sugar pearls/dragees - NEVER treat as chocolates or gumpaste balls
   
   - **'support_printout'**: Smaller printed images used as background or secondary decoration
   
   - **'isomalt'**: Hard, clear or colored sugar work creating glass-like or gemstone effect (e.g., 'sail', 'shards', translucent lollipops)
   
   - **'edible_flowers'**: Sugar flowers - count as cohesive clusters. Note if flowers appear to be real/fresh (for substitution recommendation)

   - **'edible_photo_side'**: A seamless image or photo applied directly to the side icing of the cake, often as a wrap. Distinguish this from 'support_printout' which are smaller, often cut-out, printed images attached to the side.

   **COVERAGE CLASSIFICATION:**
   - **'light'**: <25% of visible surface
   - **'medium'**: 25-40% of visible surface
   - **'heavy'**: >40% of visible surface
   - **'none'**: Not present

**GROUPING:**
Apply the same shape-based grouping rules as main_toppers. For each group, include:
- type: material classification
- description: "[description of element group] located at [specific location on cake]"
- coverage: 'light', 'medium', 'heavy', or 'none'
- group_id: same ID for this shape family
- color: (optional) The single, dominant color hex code from the Color Palette if clearly identifiable. Omit for multi-colored items.

5. **cake_messages** (array):
   
   For each distinct message on the cake, create a separate object. If no message, return an empty array.
   
   **MESSAGE TYPE CLASSIFICATION:**
   - **'gumpaste_letters'**: Individual cut letters made from gumpaste/fondant
   - **'icing_script'**: Text piped directly with icing
   - **'printout'**: Printed text on paper/card - usually has multiple colors (font color different from stroke)
   - **'cardstock'**: Thick paper/glitter/metallic text - has ONE uniform color only. Must meet ≥2 cardstock cues (visible thickness, real glitter, metallic luster)
   
   For each message, record:
   - type (from above)
   - text content (actual words/numbers visible)
   - position (top/side/base_board)
   - color (using closest hex from Color Palette)

6. **icing_design**:
   
   **FONDANT VS SOFT ICING IDENTIFICATION:**
   
   **SOFT ICING (boiled/marshmallow icing):**
   - Surface: Creamy, soft, slightly uneven - shows swirls, ruffles, dollops, or natural imperfections
   - Shine: Slight glossy sheen from boiled sugar
   - Borders: Often piped with rosettes, ruffles, or dollops
   - Structure: Rarely perfectly smooth sides or razor-sharp edges
   
   **FONDANT:**
   - Surface: Very smooth and uniform, matte or satin-like finish, no visible cream texture
   - Edges: Modern style → very sharp edges; Classic style → curved/rounded edges
   - Decorations: Flat cutouts, embossed patterns, sugar figures, shaped toppers
   - Key indicator: If surface looks like a "sheet covering" the cake → Fondant
   
   **DISAMBIGUATION RULE:**
   - Curved edge + smooth sheet surface → Fondant (very likely)
   - Sharp edge → Check surface texture:
     * If plasticky, sheet-like, uniform → Fondant
     * If creamy, fluffy, textured, piped → Soft icing

   **Structure:**
   - **Base**: soft_icing or fondant (use identification rules above)
   - **Color Type**: single, gradient_2, gradient_3, abstract
   - **Colors**: Object with hex codes. For each visible colored part, find CLOSEST MATCH from Color Palette. Include keys as applicable: "side", "top", "borderTop", "borderBase", "drip", "gumpasteBaseBoardColor"
   - **Features**:
     * **'drip'**: true if drip effect clearly visible (physical flow from top rim with rounded ends), otherwise false
     * **'border_top'**: true if decorative border exists at top edge
     * **'border_base'**: true if decorative border exists at base
     * **'gumpasteBaseBoard'**: true if cake board covered in fondant/gumpaste, otherwise false

**FINAL GROUPING RULES:**
- Group identical/similar items as one entry with shared group_id
- Use coverage terms for scattered items (chocolates, sprinkles, dragees)
- Combine side decorations as "panel" or "scene" work
- Focus on what customers would customize (not every tiny detail)
- Always note material type and visual prominence (main vs support)

**FINAL JSON VALIDATION:** Before you output, double-check your entire response. It MUST be a single valid JSON object. If the image was accepted, ensure ALL SIX of the required top-level keys ('cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design') are present in your JSON output.
`;

const hybridAnalysisResponseSchema = {
    type: Type.OBJECT,
    properties: {
        main_toppers: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['edible_3d', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo', 'edible_2d_gumpaste'] },
                    description: { type: Type.STRING },
                    size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'partial'] },
                    quantity: { type: Type.INTEGER },
                    group_id: { type: Type.STRING },
                    classification: { type: Type.STRING, enum: ['hero', 'support'] },
                    color: { type: Type.STRING }
                },
                required: ['type', 'description', 'size', 'quantity', 'group_id', 'classification']
            }
        },
        support_elements: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['gumpaste_panel', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'small_gumpaste', 'dragees', 'edible_flowers', 'edible_photo_side'] },
                    description: { type: Type.STRING },
                    coverage: { type: Type.STRING, enum: ['light', 'medium', 'heavy', 'none'] },
                    group_id: { type: Type.STRING },
                    color: { type: Type.STRING }
                },
                required: ['type', 'description', 'coverage', 'group_id']
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
                    color: { type: Type.STRING }
                },
                required: ['type', 'text', 'position', 'color']
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
    },
    required: ['cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
};

export const analyzeCakeImage = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                ],
            }],
            config: {
                systemInstruction: NEW_HYBRID_PROMPT,
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema,
                temperature: 0.1,
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


export const EDIT_CAKE_PROMPT_TEMPLATE = (
    originalAnalysis: HybridAnalysisResult | null,
    newCakeInfo: CakeInfoUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    additionalInstructions: string
): string => {
    if (!originalAnalysis) return ""; // Guard clause

    const isThreeTierReconstruction = newCakeInfo.type !== originalAnalysis.cakeType && newCakeInfo.type.includes('3 Tier');

    const colorName = (hex: string | undefined) => {
        if (!hex) return 'not specified';
        const foundColor = COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
        return foundColor ? `${foundColor.name} (${hex})` : hex;
    };

    let prompt: string;

    if (isThreeTierReconstruction) {
        prompt = `You are a master digital cake artist tasked with reconstructing a cake design into a new 3-tier structure. You will be given an original cake image for its design language and a reference image for the 3-tier structure.

---
### **Core Reconstruction Principles (VERY IMPORTANT)**
---
1.  **Reconstruct Proportionally:** Rebuild the cake with a 3-tier count, distributing height and width realistically. The final structure and proportions MUST strictly follow the provided plain white 3-tier reference image. Maintain the original cake’s visual proportions if possible (e.g., if it was tall and narrow, keep that ratio across the new tiers).
2.  **Preserve Design Language, Not Layout:** Your primary task is to harvest the colors, textures, icing style, and decorative motifs from the original cake and apply them to the new 3-tier structure.
3.  **Redistribute Decorations Logically:**
    - Main toppers go on the top tier.
    - Side decorations (e.g., florals, lace) should appear on all tiers or follow a cascading pattern.
    - Cake messages should remain readable and be centered on an appropriate tier.
4.  **Maintain Theme & Style Consistency:** If the original had a drip effect, apply it to all tiers consistently. If it used gold leaf, fresh flowers, or geometric patterns, replicate that aesthetic across the new structure.
5.  **Do NOT Preserve Spatial Layout:** It is expected that elements will move to fit the new tier structure. The goal is stylistic continuity, not pixel-perfect replication of element positions.

---
### **List of Changes to Apply to the New 3-Tier Structure**
---
`;
    } else {
        prompt = `You are a master digital cake artist performing a precise photo edit on the provided cake image. Your goal is to preserve the original image's style, lighting, and composition, applying ONLY the specific changes listed below.

---
### **Core Editing Principles (VERY IMPORTANT)**
---
1.  **Layer-Based Editing:** Imagine you are working in a photo editor with layers. Your changes must be applied as non-destructive layers on top of the original image features.
2.  **Modification, Not Replacement:** When asked to change a color (e.g., "Change the side icing to blue"), your task is to **recolor the existing surface** while preserving all decorations, textures, and details on that surface. You are NOT replacing the entire area with a plain blue color.
3.  **Realistic Interaction:** When adding an element like a drip, it must interact realistically with existing decorations. The drip should flow **around or partially over** decorations on the side of the cake, not completely erase them. The original decorations must remain visible and integrated with the new element.
4.  **Preserve Unmentioned Details:** If a decoration or feature from the original image is not explicitly mentioned as changed or removed in the list below, it MUST be preserved exactly as it is.

---
### **List of Changes to Apply**
---
`;
    }

    const changes: string[] = [];

    // 1. Core Structure Changes
    if (newCakeInfo.type !== originalAnalysis.cakeType) {
        if (isThreeTierReconstruction) {
            changes.push(`- **Reconstruct the cake** from its original "${originalAnalysis.cakeType}" form into a new "${newCakeInfo.type}" structure based on the provided reference image.`);
        } else {
            let typeChangeInstruction = `- **Change the cake type** from "${originalAnalysis.cakeType}" to "${newCakeInfo.type}".`;
            if (newCakeInfo.type.includes('2 Tier')) {
                typeChangeInstruction += ' This means the cake must be rendered with two distinct levels (tiers) stacked vertically.';
            }
            changes.push(typeChangeInstruction);
        }
    }
    if (newCakeInfo.thickness !== originalAnalysis.cakeThickness) {
        changes.push(`- **Change the cake thickness** to "${newCakeInfo.thickness}".`);
    }

    // A more descriptive size instruction for multi-tier cakes.
    const tiers = newCakeInfo.size.match(/\d+"/g); // e.g., ["6\"", "8\"", "10\""]
    if ((newCakeInfo.type.includes('2 Tier')) && tiers && tiers.length === 2) {
        changes.push(`- The final **cake size** represents a 2-tier structure: a ${tiers[0]} diameter top tier stacked on a ${tiers[1]} diameter bottom tier.`);
    } else if ((newCakeInfo.type.includes('3 Tier')) && tiers && tiers.length === 3) {
        changes.push(`- The final **cake size** represents a 3-tier structure: a ${tiers[0]} diameter top tier, an ${tiers[1]} diameter middle tier, and a ${tiers[2]} diameter bottom tier.`);
    } else {
        changes.push(`- The final **cake size** must be "${newCakeInfo.size}".`);
    }

    // 2. Topper Changes
    mainToppers.forEach(t => {
        if (!t.isEnabled) {
            changes.push(`- **Remove the main topper** described as: "${t.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (t.type !== t.original_type) {
                itemChanges.push(`change its material to **${t.type}**`);
            }
            if (t.replacementImage) {
                 itemChanges.push(`replace its image with the new one provided`);
            }
            if (t.color && t.original_color && t.color !== t.original_color) {
                itemChanges.push(`recolor it to **${colorName(t.color)}**`);
            }

            if (itemChanges.length > 0) {
                 changes.push(`- For the main topper "${t.description}": ${itemChanges.join(' and ')}.`);
            }
        }
    });

    // 3. Support Element Changes
    supportElements.forEach(s => {
        if (!s.isEnabled) {
            changes.push(`- **Remove the support element** described as: "${s.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (s.type !== s.original_type) {
                itemChanges.push(`change its material to **${s.type}**`);
            }
            if (s.replacementImage) {
                itemChanges.push(`replace its image with the new one provided`);
            }
            if (s.color && s.original_color && s.color !== s.original_color) {
                itemChanges.push(`recolor it to **${colorName(s.color)}**`);
            }
            
            if (itemChanges.length > 0) {
                 changes.push(`- For the support element "${s.description}": ${itemChanges.join(' and ')}.`);
            }
        }
    });


    // 4. Icing Design Changes
    const icingChanges: string[] = [];
    const originalIcing = originalAnalysis.icing_design;
    const newIcing = icingDesign;

    if (newIcing.base !== originalIcing.base) {
        icingChanges.push(`- **Change the base icing** to be **${newIcing.base}**.`);
    }

    // Handle Drip
    if (newIcing.drip && !originalIcing.drip) {
        let instruction = `- **Add a drip effect**. The drip should flow naturally from the top edge and interact realistically with any existing side decorations, flowing around them, not erasing them.`;
        if (newIcing.colors.drip) {
            instruction += ` The DRIP color should be **${colorName(newIcing.colors.drip)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.drip && originalIcing.drip) {
        icingChanges.push(`- **Remove the drip effect**.`);
    } else if (newIcing.drip && originalIcing.drip && newIcing.colors.drip !== originalIcing.colors.drip) {
        icingChanges.push(`- **Recolor the drip**. The new DRIP color should be **${colorName(newIcing.colors.drip!)}**. Preserve all other details.`);
    }

    // Handle Top Border
    if (newIcing.border_top && !originalIcing.border_top) {
        let instruction = `- **Add a decorative top border**.`;
        if (newIcing.colors.borderTop) {
            instruction += ` The TOP border color should be **${colorName(newIcing.colors.borderTop)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.border_top && originalIcing.border_top) {
        icingChanges.push(`- **Remove the top border**.`);
    } else if (newIcing.border_top && originalIcing.border_top && newIcing.colors.borderTop !== originalIcing.colors.borderTop) {
        icingChanges.push(`- **Recolor the top border**. The new TOP border color should be **${colorName(newIcing.colors.borderTop!)}**. Preserve all other details.`);
    }
    
    // Handle Base Border
    if (newIcing.border_base && !originalIcing.border_base) {
        let instruction = `- **Add a decorative base border**.`;
        if (newIcing.colors.borderBase) {
            instruction += ` The BASE border color should be **${colorName(newIcing.colors.borderBase)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.border_base && originalIcing.border_base) {
        icingChanges.push(`- **Remove the base border**.`);
    } else if (newIcing.border_base && originalIcing.border_base && newIcing.colors.borderBase !== originalIcing.colors.borderBase) {
        icingChanges.push(`- **Recolor the base border**. The new BASE border color should be **${colorName(newIcing.colors.borderBase!)}**. Preserve all other details.`);
    }

    // Handle Gumpaste Base Board
    if (newIcing.gumpasteBaseBoard && !originalIcing.gumpasteBaseBoard) {
        let instruction = `- **Add a round gumpaste-covered base board**. Preserve any existing decorations on the base area.(White base is not a decoration and is ok not to be preserved when changing from 1 tier to 2 tier or 1 tier to 3 tier.).`;
        if (newIcing.colors.gumpasteBaseBoardColor) {
            instruction += ` The BASE BOARD color should be **${colorName(newIcing.colors.gumpasteBaseBoardColor)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard) {
        icingChanges.push(`- **Remove the gumpaste-covered base board**.`);
    } else if (newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard && newIcing.colors.gumpasteBaseBoardColor !== originalIcing.colors.gumpasteBaseBoardColor) {
        icingChanges.push(`- **Recolor the gumpaste base board**. The new BASE BOARD color should be **${colorName(newIcing.colors.gumpasteBaseBoardColor!)}**. Preserve all other details.`);
    }

    // Handle core icing colors (side, top) which are always present
    const originalIcingColors = originalIcing.colors;
    if (newIcing.colors.side !== undefined && newIcing.colors.side !== originalIcingColors.side) {
        icingChanges.push(`- **Recolor the side icing**. The new SIDE icing color should be **${colorName(newIcing.colors.side)}**. Important: This is a color change only. All original decorations, patterns, or details on this surface must be preserved and remain visible.`);
    }
    if (newIcing.colors.top !== undefined && newIcing.colors.top !== originalIcingColors.top) {
        icingChanges.push(`- **Recolor the top icing**. The new TOP icing color should be **${colorName(newIcing.colors.top)}**. Important: This is a color change only. All original decorations, patterns, or details on this surface must be preserved and remain visible.`);
    }

    changes.push(...icingChanges);


    // 5. Cake Message Changes (more specific and robust)
    const messageChanges: string[] = [];
    const originalMessages = originalAnalysis.cake_messages || [];
    const currentUIMessages = cakeMessages;

    // Process original messages to see if they were kept, modified, or removed.
    originalMessages.forEach(originalMsg => {
        // Find the UI representation of this original message.
        const correspondingUIMsg = currentUIMessages.find(uiMsg => {
            if (!uiMsg.originalMessage) return false;
            const o = uiMsg.originalMessage;
            return o.text === originalMsg.text &&
                   o.position === originalMsg.position &&
                   o.type === originalMsg.type &&
                   o.color === originalMsg.color;
        });

        if (!correspondingUIMsg || !correspondingUIMsg.isEnabled) {
            // Case 1: Message was removed (deleted from UI or toggled off).
            messageChanges.push(`- **Erase the text** that says "${originalMsg.text}" from the cake's **${originalMsg.position}**. The area should be clean as if the text was never there.`);
        } else {
            // Case 2: Message exists and is enabled. Check for modifications.
            const uiMsg = correspondingUIMsg;
            const changesInMessage = [];
            if (uiMsg.text !== originalMsg.text) {
                changesInMessage.push(`change the text from "${originalMsg.text}" to "${uiMsg.text}"`);
            }
            if (uiMsg.color !== originalMsg.color) {
                changesInMessage.push(`change the color to ${colorName(uiMsg.color)}`);
            }
            if (uiMsg.position !== originalMsg.position) {
                changesInMessage.push(`move it from the ${originalMsg.position} to the ${uiMsg.position}`);
            }
            if (uiMsg.type !== originalMsg.type) {
                changesInMessage.push(`change the style to ${uiMsg.type}`);
            }
            
            if (changesInMessage.length > 0) {
                messageChanges.push(`- Regarding the message on the **${originalMsg.position}** that originally said "${originalMsg.text}", please ${changesInMessage.join(' and ')}.`);
            }
        }
    });

    // Process new messages (those in UI state without an originalMessage).
    currentUIMessages.forEach(uiMsg => {
        if (uiMsg.isEnabled && !uiMsg.originalMessage) {
            // Case 3: A new message was added.
            messageChanges.push(`- **Add new text**: Write "${uiMsg.text}" on the **${uiMsg.position}** using ${uiMsg.type} style in the color ${colorName(uiMsg.color)}.`);
        }
    });

    // Add unique changes to the main prompt changes list.
    if (messageChanges.length > 0) {
        changes.push(...[...new Set(messageChanges)]);
    }

    // 6. Bento-specific instruction
    if (newCakeInfo.type === 'Bento') {
        changes.push(`- **Bento Box Presentation:** The final image MUST show the cake placed inside a classic, open, light brown clamshell bento box. The box should be visible around the base of the cake, framing it.`);
    }

    // 7. Additional Instructions
    if (additionalInstructions.trim()) {
        changes.push(`- **Special Instructions:** ${additionalInstructions.trim()}`);
    }

    // Assemble the final prompt
    if (changes.length > 0) {
        prompt += changes.join('\n');
    } else {
        prompt += "- No changes were requested. The image should remain exactly the same.";
    }
    
    let finalReminder: string;
    if (isThreeTierReconstruction) {
        finalReminder = `---
**Final Reminder:** Reconstruct the cake structure while faithfully preserving the original design language, color palette, and decorative theme. Do not attempt to keep elements in their original positions—redistribute them naturally across the new tier configuration.`;
    } else {
        finalReminder = `---
**Final Reminder:** Adhere strictly to the Core Editing Principles. You are ONLY editing the provided image based on the specific changes listed above. All other features, decorations, lighting, and style must be perfectly preserved from the original.`;
    }

    prompt += `\n\n${finalReminder}`;
    
    return prompt;
};


export const editCakeImage = async (
    prompt: string,
    originalImage: { data: string; mimeType: string; },
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    threeTierReferenceImage: { data: string; mimeType: string; } | null
): Promise<string> => {

    const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];

    // 1. Original Image (Source for style)
    parts.push({ inlineData: { mimeType: originalImage.mimeType, data: originalImage.data } });

    // 2. Reference Image (Source for structure, if provided)
    if (threeTierReferenceImage) {
        parts.push({ inlineData: { mimeType: threeTierReferenceImage.mimeType, data: threeTierReferenceImage.data } });
    }
    
    // 3. Replacement images for printouts and edible photos (main toppers)
    mainToppers.forEach(topper => {
        if (topper.isEnabled && (topper.type === 'printout' || topper.type === 'edible_photo') && topper.replacementImage) {
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [{ parts }],
            config: {
                responseModalities: [Modality.IMAGE],
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
