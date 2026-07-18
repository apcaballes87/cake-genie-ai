import { describe, expect, it } from 'vitest';

import {
    shouldIgnoreUnchangedSourceUpdate,
    type SupabaseWebhookPayload,
} from '../webhookPolicy';

const SOURCE_A = 'https://example.com/a.jpg';
const SOURCE_B = 'https://example.com/b.jpg';

function updatePayload(
    record: NonNullable<SupabaseWebhookPayload['record']>,
    oldRecord: SupabaseWebhookPayload['old_record'],
): SupabaseWebhookPayload {
    return {
        type: 'UPDATE',
        table: 'cakegenie_analysis_cache',
        record,
        old_record: oldRecord,
    };
}

describe('shouldIgnoreUnchangedSourceUpdate', () => {
    it('never ignores INSERT events', () => {
        expect(shouldIgnoreUnchangedSourceUpdate({
            type: 'INSERT',
            table: 'cakegenie_analysis_cache',
            record: { original_image_url: SOURCE_A },
        })).toBe(false);
    });

    it('ignores an UPDATE whose effective source is unchanged', () => {
        expect(shouldIgnoreUnchangedSourceUpdate(updatePayload(
            { original_image_url: SOURCE_A, image_variants_status: 'failed' },
            { original_image_url: SOURCE_A, image_variants_status: 'running' },
        ))).toBe(true);
    });

    it('processes an UPDATE whose effective source changed', () => {
        expect(shouldIgnoreUnchangedSourceUpdate(updatePayload(
            { original_image_url: SOURCE_B, image_variants_status: 'ready' },
            { original_image_url: SOURCE_A, image_variants_status: 'ready' },
        ))).toBe(false);
    });

    it('compares the selected studio source rather than an unused original URL', () => {
        expect(shouldIgnoreUnchangedSourceUpdate(updatePayload(
            {
                studio_edited_image_url: SOURCE_A,
                original_image_url: SOURCE_B,
                image_variants_status: 'ready',
            },
            {
                studio_edited_image_url: SOURCE_A,
                original_image_url: SOURCE_A,
                image_variants_status: 'ready',
            },
        ))).toBe(true);
    });

    it('allows an explicit transition to pending as a manual retry', () => {
        expect(shouldIgnoreUnchangedSourceUpdate(updatePayload(
            { original_image_url: SOURCE_A, image_variants_status: 'pending' },
            { original_image_url: SOURCE_A, image_variants_status: 'failed' },
        ))).toBe(false);
    });

    it('does not repeatedly process pending-to-pending updates', () => {
        expect(shouldIgnoreUnchangedSourceUpdate(updatePayload(
            { original_image_url: SOURCE_A, image_variants_status: 'pending' },
            { original_image_url: SOURCE_A, image_variants_status: 'pending' },
        ))).toBe(true);
    });

    it('ignores unchanged no-source updates so skipped rows settle', () => {
        expect(shouldIgnoreUnchangedSourceUpdate(updatePayload(
            { original_image_url: null, studio_edited_image_url: null, image_variants_status: 'skipped' },
            { original_image_url: null, studio_edited_image_url: null, image_variants_status: null },
        ))).toBe(true);
    });

    it('fails open when old_record is missing', () => {
        expect(shouldIgnoreUnchangedSourceUpdate(updatePayload(
            { original_image_url: SOURCE_A, image_variants_status: 'failed' },
            null,
        ))).toBe(false);
    });
});
