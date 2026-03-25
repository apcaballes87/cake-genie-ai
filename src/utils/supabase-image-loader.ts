/**
 * Supabase image transformations are DISABLED to avoid exceeding the
 * Pro Plan quota (100/month). Images are already uploaded as .webp,
 * so server-side transforms are unnecessary.
 */

/**
 * Returns null — render URL generation is disabled.
 * Kept for API compatibility with preload links.
 */
export function getSupabaseRenderUrl(_src: string): string | null {
  return null;
}

/**
 * Pass-through loader — returns the original URL without Supabase
 * image transformations (/render/image/ endpoint).
 */
export default function supabaseLoader({ src }: { src: string; width: number; quality?: number }) {
  return src;
}
