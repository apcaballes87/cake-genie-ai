'use client';

import { useEffect } from 'react';

/**
 * Tawk.to Live Chat Widget Component
 * This component loads the Tawk.to chat widget globally across all pages.
 * 
 * Dashboard: https://dashboard.tawk.to/
 */
export default function TawkToChat() {
    useEffect(() => {
        // Skip if already loaded
        if (window.Tawk_API) return;

        // Initialize Tawk.to API
        window.Tawk_API = window.Tawk_API || {};
        window.Tawk_LoadStart = new Date();

        // Create and inject the Tawk.to script
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://embed.tawk.to/694211438ecd79197d49cf01/1jcl16sm3';
        script.charset = 'UTF-8';
        script.setAttribute('crossorigin', '*');

        const firstScript = document.getElementsByTagName('script')[0];
        if (firstScript?.parentNode) {
            firstScript.parentNode.insertBefore(script, firstScript);
        } else {
            document.body.appendChild(script);
        }

        // Cleanup on unmount (optional - usually not needed for global widgets)
        return () => {
            // Note: Tawk.to doesn't provide a clean unload function
            // The widget persists to avoid re-loading on navigation
        };
    }, []);

    return null;
}

// Extend Window interface for TypeScript
declare global {
    interface Window {
        Tawk_API?: any;
        Tawk_LoadStart?: Date;
    }
}
