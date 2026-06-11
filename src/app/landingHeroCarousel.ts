export function getMobileHeroCarouselVisibleIndices(total: number, activeIndex: number): number[] {
    if (total <= 0) return [];

    const normalizeIndex = (index: number) => ((index % total) + total) % total;
    const normalizedActiveIndex = normalizeIndex(activeIndex);

    if (total === 1) return [normalizedActiveIndex];
    if (total === 2) {
        const otherIndex = normalizeIndex(normalizedActiveIndex - 1);
        return [otherIndex, normalizedActiveIndex];
    }

    return [
        normalizeIndex(normalizedActiveIndex - 1),
        normalizedActiveIndex,
        normalizeIndex(normalizedActiveIndex + 1),
    ];
}

export function getMobileHeroCarouselVisibleProducts<T>(
    items: readonly T[],
    activeIndex: number
): Array<{ index: number; item: T }> {
    return getMobileHeroCarouselVisibleIndices(items.length, activeIndex).reduce<Array<{ index: number; item: T }>>(
        (visibleProducts, index) => {
            const item = items[index];
            if (item != null) {
                visibleProducts.push({ index, item });
            }
            return visibleProducts;
        },
        []
    );
}
