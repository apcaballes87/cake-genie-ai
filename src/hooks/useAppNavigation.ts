// hooks/useAppNavigation.ts
import { useState, useRef, useEffect, useCallback } from 'react';

// Define and export the AppState type for use in other components
export type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation' | 'shared_design' | 'about' | 'how_to_order' | 'contact' | 'reviews';

export const useAppNavigation = () => {
    // State
    const [appState, _setAppState] = useState<AppState>('landing');
    const appStateRef = useRef(appState);
    const previousAppState = useRef<AppState | null>(null);
    const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
    const [viewingDesignId, setViewingDesignId] = useState<string | null>(null);

    // Custom setter for appState to also manage refs, ensuring consistency
    const setAppState = useCallback((newState: AppState) => {
        if (appStateRef.current !== newState) {
            previousAppState.current = appStateRef.current;
            appStateRef.current = newState;
            _setAppState(newState);
        }
    }, []);

    // Effect for SPA routing via URL hash
    useEffect(() => {
        const handleRouting = () => {
            const path = window.location.hash.substring(1); // remove '#'
            const designMatch = path.match(/^\/design\/([a-zA-Z0-9-]+)/);

            if (designMatch && designMatch[1]) {
                setViewingDesignId(designMatch[1]);
                setAppState('shared_design');
            } else {
                // If the hash is cleared but we're still on the shared page, go back to landing
                if (appStateRef.current === 'shared_design') {
                    setViewingDesignId(null);
                    setAppState('landing');
                }
            }
        };

        // Listen for direct hash changes
        window.addEventListener('hashchange', handleRouting);
        
        // Listen for browser back/forward button clicks
        window.addEventListener('popstate', handleRouting);

        // Initial check on component mount to handle direct URL access
        handleRouting();

        // Cleanup listeners on unmount
        return () => {
            window.removeEventListener('hashchange', handleRouting);
            window.removeEventListener('popstate', handleRouting);
        };
    }, [setAppState]); // setAppState is stable due to useCallback

    return {
        appState,
        previousAppState, // The ref for immediate access without re-renders
        confirmedOrderId,
        viewingDesignId,
        setAppState,
        setConfirmedOrderId,
    };
};