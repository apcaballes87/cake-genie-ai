import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import type { SupabaseWebhookPayload } from '../webhookPolicy';
import { WEBHOOK_SECRET_HEADER } from '../auth';

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    selectEq: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    claim: vi.fn(),
    run: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: mocks.createClient,
}));

vi.mock('@/lib/imageVariants/claim', () => ({
    claimRowForVariantPipeline: mocks.claim,
}));

vi.mock('@/lib/imageVariants/runForRow', () => ({
    runVariantPipelineForRow: mocks.run,
}));

import { POST } from '../route';

const SOURCE_A = 'https://example.com/a.jpg';
const SOURCE_B = 'https://example.com/b.jpg';
const P_HASH = '0123456789abcdef';
const TEST_SECRET = 'variant-route-test-secret';

function currentRow(overrides: Partial<{
    slug: string | null;
    studio_edited_image_url: string | null;
    original_image_url: string | null;
}> = {}) {
    return {
        p_hash: P_HASH,
        slug: 'birthday-cake',
        studio_edited_image_url: null,
        original_image_url: SOURCE_A,
        ...overrides,
    };
}

function makeRequest(payload: SupabaseWebhookPayload): NextRequest {
    return new NextRequest('https://example.com/api/internal/variant-pipeline', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            [WEBHOOK_SECRET_HEADER]: TEST_SECRET,
        },
        body: JSON.stringify(payload),
    });
}

function payload(
    type: 'INSERT' | 'UPDATE',
    record: NonNullable<SupabaseWebhookPayload['record']>,
    oldRecord?: SupabaseWebhookPayload['old_record'],
): SupabaseWebhookPayload {
    return {
        type,
        table: 'cakegenie_analysis_cache',
        record,
        ...(oldRecord === undefined ? {} : { old_record: oldRecord }),
    };
}

