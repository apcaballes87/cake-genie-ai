/**
 * Converts a product slug into a clean, human-readable Pinterest pin title.
 *
 * Slugs often have a hash-like suffix appended (e.g. "ps5-birthday-cake-c0fcef5f63fefeff"
 * or short variants like "travel-cake-30e2"). This function strips any trailing segment
 * that looks like a hash token before converting to title case.
 *
 * Examples:
 *   "ps5-birthday-cake-c0fcef5f63fefeff" -> "Ps5 Birthday Cake"
 *   "travel-suitcase-sky-blue-square-cake-30e2" -> "Travel Suitcase Sky Blue Square Cake"
 *   "blue_nintendo_cake_e7c1c70643efebff" -> "Blue Nintendo Cake"
 *   "elegant-wedding-cake"               -> "Elegant Wedding Cake"
 *   "graduation-cake-2025"               -> "Graduation Cake 2025"
 */
export function slugToTitle(slug: string, maxLength = 100): string {
  if (!slug) return 'Custom Cake Design';

  // Replace underscores with dashes to unify separators
  const normalizedSlug = slug.replace(/_/g, '-');
  const parts = normalizedSlug.split('-');
  const hashLikeSuffix = /^(?=.*[a-f])[0-9a-f]{4,}$/i;
  const cleaned = [...parts];

  while (cleaned.length > 1 && hashLikeSuffix.test(cleaned[cleaned.length - 1] || '')) {
    cleaned.pop();
  }

  const title = cleaned
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
    .trim();

  return (title || 'Custom Cake Design').slice(0, maxLength);
}
