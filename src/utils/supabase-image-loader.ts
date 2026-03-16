export default function supabaseLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  // Non-Supabase URLs: append width param so srcset entries are unique
  if (!src.includes('supabase.co/storage/v1/object/public/')) {
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}w=${width}`;
  }

  // Convert /object/public/ → /render/image/public/ for Supabase image transformations
  // https://supabase.com/docs/guides/storage/image-transformations
  const urlParts = src.split('supabase.co/storage/v1/object/public/');
  const baseUrl = urlParts[0] + 'supabase.co/storage/v1/render/image/public/';
  const path = urlParts[1];

  const params = new URLSearchParams();
  params.set('width', width.toString());
  params.set('quality', (quality || 80).toString());
  params.set('resize', 'contain');
  params.set('format', 'webp');

  return `${baseUrl}${path}?${params.toString()}`;
}
