import { describe, expect, it } from 'vitest';
import { roundDownToNearest99 } from './pricing';

describe('roundDownToNearest99', () => {
  it('rounds down to the nearest 99', () => {
    expect(roundDownToNearest99(1250)).toBe(1199);
    expect(roundDownToNearest99(1469)).toBe(1399);
    expect(roundDownToNearest99(1389)).toBe(1299);
  });

  it('does not round if price already ends with 99', () => {
    expect(roundDownToNearest99(1299)).toBe(1299);
    expect(roundDownToNearest99(99)).toBe(99);
  });

  it('does not round prices below 100', () => {
    expect(roundDownToNearest99(50)).toBe(50);
    expect(roundDownToNearest99(0)).toBe(0);
  });

  it('respects minPrice constraints', () => {
    // 1250 rounded down is 1199. Since 1199 < 1200, it returns 1250.
    expect(roundDownToNearest99(1250, 1200)).toBe(1250);

    // 1350 rounded down is 1299. Since 1299 >= 1200, it returns 1299.
    expect(roundDownToNearest99(1350, 1200)).toBe(1299);
  });

  it('handles edge cases', () => {
    // exactly 100
    expect(roundDownToNearest99(100)).toBe(99);
    // negative min price
    expect(roundDownToNearest99(150, -100)).toBe(99);
  });
});
