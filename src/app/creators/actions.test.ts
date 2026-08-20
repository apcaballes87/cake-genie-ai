import { describe, expect, it } from 'vitest';
import { normalizeCreatorPromoCode } from './promoCode';

describe('creator promo codes', () => {
  it('normalizes handles and editable codes to uppercase alphanumeric values', () => {
    expect(normalizeCreatorPromoCode('@rawan.ph!')).toBe('RAWANPH');
    expect(normalizeCreatorPromoCode('My Custom-Code')).toBe('MYCUSTOMCODE');
  });
});
