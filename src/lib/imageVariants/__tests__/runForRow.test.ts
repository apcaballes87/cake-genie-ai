import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';

import { runVariantPipelineForRow } from '../runForRow';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function makeJpeg(width: number): Promise<Buffer> {
    return sharp({
        create: {
            width,
            height: Math.round(width * 0.75),
            channels: 3,
            background: { r: 200, g: 100, b: 50 },
        },
    })
        .jpeg({ quality: 90 })
        .toBuffer();
}

/**
 * Build a fake SupabaseClient that records storage uploads and returns
 * configurable success/error per width. We only care about `client.storage.from(...).upload(...)`
 * — the rest of the SupabaseClient surface is unused by runForRow.
 */
function makeFakeClient(opts: {
    uploadResultByWidth?: Record<number, { error: Error | null }>;
} = {}): { client: SupabaseClient; uploads: Array<{ path: string; bytes: number }> } {
    const uploads: Array<{ path: string; bytes: number }> = [];

    const upload = vi.fn(async (path: string, buf: Buffer) => {
        const widthMatch = path.match(/\/(\d+)\.webp$/);
        const width = widthMatch ? Number(widthMatch[1]) : 0;
        const override = opts.uploadResultByWidth?.[width];

        uploads.push({ path, bytes: buf.length });

        if (override?.error) {
            return { data: null, error: override.error };
        }
        return { data: { path }, error: null };
    });

    const from = vi.fn(() => ({ upload }));
    const client = {
        storage: { from },
    } as unknown as SupabaseClient;

    return { client, uploads };
}

function makeFetchSource(buffer: Buffer | null, status: number = 200) {
    return vi.fn(async () => ({
        bytes: buffer ?? Buffer.alloc(0),
        status,
    }));
}

