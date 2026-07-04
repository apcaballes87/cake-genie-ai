import type { CakeThickness, CakeType } from '@/types';
import { CANONICAL_CAKE_TYPES } from '@/lib/utils/cakeType';
import { DEFAULT_THICKNESS_MAP } from '@/constants';

export type CakeTypePriceRow = {
  type: CakeType;
  thickness: CakeThickness;
  cakesize: string;
  price: number;
  display_order: number | null;
};

export type PriceListFilterKey = 'all' | 'soft-icing' | 'fondant' | 'party';

export type CakeTypePricePoint = {
  size: string;
  price: number;
};

export type CakeTypeThicknessPriceGroup = {
  thickness: CakeThickness;
  prices: CakeTypePricePoint[];
};

export type CakeTypePriceSummary = {
  cakeType: CakeType;
  title: string;
  filterKey: Exclude<PriceListFilterKey, 'all'>;
  filterLabel: string;
  note: string;
  startingPrice: number;
  maxPrice: number;
  defaultThickness: CakeThickness;
  thicknesses: CakeThickness[];
  priceGroups: CakeTypeThicknessPriceGroup[];
};

const PRICE_LIST_META: Record<
  CakeType,
  {
    filterKey: Exclude<PriceListFilterKey, 'all'>;
    filterLabel: string;
    note: string;
  }
> = {
  '1 Tier': {
    filterKey: 'soft-icing',
    filterLabel: 'Soft icing',
    note: 'Classic round cakes for most birthdays and celebrations.',
  },
  '2 Tier': {
    filterKey: 'soft-icing',
    filterLabel: 'Soft icing',
    note: 'Best for larger parties that need extra servings and height.',
  },
  '3 Tier': {
    filterKey: 'soft-icing',
    filterLabel: 'Soft icing',
    note: 'Statement cakes for big milestones and formal events.',
  },
  '1 Tier Fondant': {
    filterKey: 'fondant',
    filterLabel: 'Fondant',
    note: 'Smooth fondant finish for cleaner edges and character work.',
  },
  '2 Tier Fondant': {
    filterKey: 'fondant',
    filterLabel: 'Fondant',
    note: 'Tiered fondant cakes built for polished themed designs.',
  },
  '3 Tier Fondant': {
    filterKey: 'fondant',
    filterLabel: 'Fondant',
    note: 'Premium tiered fondant builds for intricate event centerpieces.',
  },
  Square: {
    filterKey: 'soft-icing',
    filterLabel: 'Soft icing',
    note: 'Square cakes for cleaner lines and efficient party servings.',
  },
  Rectangle: {
    filterKey: 'soft-icing',
    filterLabel: 'Soft icing',
    note: 'Rectangle cakes suited for larger celebrations and sheet-style layouts.',
  },
  Bento: {
    filterKey: 'party',
    filterLabel: 'Party sets',
    note: 'Compact bento cakes for gifts, date nights, and mini celebrations.',
  },
  'Square Fondant': {
    filterKey: 'fondant',
    filterLabel: 'Fondant',
    note: 'Sharp-edged square fondant cakes for modern or formal styling.',
  },
  'Rectangle Fondant': {
    filterKey: 'fondant',
    filterLabel: 'Fondant',
    note: 'Long-format fondant cakes for events, logos, and detailed layouts.',
  },
  Cupcake: {
    filterKey: 'party',
    filterLabel: 'Party sets',
    note: 'Cupcake pricing for giveaways, dessert tables, and party boxes.',
  },
  'Bento Cupcake Set': {
    filterKey: 'party',
    filterLabel: 'Party sets',
    note: 'A bento cake paired with cupcakes for coordinated gifting sets.',
  },
};

function sortPricePoints(
  left: { size: string; price: number; displayOrder: number | null },
  right: { size: string; price: number; displayOrder: number | null },
): number {
  const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.size.localeCompare(right.size);
}

export function buildCakeTypePriceSummaries(
  rows: readonly CakeTypePriceRow[],
): CakeTypePriceSummary[] {
  const rowsByType = new Map<CakeType, CakeTypePriceRow[]>();

  for (const row of rows) {
    const existing = rowsByType.get(row.type) ?? [];
    existing.push(row);
    rowsByType.set(row.type, existing);
  }

  return CANONICAL_CAKE_TYPES.flatMap((cakeType) => {
    const typeRows = rowsByType.get(cakeType) ?? [];
    if (typeRows.length === 0) return [];

    const rowsByThickness = new Map<
      CakeThickness,
      CakeTypePriceRow[]
    >();

    for (const row of typeRows) {
      const existing = rowsByThickness.get(row.thickness) ?? [];
      existing.push(row);
      rowsByThickness.set(row.thickness, existing);
    }

    const priceGroups = [...rowsByThickness.entries()]
      .map(([thickness, thicknessRows]) => {
        const lowestBySize = new Map<
          string,
          { size: string; price: number; displayOrder: number | null }
        >();

        for (const row of thicknessRows) {
          const existing = lowestBySize.get(row.cakesize);
          if (!existing || row.price < existing.price) {
            lowestBySize.set(row.cakesize, {
              size: row.cakesize,
              price: row.price,
              displayOrder: row.display_order,
            });
          }
        }

        const sortedPricePoints = [...lowestBySize.values()]
          .sort(sortPricePoints)
          .map(({ size, price }) => ({ size, price }));

        return {
          thickness,
          prices: sortedPricePoints,
        };
      })
      .filter((group) => group.prices.length > 0)
      .sort((left, right) => left.thickness.localeCompare(right.thickness, undefined, { numeric: true }));

    if (priceGroups.length === 0) return [];

    const numericPrices = priceGroups.flatMap((group) => group.prices.map((point) => point.price));
    const meta = PRICE_LIST_META[cakeType];
    const defaultThickness = priceGroups.some((group) => group.thickness === DEFAULT_THICKNESS_MAP[cakeType])
      ? DEFAULT_THICKNESS_MAP[cakeType]
      : priceGroups[0].thickness;

    return [{
      cakeType,
      title: cakeType,
      filterKey: meta.filterKey,
      filterLabel: meta.filterLabel,
      note: meta.note,
      startingPrice: Math.min(...numericPrices),
      maxPrice: Math.max(...numericPrices),
      defaultThickness,
      thicknesses: priceGroups.map((group) => group.thickness),
      priceGroups,
    }];
  });
}
