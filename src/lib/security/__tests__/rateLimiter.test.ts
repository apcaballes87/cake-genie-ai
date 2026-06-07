import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockLimit = vi.fn();

// Mock the external packages
vi.mock('@upstash/ratelimit', () => {
    return {
        Ratelimit: class {
            static slidingWindow = vi.fn();
            limit = mockLimit;
        }
    };
});

vi.mock('@vercel/kv', () => {
    return {
        kv: {}
    };
});

describe('rateLimiter', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        mockLimit.mockReset();
        vi.stubGlobal('console', {
            warn: vi.fn(),
            error: vi.fn(),
            log: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        process.env = { ...originalEnv };
    });

    it('should bypass and return success if KV env vars are missing', async () => {
        delete process.env.KV_REST_API_URL;
        delete process.env.KV_REST_API_TOKEN;

        // Import dynamically so it evaluates with the current process.env
        const { checkRateLimit } = await import('../rateLimiter');

        const result = await checkRateLimit('ai', 'test-ip');
        expect(result).toEqual({
            success: true,
            remaining: 999,
            limit: 999,
            reset: expect.any(Number),
        });
        expect(mockLimit).not.toHaveBeenCalled();
    });

    it('should call limiter and return its result when KV env vars are present', async () => {
        process.env.KV_REST_API_URL = 'https://mock-kv.upstash.io';
        process.env.KV_REST_API_TOKEN = 'mock-token';

        mockLimit.mockResolvedValue({
            success: false,
            remaining: 0,
            limit: 5,
            reset: 123456789,
        });

        const { checkRateLimit } = await import('../rateLimiter');

        const result = await checkRateLimit('ai', 'test-ip');
        expect(mockLimit).toHaveBeenCalledWith('test-ip');
        expect(result).toEqual({
            success: false,
            remaining: 0,
            limit: 5,
            reset: 123456789,
        });
    });

    it('should fail-safe (bypass) if limiter throws an exception', async () => {
        process.env.KV_REST_API_URL = 'https://mock-kv.upstash.io';
        process.env.KV_REST_API_TOKEN = 'mock-token';

        mockLimit.mockRejectedValue(new Error('Redis is down'));

        const { checkRateLimit } = await import('../rateLimiter');

        const result = await checkRateLimit('ai', 'test-ip');
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(999);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Rate limit check failed for ai, bypassing:'),
            expect.any(Error)
        );
    });
});
