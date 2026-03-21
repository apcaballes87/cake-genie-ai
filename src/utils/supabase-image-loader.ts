export default function supabaseLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  // Use Supabase Image Transformations for real responsive srcset.
  // Converts /storage/v1/object/public/... → /storage/v1/render/image/public/...
  // with width, quality, and format params for on-the-fly resizing.
  try {
    const url = new URL(src);
    if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
      const renderPath = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      return `${url.origin}${renderPath}?width=${width}&resize=contain&quality=${quality || 75}`;
    }
  } catch {
    // Malformed URL — fall through to passthrough
  }

  // Non-Supabase URLs: pass through as-is (external images use unoptimized={true})
  return src;
}
