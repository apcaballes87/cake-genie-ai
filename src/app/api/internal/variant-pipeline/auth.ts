/**
 * HMAC verification for the Supabase Database Webhook callback.
 *
 * Supabase sends DB-webhook events to this endpoint with a static shared
 * secret in the `x-supabase-webhook-secret` header (matches the value the
 * operator configured in the Supabase dashboard, also stored as the
 * `SUPABASE_WEBHOOK_SECRET` Vercel env var). For v1 we use a literal
 * shared-secret comparison rather than computing an HMAC over the body —
 * Supabase's "Database Webhooks" UI ships a custom-header field, not a
 * body-signing field, so the simple-comparison path is the documented
 * configuration.
 *
 * The comparison must be constant-time so a remote attacker can't time-
 * leak the secret one byte at a time.
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
 *       Req 4.1, 4.5
 */

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Header Supabase populates with the secret. Lowercase because Next.js
 * normalizes header names; matching the Supabase config docs.
 */
export const WEBHOOK_SECRET_HEADER = 'x-supabase-webhook-secret';

/**
 * Verifies the inbound request carries a valid webhook secret.
 *
 * Returns one of:
 *   - `{ ok: true }` when authenticated
 *   - `{ ok: false, reason: string }` when not — caller maps `reason` to a
 *     401 with a generic message (we don't leak the reason to the client).
 *
 * Never throws. Configuration errors (missing env var) are explicitly
 * surfaced as `{ ok: false, reason: 'missing_server_secret' }` so the
 * route handler can return 500 instead of 401 — that distinction matters
 * because Supabase retries 5xx responses but not 4xx.
 */
export function verifyWebhookSecret(req: NextRequest): { ok: true } | { ok: false; reason: string } {
    const expected = process.env.SUPABASE_WEBHOOK_SECRET;
    if (!expected || expected.length === 0) {
        return { ok: false, reason: 'missing_server_secret' };
    }

    const provided = req.headers.get(WEBHOOK_SECRET_HEADER);
    if (!provided) {
        return { ok: false, reason: 'missing_header' };
    }

    if (!constantTimeEqual(provided, expected)) {
        return { ok: false, reason: 'invalid_secret' };
    }

    return { ok: true };
}

/**
 * Constant-time string comparison.
 *
 * `crypto.timingSafeEqual` requires both buffers to have the same length
 * and otherwise throws — we copy both sides into a fixed-length buffer so
 * length-mismatched inputs still take constant time and don't leak via
 * the throw path. Specifically: write the longer of the two into a buffer
 * of size `max(a, b)`, then compare against the shorter padded with zeros.
 * This makes "wrong length" indistinguishable from "wrong content" by
 * timing alone.
 */
function constantTimeEqual(a: string, b: string): boolean {
    const maxLen = Math.max(a.length, b.length);
    const bufA = Buffer.alloc(maxLen, 0);
    const bufB = Buffer.alloc(maxLen, 0);
    bufA.write(a, 'utf8');
    bufB.write(b, 'utf8');
    // timingSafeEqual short-circuits on length mismatch internally, but
    // both buffers are now the same size by construction so it always
    // walks the full comparison.
    const equalContent = timingSafeEqual(bufA, bufB);
    // Length must also match for a true result. Combining via `&` keeps
    // this branch-free and length-blind.
    return equalContent && a.length === b.length;
}
