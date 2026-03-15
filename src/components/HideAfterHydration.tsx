'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * Renders children in SSR HTML for Googlebot. After client hydration,
 * positions them absolutely behind the interactive CSR version so there's
 * no visual flash during the transition.
 */
export function HideAfterHydration({ children }: { children: ReactNode }) {
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    return (
        <div
            className={hydrated ? 'absolute inset-x-0 z-0 pointer-events-none' : 'relative z-10'}
            aria-hidden={hydrated || undefined}
        >
            {children}
        </div>
    );
}
