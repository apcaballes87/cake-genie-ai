'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * Renders children in SSR HTML for Googlebot, then hides them after client
 * hydration so the interactive version takes over without duplicates.
 */
export function HideAfterHydration({ children }: { children: ReactNode }) {
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    if (hydrated) return null;

    return <>{children}</>;
}
