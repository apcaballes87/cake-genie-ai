export type CakeTier = 'top' | 'middle' | 'bottom';

export interface TierFlavorAssignment {
  tier: CakeTier;
  size: string;
  flavor: string;
}

const TIER_SEQUENCE: Record<2 | 3, CakeTier[]> = {
  2: ['top', 'bottom'],
  3: ['top', 'middle', 'bottom'],
};

function getTierCount(cakeType: string): 2 | 3 | null {
  if (cakeType.includes('3 Tier')) return 3;
  if (cakeType.includes('2 Tier')) return 2;
  return null;
}

/**
 * Converts the customizer's explicitly ordered multi-tier choices into a
 * self-describing order record. Returns undefined rather than guessing when
 * an incomplete or non-standard variant cannot be mapped safely.
 */
export function buildTierFlavorAssignments(
  cakeType: string,
  cakeSize: string,
  flavors: readonly string[],
): TierFlavorAssignment[] | undefined {
  const tierCount = getTierCount(cakeType);
  if (!tierCount || flavors.length !== tierCount) return undefined;

  const sizes = Array.from(cakeSize.matchAll(/(\d+(?:\.\d+)?)\s*"/g), ([, diameter]) => `${diameter}"`);
  if (sizes.length !== tierCount) return undefined;

  return TIER_SEQUENCE[tierCount].map((tier, index) => ({
    tier,
    size: sizes[index],
    flavor: flavors[index],
  }));
}
