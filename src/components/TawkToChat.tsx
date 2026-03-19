'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

/**
 * Tawk.to Live Chat Widget Component
 * This component loads the Tawk.to chat widget globally across all pages.
 * 
 * Dashboard: https://dashboard.tawk.to/
 */
export const TawkToChat = () => {
    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        // Skip if already loaded or about to load
        if (typeof window === 'undefined' || window.Tawk_API || shouldLoad) return;

        const triggerEvents = ['scroll', 'mousemove', 'touchstart', 'keydown'];

        const handleInteraction = () => {
            setShouldLoad(true);
            removeEventListeners();
        };

        const removeEventListeners = () => {
            triggerEvents.forEach(event => {
                window.removeEventListener(event, handleInteraction);
            });
        };

        // Add interaction listeners for lazy loading
        triggerEvents.forEach(event => {
            window.addEventListener(event, handleInteraction, { once: true, passive: true });
        });

        return () => {
            removeEventListeners();
        };
    }, [shouldLoad]);

    useEffect(() => {
        if (!shouldLoad) return;

        // Initialize Tawk.to API before script loads to avoid race conditions
        window.Tawk_API = window.Tawk_API || {};
        window.Tawk_LoadStart = new Date();

        // Calculate 8% vertical position + 15px extra
        const vOffset = (typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.08) : 60) + 15;

        // Adjust widget position
        window.Tawk_API.customStyle = {
            visibility: {
                desktop: {
                    position: 'tr', // top right
                    xOffset: 15,
                    yOffset: vOffset
                },
                mobile: {
                    position: 'tr',
                    xOffset: 15,
                    yOffset: vOffset
                }
            }
        };

        // Add event listeners for the API if needed
        window.Tawk_API.onLoad = function () {
            if (process.env.NODE_ENV === 'development') {
                console.log('[Tawk.to] Widget loaded successfully');
            }
        };

        window.Tawk_API.onStatusChange = function (status: string) {
            // Optional: Handle status changes
        };

    }, [shouldLoad]);

    if (!shouldLoad) return null;

    return (
        <Script
            id="tawk-to-script"
            src="https://embed.tawk.to/694211438ecd79197d49cf01/1jcl16sm3"
            strategy="afterInteractive"
            crossOrigin="anonymous"
        />
    );
};

export default TawkToChat;

// Extend Window interface for TypeScript
declare global {
    interface Window {
        Tawk_API?: any;
        Tawk_LoadStart?: Date;
    }
}
