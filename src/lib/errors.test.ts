import { describe, expect, it } from 'vitest';
import { wrapError, AppError } from './errors';

describe('wrapError utility', () => {
    it('returns the same error if it is already an AppError', () => {
        const appError = new AppError('Already an AppError', 'VALIDATION_ERROR');
        const result = wrapError(appError);

        expect(result).toBe(appError);
        expect(result.message).toBe('Already an AppError');
        expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('wraps a standard Error and inherits its message', () => {
        const standardError = new Error('Standard Error');
        const result = wrapError(standardError);

        expect(result).toBeInstanceOf(AppError);
        expect(result.message).toBe('Standard Error');
        expect(result.code).toBe('UNKNOWN_ERROR'); // Default code
        expect(result.originalError).toBe(standardError);
    });

    it('uses fallbackMessage for strings or other non-Error objects', () => {
        const stringError = 'Just a string error';
        const result = wrapError(stringError, 'Custom Fallback Message');

        expect(result).toBeInstanceOf(AppError);
        expect(result.message).toBe('Custom Fallback Message');
        expect(result.code).toBe('UNKNOWN_ERROR');
        expect(result.originalError).toBe(stringError);

        const objectError = { some: 'data' };
        const result2 = wrapError(objectError, 'Custom Fallback Message 2');

        expect(result2).toBeInstanceOf(AppError);
        expect(result2.message).toBe('Custom Fallback Message 2');
        expect(result2.originalError).toBe(objectError);
    });

    it('uses a specific ErrorCode when provided', () => {
        const standardError = new Error('Database connection failed');
        const result = wrapError(standardError, 'Failed', 'NETWORK_ERROR');

        expect(result).toBeInstanceOf(AppError);
        expect(result.message).toBe('Database connection failed');
        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.originalError).toBe(standardError);
    });

    it('uses defaults when no fallbackMessage or code is provided', () => {
        const stringError = 'Just a string error';
        const result = wrapError(stringError);

        expect(result).toBeInstanceOf(AppError);
        expect(result.message).toBe('An unexpected error occurred');
        expect(result.code).toBe('UNKNOWN_ERROR');
        expect(result.originalError).toBe(stringError);
    });
});
