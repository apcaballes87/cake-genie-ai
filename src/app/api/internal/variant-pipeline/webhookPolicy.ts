import { selectEffectiveSource } from '@/lib/imageVariants/manifest';

export interface VariantWebhookRecord {
    p_hash?: string;
    slug?: string | null;
    studio_edited_image_url?: string | null;
    original_image_url?: string | null;
    image_variants_status?: string | null;
    [k: string]: unknown;
}

export interface SupabaseWebhookPayload {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    record?: VariantWebhookRecord;
    old_record?: VariantWebhookRecord | null;
    schema?: string;
}

function effectiveSourceUrl(record: VariantWebhookRecord): string | null {
    return selectEffectiveSource({
        studio_edited_image_url: record.studio_edited_image_url,
        original_image_url: record.original_image_url,
    })?.url ?? null;
}

/**
 * Database webhook UPDATEs caused by the worker's own status/manifest writes
 * must not start another claim. A deliberate transition to `pending` is the
 * one exception: it is the manual retry contract for an unchanged source.
 *
 * If Supabase unexpectedly omits `old_record`, fail open and let the atomic
 * claim RPC decide. That preserves legitimate work while the corrected RPC
 * still rejects unchanged terminal rows.
 */
export function shouldIgnoreUnchangedSourceUpdate(
    payload: SupabaseWebhookPayload,
): boolean {
    if (payload.type !== 'UPDATE' || !payload.old_record) {
        return false;
    }

    const record = payload.record ?? {};
    const explicitlySetPending =
        record.image_variants_status === 'pending'
        && payload.old_record.image_variants_status !== 'pending';

    if (explicitlySetPending) {
        return false;
    }

    return effectiveSourceUrl(record) === effectiveSourceUrl(payload.old_record);
}
