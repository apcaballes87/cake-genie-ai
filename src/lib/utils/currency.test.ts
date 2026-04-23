import { describe, expect, it } from 'vitest';
import { formatCurrency, formatStartingPrice } from './currency';

describe('formatCurrency', () => {
  it('formats positive integers correctly', () => {
    expect(formatCurrency(1000)).toBe('₱1,000.00');
    expect(formatCurrency(5)).toBe('₱5.00');
  });

  it('formats numbers with decimals correctly', () => {
    expect(formatCurrency(1599.99)).toBe('₱1,599.99');
    expect(formatCurrency(10.5)).toBe('₱10.50');
  });

  it('formats negative numbers correctly', () => {
    expect(formatCurrency(-500)).toBe('-₱500.00');
  });

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('₱0.00');
  });

  it('rounds numbers with more than 2 decimal places', () => {
    expect(formatCurrency(10.555)).toBe('₱10.56');
    expect(formatCurrency(10.554)).toBe('₱10.55');
  });
});

describe('formatStartingPrice', () => {
  it('formats a given valid price correctly', () => {
    expect(formatStartingPrice(1200)).toBe('Starts at ₱1,200');
    expect(formatStartingPrice(5000)).toBe('Starts at ₱5,000');
  });

  it('uses default price (1599) when undefined is provided', () => {
    expect(formatStartingPrice(undefined)).toBe('Starts at ₱1,599');
  });

  it('uses default price (1599) when null is provided', () => {
    expect(formatStartingPrice(null)).toBe('Starts at ₱1,599');
  });

  it('uses default price (1599) when 0 is provided', () => {
    // Note: 0 is falsy, so `price || 1599` resolves to 1599.
    // This is the current behavior of the function.
    expect(formatStartingPrice(0)).toBe('Starts at ₱1,599');
  });
});
