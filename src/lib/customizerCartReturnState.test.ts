import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CUSTOMIZER_CART_RETURN_STATE_KEY,
    takeCustomizerCartReturnState,
    writeCustomizerCartReturnState,
} from './customizerCartReturnState';

const returnUrl = '/customizing/pink-cake?size=8#summary';

describe('customizer cart return state', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        vi.setSystemTime(new Date('2026-07-26T00:00:00Z'));
    });

    it('restores the saved editor state once for its originating customizer URL', () => {
        writeCustomizerCartReturnState({
            returnUrl,
            customization: {
                cakeInfo: { type: '1 Tier', size: '8" Round', thickness: '4 in', flavors: ['Chocolate Cake'] },
                additionalInstructions: 'Add extra pearls',
            },
            activeTab: 'customized',
            isCustomizationDirty: true,
            dirtyFields: ['cakeInfo.size', 'additionalInstructions'],
        });

        expect(takeCustomizerCartReturnState(returnUrl)).toMatchObject({
            returnUrl,
            activeTab: 'customized',
            isCustomizationDirty: true,
            dirtyFields: ['cakeInfo.size', 'additionalInstructions'],
            customization: {
                cakeInfo: { size: '8" Round' },
                additionalInstructions: 'Add extra pearls',
            },
        });
        expect(window.sessionStorage.getItem(CUSTOMIZER_CART_RETURN_STATE_KEY)).toBeNull();
    });

    it('discards snapshots for another design or an expired cart trip', () => {
        writeCustomizerCartReturnState({
            returnUrl,
            customization: {},
            activeTab: 'original',
            isCustomizationDirty: false,
            dirtyFields: [],
        });
        expect(takeCustomizerCartReturnState('/customizing/other-cake')).toBeNull();

        window.sessionStorage.setItem(CUSTOMIZER_CART_RETURN_STATE_KEY, JSON.stringify({
            returnUrl,
            customization: {},
            activeTab: 'original',
            isCustomizationDirty: false,
            dirtyFields: [],
            savedAt: Date.now() - 31 * 60 * 1000,
        }));
        expect(takeCustomizerCartReturnState(returnUrl)).toBeNull();
    });
});
