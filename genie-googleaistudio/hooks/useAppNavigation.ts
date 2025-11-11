import { useState, useRef, useEffect, useCallback } from 'react';

// Define and export the AppState type for use in other components
export type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation' | 'shared_design' | 'about' | 'how_to_order' | 'contact' | 'reviews' | 'shopify_customizing' | 'pricing_sandbox';

export const useAppNavigation = () => {
    // State
    const [appState, _setAppState] = useState<AppState>('landing');
    const appStateRef = useRef(appState);
    const previousAppState = useRef<AppState | null>(null);
    const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
    const [viewingDesignId, setViewingDesignId] = useState<string | null>(null);
    const [viewingShopifySessionId, setViewingShopifySessionId] = useState<string | null>(null);

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
            console.log('[Routing] Handling route for hash:', window.location.hash);
            const pathWithQuery = window.location.hash.substring(1); // e.g., /order-confirmation?order_id=...

            const [path, queryString] = pathWithQuery.split('?');
            const params = new URLSearchParams(queryString || '');
            
            console.log('[Routing] Parsed Path:', path, 'Query:', queryString);

            const designMatch = path.match(/^\/designs\/([a-z0-9-]+)\/?$/);
            const shopifyMatch = path.match(/^\/cakesandmemories\/([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})\/?$/);
            const orderConfirmationMatch = path.match(/^\/order-confirmation\/?$/);
            const oldDesignMatch = path.match(/^\/design\/([a-zA-Z0-9-]+)\/?$/);

            if (orderConfirmationMatch && params.get('order_id')) {
                const orderId = params.get('order_id');
                console.log('[Routing] Matched order confirmation with orderId:', orderId);
                if (orderId) {
                    setConfirmedOrderId(orderId);
                    setAppState('order_confirmation');
                    // TEMPORARILY REMOVED to debug state loss issues. The URL will keep the query param.
                    // window.history.replaceState({}, document.title, `${window.location.pathname}#/order-confirmation`);
                }
            } else if (designMatch && designMatch[1]) {
                setViewingDesignId(designMatch[1]);
                setAppState('shared_design');
            } else if (oldDesignMatch && oldDesignMatch[1]) { // Keep for backward compatibility
                setViewingDesignId(oldDesignMatch[1]);
                setAppState('shared_design');
            } else if (shopifyMatch && shopifyMatch[1]) {
                const sessionId = shopifyMatch[1];
                setViewingShopifySessionId(sessionId);
                setAppState('shopify_customizing');
            } else {
                // If the hash is cleared or doesn't match a special route, reset to landing.
                if (appStateRef.current === 'shared_design' || appStateRef.current === 'shopify_customizing') {
                    setViewingDesignId(null);
                    setViewingShopifySessionId(null);
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
    }, [setAppState, setConfirmedOrderId, setViewingDesignId, setViewingShopifySessionId]);

    return {
        appState,
        previousAppState, // The ref for immediate access without re-renders
        confirmedOrderId,
        viewingDesignId,
        viewingShopifySessionId,
        setAppState,
        setConfirmedOrderId,
    };
};