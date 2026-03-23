/**
 * Returns the Supabase render URL base (without query params) for responsive preloading.
 * Returns null for non-Supabase URLs.
 */
export function getSupabaseRenderUrl(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
      const renderPath = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      return `${url.origin}${renderPath}`;
    }
  } catch {
    // Malformed URL
  }
  return null;
}

export default function supabaseLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  // Use Supabase Image Transformations for real responsive srcset.
  // Converts /storage/v1/object/public/... → /storage/v1/render/image/public/...
  // with width, quality, and format params for on-the-fly resizing.
  try {
    const url = new URL(src);
    if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
      const renderPath = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      return `${url.origin}${renderPath}?width=${width}&resize=contain&quality=${quality || 75}&format=webp`;
    }
  } catch {
    // Malformed URL — fall through to passthrough
  }

  // Non-Supabase URLs: pass through as-is (external images use unoptimized={true})
  return src;
}
