import { describe, expect, it } from 'vitest';
import { calculateIcingTypePriceDelta, findComparableIcingPriceOption } from './icingTypePrice';

const fondantOptions = [
    { size: '6" Round Fondant', price: 1999, thickness: '5 in' },
    { size: '6" Round Fondant', price: 2499, thickness: '6 in' },
];

describe('icing type price comparison', () => {
    it('uses the exact same-size height when the counterpart offers it', () => {
        expect(findComparableIcingPriceOption(fondantOptions, '6" Round', '6 in')).toEqual(
            fondantOptions[1],
        );
    });

    it('uses the nearest available same-size height when the current height is unavailable', () => {
        expect(findComparableIcingPriceOption(fondantOptions, '6" Round', '3 in')).toEqual(
            fondantOptions[0],
        );
    });

    it('returns the signed price change against the current same-size option', () => {
        expect(calculateIcingTypePriceDelta({
            currentOptions: [{ size: '6" Round', price: 1899 }],
            counterpartOptions: fondantOptions,
            currentSize: '6" Round',
            currentThickness: '6 in',
        })).toBe(600);
    });

    it('returns null when the counterpart does not offer the same cake size', () => {
        expect(calculateIcingTypePriceDelta({
            currentOptions: [{ size: '6" Round', price: 1899 }],
            counterpartOptions: [{ size: '8" Round Fondant', price: 2999, thickness: '6 in' }],
            currentSize: '6" Round',
            currentThickness: '6 in',
        })).toBeNull();
    });
});
