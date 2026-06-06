type GoogleFeedImageSource = {
  studio_edited_image_url?: string | null;
  original_image_url?: string | null;
};

function normalizeImageUrl(url: string | null | undefined): string {
  const candidate = url?.trim();
  if (!candidate || candidate.startsWith('data:')) return '';

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';

    if (parsed.hostname.includes('supabase')) {
      return `${parsed.origin}${parsed.pathname}`;
    }

    return candidate;
  } catch {
    return '';
  }
}

export function resolveGoogleFeedImage(source: GoogleFeedImageSource): string {
  return (
    normalizeImageUrl(source.studio_edited_image_url)
    || normalizeImageUrl(source.original_image_url)
  );
}
