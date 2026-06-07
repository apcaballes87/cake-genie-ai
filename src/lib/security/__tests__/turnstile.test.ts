import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstileToken } from '../turnstile';

describe('verifyTurnstileToken', () => {
    const originalSecretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        vi.stubGlobal('console', {
            warn: vi.fn(),
            error: vi.fn(),
            log: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        if (originalSecretKey !== undefined) {
            process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = originalSecretKey;
        } else {
            delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
        }
    });

    it('should bypass verification and return success if secret key is not set', async () => {
        delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const result = await verifyTurnstileToken('some-token');
        expect(result).toEqual({ success: true });
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('CLOUDFLARE_TURNSTILE_SECRET_KEY is not defined')
        );
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('should return failure if secret key is set but token is missing', async () => {
        process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'mock-secret-key';

        const result = await verifyTurnstileToken(undefined);
        expect(result.success).toBe(false);
        expect(result.error).toContain('token is missing');
    });

    it('should verify token successfully when API returns success', async () => {
        process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'mock-secret-key';

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await verifyTurnstileToken('valid-token', '1.2.3.4');
        expect(result).toEqual({ success: true });
        expect(fetchMock).toHaveBeenCalledWith(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: expect.stringContaining('secret=mock-secret-key'),
            })
        );
        expect(fetchMock.mock.calls[0][1].body).toContain('response=valid-token');
        expect(fetchMock.mock.calls[0][1].body).toContain('remoteip=1.2.3.4');
    });

    it('should return failure when API returns success: false', async () => {
        process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'mock-secret-key';

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await verifyTurnstileToken('invalid-token');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Security verification failed');
        expect(console.error).toHaveBeenCalled();
    });

    it('should return failure when API returns non-ok status', async () => {
        process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'mock-secret-key';

        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await verifyTurnstileToken('token');
        expect(result.success).toBe(false);
        expect(result.error).toContain('status 500');
    });

    it('should return failure and handle exceptions gracefully', async () => {
        process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'mock-secret-key';

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        const result = await verifyTurnstileToken('token');
        expect(result.success).toBe(false);
        expect(result.error).toContain('temporarily unavailable');
        expect(console.error).toHaveBeenCalled();
    });
});
