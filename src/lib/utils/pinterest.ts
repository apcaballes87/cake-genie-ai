/**
 * Converts a product slug into a clean, human-readable Pinterest pin title.
 *
 * Slugs often have a hex p_hash appended (e.g. "ps5-birthday-cake-c0fcef5f63fefeff").
 * This function strips any trailing segment that looks like a hex hash (8+ hex chars)
 * before converting to title case.
 *
 * Examples:
 *   "ps5-birthday-cake-c0fcef5f63fefeff" → "Ps5 Birthday Cake"
 *   "elegant-wedding-cake"               → "Elegant Wedding Cake"
 *   "number-3-cake-ab12cd34ef56gh78"     → "Number 3 Cake"  (non-hex stops stripping)
 */
export function slugToTitle(slug: string, maxLength = 100): string {
  if (!slug) return 'Custom Cake Design';

  const parts = slug.split('-');

  // Strip the last segment if it is purely hex digits and at least 8 characters
  // (matches p_hash values like "c0fcef5f63fefeff")
  const lastPart = parts[parts.length - 1];
  const cleaned =
    lastPart && /^[0-9a-f]{8,}$/i.test(lastPart) ? parts.slice(0, -1) : parts;

  const title = cleaned
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
    .trim();

  return (title || 'Custom Cake Design').slice(0, maxLength);
}
