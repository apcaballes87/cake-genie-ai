// lib/utils/urlHelpers.ts

/**
 * Generates a URL-friendly slug from a string or array of strings.
 * @param parts - A single string or an array of strings to combine into a slug.
 * @param suffix - Optional suffix to append to the slug (e.g., a hash or ID).
 * @returns A formatted slug string.
 */
export function generateUrlSlug(parts: string | (string | null | undefined)[], suffix?: string): string {
  const input = Array.isArray(parts) ? parts.filter(Boolean).join(' ') : parts;

  // Clean and format string
  const slug = (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/-+/g, '-') // Multiple hyphens to single
    .substring(0, 80) // Limit length (slightly higher for descriptive slugs)
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  if (!slug) return suffix || 'custom-cake';

  return suffix ? `${slug}-${suffix.toLowerCase()}` : slug;
}

/**
 * Maps hex color codes to human-readable color names.
 * Uses the same palette defined in the AI system instruction.
 */
const HEX_TO_NAME: Record<string, string> = {
  '#EF4444': 'red', '#FCA5A5': 'light red', '#F97316': 'orange',
  '#EAB308': 'yellow', '#16A34A': 'green', '#4ADE80': 'light green',
  '#14B8A6': 'teal', '#3B82F6': 'blue', '#93C5FD': 'light blue',
  '#8B5CF6': 'purple', '#C4B5FD': 'light purple', '#EC4899': 'pink',
  '#FBCFE8': 'light pink', '#78350F': 'brown', '#B45309': 'light brown',
  '#64748B': 'gray', '#FFFFFF': 'white', '#000000': 'black',
};

/**
 * Converts a hex color code to a human-readable color name.
 * If the hex is not in the mapping, returns the original value.
 */
function hexToName(hex: string): string {
  if (!hex) return '';
  const upper = hex.toUpperCase();
  return HEX_TO_NAME[upper] || hex;
}

/**
 * Specific helper for generating AI cake analysis slugs.
 *
 * This function constructs a URL slug based on several cake-related parameters.
 * The process involves:
 * 1. **Parameter Normalization**: `keyword`, `icingColor`, and `cakeType` are used.
 *    If `keyword` is missing, it defaults to 'custom-cake'. `icingColor` and `cakeType`
 *    are treated as empty strings if null/undefined. If `icingColor` is a hex code,
 *    it is converted to a color name.
 * 2. **Slugification**: These elements are combined into a readable string: `{keyword}-{color}-{type}-{phash}`.
 * 3. **Collision Avoidance**: A 4-character suffix from the **Perceptual Hash (pHash)** is appended.
 *    - *Example*: `unicorn-birthday-pink-2-tier-b7c4`
 *
 * @param params - An object containing optional parameters for slug generation.
 * @param params.keyword - Main keyword describing the cake.
 * @param params.icingColor - Color of the icing (hex code or color name).
 * @param params.cakeType - Type or style of the cake (e.g., '2-tier', 'bento').
 * @param params.pHash - Perceptual hash for uniqueness, truncated to 4 characters.
 * @returns A formatted slug string for AI cake analysis.
 *
 * | Keyword | Icing Color | Cake Type | pHash Suffix | Resulting Slug |
 * | :--- | :--- | :--- | :--- | :--- |
 * | **Unicorn Birthday** | Pink | 2 Tier | `b7c4` | `unicorn-birthday-pink-2-tier-b7c4` |
 * | **Minecraft Cake** | Green | 1 Tier | `a1b2` | `minecraft-cake-green-1-tier-a1b2` |
 * | **Minimalist** | *None* | Bento | `f9e8` | `minimalist-bento-f9e8` |
 * | **Chocolate Drip** | Brown | 3 Tier | `d3e1` | `chocolate-drip-brown-3-tier-d3e1` |
 */
export function generateCakeAnalysisSlug(params: {
  keyword?: string | null;
  icingColor?: string | null;
  cakeType?: string | null;
  pHash?: string | null;
}): string {
  const { keyword, icingColor, cakeType, pHash } = params;

  // Normalize inputs
  const kw = keyword || 'custom-cake';
  // Convert hex color codes to color names for the slug
  const color = icingColor ? hexToName(icingColor) : '';
  const type = cakeType || '';
  const hashSuffix = pHash ? pHash.substring(0, 4) : '';

  return generateUrlSlug([kw, color, type], hashSuffix);
}

export function isValidRedirect(path: string | null): boolean {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}
