/**
 * Generates the icing conversion prompt with the cake's actual icing color injected
 * for better AI targeting accuracy. The color name (e.g. "white", "pink", "dark green")
 * helps Gemini identify the correct icing surface to paint red.
 *
 * @param icingColorName Human-readable color name (e.g. "white", "pink"). Defaults to
 *   "white" when unknown, which is the most common icing color.
 */
export function buildIcingConversionPrompt(icingColorName = 'white'): string {
  return `Generate a high-contrast image of the same image that we can use as a "mask" for this current custom cake design. It should be centered in a pure pitch-black (#000000) void.
Icing Color (The core): The ${icingColorName} icing body (Toppers and Icing message is NOT included) of the cake is a solid, rich, textured RED retaining all realistic 3D depth, studio lighting, and physical textures appropriate for its specific shape and architecture.
Non-Icing Details (Masking): Crucially, all original non-icing and decorative elements—including the exact text characters of any message, decorative beads, structural toppers, floral additions, and all piped base/tier borders—are physically present in their correct shapes and positions on the RED icing.
Black-Out Application: Every single one of these non-icing details must be rendered in absolute, flat, pure pitch-black (#000000). They must look like unlit Vantablack silhouettes or pure 2D cutouts. There must be ZERO shadows, ZERO highlights, ZERO gradients, and absolutely NO gray shading on any text, beads, toppers, or borders. They must act as a perfect, flat digital black mask over the realistic base icing, blending perfectly and seamlessly into the pitch-black background void. Make the texts, logos, photos and graphic designs pitch-black too (these are not icing). makt the background black, make eveything in the image that is not icing, black.

For simplicity, make the icing color red, make ALL non-icing pitch black.
IMPORTANT: RETAIN THE CURRENT DESIGN. JUST CHANGE COLORS, DONT REMOVE ANYTHING.
For the segmentation and identification: Disregard the colors when identifying the correct icing parts. Just focus on the icing and non-icing only.`;
}

/**
 * Static fallback for the icing recolor lab (which doesn't have icing color context).
 * Use `buildIcingConversionPrompt(colorName)` everywhere the actual color is known.
 */
export const ICING_CONVERSION_PROMPT = buildIcingConversionPrompt();
