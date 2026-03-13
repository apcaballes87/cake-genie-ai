import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AppError, isAppError, wrapError, getErrorMessage, logError } from './errors';

describe('AppError', () => {
    it('should initialize with correct properties', () => {
        const message = 'Test error message';
        const code = 'AUTH_FAILED';
        const statusCode = 401;
        const originalError = new Error('Original error');

        const error = new AppError(message, code, statusCode, originalError);

        expect(error.message).toBe(message);
        expect(error.code).toBe(code);
        expect(error.statusCode).toBe(statusCode);
        expect(error.originalError).toBe(originalError);
        expect(error.timestamp).toBeInstanceOf(Date);
        expect(error.name).toBe('AppError');
        expect(error.stack).toBeDefined();
    });

    it('should use default values if not provided', () => {
        const message = 'Default error';
        const error = new AppError(message);

        expect(error.code).toBe('UNKNOWN_ERROR');
        expect(error.statusCode).toBe(500);
    });

    describe('getUserMessage', () => {
        it('should return correct message for AUTH_FAILED', () => {
            const error = new AppError('msg', 'AUTH_FAILED');
            expect(error.getUserMessage()).toBe('Authentication failed. Please try again.');
        });

        it('should return fallback message for unknown code', () => {
            // @ts-expect-error - testing invalid code
            const error = new AppError('msg', 'NON_EXISTENT_CODE');
            expect(error.getUserMessage()).toBe('An unexpected error occurred. Please try again.');
        });
    });

    describe('toJSON', () => {
        it('should return a serializable object', () => {
            const error = new AppError('msg', 'AUTH_FAILED', 401);
            const json = error.toJSON();

            expect(json).toEqual({
                name: 'AppError',
                message: 'msg',
                code: 'AUTH_FAILED',
                statusCode: 401,
                timestamp: expect.any(String),
                stack: expect.any(String),
            });
        });
    });
});

describe('Error Utility Functions', () => {
    describe('isAppError', () => {
        it('should return true for AppError instances', () => {
            const error = new AppError('msg');
            expect(isAppError(error)).toBe(true);
        });

        it('should return false for regular Error instances', () => {
            const error = new Error('msg');
            expect(isAppError(error)).toBe(false);
        });

        it('should return false for non-error objects', () => {
            expect(isAppError({ message: 'msg' })).toBe(false);
            expect(isAppError(null)).toBe(false);
        });
    });

    describe('wrapError', () => {
        it('should return the same error if it is an AppError', () => {
            const error = new AppError('msg');
            expect(wrapError(error)).toBe(error);
        });

        it('should wrap a standard Error', () => {
            const standardError = new Error('Standard error');
            const wrapped = wrapError(standardError);

            expect(wrapped).toBeInstanceOf(AppError);
            expect(wrapped.message).toBe('Standard error');
            expect(wrapped.originalError).toBe(standardError);
        });

        it('should wrap a string', () => {
            const wrapped = wrapError('Something went wrong');

            expect(wrapped).toBeInstanceOf(AppError);
            expect(wrapped.message).toBe('Something went wrong');
        });
    });

    describe('getErrorMessage', () => {
        it('should return user message for AppError', () => {
            const error = new AppError('msg', 'AUTH_FAILED');
            expect(getErrorMessage(error)).toBe('Authentication failed. Please try again.');
        });

        it('should return error message for standard Error', () => {
            const error = new Error('Standard error');
            expect(getErrorMessage(error)).toBe('Standard error');
        });

        it('should return the string if error is a string', () => {
            expect(getErrorMessage('Custom error')).toBe('Custom error');
        });

        it('should return default message for unknown types', () => {
            expect(getErrorMessage({})).toBe('An unexpected error occurred. Please try again.');
        });
    });

    describe('logError', () => {
        let consoleSpy: any;

        beforeEach(() => {
            consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('should log AppError with full context', () => {
            const error = new AppError('msg', 'AUTH_FAILED');
            logError(error, { userId: '123' });

            expect(consoleSpy).toHaveBeenCalledWith(
                'Application Error:',
                expect.objectContaining({
                    message: 'msg',
                    code: 'AUTH_FAILED',
                    context: { userId: '123' },
                    timestamp: expect.any(String),
                })
            );
        });

        it('should log regular Error', () => {
            const error = new Error('Standard error');
            logError(error);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Application Error:',
                expect.objectContaining({
                    message: 'Standard error',
                    timestamp: expect.any(String),
                })
            );
        });
    });
});
