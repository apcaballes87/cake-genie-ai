'use client';

import type { CustomizationState } from '@/contexts/CustomizationContext';

export const CUSTOMIZER_CART_RETURN_STATE_KEY = 'genieph_customizer_cart_return_state';
const MAX_STATE_AGE_MS = 30 * 60 * 1000;

export type CustomizerCartReturnState = {
    returnUrl: string;
    customization: CustomizationState;
    activeTab: 'original' | 'customized';
    isCustomizationDirty: boolean;
    dirtyFields: string[];
    savedAt: number;
};

type CustomizerCartReturnStateInput = Omit<CustomizerCartReturnState, 'savedAt'>;

export function writeCustomizerCartReturnState(state: CustomizerCartReturnStateInput): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(
            CUSTOMIZER_CART_RETURN_STATE_KEY,
            JSON.stringify({ ...state, savedAt: Date.now() }),
        );
    } catch {
        // Navigation still works if sessionStorage is unavailable or full.
    }
}

export function takeCustomizerCartReturnState(
    returnUrl: string,
    now = Date.now(),
): CustomizerCartReturnState | null {
    if (typeof window === 'undefined') return null;

    const raw = window.sessionStorage.getItem(CUSTOMIZER_CART_RETURN_STATE_KEY);
    if (!raw) return null;

    window.sessionStorage.removeItem(CUSTOMIZER_CART_RETURN_STATE_KEY);

    try {
        const parsed = JSON.parse(raw) as Partial<CustomizerCartReturnState>;
        if (
            typeof parsed.returnUrl !== 'string' ||
            parsed.returnUrl !== returnUrl ||
            typeof parsed.savedAt !== 'number' ||
            !Number.isFinite(parsed.savedAt) ||
            now < parsed.savedAt ||
            now - parsed.savedAt > MAX_STATE_AGE_MS ||
            !parsed.customization ||
            typeof parsed.customization !== 'object' ||
            (parsed.activeTab !== 'original' && parsed.activeTab !== 'customized') ||
            typeof parsed.isCustomizationDirty !== 'boolean' ||
            !Array.isArray(parsed.dirtyFields) ||
            !parsed.dirtyFields.every((field) => typeof field === 'string')
        ) {
            return null;
        }

        return {
            returnUrl: parsed.returnUrl,
            customization: parsed.customization as CustomizationState,
            activeTab: parsed.activeTab,
            isCustomizationDirty: parsed.isCustomizationDirty,
            dirtyFields: parsed.dirtyFields,
            savedAt: parsed.savedAt,
        };
    } catch {
        return null;
    }
}
