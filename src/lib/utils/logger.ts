/**
 * Production-safe logger utility
 * Only logs in development mode to avoid console pollution in production
 */

const isDev = process.env.NODE_ENV === 'development';

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface LoggerOptions {
    /** Force logging even in production (use sparingly) */
    force?: boolean;
}

/**
 * Creates a namespaced logger for a specific module
 * @param namespace - Module name for prefixing logs
 */
export const createLogger = (namespace: string) => {
    const prefix = `[${namespace}]`;

    return {
        log: (message: string, ...args: any[]) => {
            if (isDev) console.log(prefix, message, ...args);
        },
        info: (message: string, ...args: any[]) => {
            if (isDev) console.info(prefix, message, ...args);
        },
        warn: (message: string, ...args: any[]) => {
            // Warnings shown in all environments
            console.warn(prefix, message, ...args);
        },
        error: (message: string, ...args: any[]) => {
            // Errors shown in all environments
            console.error(prefix, message, ...args);
        },
        debug: (message: string, ...args: any[]) => {
            if (isDev) console.debug(prefix, message, ...args);
        },
    };
};

/**
 * Simple log functions that only execute in development
 */
export const devLog = (message: string, ...args: any[]) => {
    if (isDev) console.log(message, ...args);
};

export const devWarn = (message: string, ...args: any[]) => {
    if (isDev) console.warn(message, ...args);
};

export const devInfo = (message: string, ...args: any[]) => {
    if (isDev) console.info(message, ...args);
};

/**
 * Debug log that includes timestamp (development only)
 */
export const devDebug = (label: string, data?: any) => {
    if (isDev) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
        console.log(`[${timestamp}] ${label}`, data !== undefined ? data : '');
    }
};

export default { createLogger, devLog, devWarn, devInfo, devDebug };
