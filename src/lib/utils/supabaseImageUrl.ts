const OWN_SUPABASE_DOMAINS = [
  'cqmhanqnfybyxezhobkx.supabase.co',
  'congofivupobtfudnhni.supabase.co',
];

export function getOptimizedSupabaseImageSrc(
  src: string | undefined,
  originalWidth?: number | `${number}`,
): string | undefined {
  if (!src || typeof src !== 'string') return src;

  const isOwnSupabase = OWN_SUPABASE_DOMAINS.some((domain) => src.includes(domain));
  if (!isOwnSupabase) return src;

  try {
    const url = new URL(src);

    if (
      url.pathname.includes('/storage/v1/object/public/') &&
      !url.pathname.includes('/render/image/public/')
    ) {
      url.pathname = url.pathname.replace(
        '/storage/v1/object/public/',
        '/storage/v1/render/image/public/',
      );

      if (!url.searchParams.has('width')) {
        url.searchParams.set('width', originalWidth ? originalWidth.toString() : '800');
      }
      if (!url.searchParams.has('resize')) {
        url.searchParams.set('resize', 'contain');
      }
      if (!url.searchParams.has('quality')) {
        url.searchParams.set('quality', '80');
      }

      return url.toString();
    }
  } catch {
    return src;
  }

  return src;
}