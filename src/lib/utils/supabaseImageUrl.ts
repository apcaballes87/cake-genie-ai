/**
 * Returns the image src as-is. Images are already .webp so no server-side
 * transformation is needed. Previously this converted URLs to the Supabase
 * /render/image/ endpoint, but that consumes the free-tier transformation
 * quota (100/month) and returns larger jpeg/png files anyway.
 */
export function getOptimizedSupabaseImageSrc(
  src: string | undefined,
  _originalWidth?: number | `${number}`,
): string | undefined {
  return src;
}
