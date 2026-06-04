import { describe, expect, it } from 'vitest';

import { slugToTitle } from './pinterest';

describe('slugToTitle', () => {
  it('strips long and short trailing hash-like suffixes', () => {
    expect(slugToTitle('travel-suitcase-sky-blue-square-cake-30e2'))
      .toBe('Travel Suitcase Sky Blue Square Cake');
    expect(slugToTitle('ps5-birthday-cake-c0fcef5f63fefeff'))
      .toBe('Ps5 Birthday Cake');
  });

  it('keeps legitimate numeric suffixes that are not hash-like', () => {
    expect(slugToTitle('graduation-cake-2025')).toBe('Graduation Cake 2025');
  });
});
