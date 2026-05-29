/**
 * Single-flight claim helper for the variant pipeline.
 *
 * Two webhook invocations could race for the same `p_hash`:
 *   - Supabase retries on non-2xx responses.
 *   - INSERT and a later UPDATE both fire the same hook.
 *   - The backfill CLI may run concurrently with cron-fired webhooks.
 *
 * Req 4.5 forbids concurrent runs. The atomic claim is implemented as the
 * Postgres function `cakegenie_claim_variant_row(p_hash, effective_source)`
 * (migration `20260601000200_claim_variant_row_function.sql`) which runs a
 * conditional UPDATE in a single statement. Doing this server-side
 * eliminates the read-then-update race window that a JS-side check-then-set
 * would have.
 *
 * The function returns `1` when the claim succeeded (caller proceeds) and
 * `0` when another worker already holds it or the row is already
 * up-to-date for the same indexed source (caller exits 200 without retry).
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline/design.md §"Single-flight
 *       concurrency control" — Req 4.5, 9.3
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Name of the server-side RPC. Kept as a constant so any rename in the
 * migration shows up as a single edit here. */
const CLAIM_RPC = 'cakegenie_claim_variant_row';

export interface ClaimResult {
    /** true → caller should proceed with the pipeline; false → exit 200. */
    claimed: boolean;
    /**
     * Underlying error message when the RPC call itself failed (network,
     * function-missing, etc). Caller may want to log this for ops triage,
     * but should still treat it as `claimed: false` and not retry.
     */
    error?: string;
}

/**
 * Atomically claims a row for the variant pipeline.
 *
 * Does not throw on RPC failure — returns `{ claimed: false, error }` so
 * the caller's structured logging can record it without a try/catch
 * branch. The webhook route handler maps `claimed: false` to a 200
 * response (Supabase will not retry).
 *
 * `effectiveSourceUrl` should be the result of `selectEffectiveSource`
 * applied to the row's `studio_edited_image_url` / `original_image_url`.
 * Passing the empty string when no source exists is harmless — the RPC
 * compares against `image_variants_indexed_source` and won't match the
 * empty string for any normal row.
 */
export async function claimRowForVariantPipeline(
    client: SupabaseClient,
    pHash: string,
    effectiveSourceUrl: string,
): Promise<ClaimResult> {
    const { data, error } = await client.rpc(CLAIM_RPC, {
        p_hash_arg: pHash,
        effective_source_arg: effectiveSourceUrl,
    });

    if (error) {
        return { claimed: false, error: error.message };
    }

    // The RPC returns an integer (rows-affected). supabase-js wraps scalar
    // returns as the bare value. Defensive coercion handles older
    // supabase-js versions that returned arrays.
    const rowsAffected =
        typeof data === 'number' ? data : Array.isArray(data) ? Number(data[0]) : 0;

    return { claimed: rowsAffected > 0 };
}
