'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type PageType = 'home' | 'search' | 'customizing' | 'cart' | 'saved' | 'account' | 'collections' | 'unknown';

interface NavigationState {
    currentPage: PageType;
    previousPage: PageType;
    entrySource: string | null; // How they entered current page (e.g., 'search', 'home', 'shared_link')
    referrerUrl: string | null;
}

interface NavigationContextType {
    navigationState: NavigationState;
    recordNavigation: (page: PageType, source?: string | null) => void;
    canGoBack: () => boolean;
    getBackDestination: () => string;
}

const defaultNavigationState: NavigationState = {
    currentPage: 'home',
    previousPage: 'unknown',
    entrySource: null,
    referrerUrl: null,
};

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Storage key for session persistence
const STORAGE_KEY = 'genieph_navigation_state';

export function NavigationProvider({ children }: { children: React.ReactNode }) {
    const [navigationState, setNavigationState] = useState<NavigationState>(defaultNavigationState);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load state from sessionStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = sessionStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setNavigationState(parsed);
                }
            } catch (e) {
                console.warn('Failed to parse navigation state:', e);
            }
            setIsInitialized(true);
        }
    }, []);

    // Persist state to sessionStorage
    useEffect(() => {
        if (isInitialized && typeof window !== 'undefined') {
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(navigationState));
            } catch (e) {
                console.warn('Failed to save navigation state:', e);
            }
        }
    }, [navigationState, isInitialized]);

    const recordNavigation = useCallback((page: PageType, source: string | null = null) => {
        setNavigationState(prev => ({
            previousPage: prev.currentPage,
            currentPage: page,
            entrySource: source,
            referrerUrl: typeof window !== 'undefined' ? window.location.href : null,
        }));
    }, []);

    const canGoBack = useCallback(() => {
        // Can go back if there's a valid previous page that isn't unknown
        return navigationState.previousPage !== 'unknown' &&
            navigationState.previousPage !== navigationState.currentPage;
    }, [navigationState.previousPage, navigationState.currentPage]);

    const getBackDestination = useCallback((): string => {
        const { previousPage, currentPage, entrySource } = navigationState;

        // If we have a valid previous page, use it
        if (previousPage !== 'unknown' && previousPage !== currentPage) {
            return getPathForPage(previousPage);
        }

        // Fall back to page-specific defaults
        switch (currentPage) {
            case 'search':
                return '/';
            case 'customizing':
                // If came from search, go back to search
                if (entrySource === 'search') {
                    return '/search';
                }
                // Otherwise go home
                return '/';
            case 'cart':
            case 'saved':
            case 'account':
            case 'collections':
                return '/';
            default:
                return '/';
        }
    }, [navigationState]);

    return (
        <NavigationContext.Provider value={{ navigationState, recordNavigation, canGoBack, getBackDestination }}>
            {children}
        </NavigationContext.Provider>
    );
}

function getPathForPage(page: PageType): string {
    switch (page) {
        case 'home':
            return '/';
        case 'search':
            return '/search';
        case 'customizing':
            return '/customizing';
        case 'cart':
            return '/cart';
        case 'saved':
            return '/saved';
        case 'account':
            return '/account';
        case 'collections':
            return '/collections';
        default:
            return '/';
    }
}

export function useNavigation() {
    const context = useContext(NavigationContext);
    if (context === undefined) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return context;
}

export { NavigationContext };
