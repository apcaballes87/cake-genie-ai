/**
 * POST /api/internal/variant-pipeline
 *
 * Vercel Node-runtime route handler that processes a single
 * `cakegenie_analysis_cache` row through the variant pipeline. Triggered
 * by the Supabase Database Webhook on INSERT/UPDATE of the cache table.
 *
 * Flow:
 *   1. Verify the HMAC shared-secret header (auth.ts).
 *   2. Parse the Supabase webhook payload (`{ type, table, record, ... }`).
 *   3. Resolve effective source via `selectEffectiveSource`.
 *   4. Atomic claim via the `cakegenie_claim_variant_row` RPC. On 0
 *      rows-affected we return 200 and exit (Supabase will not retry).
 *   5. Run the pipeline via `runVariantPipelineForRow`.
 *   6. UPDATE the row with the manifest, status, indexed source, and the
 *      re-measured dimensions.
 *   7. If the pipeline rehosted a foreign-host source, additionally UPDATE
 *      the source column to point at the largest variant URL (Req 5.6, 15.2).
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
 *       Req 3.3, 3.4, 3.5, 4.1, 4.2, 4.5, 5.1, 5.3, 5.4, 5.5, 5.6, 9.2,
 *       9.3, 14.2, 16.1, 16.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { verifyWebhookSecret } from './auth';
import { claimRowForVariantPipeline } from '@/lib/imageVariants/claim';
import { selectEffectiveSource } from '@/lib/imageVariants/manifest';
import { runVariantPipelineForRow } from '@/lib/imageVariants/runForRow';
import { serializeManifest } from '@/lib/imageVariants/manifest';

// Force this route onto the Node runtime — sharp can't run on the Edge
// runtime. The `vercel.json` `functions` block raises maxDuration to 60 s
// for this route specifically (Phase 1.2).
export const runtime = 'nodejs';
// Disable Next.js response caching — every webhook is a unique row.
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Webhook payload shape
// ---------------------------------------------------------------------------

/**
 * Supabase DB Webhook payload. We only care about `record.p_hash` and the
 * URL columns; the rest of the row is read fresh during the pipeline run
 * because the webhook payload may be stale by the time we process it.
 */
interface SupabaseWebhookPayload {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    record?: {
        p_hash?: string;
        studio_edited_image_url?: string | null;
        original_image_url?: string | null;
        [k: string]: unknown;
    };
    old_record?: Record<string, unknown> | null;
    schema?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
    // ---- 1. Auth -----------------------------------------------------------
    const auth = verifyWebhookSecret(req);
    if (!auth.ok) {
        if (auth.reason === 'missing_server_secret') {
            // Server-side misconfiguration: the env var isn't set. 500 lets
            // Supabase retry (and lets ops notice the alert) rather than
            // silently swallowing webhooks at 401.
            return NextResponse.json(
                { error: 'server_misconfigured' },
                { status: 500 },
            );
        }
        // Don't leak the specific reason to remote callers.
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // ---- 2. Parse payload --------------------------------------------------
    let payload: SupabaseWebhookPayload;
    try {
        payload = (await req.json()) as SupabaseWebhookPayload;
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    // DELETE events have no record to process — Supabase still fires them
    // but variants are never created for deleted rows. Acknowledge without
    // doing work so Supabase doesn't retry.
    if (payload.type === 'DELETE') {
        return NextResponse.json({ ok: true, status: 'ignored_delete' });
    }

    const record = payload.record ?? {};
    const pHash = typeof record.p_hash === 'string' ? record.p_hash : null;
    if (!pHash) {
        return NextResponse.json(
            { error: 'missing_p_hash' },
            { status: 400 },
        );
    }

    // ---- 3. Build admin client + resolve effective source ------------------
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
            { error: 'server_misconfigured' },
            { status: 500 },
        );
    }
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const studioUrl =
        typeof record.studio_edited_image_url === 'string' || record.studio_edited_image_url === null
            ? (record.studio_edited_image_url as string | null)
            : null;
    const originalUrl =
        typeof record.original_image_url === 'string' || record.original_image_url === null
            ? (record.original_image_url as string | null)
            : null;

    const selected = selectEffectiveSource({
        studio_edited_image_url: studioUrl,
        original_image_url: originalUrl,
    });

    if (!selected) {
        // No usable source on the row. Mark skipped and exit.
        await admin
            .from('cakegenie_analysis_cache')
            .update({
                image_variants_status: 'skipped',
                image_variants_attempted_at: new Date().toISOString(),
            })
            .eq('p_hash', pHash);

        return NextResponse.json({ ok: true, status: 'skipped', reason: 'no_source' });
    }

