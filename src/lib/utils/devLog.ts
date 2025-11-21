/**
 * Development-only logging utility
 * Logs messages only in development mode to avoid console noise in production
 */

const isDev = import.meta.env.DEV;

export const devLog = {
    log: (...args: unknown[]) => {
        if (isDev) {
            console.log(...args);
        }
    },
    warn: (...args: unknown[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },
    error: (...args: unknown[]) => {
        if (isDev) {
            console.error(...args);
        }
    },
    info: (...args: unknown[]) => {
        if (isDev) {
            console.info(...args);
        }
    },
};
