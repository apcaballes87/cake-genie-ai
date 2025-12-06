// lib/utils/urlHelpers.ts
export function generateUrlSlug(title: string, uuid: string): string {
  // Take first 8 chars of UUID
  const shortId = uuid.substring(0, 8);
  
  // Clean and format title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/-+/g, '-') // Multiple hyphens to single
    .substring(0, 50) // Limit length
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  return `${slug}-${shortId}`;
}
