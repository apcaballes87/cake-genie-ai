import { describe, expect, it } from 'vitest';

import { toGoogleMerchantId } from './feedIds';

describe('toGoogleMerchantId', () => {
  it('keeps already compliant ids unchanged', () => {
    expect(toGoogleMerchantId('pink-cake-1234')).toBe('pink-cake-1234');
  });

  it('shortens overlong ids to 50 characters', () => {
    const sourceId =
      'minimalist-ribbon-ffffffsidecolorffffffgumpastebaseboardcolorffffff-1-tier-cake-1f2f';
    const result = toGoogleMerchantId(
      sourceId,
    );

    expect(result).toHaveLength(50);
    expect(sourceId.startsWith(result.slice(0, 41))).toBe(true);
    expect(result).toMatch(/^.+-[0-9a-f]{8}$/);
  });

  it('returns a stable deterministic value for the same source id', () => {
    const sourceId =
      'minimalist-ribbon-ffffffsidecolorffffffgumpastebaseboardcolorffffff-1-tier-cake-1f2f';

    expect(toGoogleMerchantId(sourceId)).toBe(toGoogleMerchantId(sourceId));
  });

  it('produces distinct shortened ids for distinct long source ids', () => {
    const a = toGoogleMerchantId(
      'minimalist-ribbon-ffffffsidecolorffffffgumpastebaseboardcolorffffff-1-tier-cake-1f2f',
    );
    const b = toGoogleMerchantId(
      'minimalist-ribbon-ffffffsidecolorffffffgumpastebaseboardcolorffffff-1-tier-cake-9abc',
    );

    expect(a).not.toBe(b);
  });
});
