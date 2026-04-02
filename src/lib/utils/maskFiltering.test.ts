import { describe, it, expect } from 'vitest';
import { filterSignificantMasks, filterCakeComponents } from './maskFiltering';

describe('maskFiltering', () => {
    const mockItems = [
        { mask: 'mask1', label: 'cake', confidence: 0.9 },
        { mask: 'mask2', label: 'topping', confidence: 0.4 },
        { mask: 'mask3', label: 'plate', confidence: 0.6 },
        { mask: 'mask4', label: 'candle', confidence: 0.8 },
    ];

    describe('filterSignificantMasks', () => {
        it('should filter by minConfidence', () => {
            const result = filterSignificantMasks(mockItems, { minConfidence: 0.5 });
            expect(result).toHaveLength(3);
            expect(result.every(item => item.confidence >= 0.5)).toBe(true);
        });

        it('should sort by confidence descending by default', () => {
            const result = filterSignificantMasks(mockItems);
            expect(result[0].confidence).toBe(0.9);
            expect(result[1].confidence).toBe(0.8);
        });

        it('should limit the number of masks', () => {
            const result = filterSignificantMasks(mockItems, { maxMasks: 2 });
            expect(result).toHaveLength(2);
            expect(result[0].confidence).toBe(0.9);
            expect(result[1].confidence).toBe(0.8);
        });
    });

    describe('filterCakeComponents', () => {
        it('should apply specific cake filtering rules', () => {
            const result = filterCakeComponents(mockItems);
            // minConfidence 0.7, maxMasks 3
            expect(result).toHaveLength(2); // cake (0.9) and candle (0.8)
            expect(result[0].label).toBe('cake');
            expect(result[1].label).toBe('candle');
        });
    });
});