// In the test environment, NEXT_PUBLIC_SUPABASE_URL is set to
// `https://mock-supabase-url.com` (see src/tests/setup.ts), so
// PROJECT_SUPABASE_HOST resolves to `mock-supabase-url.com`. We use that
// host for the "same project" fixture and a real foreign host for the
// rehost fixture.
const SUPABASE_URL = 'https://mock-supabase-url.com/storage/v1/object/public/cakegenie/originals/test.jpg';
const PROJECT_VARIANT_BASE = 'https://mock-supabase-url.com/storage/v1/object/public/cakegenie/variants';
const PINTEREST_URL = 'https://i.pinimg.com/originals/abc/123.jpg';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runVariantPipelineForRow', () => {
    describe('selection', () => {
        it('returns status="skipped" when both URLs are null (Req 5.4)', async () => {
            const { client } = makeFakeClient();
            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: null,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource: makeFetchSource(null) },
            );
            expect(result.status).toBe('skipped');
            expect(result.manifest).toBeNull();
        });

        it('returns status="skipped" when both URLs are whitespace-only (Req 14.1)', async () => {
            const { client } = makeFakeClient();
            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: '   ',
                    originalImageUrl: '\n\t',
                    client,
                },
                { fetchSource: makeFetchSource(null) },
            );
            expect(result.status).toBe('skipped');
        });

        it('uses studio_edited_image_url when present (Req 14.1)', async () => {
            const { client, uploads } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: 'https://other.example.com/x.jpg',
                    client,
                },
                { fetchSource },
            );

            expect(fetchSource).toHaveBeenCalledWith(SUPABASE_URL);
            expect(result.selected?.column).toBe('studio_edited_image_url');
            expect(result.manifest?.source).toBe('studio_edited_image_url');
            expect(uploads.length).toBeGreaterThan(0);
        });

        it('falls back to original_image_url when studio is empty', async () => {
            const { client } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: '',
                    originalImageUrl: SUPABASE_URL,
                    client,
                },
                { fetchSource },
            );

            expect(fetchSource).toHaveBeenCalledWith(SUPABASE_URL);
            expect(result.selected?.column).toBe('original_image_url');
            expect(result.manifest?.source).toBe('original_image_url');
        });
    });

    describe('fetch failures', () => {
        it('returns status="failed" with fetch_original stage when status is non-2xx (Req 15.3)', async () => {
            const { client } = makeFakeClient();
            const fetchSource = makeFetchSource(Buffer.alloc(100), 404);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('failed');
            expect(result.manifest).toBeNull();
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].stage).toBe('fetch_original');
            expect(result.errors[0].message).toContain('404');
            expect(result.selected?.column).toBe('studio_edited_image_url');
        });

        it('returns status="failed" when fetch throws', async () => {
            const { client } = makeFakeClient();
            const fetchSource = vi.fn(async () => {
                throw new Error('network unreachable');
            });

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('failed');
            expect(result.errors[0].stage).toBe('fetch_original');
            expect(result.errors[0].message).toContain('network unreachable');
        });

        it('returns status="failed" when fetched bytes are empty', async () => {
            const { client } = makeFakeClient();
            const fetchSource = makeFetchSource(Buffer.alloc(0), 200);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('failed');
            expect(result.errors[0].stage).toBe('fetch_original');
            expect(result.errors[0].message).toContain('empty body');
        });
    });

    describe('decode failures (Req 5.5)', () => {
        it('returns status="failed" when sharp cannot decode the bytes', async () => {
            const { client, uploads } = makeFakeClient();
            const garbage = Buffer.from('definitely not an image', 'utf-8');
            const fetchSource = makeFetchSource(garbage);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('failed');
            expect(result.manifest).toBeNull();
            expect(uploads).toHaveLength(0);
            expect(result.errors.some((e) => e.stage === 'decode')).toBe(true);
        });
    });

    describe('happy path', () => {
        it('uploads all variants and returns status="ok" for a 2000 px source', async () => {
            const { client, uploads } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'phash123',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('ok');
            expect(result.manifest?.variants.map((v) => v.width)).toEqual([400, 800, 1200]);
            expect(uploads.map((u) => u.path)).toEqual([
                'variants/phash123/400.webp',
                'variants/phash123/800.webp',
                'variants/phash123/1200.webp',
            ]);
            expect(result.source).toEqual({ width: 2000, height: 1500 });
            expect(result.errors).toEqual([]);
        });

        it('keys variant storage paths by the descriptive slug when provided', async () => {
            const { client, uploads } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'phash123',
                    slug: 'kuromi-light-purple-1-tier-cake-e3c3',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('ok');
            // Paths use the slug, not the p_hash → keyword-rich image URLs.
            expect(uploads.map((u) => u.path)).toEqual([
                'variants/kuromi-light-purple-1-tier-cake-e3c3/400.webp',
                'variants/kuromi-light-purple-1-tier-cake-e3c3/800.webp',
                'variants/kuromi-light-purple-1-tier-cake-e3c3/1200.webp',
            ]);
            expect(result.manifest?.variants.every((v) =>
                v.url.includes('/variants/kuromi-light-purple-1-tier-cake-e3c3/'),
            )).toBe(true);
        });

        it('falls back to p_hash for storage key when slug is blank/whitespace', async () => {
            const { client, uploads } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'phash123',
                    slug: '   ',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('ok');
            expect(uploads.map((u) => u.path)).toEqual([
                'variants/phash123/400.webp',
                'variants/phash123/800.webp',
                'variants/phash123/1200.webp',
            ]);
        });

        it('manifest is sorted ascending by width even if encoded order varied (Req 3.4)', async () => {
            const { client } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'phash123',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            const widths = result.manifest!.variants.map((v) => v.width);
            expect(widths).toEqual([...widths].sort((a, b) => a - b));
        });

        it('manifest URLs use the deterministic public URL pattern', async () => {
            const { client } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'phash123',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            for (const v of result.manifest!.variants) {
                expect(v.url.startsWith(`${PROJECT_VARIANT_BASE}/phash123/`)).toBe(true);
                expect(v.url).toMatch(/\/\d+\.webp$/);
                // No query string, no cache-busting tokens (Req 9.4, 12.2).
                expect(v.url).not.toContain('?');
            }
        });
    });

    describe('partial upload failures (Req 5.3)', () => {
        it('returns status="partial" when one upload fails and others succeed', async () => {
            // Simulate a transient storage failure on the 800px upload.
            const { client, uploads } = makeFakeClient({
                uploadResultByWidth: {
                    800: { error: new Error('storage 503') },
                },
            });
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('partial');
            expect(result.manifest?.variants.map((v) => v.width)).toEqual([400, 1200]);
            expect(uploads).toHaveLength(3); // all three were attempted
            expect(result.errors.some((e) => e.stage === 'upload_800')).toBe(true);
        });

        it('returns status="failed" when every upload fails', async () => {
            const { client } = makeFakeClient({
                uploadResultByWidth: {
                    400: { error: new Error('storage 503') },
                    800: { error: new Error('storage 503') },
                    1200: { error: new Error('storage 503') },
                },
            });
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'abc',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('failed');
            expect(result.manifest).toBeNull();
            expect(result.errors.filter((e) => e.stage.startsWith('upload_')).length).toBe(3);
        });
    });

    describe('foreign host rehost (Req 5.6, 15.2)', () => {
        it('sets rehostedTo to the largest variant URL when source is on a non-Supabase host', async () => {
            const { client } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'phash123',
                    studioEditedImageUrl: PINTEREST_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.status).toBe('ok');
            expect(result.rehostedTo).toBe(`${PROJECT_VARIANT_BASE}/phash123/1200.webp`);
        });

        it('does NOT set rehostedTo when source is already on the project Supabase host', async () => {
            const { client } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'phash123',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            expect(result.rehostedTo).toBeUndefined();
        });

        it('rehost target is the largest available variant when not all widths uploaded', async () => {
            // 1500 px source fits 400/800/1200; if 1200 upload fails, the
            // rehost should still target the 1200 url because that's the
            // largest variant the pipeline produced (encoded array is what
            // determines the largest, not just the manifest).
            //
            // Actually re-reading runForRow: maybeRehostFlag uses encoded
            // (which has all three since generate succeeded), so largest=1200
            // even if its upload failed. That means rehostedTo points at a
            // URL that doesn't exist. We accept this: the caller only writes
            // rehostedTo *after* a successful manifest write, and a partial
            // manifest with 1200 missing means the largest stored is 800.
            //
            // To keep this contract correct, the design should rehost to the
            // largest *uploaded* variant. Adjust the test to assert that
            // (which will also drive a small fix in runForRow if needed).
            const { client } = makeFakeClient({
                uploadResultByWidth: {
                    1200: { error: new Error('storage 503') },
                },
            });
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'phash123',
                    studioEditedImageUrl: PINTEREST_URL,
                    originalImageUrl: null,
                    client,
                },
                { fetchSource },
            );

            // Status is partial because 1200 failed.
            expect(result.status).toBe('partial');
            // manifest contains 400, 800.
            expect(result.manifest?.variants.map((v) => v.width)).toEqual([400, 800]);
            // rehostedTo should target the largest *uploaded* variant (800).
            expect(result.rehostedTo).toBe(`${PROJECT_VARIANT_BASE}/phash123/800.webp`);
        });
    });

    describe('dry-run mode', () => {
        it('skips storage uploads but produces a manifest (Req 7.10)', async () => {
            const { client, uploads } = makeFakeClient();
            const buf = await makeJpeg(2000);
            const fetchSource = makeFetchSource(buf);

            const result = await runVariantPipelineForRow(
                {
                    pHash: 'phash123',
                    studioEditedImageUrl: SUPABASE_URL,
                    originalImageUrl: null,
                    client,
                    dryRun: true,
                },
                { fetchSource },
            );

            expect(result.status).toBe('ok');
            expect(result.manifest?.variants.map((v) => v.width)).toEqual([400, 800, 1200]);
            expect(uploads).toHaveLength(0); // no storage writes
        });
    });
});
