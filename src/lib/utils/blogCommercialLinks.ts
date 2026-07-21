import { generateUrlSlug } from './urlHelpers';

interface ResolveBlogCommercialLinksInput {
  title?: string | null;
  slug?: string | null;
  keyword?: string | null;
}

interface BlogCommercialTarget {
  href: string;
  label: string;
}

export interface BlogCommercialLinks {
  primary: BlogCommercialTarget;
  support: BlogCommercialTarget;
  keywordLabel: string;
}

const KNOWN_COLLECTION_TARGETS = [
  { slug: 'super-mario-cake', label: 'Super Mario', patterns: ['super mario', 'mario bros', 'mario'] },
  { slug: 'hello-kitty-cake', label: 'Hello Kitty', patterns: ['hello kitty'] },
  { slug: 'minecraft-cake', label: 'Minecraft', patterns: ['minecraft'] },
  { slug: 'pokemon-cake', label: 'Pokemon', patterns: ['pokemon', 'pikachu'] },
  { slug: 'cocomelon-cake', label: 'Cocomelon', patterns: ['cocomelon'] },
  { slug: 'minimalist-cake', label: 'Minimalist', patterns: ['minimalist'] },
  { slug: 'wedding-cake', label: 'Wedding', patterns: ['wedding', 'engagement'] },
  { slug: 'unicorn-cake', label: 'Unicorn', patterns: ['unicorn'] },
  { slug: 'frozen-cake', label: 'Frozen', patterns: ['frozen', 'elsa', 'anna', 'olaf'] },
  { slug: 'bento-cake', label: 'Bento', patterns: ['bento'] },
  { slug: 'birthday', label: 'Birthday', patterns: ['birthday', 'debut'] },
] as const;

const BUYER_INTENT_PATTERNS = [
  'where to order',
  'compare',
  'comparison',
  'versus',
  ' vs ',
  'venue',
  'venues',
  'party place',
  'party places',
  'package',
  'packages',
];

function normalizeText(value?: string | null) {
  return (value || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPrimaryKeyword(value?: string | null) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .find(Boolean) || '';
}

function getKeywordLabel(input: ResolveBlogCommercialLinksInput) {
  const baseKeyword = getPrimaryKeyword(input.keyword) || input.title || input.slug?.replace(/-/g, ' ') || 'custom cake';
  return toTitleCase(normalizeText(baseKeyword) || 'custom cake');
}

function getPrimaryLabel(keywordLabel: string) {
  const normalizedKeywordLabel = keywordLabel.toLowerCase();
  const designTopic = normalizedKeywordLabel.endsWith(' cake') || normalizedKeywordLabel.endsWith(' cakes')
    ? keywordLabel
    : `${keywordLabel} Cake`;

  return `Browse ${designTopic} Designs`;
}

export function resolveBlogCommercialLinks(input: ResolveBlogCommercialLinksInput): BlogCommercialLinks {
  const combinedText = normalizeText([input.title, input.slug?.replace(/-/g, ' '), input.keyword].filter(Boolean).join(' '));
  const matchedCollection = KNOWN_COLLECTION_TARGETS.find((target) =>
    target.patterns.some((pattern) => combinedText.includes(pattern)),
  );

  const keywordLabel = matchedCollection?.label || getKeywordLabel(input);
  const isBuyerIntentTopic = BUYER_INTENT_PATTERNS.some((pattern) => combinedText.includes(pattern));

  if (matchedCollection) {
    return {
      primary: {
        href: `/collections/${matchedCollection.slug}`,
        label: getPrimaryLabel(matchedCollection.label),
      },
      support: {
        href: '/how-to-order',
        label: 'See How Ordering Works',
      },
      keywordLabel,
    };
  }

  if (isBuyerIntentTopic) {
    return {
      primary: {
        href: '/collections/birthday',
        label: 'Browse Cakes Collections',
      },
      support: {
        href: '/how-to-order',
        label: 'See How Ordering Works',
      },
      keywordLabel: 'Birthday',
    };
  }

  const fallbackKeyword = getPrimaryKeyword(input.keyword) || input.title || input.slug || 'custom cake';
  const fallbackSlug = generateUrlSlug(fallbackKeyword);

  return {
    primary: {
      href: `/customizing/category/${fallbackSlug}`,
      label: getPrimaryLabel(keywordLabel),
    },
    support: {
      href: '/how-to-order',
      label: 'See How Ordering Works',
    },
    keywordLabel,
  };
}
