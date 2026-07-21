/**
 * Supabase Storage defaults public objects to `X-Robots-Tag: none` unless an
 * upload explicitly opts into crawler eligibility. Only use these headers for
 * images that can be selected by public SEO metadata or the image sitemap.
 */
export const SEO_IMAGE_X_ROBOTS_TAG = 'all' as const;

export function getSeoImageUploadHeaders(): Record<string, string> {
  return {
    'x-robots-tag': SEO_IMAGE_X_ROBOTS_TAG,
  };
}
