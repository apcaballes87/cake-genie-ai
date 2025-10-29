import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    throw new Error("VITE_GEMINI_API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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

Based on the image, classify it into ONE of the following categories:

- "valid_single_cake": A single, clear image of one cake. It can be a bento, 1-3 tier, square, rectangle, or fondant cake. Cupcakes may be present on the side, but the main focus is a single cake.
- "not_a_cake": The image does not contain a cake. It might be a person, object, or scene that isn't cake-like.
- "multiple_cakes": The image clearly shows two or more separate cakes of significant size (not including a main cake with cupcakes).
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
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                ],
            }],
            config: {
                systemInstruction: VALIDATION_PROMPT,
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

const NEW_HYBRID_PROMPT = `You are an expert cake designer analyzing a cake image to identify design elements for pricing and customization. Your response must be a valid JSON object.

**OBJECTIVE TOPPER SIZING SYSTEM**
Use ratio-based size classification for all physical toppers (e.g., 'edible_3d', 'toy', 'figurine', 'cardstock', 'meringue_pop'):

MEASUREMENT PROTOCOL:
1. Establish the cake tier thickness (2-6 inches)
2. Estimate topper height relative to tier thickness
3. Apply ratio classification:
   - **'large'**: Height > 1.0× tier thickness
   - **'medium'**: Height > 0.6× and ≤ 1.0× tier thickness
   - **'small'**: Height > 0.4× and ≤ 0.6× tier thickness
   - **'tiny'**: Height ≤ 0.4× tier thickness

SPECIAL CASES:
- For horizontal/lying toppers: use longest dimension instead of height
- For printout toppers: SKIP sizing (always note as printout, size not relevant)
- When tier thickness is uncertain, default to 4 inches for calculations
- When borderline between sizes, round DOWN to smaller category

**Color Palette:** For any color field in your response (like icing or message colors), you MUST use the closest matching hex code from this specific list: Red (#EF4444), Light Red (#FCA5A5), Orange (#F97316), Yellow (#EAB308), Green (#16A34A), Light Green (#4ADE80), Teal (#14B8A6), Blue (#3B82F6), Light Blue (#93C5FD), Purple (#8B5CF6), Light Purple (#C4B5FD), Pink (#EC4899), Light Pink (#FBCFE8), Brown (#78350F), Light Brown (#B45309), Gray (#64748B), White (#FFFFFF), Black (#000000).

**CRITICAL RULE: ICING DECORATION IDENTIFICATION**
- **Simple piped icing** (swirls, rosettes, ruffles, shell borders) are part of the fundamental icing design and MUST NOT be listed in 'main_toppers' or 'support_elements'. They are not add-ons.
- **Complex icing techniques**, however, ARE considered add-ons. You MUST identify and list them. These include:
  - **Doodles:** Piped line-art drawings or intricate patterns. Note in the description if they are 'simple' or 'intricate'.
  - **Palette Knife Finish:** Distinct, textured strokes made with a palette knife.
  - **Brush Stroke Icing:** Visible strokes made with a brush.
  - **Splatter Finish:** A speckled or splattered color effect on icing.
  - **Minimalist Spread:** A rough, intentionally rustic or unfinished-looking spread of icing.

Now, analyze the image and provide a JSON object with these 6 categories:

1. **cakeType**: Choose the best fit from this list: 1 Tier, 2 Tier, 3 Tier, 1 Tier Fondant, 2 Tier Fondant, 3 Tier Fondant, Square, Rectangle, Bento. 
   
   **TIER RECOGNITION GUARDRAILS:**
   - Default to "1 Tier" unless there is CLEAR physical separation between tiers:
     * A distinct second cake body with its own vertical side and top plane
     * Shadow line and diameter change visible; top tier's base is flat and not just a piped crown
     * Top décor resting on a same-diameter top (NOT just a mound of piping)
   - Do NOT count dense top piping crowns or large 3D toppers as a second tier
   - Top-view photos: use side cues (shadows, board edge, visible side height) before claiming multiple tiers
   
   **Bento Definition:** A "Bento" cake is a small, personal-sized cake, typically 4 inches in diameter and 2 inches thick, often packaged in a clamshell box.

2. **cakeThickness**: Choose the best fit from this list: 2 in, 3 in, 4 in, 5 in, 6 in.
   
   **THICKNESS HEURISTICS:**
   - Bento: 2–3 in
   - Standard single tier: 4 in (most common)
   - Tall/double-barrel look: 6 in (or 5 in when clearly taller than standard but not double)
   - Small but not bento: 3 in
   - If uncertain: default to 4 in

3. **main_toppers** (focal points on top/prominent on cake):
   
   **CRITICAL DECISION FRAMEWORKS (APPLY IN ORDER):**

    **ICING PALETTE KNIFE / SPATULA PAINTING IDENTIFICATION (APPLY FIRST):**
    - Identify textured "swooshes," "swipes," or "smears" of colored icing.
    - If these are the primary decoration on the **top surface** of the cake, classify it as a 'main_topper' with type 'icing_palette_knife'.
    - Use 'size' to describe the coverage on the top surface: 'small' for accent, 'medium' for partial, 'large' for full coverage.
    - **CRITICAL:** Assess the complexity. Describe it as either "Intricate Palette Knife Finish" or "Simple Palette Knife Finish". A design is 'intricate' if it involves multiple layers, complex color blending, or forms a detailed abstract picture. It is 'simple' if it consists of basic, separate swooshes.
    - For this type, you MUST identify up to 3 dominant colors present in the strokes and return them as an array in a 'colors' field (e.g., "colors": ["#EC4899", "#FFFFFF", "#FBCFE8"]). Do not use the singular 'color' field for this type.
   
    **SPHERICAL TOPPER CLASSIFICATION (APPLY SECOND):**
    You MUST correctly classify all spherical or ball-shaped toppers to ensure correct pricing. This rule has high priority.

    **Identification Cues:** Look for any decorative item that is primarily a sphere or ball.
    
    **Classification Logic (Strictly follow this order):**
    1.  **Is it very small and scattered in large numbers?**
        - If YES, and it has a pearlescent/metallic sheen -> Classify as a \`support_element\` with type \`dragees\`.
        - If YES, and it's like tiny candy dots -> Classify as a \`support_element\` with type \`sprinkles\`.
    2.  **Does it look like a chocolate?** (e.g., Ferrero Rocher, malt ball, chocolate truffle)
        - If YES -> Classify as a \`support_element\` with type \`chocolates\`. Describe it as "chocolate balls" or by brand name.
    3.  **For ALL OTHER SPHERES/BALLS:**
        - You MUST classify them as a \`main_topper\` with the type \`plastic_ball\`.
        - **This applies even if they look like they are made of gumpaste, fondant, or other edible materials.** This is a pricing override rule. Unless it is clearly a tiny sprinkle/dragee or a chocolate, any decorative sphere is priced as a \`plastic_ball\`.
        - **Description:** The description MUST include "sphere" or "ball" and the color if applicable (e.g., "3 large brown spheres", "5 small silver balls"). Do not describe them as "gumpaste spheres".
    
    **CRITICAL RULE:** This rule overrides all other material analysis for spherical toppers. Do NOT classify decorative spheres as \`edible_3d\` unless they are part of a more complex sculpture (e.g., the head of a snowman figure). If they are just standalone spheres, they are \`plastic_ball\`.

   **CONCEPTUAL TOPPER GUIDE (Use this for high-level understanding):**

    🍰 **Cake Topper Guide: What Type Is It?**
    Not sure if your topper is a toy, figurine, edible sculpture, or printout?
    Look at these 4 key clues — shape, texture, material, and purpose — to tell them apart!

    🍓 **1. 3D Edible (Gumpaste/Fondant) — “Eat Me!”**
    Hand-sculpted sugar art — soft, detailed, and meant to be eaten with the cake. 

    🔹 **How It Looks:**
    Soft, matte finish — like clay or dough
    Slightly uneven edges (handmade!)
    Often painted with food-safe colors
    No plastic shine or printed lines
    🔹 **Texture Clue:** Feels like soft modeling paste — not hard or glossy

    🔹 **Ask Yourself:**
    “Can I eat this?” → If YES → It’s 3D Edible 

    🧸 **2. Toy Toppers — “Play With Me!”**
    Plastic characters from movies or toy lines — fun, colorful, and perfect for kids’ parties. 

    🔹 **How It Looks:**
    Hard plastic or PVC — shiny, molded, lightweight
    Glossy finish, bright colors, cartoonish style
    Often has small white plastic base or stand
    May have visible seams or injection molding lines
    🔹 **Texture Clue:** Feels like a plastic action figure — smooth but rigid

    🔹 **Ask Yourself:**
    “Would a kid play with this after the party?” → If YES → It’s a Toy 

    ✅ **Examples:** construction trucks, action figures

    🎭 **3. Figurine Toppers — “Display Me!”**
    Decorative collectibles — elegant, detailed, and often sentimental (like wedding couples). 

    🔹 **How It Looks:**
    Made of resin, ceramic, or porcelain — smooth, heavy, often matte or satin
    not so detailed: sometimes poorly painted,  facial expressions not clear, details are not clear.
    May be hand-painted or airbrushed — not just printed
    Often includes  weighted bases
    🔹 **Texture Clue:** Feels solid, weighty, and refined — like a mini statue

    🔹 **Ask Yourself:**
    “Would I keep this on my shelf as a keepsake?” → If YES → It’s a Figurine 

    ✅ **Examples:** Bride & groom, Frozen resin characters, breakable fragile figurines

    🖨️ **4. Printout Toppers — “Peel & Stick Me!”**
    Flat, printed images on paper, cardstock, or edible icing — easy, affordable, and great for quick decoration. 

    🔹 **How It Looks:**
    Flat, 2D cutouts — sharp edges, glossy or matte finish
    Printed with vibrant colors — looks like a photo or poster
    Attached to thin sticks (food-safe picks)
    has a white outline.
    May include text, numbers, banners, or scenes
    🔹 **Texture Clue:** Feels like paper or thin plastic — flat and flexible

    🔹 **Ask Yourself:**
    “Is this a flat picture on a stick?” → If YES → It’s a Printout 

    ✅ **Examples:** Barbie cutouts, Frozen banner, princess castle printed with white outlines.

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
   - **Is a well-known licensed character** (e.g., from Disney, Marvel, Nintendo like Mickey Mouse, Spider-Man, Mario). These are almost always commercially produced toys.
   - True 3D volume with parallax effect from different angles
   - Glossy plastic specular highlights that "travel" smoothly
   - Visible injection mold seams/marks
   - Factory-made base or stand
   - Thick, rounded edges typical of molded plastic
   - Printed licensing text under feet/base
   - Uniform factory-made appearance
   
   **BABY FIGURINE OVERRIDE:** Realistic proportioned baby + glossy/hard finish → TOY/figurine (classify as toy regardless of other cues)

   **T3) EDIBLE 3D & 2D CHECK:** 
   
   **2D vs 3D Gumpaste Distinction (CRITICAL):**
   - **CRITICAL OVERRIDE FOR NUMBERS & LETTERS:** If the primary subject of a topper is a number or a letter, you MUST classify it as **'edible_2d_gumpaste'**, even if it appears thick, sculpted, or is described as '3D'. This is a pricing rule to ensure all standalone numbers and letters are categorized correctly.
   - For all other items, if a gumpaste item is flat with minimal thickness (like a cutout), you MUST classify it as **'edible_2d_gumpaste'**. Examples include flat snowflakes, or leaves. 
   - If it has significant depth and sculpted volume (like a figurine), you MUST classify it as **'edible_3d'**. This rule applies to both main toppers and support elements.
   
   A topper is 'edible_3d' if it has **2 or more** of these cues:
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
   - **'plastic_ball'**: Non-edible plastic spheres, including disco balls and solid color balls.
   - **'edible_2d_gumpaste'**: Flat, cut-out shapes made from hardened sugar paste
   - **'cardstock'**: Stiff colored paper (glitter, metallic) - NOT printed. Must have ≥2 cues: visible edge thickness/layers, real glitter granules, or mirror-foil highlights
   - **'edible_photo'**: Photo printed on edible sheet applied seamlessly to icing
   - **'icing_doodle'**: Complex piped line-art or drawings.
   - **'icing_palette_knife'**: Textured icing applied with a palette knife.
   - **'icing_brush_stroke'**: Visible icing strokes made with a brush.
   - **'icing_splatter'**: Speckled or splattered color effect on icing.
   - **'icing_minimalist_spread'**: Intentionally rough or rustic icing spread.
   - **'meringue_pop'**: Piped icing swirls standing on sticks.

   **IMPORTANT EXCLUSIONS:**
   - Decorations made directly from simple piped icing (swirls, rosettes, dollops) are NOT main toppers
   - Simple piping and sprinkles are not toppers

    **GROUPING RULES:**

**UNICORN SET GROUPING (HIGHEST PRIORITY):**
If you identify a unicorn horn and two matching ears on top of the cake, you MUST group them as a single main topper.
- **Description:** "1 Unicorn horn & ears set"
- **Type:** 'edible_3d' (or 'cardstock' if applicable)
- **Quantity:** 1
- **Size:** 'medium' (this is the typical size for this set)
- **Classification:** 'hero'
- This rule overrides all other shape-based grouping rules for these specific items. Do not list the horn and ears separately.

**MERINGUE POP / ICING LOLLIPOP IDENTIFICATION (CRITICAL RULE):**
You MUST identify piped icing swirls that are standing upright on sticks. These are called 'meringue pops' or 'icing lollipops' and are priced add-ons.
- **Identification Cues:** Look for distinct, piped icing rosettes or swirls that have a visible stick or lollipop stick inserted at the base, making them stand up from the cake surface. They often appear in groups.
- **Classification:** If you identify these, you MUST list them as a \`main_topper\` with the type \`meringue_pop\`.
- **Description:** The description should be "Meringue Pop" or "Icing Lollipop".
- **Quantity:** Count each individual pop.
- **Size:** Use the standard sizing system ('small', 'medium', 'large').
- **CRITICAL DISTINCTION:** If you see similar piped swirls or rosettes directly on the cake surface *without a stick*, they are considered part of the basic icing design and MUST NOT be listed as a topper. The presence of a stick is the only thing that makes it a \`meringue_pop\`.

**SHAPE-BASED GROUPING (Standard Rule):**
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
- description: "[quantity] [shape] ([size/classification details if varied])"
- size: if all same size use that; if mixed use "mixed" and detail in description
- quantity: total count in group
- group_id: same ID for this shape family
- classification: if mixed, note "hero + support" or detail in description

**Examples:**
{
  "type": "edible_3d",
  "description": "7 gumpaste stars: 2 large red (hero), 3 medium blue (hero), 2 small yellow (support)",
  "size": "mixed",
  "quantity": 7,
  "group_id": "stars_01",
  "classification": "hero + support"
}
   
4. **support_elements** (decorative, not focal):

    **DOTS IDENTIFICATION:** If you identify simple, small gumpaste dots (not sprinkles/dragees), they MUST be classified as a \`support_element\`. You MUST include the word "dots" in the description (e.g., "small gumpaste dots"). These are considered a free, simple decoration.

    **SCATTERED ELEMENTS RULE:** For small, numerous, flat decorative items (like gumpaste confetti, tiny stars, or snowflakes scattered across the cake), you should prefer classifying them as a single **'support_element'** with type **'edible_2d_gumpaste'**. Assess their overall **coverage** ('light', 'medium', 'heavy') rather than listing them as individual 'main_toppers' with a quantity.

    **ICING PALETTE KNIFE / SPATULA PAINTING IDENTIFICATION (APPLY FIRST):**
    - Identify textured "swooshes," "swipes," or "smears" of colored icing.
    - If these are on the **sides of the cake**, classify it as a 'support_element' with type 'icing_palette_knife'.
    - **CRITICAL:** Assess the complexity. Describe it as either "Intricate Palette Knife Finish" or "Simple Palette Knife Finish". A design is 'intricate' if it involves multiple layers, complex color blending, or forms a detailed abstract picture. It is 'simple' if it consists of basic, separate swooshes.
    - For this type, you MUST identify up to 3 dominant colors present in the strokes and return them as an array in a 'colors' field (e.g., "colors": ["#EC4899", "#FFFFFF", "#FBCFE8"]). Do not use the singular 'color' field for this type.

    **SIMPLE PRINTOUT PRIORITY RULE (APPLY SECOND):**
    If a printed element on the side/front of the cake is a **small logo, brand name, or consists of only 1-3 characters/symbols**, you MUST classify it as a **'support_printout'**. This is considered a simple accent, not a decorative wrap. This rule overrides the 'edible_photo_side' classification for these specific cases, even if the print quality is high and it appears seamless.

    **EDIBLE PHOTO WRAP VS. SUPPORT PRINTOUT DECISION RULE (APPLY FOURTH):**
    You MUST correctly distinguish between an edible photo wrap/panel applied to the side of the cake and a simple non-edible printout stuck to the side.

    - **Classify as 'edible_photo_side'** if the decoration meets **TWO or more** of these criteria:
      - **Seamless Appearance:** The image looks fully integrated with the icing, with no visible gap or shadow indicating it's a separate object.
      - **Conforms Perfectly:** It follows the curve of the cake flawlessly.
      - **Ultra-Thin Edges:** The edges appear to melt into the icing and are not visibly thick like paper.
      - **Continuous Wrap:** The image wraps partially or fully around the cake in a continuous sheet.

    - **Classify as 'support_printout'** if the decoration meets **TWO or more** of these criteria:
      - **Visible Edge Thickness:** You can perceive the thickness of paper or cardstock (0.2mm or more).
      - **Stands Off Surface:** It looks like a separate object placed *on* the cake, with a slight shadow behind it.
      - **Rigid Shape:** It doesn't perfectly follow the cake's curve.
      - **White Cut Edge:** A thin white border is visible around the image.

    **STRICT RULE:** If an image on the side of the cake looks like a flat cutout with visible edges, it is 'support_printout'. If it looks like it's printed *onto* the icing, it is 'edible_photo_side'.
   
   Identify each support element and classify its material:
   
   - **'gumpaste_panel'**: Significant side decoration made from flat gumpaste pieces forming a scene or pattern. Examples: camo patches, stripes, cloud blobs, silhouettes, badges, top flat discs/panels
   
   - **'edible_2d_gumpaste'**: Flat, 2D cut-out shapes made from hardened sugar paste, often used as scattered decorations (like snowflakes, leaves, or confetti).

   - **'small_gumpaste'**: Smaller individual gumpaste items like stars, flowers, or dots that are not the main focus
   
   - **'chocolates'**: Chocolate bars, spheres, drips, or shards used decoratively
     * **For expensive chocolates** (Ferrero, Kinder, Cadbury, Snickers, KitKat): note as premium
     * **For cheap/generic chocolates** (Oreos, Kisses): note as standard
     * **M&M chocolates**: specify as M&Ms
   
   - **'sprinkles'**: Tiny decorative particles like nonpareils, jimmies, or edible glitter
   
   - **'dragees'**: Sugar pearls/dragees - use the decision rule above.
   
   - **'support_printout'**: Smaller printed images used as background or secondary decoration
   
   - **'isomalt'**: Hard, clear or colored sugar work creating glass-like or gemstone effect (e.g., 'sail', 'shards', translucent lollipops)
   
   - **'edible_flowers'**: Sugar flowers - count as cohesive clusters. Note if flowers appear to be real/fresh (for substitution recommendation)

   **COVERAGE CLASSIFICATION:**
   - **'light'**: <25% of visible surface
   - **'medium'**: 25-40% of visible surface
   - **'heavy'**: >40% of visible surface
   - **'none'**: Not present

**GROUPING:**
Apply the same shape-based grouping rules as main_toppers:
- Group by PRIMARY SHAPE regardless of color, size, or material variations
- Example: red star sprinkles + gold star dragees = 1 star group
- For support elements, also include **coverage** assessment (light/medium/heavy/none)
- Format: type, description (with shape + variations), coverage, quantity, group_id

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
   
   **FONDANT VS SOFT ICING IDENTIFICATION (REINFORCED RULE):**
   The primary visual cue for differentiation is the sharpness of the cake's edges.

   **SOFT ICING (boiled/marshmallow icing):**
   - **Edges (Primary Identifier):** The key characteristic of this style is **razor-sharp edges** and perfectly smooth, straight sides. If you see sharp, clean corners on the top edge of the cake, it is almost certainly soft icing.
   - **Surface (Secondary Identifier):** The surface is typically creamy, soft, and may show very subtle spatula marks or a slight glossy sheen from boiled sugar. It lacks the "sheet-like" appearance of fondant.
   
   **FONDANT:**
   - **Edges (Primary Identifier):** The key characteristic of fondant is **curved or rounded edges**. The transition from the side of the cake to the top surface is smooth and soft, never a sharp corner.
   - **Surface (Secondary Identifier):** The surface is very smooth and uniform, with a matte or satin-like finish. It looks like a seamless sheet has been draped over the cake.
   
   **CRITICAL DECISION RULE:**
   - **If the cake has SHARP EDGES -> classify as 'soft_icing'.**
   - **If the cake has ROUNDED/CURVED EDGES -> classify as 'fondant'.**
   - Use surface texture (creamy vs. sheet-like) only as a secondary confirmation if the edges are somehow unclear. The edge style is the most important factor.

    **GUMPASTE BASE BOARD IDENTIFICATION (CRITICAL RULE):**
    You must follow these steps to determine if \`gumpasteBaseBoard\` is true:

    1.  **Default \`false\` Rule (Standard Boards):** You MUST set \`gumpasteBaseBoard: false\` if the cake board appears to be a standard, pre-made board. This is the default. Strong indicators of a standard board are:
        - **Plain White Color:** The board is simple white cardboard.
        - **Metallic Finish:** The board has a shiny, metallic finish, typically **gold** or **silver**. These are almost always foil-covered cardboard and NOT gumpaste.
    2.  **Evidence for \`true\` (Custom Covered):** Only set \`gumpasteBaseBoard: true\` if you see **at least one** of these strong indicators of a custom-covered board:
        - **Solid, Non-Metallic Color:** The board is a distinct, matte or satin color (e.g., pink, black, blue) that is NOT metallic gold or silver.
        - **Matching Texture:** The board's surface has the same smooth, non-shiny texture as a fondant-covered cake, indicating it's covered with the same material.
        - **Ribbon Edge:** A decorative ribbon is wrapped around the edge of the board. This is a very strong sign it's a custom-covered board.
    3.  **Uncertainty Rule:** If you are uncertain or the evidence is weak, you MUST default to \`gumpasteBaseBoard: false\`. This prevents overcharging.

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
`;

const hybridAnalysisResponseSchema = {
    type: Type.OBJECT,
    properties: {
        main_toppers: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['edible_3d', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo', 'edible_2d_gumpaste', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'] },
                    description: { type: Type.STRING },
                    size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                    quantity: { type: Type.INTEGER },
                    group_id: { type: Type.STRING },
                    classification: { type: Type.STRING, enum: ['hero', 'support'] },
                    color: { type: Type.STRING },
                    colors: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['type', 'description', 'size', 'quantity', 'group_id', 'classification']
            }
        },
        support_elements: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['gumpaste_panel', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'small_gumpaste', 'dragees', 'edible_flowers', 'edible_photo_side', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'edible_2d_gumpaste'] },
                    description: { type: Type.STRING },
                    coverage: { type: Type.STRING, enum: ['light', 'medium', 'heavy', 'none'] },
                    group_id: { type: Type.STRING },
                    color: { type: Type.STRING },
                    colors: { type: Type.ARRAY, items: { type: Type.STRING } }
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
    HEX_TO_COLOR_NAME_MAP: Record<string, string>
): Promise<ShareableTexts> => {
    try {
        const simplifiedAnalysis = {
            cakeType: cakeInfo.type,
            cakeSize: cakeInfo.size,
            main_toppers: analysisResult.main_toppers,
            support_elements: analysisResult.support_elements,
            cake_messages: analysisResult.cake_messages,
            icing_colors: Object.entries(analysisResult.icing_design.colors).map(([key, hex]) => {
// FIX: Add a type guard to ensure `hex` is a string before calling `toLowerCase()`.
                return { location: key, name: (typeof hex === 'string' ? HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] : undefined) || 'Custom Color' };
            })
        };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { text: SHARE_TEXT_PROMPT },
                    { text: `\`\`\`json\n${JSON.stringify(simplifiedAnalysis, null, 2)}\n\`\`\`` },
                ],
            }],
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
    threeTierReferenceImage: { data: string; mimeType: string; } | null
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