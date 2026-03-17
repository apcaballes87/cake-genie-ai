export default function supabaseLoader({ src, width }: { src: string; width: number; quality?: number }) {
  // Images are already .webp — no server-side transformation needed.
  // We only append a width query param so that each srcset entry has a unique URL.
  // The actual image served is the original (Supabase storage ignores unknown params).
  // This avoids both Vercel (5k/mo) and Supabase (100/mo free) transformation limits.
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}w=${width}`;
}
