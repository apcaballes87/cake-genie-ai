'use client';

export const SEARCH_RETURN_STATE_KEY = 'genieph_search_return_state';

export type SearchReturnState = {
    returnUrl: string;
    targetPath: string | null;
    query: string;
    scrollY: number;
    resultCount: number;
    maxPrice: number | null;
    selectedColor: string | null;
    sortBy: 'relevant' | 'price_asc' | 'price_desc';
    savedAt: number;
};

const MAX_STATE_AGE_MS = 30 * 60 * 1000;

export function readSearchReturnState(now = Date.now()): SearchReturnState | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(SEARCH_RETURN_STATE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<SearchReturnState>;
        if (
            typeof parsed.returnUrl !== 'string' ||
            typeof parsed.query !== 'string' ||
            typeof parsed.scrollY !== 'number' ||
            typeof parsed.resultCount !== 'number' ||
            typeof parsed.savedAt !== 'number'
        ) {
            return null;
        }

        if (now - parsed.savedAt > MAX_STATE_AGE_MS) {
            window.sessionStorage.removeItem(SEARCH_RETURN_STATE_KEY);
            return null;
        }

        return {
            returnUrl: parsed.returnUrl,
            targetPath: typeof parsed.targetPath === 'string' ? parsed.targetPath : null,
            query: parsed.query,
            scrollY: Math.max(0, parsed.scrollY),
            resultCount: Math.max(0, parsed.resultCount),
            maxPrice: typeof parsed.maxPrice === 'number' ? parsed.maxPrice : null,
            selectedColor: typeof parsed.selectedColor === 'string' ? parsed.selectedColor : null,
            sortBy: parsed.sortBy === 'price_asc' || parsed.sortBy === 'price_desc' ? parsed.sortBy : 'relevant',
            savedAt: parsed.savedAt,
        };
    } catch {
        return null;
    }
}

export function writeSearchReturnState(state: Omit<SearchReturnState, 'savedAt'>): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(
            SEARCH_RETURN_STATE_KEY,
            JSON.stringify({
                ...state,
                scrollY: Math.max(0, state.scrollY),
                resultCount: Math.max(0, state.resultCount),
                savedAt: Date.now(),
            }),
        );
    } catch {
        // Session storage can be unavailable in private contexts; navigation should still work.
    }
}

export function isCurrentSearchReturnUrl(state: SearchReturnState | null): boolean {
    if (!state || typeof window === 'undefined') return false;
    return state.returnUrl === `${window.location.pathname}${window.location.search}`;
}
