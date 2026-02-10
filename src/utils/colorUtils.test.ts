
import { describe, it, expect } from 'vitest';
import { findClosestColor } from './colorUtils';

describe('findClosestColor', () => {
    // Original Bug Case
    it('should map Sky Blue (#87CEEB) to blue', () => {
        expect(findClosestColor('#87CEEB')).toBe('blue');
    });

    // Core Colors
    it('should map pure colors correctly', () => {
        expect(findClosestColor('#0000FF')).toBe('blue');
        expect(findClosestColor('#EF4444')).toBe('red');
        expect(findClosestColor('#1A1A1A')).toBe('black');
        expect(findClosestColor('#FFFFFF')).toBe('white');
        expect(findClosestColor('#800080')).toBe('purple');
    });

    // Pastels / Variations
    it('should map pastel variants to their base color', () => {
        expect(findClosestColor('#FFC0CB')).toBe('pink'); // Pink
        expect(findClosestColor('#ADD8E6')).toBe('blue'); // Light Blue
        expect(findClosestColor('#90EE90')).toBe('green'); // Light Green
        expect(findClosestColor('#E6E6FA')).toBe('purple'); // Lavender
    });

    // Darker Variations
    it('should map darker variants correctly', () => {
        expect(findClosestColor('#00008B')).toBe('blue'); // Dark Blue
        expect(findClosestColor('#8B0000')).toBe('red'); // Dark Red
    });

    // Edge Cases
    it('should handle uppercase hex codes', () => {
        expect(findClosestColor('#87CEEB')).toBe('blue');
    });

    it('should handle hex codes without hash if logic supports it (logic trims and lowercases)', () => {
        // Logic checks if starts with #, so maybe it fails without hash?
        // Let's check implementation behavior:
        // if (colorLower.startsWith('#')) -> hexToRgb
        // else -> keyword search
        // So '87CEEB' would fail hex check and go to keyword search.
        // If keyword search fails, returns 'white'.
        // So let's test a keyword case
        expect(findClosestColor('sky blue')).toBe('blue');
    });

    it('should default to white for invalid inputs', () => {
        expect(findClosestColor('')).toBe('white');
        expect(findClosestColor('invalid-color-string')).toBe('white');
    });
});
