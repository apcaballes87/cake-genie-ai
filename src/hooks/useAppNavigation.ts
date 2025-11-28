import { useState, useRef, useEffect, useCallback } from 'react';

// Define and export the AppState type for use in other components
export type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation' | 'shared_design' | 'about' | 'how_to_order' | 'contact' | 'reviews' | 'not_found' | 'set_password' | 'contribute';

export const useAppNavigation = () => {
    // State
    const [appState, _setAppState] = useState<AppState>('landing');
    const appStateRef = useRef(appState);
    const previousAppState = useRef<AppState | null>(null);
    const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
    const [viewingDesignId, setViewingDesignId] = useState<string | null>(null);

    const [urlDiscountCode, setUrlDiscountCode] = useState<string | null>(null);
    const [contributeOrderId, setContributeOrderId] = useState<string | null>(null);

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
        // Handle pathname redirects for static pages (e.g. /about -> /#/about)
        // This ensures that if a user (or bot) visits the non-hash URL directly, they get redirected to the correct SPA route.
        if (window.location.pathname !== '/' && !window.location.hash) {
            const path = window.location.pathname;
            const staticRoutes = ['/about', '/contact', '/how-to-order', '/reviews'];

            // Check if the current path matches a static route (exact match or sub-path)
            const isStaticRoute = staticRoutes.some(route => path === route || path.startsWith(`${route}/`));

            if (isStaticRoute) {
                console.log(`[Routing] Redirecting static path ${path} to hash route /#${path}`);
                window.location.replace(`/#${path}${window.location.search}`);
                return;
            }

            // Check if this is a discount code (alphanumeric only, case insensitive)
            const discountCodeMatch = path.match(/^\/([A-Za-z0-9]+)\/?$/i);
            if (discountCodeMatch && discountCodeMatch[1]) {
                const code = discountCodeMatch[1].toUpperCase();
                console.log(`[Routing] Detected discount code from pathname: ${code}, redirecting to hash route`);
                window.location.replace(`/#/${code}`);
                return;
            }
        }

        const handleRouting = () => {
            console.log('[Routing] Handling route for hash:', window.location.hash);
            let pathWithQuery = window.location.hash.substring(1) || ''; // e.g., /order-confirmation?order_id=... or /auth/set-password#access_token=...

            // Supabase appends auth tokens with # (e.g., #access_token=...), so we need to handle both ? and #
            // Split by # first to remove Supabase auth tokens, then split by ? for regular query params
            const [pathWithPossibleQuery] = pathWithQuery.split('#');
            const [path = '', queryString] = pathWithPossibleQuery.split('?');
            const params = new URLSearchParams(queryString || '');

            console.log('[Routing] Parsed Path:', path, 'Query:', queryString);

            // Ensure path is a string before calling .match()
            if (!path || typeof path !== 'string') {
                // If path is invalid, reset to landing if needed
                if (appStateRef.current === 'shared_design') {
                    setViewingDesignId(null);
                    setAppState('landing');
                }
                return;
            }

            const designMatch = path.match(/^\/designs\/([a-z0-9-]+)\/?$/);
            const orderConfirmationMatch = path.match(/^\/order-confirmation\/?$/);
            const customizingMatch = path.match(/^\/customizing\/?$/);
            const oldDesignMatch = path.match(/^\/design\/([a-zA-Z0-9-]+)\/?$/);
            const discountMatch = path.match(/^\/([A-Za-z0-9]+)\/?$/i);
            const contributeMatch = path.match(/^\/contribute\/([a-zA-Z0-9-]+)\/?$/);

            // Static route matching
            const aboutMatch = path.match(/^\/about\/?$/);
            const contactMatch = path.match(/^\/contact\/?$/);
            const howToOrderMatch = path.match(/^\/how-to-order\/?$/);
            const reviewsMatch = path.match(/^\/reviews\/?$/);
            const setPasswordMatch = path.match(/^\/auth\/set-password/);

            if (customizingMatch && params.get('image') && (params.get('source') === 'shopify' || params.get('source') === 'shopify_search')) {
                const imageUrl = params.get('image');
                const shopifyRowId = params.get('shopify_rowid');
                console.log('[Routing] Matched customizing with Shopify image:', imageUrl);

                // Store in sessionStorage for App.tsx to pick up
                if (imageUrl) {
                    sessionStorage.setItem('shopify_image_url', decodeURIComponent(imageUrl));
                }
                if (shopifyRowId) {
                    sessionStorage.setItem('shopify_rowid', decodeURIComponent(shopifyRowId));
                    sessionStorage.setItem('came_from_shopify', 'true');
                }

                // Set state to customizing
                setAppState('customizing');
            } else if (orderConfirmationMatch && params.get('order_id')) {
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
            } else if (oldDesignMatch && oldDesignMatch[1]) { // Keep for backward compatibility
                setViewingDesignId(oldDesignMatch[1]);
                setAppState('shared_design');
            } else if (contributeMatch && contributeMatch[1]) {
                setContributeOrderId(contributeMatch[1]);
                setAppState('contribute');
            } else if (aboutMatch) {
                setAppState('about');
            } else if (contactMatch) {
                setAppState('contact');
            } else if (howToOrderMatch) {
                setAppState('how_to_order');
            } else if (reviewsMatch) {
                setAppState('reviews');
            } else if (setPasswordMatch) {
                setAppState('set_password');
            } else if (discountMatch && discountMatch[1]) {
                // Discount code route - store code and go to landing
                const code = discountMatch[1].toUpperCase();
                console.log('[Routing] Matched discount code:', code);
                setUrlDiscountCode(code);
                // User stays on landing page, code will be applied when they visit cart
                if (appStateRef.current !== 'landing') {
                    setAppState('landing');
                }
            } else {
                // If the hash is cleared or doesn't match a special route, reset to landing.
                if (appStateRef.current === 'shared_design' ||
                    ['about', 'contact', 'how_to_order', 'reviews', 'contribute'].includes(appStateRef.current)) {
                    setViewingDesignId(null);
                    setContributeOrderId(null);
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
    }, [setAppState, setConfirmedOrderId, setViewingDesignId]);

    return {
        appState,
        previousAppState, // The ref for immediate access without re-renders
        confirmedOrderId,
        viewingDesignId,
        urlDiscountCode,

        contributeOrderId,
        setAppState,
        setConfirmedOrderId,
        setUrlDiscountCode,
    };
};