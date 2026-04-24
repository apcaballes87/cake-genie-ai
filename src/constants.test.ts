import { describe, expect, it } from 'vitest';
import {
    getEquivalentCakeSizeForIcingBase,
    getEquivalentCakeTypeForIcingBase,
} from './constants';

describe('icing base helpers', () => {
    it('maps soft icing cake types into the fondant equivalents', () => {
        expect(getEquivalentCakeTypeForIcingBase('1 Tier', 'fondant')).toBe('1 Tier Fondant');
        expect(getEquivalentCakeTypeForIcingBase('Square', 'fondant')).toBe('Square Fondant');
        expect(getEquivalentCakeTypeForIcingBase('Bento', 'fondant')).toBe('1 Tier Fondant');
    });

    it('maps cake sizes between soft icing and fondant labels', () => {
        expect(getEquivalentCakeSizeForIcingBase('6" Round', 'fondant')).toBe('6" Round Fondant');
        expect(getEquivalentCakeSizeForIcingBase('8" Square Fondant', 'soft_icing')).toBe('8" Square');
    });
});
