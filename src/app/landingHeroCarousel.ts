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
}): { accumulatedDelta: number; direction: 'next' | 'prev' | null; shouldAdvance: boolean } {
    if (!userCanSeeHero || productCount <= 1 || scrollDelta === 0) {
        return {
            accumulatedDelta: 0,
            direction: null,
            shouldAdvance: false,
        };
    }

    const scrollDirection = scrollDelta > 0 ? 1 : -1;
    const accumulatedDirection = accumulatedDelta === 0 ? scrollDirection : Math.sign(accumulatedDelta);

    if (accumulatedDirection !== scrollDirection) {
        return {
            accumulatedDelta: scrollDelta,
            direction: Math.abs(scrollDelta) >= threshold ? (scrollDelta > 0 ? 'next' : 'prev') : null,
            shouldAdvance: Math.abs(scrollDelta) >= threshold,
        };
    }

    const nextAccumulatedDelta = accumulatedDelta + scrollDelta;
    if (Math.abs(nextAccumulatedDelta) < threshold) {
        return {
            accumulatedDelta: nextAccumulatedDelta,
            direction: null,
            shouldAdvance: false,
        };
    }

    return {
        accumulatedDelta: 0,
        direction: nextAccumulatedDelta > 0 ? 'next' : 'prev',
        shouldAdvance: true,
    };
}
