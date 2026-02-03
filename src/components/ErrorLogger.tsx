'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// Generate a simple session ID for correlating errors
const getSessionId = (): string => {
    if (typeof window === 'undefined') return '';

    let sessionId = sessionStorage.getItem('error_session_id');
    if (!sessionId) {
        sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('error_session_id', sessionId);
    }
    return sessionId;
};

// Check if cookies are blocked
const checkCookiesBlocked = (): boolean => {
    try {
        document.cookie = 'cookietest=1; SameSite=Strict';
        const cookiesEnabled = document.cookie.indexOf('cookietest=') !== -1;
        // Clean up test cookie
        document.cookie = 'cookietest=1; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
        return !cookiesEnabled;
    } catch {
        return true; // If we can't even test, cookies are likely blocked
    }
};

interface ErrorLogPayload {
    error_message: string;
    error_stack?: string;
    error_type: 'error' | 'unhandledrejection' | 'cookie_blocked' | 'network' | 'unknown';
    page_url: string;
    page_path: string;
    user_agent: string;
    viewport_width: number;
    viewport_height: number;
    session_id: string;
    metadata?: Record<string, unknown>;
}

// Debounce to prevent flooding with identical errors
const recentErrors = new Set<string>();
const ERROR_DEDUPE_WINDOW_MS = 5000; // 5 seconds

const logErrorToSupabase = async (payload: ErrorLogPayload): Promise<void> => {
    // Create a unique key for this error to prevent duplicates
    const errorKey = `${payload.error_type}:${payload.error_message}:${payload.page_path}`;

    if (recentErrors.has(errorKey)) {
        return; // Skip duplicate
    }

    recentErrors.add(errorKey);
    setTimeout(() => recentErrors.delete(errorKey), ERROR_DEDUPE_WINDOW_MS);

    try {
        const supabase = createClient();

        await supabase
            .from('client_errors')
            .insert([payload]);

        // Also log to console for development
        if (process.env.NODE_ENV === 'development') {
            console.log('[ErrorLogger] Logged error:', payload.error_message);
        }
    } catch (e) {
        // Silently fail - we don't want error logging to cause more errors
        console.error('[ErrorLogger] Failed to log error:', e);
    }
};

// Component that sets up global error handlers
export const ErrorLogger: React.FC = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const sessionId = getSessionId();

        // Check for cookie blocking on mount and log if blocked
        const cookiesBlocked = checkCookiesBlocked();
        if (cookiesBlocked) {
            logErrorToSupabase({
                error_message: 'Cookies are blocked or unavailable',
                error_type: 'cookie_blocked',
                page_url: window.location.href,
                page_path: window.location.pathname,
                user_agent: navigator.userAgent,
                viewport_width: window.innerWidth,
                viewport_height: window.innerHeight,
                session_id: sessionId,
                metadata: {
                    cookiesBlocked: true,
                    privateMode: 'possibly'
                }
            });
        }

        // Global error handler
        const handleError = (event: ErrorEvent) => {
            // Filter out third-party script errors (cross-origin)
            const isThirdPartyError = event.message === 'Script error.' && !event.filename;

            logErrorToSupabase({
                error_message: event.message || 'Unknown error',
                error_stack: event.error?.stack,
                error_type: isThirdPartyError ? 'unknown' : 'error',
                page_url: window.location.href,
                page_path: window.location.pathname,
                user_agent: navigator.userAgent,
                viewport_width: window.innerWidth,
                viewport_height: window.innerHeight,
                session_id: sessionId,
                metadata: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    isThirdParty: isThirdPartyError
                }
            });
        };

        // Unhandled promise rejection handler
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const errorMessage = event.reason?.message ||
                event.reason?.toString() ||
                'Unhandled promise rejection';

            logErrorToSupabase({
                error_message: errorMessage,
                error_stack: event.reason?.stack,
                error_type: 'unhandledrejection',
                page_url: window.location.href,
                page_path: window.location.pathname,
                user_agent: navigator.userAgent,
                viewport_width: window.innerWidth,
                viewport_height: window.innerHeight,
                session_id: sessionId,
                metadata: {
                    reason: typeof event.reason === 'object' ?
                        JSON.stringify(event.reason, null, 2).substring(0, 1000) :
                        String(event.reason).substring(0, 1000)
                }
            });
        };

        // Add listeners
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Cleanup
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    // This component renders nothing
    return null;
};

export default ErrorLogger;
