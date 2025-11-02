/**
 * Generate a URL-friendly slug from a title and design ID
 * @param title - The design title
 * @param designId - The unique design ID
 * @returns A URL-friendly slug
 */
export function generateUrlSlug(title: string, designId: string): string {
  // Remove special characters and convert to lowercase
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .substring(0, 50); // Limit length

  // Get first 8 characters of the design ID for uniqueness
  const shortId = designId.substring(0, 8);

  return `${cleanTitle}-${shortId}`;
}
