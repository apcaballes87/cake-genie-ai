export const firstNonBlankImageUrl = (...urls: Array<string | null | undefined>) => {
  for (const url of urls) {
    if (typeof url === 'string' && url.trim()) {
      return url.trim();
    }
  }

  return null;
};

export const getPreferredProductImageUrl = (
  studioEditedImageUrl?: string | null,
  originalImageUrl?: string | null,
): string => firstNonBlankImageUrl(studioEditedImageUrl, originalImageUrl) ?? '';

const SUPABASE_PUBLIC_PATH = '/storage/v1/object/public/';

export const isSiteOwnedSupabasePublicImageUrl = (url?: string | null): boolean => {
  const trimmedUrl = typeof url === 'string' ? url.trim() : '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!trimmedUrl || !supabaseUrl) {
    return false;
  }

  try {
    const assetUrl = new URL(trimmedUrl);
    const projectUrl = new URL(supabaseUrl);
    return assetUrl.hostname === projectUrl.hostname && assetUrl.pathname.includes(SUPABASE_PUBLIC_PATH);
  } catch {
    return false;
  }
};

export const shouldBypassImageProxy = (url?: string | null): boolean => {
  const trimmedUrl = typeof url === 'string' ? url.trim() : '';

  if (!trimmedUrl) {
    return false;
  }

  if (
    trimmedUrl.startsWith('data:') ||
    trimmedUrl.startsWith('blob:') ||
    trimmedUrl.includes('example.com')
  ) {
    return true;
  }

  return isSiteOwnedSupabasePublicImageUrl(trimmedUrl);
};

export const getProxyAwareImageUrl = (url: string): string =>
  shouldBypassImageProxy(url)
    ? url
    : `/api/proxy-image?url=${encodeURIComponent(url)}`;
