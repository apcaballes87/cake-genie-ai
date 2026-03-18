/**
 * Converts a product slug into a clean, human-readable Pinterest pin title.
 *
 * Slugs often have a hex p_hash appended (e.g. "ps5-birthday-cake-c0fcef5f63fefeff").
 * This function strips any segment that looks like a hex hash (8+ hex chars)
 * before converting to title case.
 *
 * Examples:
 *   "ps5-birthday-cake-c0fcef5f63fefeff" -> "Ps5 Birthday Cake"
 *   "blue_nintendo_cake_e7c1c70643efebff" -> "Blue Nintendo Cake"
 *   "elegant-wedding-cake"               -> "Elegant Wedding Cake"
 *   "number-3-cake-ab12cd34ef56gh78"     -> "Number 3 Cake"  (non-hex stops stripping)
 */
export function slugToTitle(slug: string, maxLength = 100): string {
  if (!slug) return 'Custom Cake Design';

  // Replace underscores with dashes to unify separators
  const normalizedSlug = slug.replace(/_/g, '-');
  const parts = normalizedSlug.split('-');

  // Filter out any segment that looks purely like a hex hash (at least 8 chars)
  const cleaned = parts.filter(part => !/^[0-9a-f]{8,}$/i.test(part));

  const title = cleaned
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
    .trim();

  return (title || 'Custom Cake Design').slice(0, maxLength);
}
