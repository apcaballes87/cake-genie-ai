import { describe, expect, it } from 'vitest';
import { normalizeAiRouteError } from './routeError';

describe('normalizeAiRouteError', () => {
    const defaultOptions = {
        defaultMessage: 'Something went wrong',
        quotaMessage: 'Quota exceeded',
        authorizationMessage: 'Not authorized',
    };

    describe('Quota errors', () => {
        it('should detect status 429', () => {
            const error = { status: 429 };
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result).toEqual({ status: 429, message: 'Quota exceeded' });
        });

        it('should detect quota-related text in error message', () => {
            const error = new Error('Google AI error: RESOURCE_EXHAUSTED - you have run out of quota.');
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result).toEqual({ status: 429, message: 'Quota exceeded' });
        });

        it('should detect quota-related text in plain string', () => {
            const error = 'rate limit exceeded';
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result).toEqual({ status: 429, message: 'Quota exceeded' });
        });
    });

    describe('Authorization errors', () => {
        it('should detect status 401', () => {
            const error = { status: 401 };
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result).toEqual({ status: 401, message: 'Not authorized' });
        });

        it('should detect status 403', () => {
            const error = { status: 403 };
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result).toEqual({ status: 403, message: 'Not authorized' });
        });

        it('should use default authorization message if not provided', () => {
            const error = { status: 401 };
            const result = normalizeAiRouteError(error, {
                defaultMessage: 'Default',
                quotaMessage: 'Quota',
            });
            expect(result.status).toBe(401);
            expect(result.message).toContain('AI service is not authorized');
        });

        it('should detect auth-related text in error message', () => {
            const error = new Error('PERMISSION_DENIED for this action');
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result.status).toBe(403);
            expect(result.message).toBe('Not authorized');
        });

        it('should detect auth-related text in plain string', () => {
            const error = 'invalid api key';
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result.status).toBe(403);
            expect(result.message).toBe('Not authorized');
        });
    });

    describe('Generic and other errors', () => {
        it('should handle standard 500 error', () => {
            const error = { status: 500, message: 'Internal server error' };
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result).toEqual({ status: 500, message: 'Something went wrong' });
        });

        it('should use default message if error is [object Object]', () => {
            const error = {};
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result.status).toBe(500);
            expect(result.message).toBe('Something went wrong');
        });

        it('should pass through safe error messages', () => {
            const error = new Error('A safe error message');
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result.status).toBe(500);
            expect(result.message).toBe('A safe error message');
        });

        it('should handle null/undefined', () => {
            const resultNull = normalizeAiRouteError(null, defaultOptions);
            expect(resultNull.status).toBe(500);
            expect(resultNull.message).toBe('null');

            const resultUndefined = normalizeAiRouteError(undefined, defaultOptions);
            expect(resultUndefined.status).toBe(500);
            expect(resultUndefined.message).toBe('undefined');
        });

        it('should handle non-standard status codes gracefully', () => {
            const error = { status: 999 };
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result.status).toBe(500); // Because it falls outside 400-599
            expect(result.message).toBe('Something went wrong');
        });

        it('should pass valid custom status codes', () => {
             const error = { status: 418 };
             const result = normalizeAiRouteError(error, defaultOptions);
             expect(result.status).toBe(418);
             expect(result.message).toBe('Something went wrong');
        });
    });

    describe('JSON provider error parsing', () => {
        it('should parse nested JSON with quota code', () => {
            const error = new Error(JSON.stringify({
                error: {
                    code: 429,
                    message: "Too many requests"
                }
            }));
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result).toEqual({ status: 429, message: 'Quota exceeded' });
        });

        it('should parse nested JSON with auth code', () => {
            const error = new Error(JSON.stringify({
                error: {
                    code: 401,
                    message: "Unauthorized access"
                }
            }));
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result.status).toBe(401);
            expect(result.message).toBe('Not authorized');
        });

        it('should parse plain string with nested JSON and quota code', () => {
             const error = JSON.stringify({
                error: {
                    code: 429,
                    message: "Too many requests"
                }
            });
            const result = normalizeAiRouteError(error, defaultOptions);
            expect(result.status).toBe(429);
            expect(result.message).toBe('Quota exceeded');
        });
    });
});
