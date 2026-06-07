'use client';

import React, { useEffect, useRef } from 'react';

declare global {
    interface Window {
        turnstile?: {
            render: (container: string | HTMLElement, options: any) => string;
            remove: (widgetId: string) => void;
            getResponse: (widgetId: string) => string;
            reset: (widgetId: string) => void;
        };
    }
}


interface TurnstileWidgetProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
    className?: string;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
    onVerify,
    onExpire,
    onError,
    className
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
        const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
        if (!siteKey) {
            if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
                console.warn('[TurnstileWidget] NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY is not defined. Turnstile widget will be hidden.');
            }
            return;
        }

        // Check if script is already loaded
        let script = document.getElementById('cloudflare-turnstile-script') as HTMLScriptElement | null;
        
        const initializeTurnstile = () => {
            if (!containerRef.current || !window.turnstile) return;
            
            // Clean up existing widget if any
            if (widgetIdRef.current) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (e) {
                    console.error('Error removing Turnstile widget:', e);
                }
                widgetIdRef.current = null;
            }

            try {
                const id = window.turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    callback: onVerify,
                    'expired-callback': onExpire || (() => onVerify('')),
                    'error-callback': onError || (() => onVerify('')),
                    theme: 'light',
                });
                widgetIdRef.current = id;
            } catch (err) {
                console.error('Failed to render Turnstile widget:', err);
            }
        };

        if (!script) {
            script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';
            script.async = true;
            script.defer = true;
            script.id = 'cloudflare-turnstile-script';
            
            // Set global callback
            (window as any).onloadTurnstileCallback = () => {
                initializeTurnstile();
            };

            document.head.appendChild(script);
        } else {
            if (window.turnstile) {
                initializeTurnstile();
            } else {
                // Wait for it to load
                const checkInterval = setInterval(() => {
                    if (window.turnstile) {
                        clearInterval(checkInterval);
                        initializeTurnstile();
                    }
                }, 100);
                return () => clearInterval(checkInterval);
            }
        }

        return () => {
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (e) {
                    // Ignore error during unmount
                }
            }
        };
    }, [onVerify, onExpire, onError]);

    const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
    if (!siteKey) return null;

    return (
        <div 
            ref={containerRef} 
            className={`flex justify-center my-3 ${className || ''}`} 
        />
    );
};
