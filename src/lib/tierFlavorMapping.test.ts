import { describe, expect, it } from 'vitest';
import { buildTierFlavorAssignments } from './tierFlavorMapping';

describe('buildTierFlavorAssignments', () => {
  it('makes a 3-tier fondant variant self-describing in top-to-bottom order', () => {
    expect(buildTierFlavorAssignments(
      '3 Tier Fondant',
      '7"10"14" Fondant',
      ['Vanilla Cake', 'Ube Cake', 'Chocolate Cake'],
    )).toEqual([
      { tier: 'top', size: '7"', flavor: 'Vanilla Cake' },
      { tier: 'middle', size: '10"', flavor: 'Ube Cake' },
      { tier: 'bottom', size: '14"', flavor: 'Chocolate Cake' },
    ]);
  });

  it('supports the slash-separated two-tier size format', () => {
    expect(buildTierFlavorAssignments(
      '2 Tier',
      '6"/8" Round',
      ['Vanilla Cake', 'Chocolate Cake'],
    )).toEqual([
      { tier: 'top', size: '6"', flavor: 'Vanilla Cake' },
      { tier: 'bottom', size: '8"', flavor: 'Chocolate Cake' },
    ]);
  });

  it('does not manufacture an association for incomplete tier data', () => {
    expect(buildTierFlavorAssignments(
      '3 Tier Fondant',
      '7"10"14" Fondant',
      ['Vanilla Cake', 'Ube Cake'],
    )).toBeUndefined();
  });
});
