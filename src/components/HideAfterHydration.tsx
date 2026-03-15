'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * Renders children in SSR HTML for Googlebot, then hides them after client
 * hydration so the interactive version takes over without duplicates.
 * Content stays in the DOM (display:none) for stable hydration.
 */
export function HideAfterHydration({ children }: { children: ReactNode }) {
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    return (
        <div className={hydrated ? 'hidden' : ''} aria-hidden={hydrated || undefined}>
            {children}
        </div>
    );
}
