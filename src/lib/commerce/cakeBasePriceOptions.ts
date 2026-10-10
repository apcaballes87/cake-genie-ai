export interface CakeBasePriceRow {
  cakesize: string;
  price: number | string;
  display_order: number | null;
}

export interface CakeBasePriceOption {
  size: string;
  price: number;
}

/** Matches the size ordering and cheapest-price selection used by the product page. */
export function buildLowestCakeBasePriceOptions(
  rows: CakeBasePriceRow[],
): CakeBasePriceOption[] {
  const lowestBySize = new Map<string, {
    size: string;
    price: number;
    displayOrder: number | null;
  }>();

  for (const row of rows) {
    const price = Number(row.price);
    if (!Number.isFinite(price)) continue;

    const existing = lowestBySize.get(row.cakesize);
    if (!existing || price < existing.price) {
      lowestBySize.set(row.cakesize, {
        size: row.cakesize,
        price,
        displayOrder: row.display_order ?? null,
      });
    }
  }

  return [...lowestBySize.values()]
    .sort((left, right) => {
      const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.size.localeCompare(right.size);
    })
    .map(({ size, price }) => ({ size, price }));
}
