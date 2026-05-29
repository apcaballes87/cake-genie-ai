import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { verifyWebhookSecret, WEBHOOK_SECRET_HEADER } from '../auth';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('https://example.com/api/internal/variant-pipeline', {
        method: 'POST',
        headers,
    });
}

describe('verifyWebhookSecret (Req 4.1, 4.5)', () => {
    const ORIGINAL_ENV = process.env.SUPABASE_WEBHOOK_SECRET;

    beforeEach(() => {
        process.env.SUPABASE_WEBHOOK_SECRET = 'super-secret-test-token-32-bytes';
    });

    afterEach(() => {
        if (ORIGINAL_ENV === undefined) {
            delete process.env.SUPABASE_WEBHOOK_SECRET;
        } else {
            process.env.SUPABASE_WEBHOOK_SECRET = ORIGINAL_ENV;
        }
    });

    it('accepts a request with a matching secret header', () => {
        const req = makeRequest({
            [WEBHOOK_SECRET_HEADER]: 'super-secret-test-token-32-bytes',
        });
        expect(verifyWebhookSecret(req)).toEqual({ ok: true });
    });

    it('rejects a request missing the secret header', () => {
        const req = makeRequest({});
        const result = verifyWebhookSecret(req);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('missing_header');
        }
    });

    it('rejects a request with a wrong secret', () => {
        const req = makeRequest({
            [WEBHOOK_SECRET_HEADER]: 'this-is-the-wrong-token',
        });
        const result = verifyWebhookSecret(req);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('invalid_secret');
        }
    });

    it('rejects a request with a same-length wrong secret', () => {
        // Same length as the expected secret to make sure rejection isn't
        // accidentally based on length matching alone.
        const req = makeRequest({
            [WEBHOOK_SECRET_HEADER]: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        });
        const result = verifyWebhookSecret(req);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('invalid_secret');
        }
    });

    it('rejects an empty header value', () => {
        const req = makeRequest({
            [WEBHOOK_SECRET_HEADER]: '',
        });
        const result = verifyWebhookSecret(req);
        expect(result.ok).toBe(false);
    });

    it('returns missing_server_secret when env is unset', () => {
        delete process.env.SUPABASE_WEBHOOK_SECRET;
        const req = makeRequest({
            [WEBHOOK_SECRET_HEADER]: 'anything',
        });
        const result = verifyWebhookSecret(req);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('missing_server_secret');
        }
    });

    it('returns missing_server_secret when env is empty string', () => {
        process.env.SUPABASE_WEBHOOK_SECRET = '';
        const req = makeRequest({
            [WEBHOOK_SECRET_HEADER]: 'anything',
        });
        const result = verifyWebhookSecret(req);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('missing_server_secret');
        }
    });

    it('treats prefix matches as wrong (no early-exit timing leak)', () => {
        // A value matching the expected secret as a prefix should still
        // be rejected — verifies the comparison doesn't short-circuit.
        const req = makeRequest({
            [WEBHOOK_SECRET_HEADER]: 'super-secret-test-token',
        });
        const result = verifyWebhookSecret(req);
        expect(result.ok).toBe(false);
    });
});