describe('POST /api/internal/variant-pipeline', () => {
    const originalEnv = {
        secret: process.env.SUPABASE_WEBHOOK_SECRET,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SUPABASE_WEBHOOK_SECRET = TEST_SECRET;
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

        mocks.eq.mockResolvedValue({ error: null });
        mocks.update.mockReturnValue({ eq: mocks.eq });
        mocks.maybeSingle.mockResolvedValue({ data: currentRow(), error: null });
        mocks.selectEq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
        mocks.select.mockReturnValue({ eq: mocks.selectEq });
        mocks.from.mockReturnValue({ select: mocks.select, update: mocks.update });
        mocks.createClient.mockReturnValue({ from: mocks.from });
        mocks.claim.mockResolvedValue({ claimed: true });
        mocks.run.mockResolvedValue({
            status: 'failed',
            manifest: null,
            source: null,
            selected: null,
            rehostedTo: null,
            errors: [{ stage: 'decode', message: 'invalid image' }],
        });
    });

    afterEach(() => {
        if (originalEnv.secret === undefined) delete process.env.SUPABASE_WEBHOOK_SECRET;
        else process.env.SUPABASE_WEBHOOK_SECRET = originalEnv.secret;
        if (originalEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        else process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
        if (originalEnv.serviceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.serviceKey;
    });

    it('returns before creating a client or claiming an unchanged-source UPDATE', async () => {
        const response = await POST(makeRequest(payload(
            'UPDATE',
            { p_hash: P_HASH, original_image_url: SOURCE_A, image_variants_status: 'failed' },
            { p_hash: P_HASH, original_image_url: SOURCE_A, image_variants_status: 'running' },
        )));

        expect(await response.json()).toEqual({
            ok: true,
            status: 'ignored_unchanged_source',
        });
        expect(mocks.createClient).not.toHaveBeenCalled();
        expect(mocks.claim).not.toHaveBeenCalled();
        expect(mocks.run).not.toHaveBeenCalled();
    });

    it('always processes INSERT events', async () => {
        await POST(makeRequest(payload('INSERT', {
            p_hash: P_HASH,
            original_image_url: SOURCE_A,
        })));

        expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), P_HASH, SOURCE_A);
        expect(mocks.run).toHaveBeenCalledOnce();
    });

    it('processes an UPDATE when the effective source changes', async () => {
        mocks.maybeSingle.mockResolvedValue({
            data: currentRow({ original_image_url: SOURCE_B }),
            error: null,
        });

        await POST(makeRequest(payload(
            'UPDATE',
            { p_hash: P_HASH, original_image_url: SOURCE_B, image_variants_status: 'ready' },
            { p_hash: P_HASH, original_image_url: SOURCE_A, image_variants_status: 'ready' },
        )));

        expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), P_HASH, SOURCE_B);
        expect(mocks.run).toHaveBeenCalledOnce();
    });

    it('allows one explicit pending transition to retry an unchanged source', async () => {
        await POST(makeRequest(payload(
            'UPDATE',
            { p_hash: P_HASH, original_image_url: SOURCE_A, image_variants_status: 'pending' },
            { p_hash: P_HASH, original_image_url: SOURCE_A, image_variants_status: 'failed' },
        )));

        expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), P_HASH, SOURCE_A);
        expect(mocks.run).toHaveBeenCalledOnce();
    });

    it('continues to the corrected RPC when old_record is missing', async () => {
        mocks.claim.mockResolvedValue({ claimed: false });

        const response = await POST(makeRequest(payload('UPDATE', {
            p_hash: P_HASH,
            original_image_url: SOURCE_A,
            image_variants_status: 'failed',
        })));

        expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), P_HASH, SOURCE_A);
        expect(mocks.run).not.toHaveBeenCalled();
        expect(await response.json()).toEqual(expect.objectContaining({
            ok: true,
            reason: 'claim_not_acquired',
        }));
    });

    it('persists a failed result once with the attempted source', async () => {
        const response = await POST(makeRequest(payload('INSERT', {
            p_hash: P_HASH,
            original_image_url: SOURCE_A,
        })));

        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
            image_variants_status: 'failed',
            image_variants_indexed_source: SOURCE_A,
        }));
        expect(mocks.eq).toHaveBeenCalledWith('p_hash', P_HASH);
        expect(await response.json()).toEqual(expect.objectContaining({
            ok: false,
            status: 'failed',
        }));
    });

    it('settles an INSERT with no effective source at skipped after a NULL-source claim', async () => {
        mocks.maybeSingle.mockResolvedValue({
            data: currentRow({ original_image_url: null }),
            error: null,
        });

        const response = await POST(makeRequest(payload('INSERT', {
            p_hash: P_HASH,
            original_image_url: null,
            studio_edited_image_url: null,
        })));

        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
            image_variants_status: 'skipped',
            image_variants_indexed_source: null,
        }));
        expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), P_HASH, null);
        expect(mocks.run).not.toHaveBeenCalled();
        expect(await response.json()).toEqual({
            ok: true,
            status: 'skipped',
            reason: 'no_source',
        });
    });

    it('lets the RPC settle a repeated no-source UPDATE when old_record is missing', async () => {
        mocks.maybeSingle.mockResolvedValue({
            data: currentRow({ original_image_url: null }),
            error: null,
        });
        mocks.claim.mockResolvedValue({ claimed: false });

        const response = await POST(makeRequest(payload('UPDATE', {
            p_hash: P_HASH,
            original_image_url: null,
            studio_edited_image_url: null,
            image_variants_status: 'skipped',
        })));

        expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), P_HASH, null);
        expect(mocks.update).not.toHaveBeenCalled();
        expect(await response.json()).toEqual(expect.objectContaining({
            ok: true,
            reason: 'claim_not_acquired',
        }));
    });

    it('uses the latest Studio source when an INSERT payload still contains the original URL', async () => {
        mocks.maybeSingle.mockResolvedValue({
            data: currentRow({ studio_edited_image_url: SOURCE_B }),
            error: null,
        });

        await POST(makeRequest(payload('INSERT', {
            p_hash: P_HASH,
            original_image_url: SOURCE_A,
            studio_edited_image_url: null,
        })));

        expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), P_HASH, SOURCE_B);
        expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({
            slug: 'birthday-cake',
            studioEditedImageUrl: SOURCE_B,
            originalImageUrl: SOURCE_A,
        }));
        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
            image_variants_indexed_source: SOURCE_B,
        }));
    });

    it('does not persist an old manifest when the source changes during processing', async () => {
        mocks.maybeSingle
            .mockResolvedValueOnce({ data: currentRow(), error: null })
            .mockResolvedValueOnce({ data: currentRow(), error: null })
            .mockResolvedValueOnce({
                data: currentRow({ studio_edited_image_url: SOURCE_B }),
                error: null,
            });
        mocks.run.mockResolvedValue({
            status: 'ok',
            manifest: {
                format: 'webp',
                source: 'original_image_url',
                variants: [{ width: 400, url: 'https://example.com/400.webp', bytes: 400 }],
            },
            source: { width: 400, height: 300 },
            selected: { column: 'original_image_url', url: SOURCE_A },
            rehostedTo: null,
            errors: [],
        });

        const response = await POST(makeRequest(payload('INSERT', {
            p_hash: P_HASH,
            original_image_url: SOURCE_A,
        })));

        expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({
            studioEditedImageUrl: null,
            originalImageUrl: SOURCE_A,
        }));
        expect(mocks.update).toHaveBeenCalledWith({
            image_variants_status: 'pending',
            image_variants_error: 'source_changed_during_run',
        });
        expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({
            image_variants: expect.anything(),
        }));
        expect(await response.json()).toEqual({
            ok: true,
            status: 'source_changed_during_run',
        });
    });
});
