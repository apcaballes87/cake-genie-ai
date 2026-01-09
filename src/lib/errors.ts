// lib/errors.ts

/**
 * Centralized error handling utilities for the application.
 * Provides consistent error patterns and user-friendly messages.
 */

export type ErrorCode =
    | 'AUTH_FAILED'
    | 'AUTH_SESSION_EXPIRED'
    | 'CART_ADD_FAILED'
    | 'CART_UPDATE_FAILED'
    | 'CART_REMOVE_FAILED'
    | 'ORDER_CREATE_FAILED'
    | 'ORDER_FETCH_FAILED'
    | 'ADDRESS_FETCH_FAILED'
    | 'IMAGE_UPLOAD_FAILED'
    | 'IMAGE_ANALYSIS_FAILED'
    | 'NETWORK_ERROR'
    | 'VALIDATION_ERROR'
    | 'UNKNOWN_ERROR';

/**
 * Custom application error class with additional context.
 */
export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly originalError?: unknown;
    public readonly timestamp: Date;

    constructor(
        message: string,
        code: ErrorCode = 'UNKNOWN_ERROR',
        statusCode: number = 500,
        originalError?: unknown
    ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        this.originalError = originalError;
        this.timestamp = new Date();

        // Maintains proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }

    /**
     * Returns a user-friendly error message based on the error code.
     */
    getUserMessage(): string {
        const messages: Record<ErrorCode, string> = {
            AUTH_FAILED: 'Authentication failed. Please try again.',
            AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again.',
            CART_ADD_FAILED: 'Failed to add item to cart. Please try again.',
            CART_UPDATE_FAILED: 'Failed to update cart. Please try again.',
            CART_REMOVE_FAILED: 'Failed to remove item from cart. Please try again.',
            ORDER_CREATE_FAILED: 'Failed to create order. Please try again.',
            ORDER_FETCH_FAILED: 'Failed to load orders. Please refresh the page.',
            ADDRESS_FETCH_FAILED: 'Failed to load addresses. Please refresh the page.',
            IMAGE_UPLOAD_FAILED: 'Failed to upload image. Please try a smaller file.',
            IMAGE_ANALYSIS_FAILED: 'Failed to analyze image. Please try again.',
            NETWORK_ERROR: 'Network error. Please check your connection.',
            VALIDATION_ERROR: 'Please check your input and try again.',
            UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
        };
        return messages[this.code] || messages.UNKNOWN_ERROR;
    }

    /**
     * Converts the error to a JSON-serializable object for logging.
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack,
        };
    }
}

/**
 * Type guard to check if an error is an AppError.
 */
export const isAppError = (error: unknown): error is AppError => {
    return error instanceof AppError;
};

/**
 * Wraps an unknown error into an AppError with appropriate context.
 */
export const wrapError = (
    error: unknown,
    fallbackMessage: string = 'An unexpected error occurred',
    code: ErrorCode = 'UNKNOWN_ERROR'
): AppError => {
    if (isAppError(error)) {
        return error;
    }

    const message =
        error instanceof Error ? error.message : fallbackMessage;

    return new AppError(message, code, 500, error);
};

/**
 * Extracts a user-friendly message from any error.
 */
export const getErrorMessage = (error: unknown): string => {
    if (isAppError(error)) {
        return error.getUserMessage();
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'An unexpected error occurred. Please try again.';
};

/**
 * Logs an error with context for debugging.
 */
export const logError = (
    error: unknown,
    context?: Record<string, unknown>
): void => {
    const errorInfo = isAppError(error)
        ? error.toJSON()
        : {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        };

    console.error('Application Error:', {
        ...errorInfo,
        context,
        timestamp: new Date().toISOString(),
    });
};
