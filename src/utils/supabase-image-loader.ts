export default function supabaseLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  // If it's not a Supabase URL, return the original URL
  if (!src.includes('supabase.co/storage/v1/object/public/')) {
    return src;
  }

  // Extract the base URL and the path
  const urlParts = src.split('supabase.co/storage/v1/object/public/');
  const baseUrl = urlParts[0] + 'supabase.co/storage/v1/render/image/public/';
  const path = urlParts[1];

  // Construct the Supabase transformation URL
  // https://supabase.com/docs/guides/storage/image-transformations
  const params = new URLSearchParams();
  params.set('width', width.toString());
  if (quality) params.set('quality', quality.toString());
  params.set('format', 'webp'); // Force WebP for better SEO

  return `${baseUrl}${path}?${params.toString()}`;
}
