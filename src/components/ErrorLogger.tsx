'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CLIENT_API_ERROR_EVENT, type ClientApiErrorReport } from '@/lib/clientApiErrors';

// Generate a simple session ID for correlating errors
let fallbackSessionId: string | null = null;

const getSessionId = (): string => {
    if (typeof window === 'undefined') return '';

    try {
        const storage = window.sessionStorage;
        const storedSessionId = storage?.getItem('error_session_id');
        if (storedSessionId) {
            fallbackSessionId = storedSessionId;
            return storedSessionId;
        }

        fallbackSessionId ??= `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        storage?.setItem('error_session_id', fallbackSessionId);
        return fallbackSessionId;
    } catch {
        fallbackSessionId ??= `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        return fallbackSessionId;
    }
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
    error_type: 'error' | 'unhandledrejection' | 'cookie_blocked' | 'network' | 'unknown' | 'api_error';
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

export const logErrorToSupabase = async (payload: ErrorLogPayload): Promise<void> => {
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

        const handleClientApiError = (event: Event) => {
            const report = (event as CustomEvent<unknown>).detail;
            if (!report || typeof report !== 'object') return;

            const apiError = report as Partial<ClientApiErrorReport>;
            if (
                typeof apiError.endpoint !== 'string' ||
                typeof apiError.method !== 'string' ||
                typeof apiError.status !== 'number' ||
                apiError.status < 500 ||
                typeof apiError.message !== 'string'
            ) {
                return;
            }

            void logErrorToSupabase({
                error_message: `${apiError.method} ${apiError.endpoint} returned HTTP ${apiError.status}: ${apiError.message}`.slice(0, 1000),
                error_stack: typeof apiError.stack === 'string' ? apiError.stack.slice(0, 5000) : undefined,
                error_type: 'api_error',
                page_url: window.location.href,
                page_path: window.location.pathname,
                user_agent: navigator.userAgent,
                viewport_width: window.innerWidth,
                viewport_height: window.innerHeight,
                session_id: sessionId,
                metadata: {
                    source: 'client_api_error',
                    endpoint: apiError.endpoint,
                    method: apiError.method,
                    status: apiError.status,
                },
            });
        };

        // Add listeners
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        window.addEventListener(CLIENT_API_ERROR_EVENT, handleClientApiError);

        // Cleanup
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
            window.removeEventListener(CLIENT_API_ERROR_EVENT, handleClientApiError);
        };
    }, []);

    // This component renders nothing
    return null;
};

export default ErrorLogger;
