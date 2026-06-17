import { describe, expect, it } from 'vitest';
import { formatCurrency, formatStartingPrice } from './currency';

describe('formatCurrency', () => {
    it('formats numbers to Philippine Peso currency style with fraction digits', () => {
        expect(formatCurrency(1000)).toBe('₱1,000.00');
        expect(formatCurrency(1999.95)).toBe('₱1,999.95');
    });
});

describe('formatStartingPrice', () => {
    it('formats a starting price without cake type correctly', () => {
        expect(formatStartingPrice(1299)).toBe('Starts at ₱1,299');
        expect(formatStartingPrice(null)).toBe('Starts at ₱1,599');
        expect(formatStartingPrice(undefined)).toBe('Starts at ₱1,599');
    });

    it('formats a starting price with a valid cake type correctly', () => {
        expect(formatStartingPrice(1999, '1 Tier Fondant')).toBe('1 Tier Fondant starts at ₱1,999');
        expect(formatStartingPrice(1699, 'Rectangle')).toBe('Rectangle starts at ₱1,699');
        expect(formatStartingPrice(1500, 'Bento')).toBe('Bento starts at ₱1,500');
    });

    it('falls back to "Starts at" if cake type is blank or whitespace', () => {
        expect(formatStartingPrice(1299, '')).toBe('Starts at ₱1,299');
        expect(formatStartingPrice(1299, '   ')).toBe('Starts at ₱1,299');
        expect(formatStartingPrice(1299, null)).toBe('Starts at ₱1,299');
    });
});
