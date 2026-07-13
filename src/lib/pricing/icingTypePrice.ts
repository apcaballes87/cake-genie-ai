import type { BasePriceInfo, CakeSize } from '@/types';

export interface IcingPriceOption extends BasePriceInfo {
    thickness: string;
}

const normalizeComparableCakeSize = (size: CakeSize): string => (
    size
        .trim()
        .replace(/\s*fondant\s*$/i, '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
);

const parseThickness = (thickness: string): number => Number.parseInt(thickness, 10);

/**
 * Finds the same cake size in the alternate icing price table. If that icing
 * does not offer the current height, use the nearest available height.
 */
export const findComparableIcingPriceOption = (
    options: IcingPriceOption[],
    currentSize: CakeSize,
    currentThickness: string,
): IcingPriceOption | null => {
    const comparableSize = normalizeComparableCakeSize(currentSize);
    const matchingSizeOptions = options.filter(option => (
        normalizeComparableCakeSize(option.size) === comparableSize
    ));

    if (matchingSizeOptions.length === 0) return null;

    const currentHeight = parseThickness(currentThickness);
    return [...matchingSizeOptions].sort((left, right) => {
        const leftHeight = parseThickness(left.thickness);
        const rightHeight = parseThickness(right.thickness);
        const leftDistance = Math.abs(leftHeight - currentHeight);
        const rightDistance = Math.abs(rightHeight - currentHeight);

        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
        return leftHeight - rightHeight;
    })[0] ?? null;
};

export const calculateIcingTypePriceDelta = ({
    currentOptions,
    counterpartOptions,
    currentSize,
    currentThickness,
}: {
    currentOptions: BasePriceInfo[];
    counterpartOptions: IcingPriceOption[];
    currentSize: CakeSize;
    currentThickness: string;
}): number | null => {
    const comparableSize = normalizeComparableCakeSize(currentSize);
    const currentOption = currentOptions.find(option => (
        normalizeComparableCakeSize(option.size) === comparableSize
    ));
    const counterpartOption = findComparableIcingPriceOption(
        counterpartOptions,
        currentSize,
        currentThickness,
    );

    if (!currentOption || !counterpartOption) return null;

    return Number(counterpartOption.price) - Number(currentOption.price);
};
