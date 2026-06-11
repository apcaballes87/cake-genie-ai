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

export function getNextMobileHeroScrollAccumulation({
    accumulatedDelta,
    productCount,
    scrollDelta,
    threshold,
    userCanSeeHero,
}: {
    accumulatedDelta: number;
    productCount: number;
    scrollDelta: number;
    threshold: number;
    userCanSeeHero: boolean;
}): { accumulatedDelta: number; shouldAdvance: boolean } {
    if (!userCanSeeHero || productCount <= 1 || scrollDelta <= 0) {
        return {
            accumulatedDelta: 0,
            shouldAdvance: false,
        };
    }

    const nextAccumulatedDelta = accumulatedDelta + scrollDelta;
    if (nextAccumulatedDelta < threshold) {
        return {
            accumulatedDelta: nextAccumulatedDelta,
            shouldAdvance: false,
        };
    }

    return {
        accumulatedDelta: 0,
        shouldAdvance: true,
    };
}
