import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from './middleware';

const mockCheckRateLimit = vi.fn();
vi.mock('@/lib/security/rateLimiter', () => ({
    checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
}));

describe('middleware', () => {
    beforeEach(() => {
        vi.resetModules();
        mockCheckRateLimit.mockReset();
        mockCheckRateLimit.mockResolvedValue({
            success: true,
            remaining: 5,
            limit: 5,
            reset: Date.now() + 60000,
        });
    });

    it('should bypass rate limiting for non-API routes', async () => {
        const request = new NextRequest('http://localhost/shop');
        const response = await middleware(request);
        
        expect(response).toBeInstanceOf(NextResponse);
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });

    it('should run rate limiter and allow request on success for api/newsletter', async () => {
        const request = new NextRequest('http://localhost/api/newsletter');
        const response = await middleware(request);

        expect(response).toBeInstanceOf(NextResponse);
        expect(mockCheckRateLimit).toHaveBeenCalledWith('newsletter', expect.any(String));
        // NextResponse.next() returns a standard next response
        expect(response.status).toBe(200);
    });

    it('should block request and return 429 if rate limit is exceeded', async () => {
        mockCheckRateLimit.mockResolvedValue({
            success: false,
            remaining: 0,
            limit: 3,
            reset: Date.now() + 30000, // resets in 30 seconds
        });

        const request = new NextRequest('http://localhost/api/contact');
        const response = await middleware(request);

        expect(response).toBeInstanceOf(NextResponse);
        expect(response.status).toBe(429);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('Retry-After')).toBe('30');
        
        const body = await response.json();
        expect(body.error).toContain('Too many requests');
    });

    it('should bypass rate limiting for /api/ai/analyze if x-admin-pin header is valid', async () => {
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            headers: {
                'x-admin-pin': '231323',
            },
        });
        const response = await middleware(request);

        expect(response).toBeInstanceOf(NextResponse);
        expect(response.status).toBe(200);
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });

    it('should rate limit /api/ai/analyze if x-admin-pin header is missing or invalid', async () => {
        const request = new NextRequest('http://localhost/api/ai/analyze');
        const response = await middleware(request);

        expect(response).toBeInstanceOf(NextResponse);
        expect(mockCheckRateLimit).toHaveBeenCalledWith('ai', expect.any(String));
    });
});