    // ---- 4. Single-flight claim --------------------------------------------
    const claim = await claimRowForVariantPipeline(admin, pHash, selected.url);
    if (!claim.claimed) {
        // Another worker is processing or the row is already up-to-date
        // for the same indexed source. Return 200 so Supabase doesn't retry.
        return NextResponse.json({
            ok: true,
            status: 'skipped',
            reason: 'claim_not_acquired',
            error: claim.error,
        });
    }

    // ---- 5. Run pipeline ---------------------------------------------------
    const result = await runVariantPipelineForRow({
        pHash,
        studioEditedImageUrl: studioUrl,
        originalImageUrl: originalUrl,
        client: admin,
    });

    // ---- 6. Persist outcome ------------------------------------------------
    if (result.status === 'skipped') {
        // selectEffectiveSource picked something but the pipeline still
        // skipped for some other reason (shouldn't happen given the
        // selection check above, but handled for completeness).
        await admin
            .from('cakegenie_analysis_cache')
            .update({
                image_variants_status: 'skipped',
                image_variants_indexed_source: selected.url,
                image_variants_indexed_at: new Date().toISOString(),
            })
            .eq('p_hash', pHash);
        return NextResponse.json({ ok: true, status: 'skipped' });
    }

    if (result.status === 'failed' || !result.manifest) {
        // Pipeline failed end-to-end. Mark failed with a structured error
        // and let the next webhook retry pick this up.
        const errorJson =
            result.errors.length > 0
                ? JSON.stringify(result.errors)
                : 'unknown_error';
        await admin
            .from('cakegenie_analysis_cache')
            .update({
                image_variants_status: 'failed',
                image_variants_error: errorJson,
                image_variants_indexed_source: selected.url,
            })
            .eq('p_hash', pHash);

        // Return 200 so Supabase does NOT retry — failures are bounded by
        // the row's source content (a non-image URL won't decode no matter
        // how many times we try). The next genuine source change will
        // re-fire the webhook automatically because indexed_source will
        // differ from the new effective source.
        return NextResponse.json(
            { ok: false, status: 'failed', errors: result.errors },
            { status: 200 },
        );
    }

    // Status: 'ok' or 'partial' — both write the manifest with whatever
    // variants succeeded. Re-measured dimensions overwrite prior values
    // (Req 16.2). Errors from a partial run are recorded for ops triage
    // but don't block the manifest write.
    const updatePayload: Record<string, unknown> = {
        image_variants: serializeManifest(result.manifest),
        image_variants_status: result.status === 'ok' ? 'ready' : 'partial',
        image_variants_indexed_source: selected.url,
        image_variants_indexed_at: new Date().toISOString(),
        image_variants_error:
            result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    };

    if (result.source) {
        updatePayload.image_width = result.source.width;
        updatePayload.image_height = result.source.height;
    }

    const { error: updateError } = await admin
        .from('cakegenie_analysis_cache')
        .update(updatePayload)
        .eq('p_hash', pHash);

    if (updateError) {
        // The manifest was generated successfully but we couldn't write
        // it. Return 500 so Supabase retries — the next call will hit a
        // stale claim, fall through, and the upsert-style storage uploads
        // are idempotent so the retry is cheap.
        return NextResponse.json(
            { ok: false, status: 'db_update_failed', error: updateError.message },
            { status: 500 },
        );
    }

    // ---- 7. Optional rehost UPDATE -----------------------------------------
    // If the source URL was on a foreign host, rewrite the source column
    // to point at the largest variant we just stored (Req 5.6, 15.2).
    if (result.rehostedTo && selected.column) {
        const { error: rehostError } = await admin
            .from('cakegenie_analysis_cache')
            .update({ [selected.column]: result.rehostedTo })
            .eq('p_hash', pHash);

        if (rehostError) {
            // Non-fatal: the manifest write already succeeded. Log and
            // continue — the next webhook fire (or backfill pass) will
            // retry. Status returned is still 'ok' for the variant work.
            return NextResponse.json({
                ok: true,
                status: result.status,
                rehostedTo: null,
                rehost_error: rehostError.message,
            });
        }
    }

    return NextResponse.json({
        ok: true,
        status: result.status,
        rehostedTo: result.rehostedTo ?? null,
        variant_count: result.manifest.variants.length,
    });
}
