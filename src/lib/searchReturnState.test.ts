import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SEARCH_RETURN_STATE_KEY,
    isCurrentSearchReturnUrl,
    readSearchReturnState,
    writeSearchReturnState,
} from './searchReturnState';

describe('searchReturnState', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        window.history.replaceState({}, '', '/search?q=birthday');
        vi.setSystemTime(new Date('2026-07-08T01:00:00Z'));
    });

    it('round-trips the search return snapshot', () => {
        writeSearchReturnState({
            returnUrl: '/search?q=birthday',
            targetPath: '/customizing/birthday-cake',
            query: 'birthday',
            scrollY: 820,
            resultCount: 24,
            maxPrice: 2000,
            selectedColor: 'pink',
            sortBy: 'price_asc',
        });

        expect(readSearchReturnState()).toMatchObject({
            returnUrl: '/search?q=birthday',
            targetPath: '/customizing/birthday-cake',
            query: 'birthday',
            scrollY: 820,
            resultCount: 24,
            maxPrice: 2000,
            selectedColor: 'pink',
            sortBy: 'price_asc',
        });
        expect(isCurrentSearchReturnUrl(readSearchReturnState())).toBe(true);
    });

    it('drops expired snapshots', () => {
        window.sessionStorage.setItem(
            SEARCH_RETURN_STATE_KEY,
            JSON.stringify({
                returnUrl: '/search?q=birthday',
                targetPath: '/customizing/birthday-cake',
                query: 'birthday',
                scrollY: 100,
                resultCount: 12,
                savedAt: Date.now() - 31 * 60 * 1000,
            }),
        );

        expect(readSearchReturnState()).toBeNull();
        expect(window.sessionStorage.getItem(SEARCH_RETURN_STATE_KEY)).toBeNull();
    });
});
