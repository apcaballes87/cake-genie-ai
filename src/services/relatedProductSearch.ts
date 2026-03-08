const GENERIC_RELATED_PRODUCT_TERMS = new Set([
  'cake',
  'cakes',
  'design',
  'designs',
  'idea',
  'ideas',
  'style',
  'styles',
]);

const BROAD_STYLE_TERMS = new Set(['minimalist', 'simple', 'modern', 'elegant', 'clean']);

export interface RelatedProductSearchCandidate {
  p_hash?: string | null;
  slug?: string | null;
  keywords?: string | null;
  alt_text?: string | null;
  usage_count?: number | null;
}

const unique = (values: string[]) => Array.from(new Set(values));

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsSearchTerm = (text: string, term: string) => {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeForRegex(term)}([^a-z0-9]|$)`, 'i');
  return pattern.test(text);
};

export const normalizeRelatedSearchPhrase = (keywords: string | null) =>
  (keywords || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const getDistinctiveRelatedSearchTerms = (keywords: string | null) => {
  const normalized = normalizeRelatedSearchPhrase(keywords);
  if (!normalized) {
    return [];
  }

  const terms = normalized.split(/[\s,-]+/).filter((term) => term.length > 2);
  const distinctiveTerms = terms.filter(
    (term) => !GENERIC_RELATED_PRODUCT_TERMS.has(term) && !BROAD_STYLE_TERMS.has(term),
  );

  if (distinctiveTerms.length > 0) {
    return unique(distinctiveTerms);
  }

  return unique(terms.filter((term) => !GENERIC_RELATED_PRODUCT_TERMS.has(term)));
};

const getSearchableText = (product: RelatedProductSearchCandidate) =>
  [product.keywords, product.alt_text, product.slug?.replace(/-/g, ' ')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export function rankRelatedProducts<T extends RelatedProductSearchCandidate>(
  products: T[],
  keywords: string | null,
  limit: number,
) {
  const normalizedPhrase = normalizeRelatedSearchPhrase(keywords);
  const rawTerms = normalizedPhrase.split(/[\s,-]+/).filter((term) => term.length > 2);
  const distinctiveTerms = getDistinctiveRelatedSearchTerms(keywords);

  return products
    .map((product, index) => {
      const searchableText = getSearchableText(product);
      const matchedDistinctiveTerms = distinctiveTerms.filter((term) => containsSearchTerm(searchableText, term));
      const matchedRawTerms = rawTerms.filter((term) => containsSearchTerm(searchableText, term));
      const phraseMatch = normalizedPhrase ? containsSearchTerm(searchableText, normalizedPhrase) : false;
      const slugPhraseMatch = normalizedPhrase
        ? (product.slug || '').toLowerCase().includes(normalizedPhrase.replace(/\s+/g, '-'))
        : false;
      const hasMeaningfulMatch =
        distinctiveTerms.length > 0
          ? phraseMatch || matchedDistinctiveTerms.length > 0
          : phraseMatch || matchedRawTerms.length > 0;

      let score = 0;
      if (phraseMatch) score += 200;
      if (slugPhraseMatch) score += 40;
      score += matchedDistinctiveTerms.length * 45;
      if (distinctiveTerms.length > 1 && matchedDistinctiveTerms.length === distinctiveTerms.length) {
        score += 120;
      }
      score += matchedRawTerms.length * 5;
      score += Math.min(Number(product.usage_count) || 0, 1000) / 100;

      return {
        product,
        index,
        score: hasMeaningfulMatch ? score : 0,
        phraseMatch,
        matchedDistinctiveCount: matchedDistinctiveTerms.length,
        matchedRawCount: matchedRawTerms.length,
        usageCount: Number(product.usage_count) || 0,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.matchedDistinctiveCount !== a.matchedDistinctiveCount) {
        return b.matchedDistinctiveCount - a.matchedDistinctiveCount;
      }
      if (b.matchedRawCount !== a.matchedRawCount) return b.matchedRawCount - a.matchedRawCount;
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map((entry) => entry.product);
}