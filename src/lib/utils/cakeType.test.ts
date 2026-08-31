import { describe, expect, it } from 'vitest';

import { isCanonicalCakeType, normalizeCakeType } from './cakeType';

describe('normalizeCakeType', () => {
  it('keeps canonical cake types stable', () => {
    expect(normalizeCakeType('1 Tier')).toBe('1 Tier');
    expect(normalizeCakeType(' 2 Tier Fondant ')).toBe('2 Tier Fondant');
    expect(normalizeCakeType('Rectangle')).toBe('Rectangle');
    expect(normalizeCakeType('Slab Cake')).toBe('Slab Cake');
  });

  it('maps legacy AI and slug-style labels to pricing table types', () => {
    expect(normalizeCakeType('cupcakes-printout-toppers')).toBe('Cupcake');
    expect(normalizeCakeType('cupcakes_icing')).toBe('Cupcake');
    expect(normalizeCakeType('4 Tier Fondant')).toBe('3 Tier Fondant');
    expect(normalizeCakeType('bento-cupcake-set')).toBe('Bento Cupcake Set');
    expect(normalizeCakeType('tall-slab-cake')).toBe('Slab Cake');
  });

  it('uses the fallback for empty or non-string values', () => {
    expect(normalizeCakeType(undefined)).toBe('1 Tier');
    expect(normalizeCakeType('null', 'Cupcake')).toBe('Cupcake');
  });
});

describe('isCanonicalCakeType', () => {
  it('only accepts canonical cake type strings', () => {
    expect(isCanonicalCakeType('1 Tier')).toBe(true);
    expect(isCanonicalCakeType(' 1 Tier ')).toBe(true);
    expect(isCanonicalCakeType('Slab Cake')).toBe(true);
    expect(isCanonicalCakeType('cupcakes-icing')).toBe(false);
  });
});
