import type { CakeType } from '@/types';

export const CANONICAL_CAKE_TYPES: readonly CakeType[] = [
  '1 Tier',
  '2 Tier',
  '3 Tier',
  '1 Tier Fondant',
  '2 Tier Fondant',
  '3 Tier Fondant',
  'Square',
  'Rectangle',
  'Bento',
  'Square Fondant',
  'Rectangle Fondant',
  'Cupcake',
  'Bento Cupcake Set',
] as const;

const CANONICAL_BY_LOWER = new Map(
  CANONICAL_CAKE_TYPES.map((type) => [type.toLowerCase(), type]),
);

export function normalizeCakeType(rawType: unknown, fallback: CakeType = '1 Tier'): CakeType {
  if (typeof rawType !== 'string') {
    return fallback;
  }

  const normalized = rawType.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return fallback;
  }

  const exact = CANONICAL_BY_LOWER.get(normalized.toLowerCase());
  if (exact) {
    return exact;
  }

  const slugLike = normalized.toLowerCase().replace(/[_\s]+/g, '-');
  if (slugLike.startsWith('cupcakes-') || slugLike === 'cupcakes-only' || slugLike === 'cupcake-only') {
    return 'Cupcake';
  }

  if (slugLike.includes('bento') && slugLike.includes('cupcake')) {
    return 'Bento Cupcake Set';
  }

  if (slugLike.includes('fondant')) {
    if (slugLike.includes('rectangle')) return 'Rectangle Fondant';
    if (slugLike.includes('square')) return 'Square Fondant';
    if (slugLike.includes('3-tier') || slugLike.includes('4-tier')) return '3 Tier Fondant';
    if (slugLike.includes('2-tier')) return '2 Tier Fondant';
    if (slugLike.includes('1-tier')) return '1 Tier Fondant';
  }

  if (slugLike.includes('rectangle')) return 'Rectangle';
  if (slugLike.includes('square')) return 'Square';
  if (slugLike.includes('bento')) return 'Bento';
  if (slugLike.includes('cupcake')) return 'Cupcake';
  if (slugLike.includes('3-tier') || slugLike.includes('4-tier')) return '3 Tier';
  if (slugLike.includes('2-tier')) return '2 Tier';
  if (slugLike.includes('1-tier')) return '1 Tier';

  return fallback;
}

export function isCanonicalCakeType(value: unknown): value is CakeType {
  return typeof value === 'string' && CANONICAL_BY_LOWER.get(value.trim().replace(/\s+/g, ' ').toLowerCase()) === value.trim().replace(/\s+/g, ' ');
}
