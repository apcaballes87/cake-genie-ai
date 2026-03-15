'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * Renders children in SSR HTML for Googlebot. Content is absolutely positioned
 * so it overlaps with (rather than pushes down) the CSR interactive version.
 * After hydration, content is hidden via display:none.
 */
export function HideAfterHydration({ children }: { children: ReactNode }) {
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                zIndex: 0,
                pointerEvents: hydrated ? 'none' : undefined,
                display: hydrated ? 'none' : undefined,
            }}
            aria-hidden={hydrated || undefined}
        >
            {children}
        </div>
    );
}
