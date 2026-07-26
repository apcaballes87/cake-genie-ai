import { describe, expect, it } from 'vitest';
import {
    buildCartReturnUrl,
    getCustomizerCartReturnUrl,
} from './cartReturnNavigation';

describe('cart return navigation', () => {
    it('builds a cart URL that preserves the exact customizer path', () => {
        const returnTo = '/customizing/pink-cake?size=8&height=4#summary';

        expect(buildCartReturnUrl(returnTo)).toBe(
            '/cart?returnTo=%2Fcustomizing%2Fpink-cake%3Fsize%3D8%26height%3D4%23summary',
        );
    });

    it('accepts a customizer return path with options and a hash', () => {
        expect(getCustomizerCartReturnUrl('/customizing/pink-cake?size=8&height=4#summary')).toBe(
            '/customizing/pink-cake?size=8&height=4#summary',
        );
    });

    it('rejects unsafe or non-customizer return paths', () => {
        expect(getCustomizerCartReturnUrl('https://evil.example/customizing/pink-cake')).toBeNull();
        expect(getCustomizerCartReturnUrl('//evil.example/customizing/pink-cake')).toBeNull();
        expect(getCustomizerCartReturnUrl('/cart')).toBeNull();
        expect(getCustomizerCartReturnUrl('/customizing/../cart')).toBeNull();
    });
});
