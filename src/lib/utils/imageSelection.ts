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
