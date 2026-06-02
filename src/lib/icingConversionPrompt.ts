/**
 * Generates the icing conversion prompt with the cake's actual icing color injected
 * for better AI targeting accuracy. The color name (e.g. "white", "pink", "dark green")
 * helps Gemini identify the correct icing surface to paint red.
 *
 * @param icingColorName Human-readable color name (e.g. "white", "pink"). Defaults to
 *   "white" when unknown, which is the most common icing color.
 */
export function buildIcingConversionPrompt(icingColorName = 'white'): string {
   return `STRICTLY FOLLOW THESE STEPS:
1st step: CHANGE the ${icingColorName} cake icing (Icing message is NOT included) into a solid, rich, textured RED. Don't change or remove the position of everything else. Retain all realistic 3D depth, studio lighting, and physical textures. 
2nd Step: CHANGE to solid pitch-black All original non-icing and decorative elements (Element B = everything non-icing) including the exact text characters of any message, decorative beads, structural toppers, floral additions, base board and all piped base/tier borders. Make it flat vantablack but retain their correct shapes and positions.
Black-Out Application: Every single one of these non-icing details must be rendered in absolute, flat, pure pitch-black (#000000). They must look like unlit Vantablack silhouettes or pure 2D cutouts. There must be ZERO shadows, ZERO highlights, ZERO gradients, and absolutely NO gray shading. They must act as a perfect, flat digital black mask over the realistic base icing, blending perfectly and seamlessly into the pitch-black background void. 

Select absolutely everything else in the image: the background, base board, piped icing borders, gift box, ribbon, gift tag, and all text. Convert Element B (everything non-icing) entirely into a flat, 2D, unlit #000000 black silhouette.

STRICTLY: Make the texts, logos, photos and graphic designs pitch-black too (these are not icing). Make the background black.
IMPORTANT: JUST CHANGE COLORS, DONT REMOVE ANYTHING.


Treat Element B (everything non-icing) as a binary segmentation mask.
Disable ambient occlusion, global illumination, and shadow casting for all items in Element B.

Force hard-edge (aliased) transitions between the realistic red cake body and the #000000 black elements to aggressively eliminate transitional gray or near-black anti-aliasing pixels.

NOTE: DO NOT MAKE THE BACKGROUND WHITE.`;
}


/**
 * Static fallback for the icing recolor lab (which doesn't have icing color context).
 * Use `buildIcingConversionPrompt(colorName)` everywhere the actual color is known.
 */
export const ICING_CONVERSION_PROMPT = buildIcingConversionPrompt();
