import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { variantPath, publicVariantUrl, PROJECT_SUPABASE_HOST } from '../storage';

// Lightweight stand-in: publicVariantUrl never actually touches the client,
// it just needs to satisfy the type. Cast through unknown to avoid recreating
// the full SupabaseClient surface in tests.
const fakeClient = {} as unknown as SupabaseClient;

describe('storage helpers', () => {
    describe('variantPath', () => {
        it('builds the canonical path for an integer width', () => {
            expect(variantPath('abc', 800)).toBe('variants/abc/800.webp');
        });

        it('truncates non-integer widths to integers (Req 12.1: deterministic from inputs)', () => {
            expect(variantPath('abc', 800.7)).toBe('variants/abc/800.webp');
        });

        it('preserves p_hash characters as-is (no slugification, no encoding)', () => {
            expect(variantPath('p_HASH-mixedCase123', 1200)).toBe(
                'variants/p_HASH-mixedCase123/1200.webp',
            );
        });

        it('is deterministic across repeated calls (Req 12.1)', () => {
            const a = variantPath('xyz', 400);
            const b = variantPath('xyz', 400);
            expect(a).toBe(b);
        });
    });

    describe('publicVariantUrl', () => {
        it('builds a Supabase public URL using the project host', () => {
            const url = publicVariantUrl(fakeClient, 'abc', 800);
            expect(url).toContain(PROJECT_SUPABASE_HOST);
            expect(url).toContain('/storage/v1/object/public/cakegenie/variants/abc/800.webp');
        });

        it('contains no query string and no cache-busting token (Req 9.4)', () => {
            const url = publicVariantUrl(fakeClient, 'abc', 800);
            expect(url).not.toContain('?');
            expect(url).not.toMatch(/[?&]t=/);
        });

        it('produces byte-identical URLs across repeated calls (Req 12.1)', () => {
            const a = publicVariantUrl(fakeClient, 'xyz', 1200);
            const b = publicVariantUrl(fakeClient, 'xyz', 1200);
            expect(a).toBe(b);
        });
    });

    describe('PROJECT_SUPABASE_HOST', () => {
        it('exposes the project hostname as a string for the rehost-rule check', () => {
            expect(typeof PROJECT_SUPABASE_HOST).toBe('string');
            expect(PROJECT_SUPABASE_HOST.length).toBeGreaterThan(0);
        });
    });
});
