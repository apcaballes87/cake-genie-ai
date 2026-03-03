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
const SIMPLE_COLORS = [
  { name: 'red', hex: 'ff0000' },
  { name: 'orange', hex: 'ffa500' },
  { name: 'yellow', hex: 'ffff00' },
  { name: 'green', hex: '008000' },
  { name: 'blue', hex: '0000ff' },
  { name: 'purple', hex: '800080' },
  { name: 'pink', hex: 'ffc0cb' },
  { name: 'brown', hex: 'a52a2a' },
  { name: 'black', hex: '000000' },
  { name: 'white', hex: 'ffffff' },
  { name: 'gray', hex: '808080' },
  { name: 'gold', hex: 'ffd700' },
  { name: 'silver', hex: 'c0c0c0' },
  { name: 'navy', hex: '000080' },
  { name: 'teal', hex: '008080' },
  { name: 'maroon', hex: '800000' },
  { name: 'olive', hex: '808000' },
  { name: 'lime', hex: '00ff00' },
  { name: 'aqua', hex: '00ffff' },
  { name: 'fuchsia', hex: 'ff00ff' },
  { name: 'sky-blue', hex: '87ceeb' },
  { name: 'ivory', hex: 'fffff0' },
  { name: 'light-pink', hex: 'ffb6c1' },
  { name: 'lavender', hex: 'e6e6fa' },
  { name: 'peach', hex: 'ffdab9' },
  { name: 'mint', hex: '98ff98' },
  { name: 'coral', hex: 'ff7f50' },
];

function hexToRgb(hex: string) {
  const bigint = parseInt(hex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function getColorDistance(hex1: string, hex2: string) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

/**
 * Converts a hex color code to the nearest human-readable color name.
 * If the value is not a hex string, it returns the original value.
 */
function hexToName(hex: string): string {
  if (!hex) return '';

  // Clean the input, remove '#' if it exists
  const cleanHex = hex.replace(/^#/, '').toLowerCase();

  // Verify it's structurally a hex code (3 or 6 chars)
  if (!/^[0-9a-f]{3}$/i.test(cleanHex) && !/^[0-9a-f]{6}$/i.test(cleanHex)) {
    return hex;
  }

  // Expand 3-char hex to 6-char
  const expandedHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex;

  let nearest = '';
  let minDistance = Infinity;
  for (const color of SIMPLE_COLORS) {
    const d = getColorDistance(expandedHex, color.hex);
    if (d < minDistance) {
      minDistance = d;
      nearest = color.name;
    }
  }

  return nearest;
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

  let slug = generateUrlSlug([kw, color, type], hashSuffix ? `cake-${hashSuffix}` : 'cake');

  // prevent 'cake-cake' since some names may naturally end with '-cake'
  slug = slug.replace(/-cake-cake-/g, '-cake-');

  return slug;
}

export function isValidRedirect(path: string | null): boolean {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}
