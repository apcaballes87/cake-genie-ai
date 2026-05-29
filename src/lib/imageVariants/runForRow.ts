/**
 * `runVariantPipelineForRow` — the glue layer that turns a single Cache_Row
 * into a written manifest + uploaded variants. Used by both the webhook
 * worker (`src/app/api/internal/variant-pipeline/route.ts`) and the
 * backfill CLI (`scripts/backfill-image-variants.ts`).
 *
 * Stages, in order:
 *
 *   1. Selection   — pick `studio_edited_image_url` or `original_image_url`
 *                    via `selectEffectiveSource` (Req 14.1).
 *   2. Fetch       — HTTP-fetch the source bytes. Foreign-host URLs
 *                    (Pinterest, Instagram, gstatic, etc.) get the same
 *                    treatment as Supabase URLs at this step (Req 15.1).
 *   3. Generate    — sharp pipeline (`generateVariants`). Pure, no I/O.
 *   4. Upload      — push each encoded variant to the cakegenie bucket
 *                    via `uploadVariant`. Sequential upload so we don't
 *                    saturate the storage egress for one cake.
 *   5. Manifest    — assemble `VariantManifest` from successful uploads,
 *                    set `manifest.source` to the column we read from.
 *   6. Rehost flag — if `selected.url` host is not the project Supabase
 *                    host, set `result.rehostedTo` so the caller can
 *                    rewrite `selected.column` to the largest variant URL
 *                    (Req 5.6, 15.2). The caller does the UPDATE so all
 *                    DB writes stay in one place.
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
 *
 * Why the caller (and not this function) issues the DB UPDATE:
 * - The webhook route has its own claim/release transaction that wraps
 *   the row update; embedding the UPDATE here would split that transaction.
 * - The backfill CLI batches updates differently (batch size 25). Keeping
 *   the UPDATE outside lets each caller choose its own write strategy.
 * - Easier to test: this function takes a buffer-producing fetcher and a
 *   storage client, returns a result struct, and the caller decides what
 *   to write to Postgres.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { generateVariants } from './generate';
import { selectEffectiveSource } from './manifest';
import { PROJECT_SUPABASE_HOST, publicVariantUrl, uploadVariant } from './storage';
import type {
    RunForRowInput,
    RunForRowResult,
    SelectedSource,
    Variant,
    VariantManifest,
} from './types';

// Re-export for backward-compat with the design spec which lists
// `selectEffectiveSource` in `runForRow.ts`. Keeping the canonical
// implementation in `manifest.ts` (pure, render-safe) and re-exporting
// here lets both modules be the documented import site.
export { selectEffectiveSource, PROJECT_SUPABASE_HOST };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Hard timeout on a single source-image fetch. The Vercel route budget is
 * 60 s and we leave headroom for sharp + uploads (~ 25 s combined). 15 s
 * covers slow Pinterest CDN responses without holding the function open.
 */
const FETCH_TIMEOUT_MS = 15_000;

/** Max source bytes we'll buffer in memory. 25 MB covers the 99th percentile
 * of cake originals (typical: 200 KB - 5 MB). Larger payloads are almost
 * certainly bogus and would put us at risk of OOM in the lambda. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/**
 * User-agent header sent on foreign-host fetches. Some hosts (Pinterest,
 * Instagram CDN) reject default Node fetch UAs with 403/429. Identifying
 * as a real user-agent string improves success rate.
 */
const FETCH_USER_AGENT =
    'Mozilla/5.0 (compatible; cakegenie-image-pipeline/1.0; +https://genie.ph/bots)';

// ---------------------------------------------------------------------------
// Errors stage names (mirror design.md §"Stages tracked")
// ---------------------------------------------------------------------------

const STAGE = {
    fetch_original: 'fetch_original',
    decode: 'decode',
    upload: (width: number) => `upload_${width}`,
    encode: (width: number) => `encode_${width}`,
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Override-points for tests. The default fetcher uses the global `fetch`,
 * but unit tests inject a mock so they don't have to spin up a server.
 */
export interface RunForRowOptions {
    /**
     * Overrides the default HTTP fetcher. Useful for tests; production
     * callers (webhook + backfill) leave this undefined to use the
     * global `fetch` with our standard headers and timeout.
     */
    fetchSource?: (url: string) => Promise<{ bytes: Buffer; status: number }>;
}

export async function runVariantPipelineForRow(
    input: RunForRowInput,
    opts: RunForRowOptions = {},
): Promise<RunForRowResult> {
    const errors: RunForRowResult['errors'] = [];
    const fetchSource = opts.fetchSource ?? defaultFetchSource;

    // ---- Stage 1: selection ------------------------------------------------
    const selected = selectEffectiveSource({
        studio_edited_image_url: input.studioEditedImageUrl ?? null,
        original_image_url: input.originalImageUrl ?? null,
    });

    if (selected === null) {
        // Req 5.4 — no usable source means we skip cleanly. Caller will
        // mark status='skipped' and not retry until the row changes.
        return {
            status: 'skipped',
            manifest: null,
            errors,
        };
    }

    // ---- Stage 2: fetch ----------------------------------------------------
    let sourceBytes: Buffer;
    try {
        const { bytes, status } = await fetchSource(selected.url);
        if (status < 200 || status >= 300) {
            errors.push({
                stage: STAGE.fetch_original,
                message: `non-2xx status: ${status} for ${safeHost(selected.url)}`,
            });
            return { status: 'failed', manifest: null, selected, errors };
        }
        if (bytes.length === 0) {
            errors.push({
                stage: STAGE.fetch_original,
                message: `empty body for ${safeHost(selected.url)}`,
            });
            return { status: 'failed', manifest: null, selected, errors };
        }
        if (bytes.length > MAX_SOURCE_BYTES) {
            errors.push({
                stage: STAGE.fetch_original,
                message: `body too large: ${bytes.length} > ${MAX_SOURCE_BYTES}`,
            });
            return { status: 'failed', manifest: null, selected, errors };
        }
        sourceBytes = bytes;
    } catch (err) {
        errors.push({
            stage: STAGE.fetch_original,
            message: `${(err as Error).message}`,
        });
        return { status: 'failed', manifest: null, selected, errors };
    }

    // ---- Stage 3: generate (decode + encode) -------------------------------
    const generated = await generateVariants(sourceBytes);

    // generateVariants returns warnings for decode/encode failures rather
    // than throwing. Map those into stage errors so the caller's structured
    // log preserves the per-stage breakdown.
    if (generated.warnings.length > 0) {
        for (const w of generated.warnings) {
            // Heuristic stage attribution: warnings starting with `encode_<n>`
            // belong to encode_<n>; everything else maps to `decode`.
            const encodeMatch = w.match(/^encode_(\d+)_/);
            if (encodeMatch) {
                errors.push({
                    stage: STAGE.encode(Number(encodeMatch[1])),
                    message: w,
                });
            } else {
                errors.push({ stage: STAGE.decode, message: w });
            }
        }
    }

    // No usable variants → failed. Req 5.5: any decode-level failure means
    // we leave `image_variants` NULL so the renderer falls back to the
    // original URL.
    if (generated.encoded.length === 0) {
        return {
            status: 'failed',
            manifest: null,
            // Don't promise post-rotation source dims here — we may not have
            // valid ones if metadata decode failed.
            source:
                generated.source.width > 0
                    ? generated.source
                    : undefined,
            selected,
            errors,
        };
    }

    // ---- Stage 4: upload (sequential) --------------------------------------
    // If `dryRun` is set the backfill is exercising the fetch + sharp path
    // without writing to storage or the DB. We still produce a synthetic
    // manifest so the caller can log what would have happened.
    if (input.dryRun) {
        const manifest = buildManifest(input.pHash, input.client, generated.encoded, selected);
        // Dry-run: synthesize Variant entries to feed the rehost helper so
        // the result is identical to a real run with all uploads succeeding.
        const syntheticUploads: Variant[] = manifest.variants.map((v) => ({
            width: v.width,
            url: v.url,
            bytes: v.bytes,
        }));
        return {
            status: 'ok',
            manifest,
            source: generated.source,
            selected,
            ...maybeRehostFlag(selected, syntheticUploads),
            errors,
        };
    }

    const uploadedVariants: Variant[] = [];
    for (const enc of generated.encoded) {
        try {
            const { url } = await uploadVariant(input.client, input.pHash, enc.width, enc.buffer);
            uploadedVariants.push({
                width: enc.width,
                url,
                bytes: enc.bytes,
            });
        } catch (err) {
            errors.push({
                stage: STAGE.upload(enc.width),
                message: (err as Error).message,
            });
        }
    }

    if (uploadedVariants.length === 0) {
        // Req 5.3 — every upload failed. Treat as full failure; manifest
        // stays NULL.
        return {
            status: 'failed',
            manifest: null,
            source: generated.source,
            selected,
            errors,
        };
    }

    // ---- Stage 5: assemble manifest ---------------------------------------
    const manifest: VariantManifest = {
        format: 'webp',
        // Req 14.3 — record which column we sourced from so the renderer
        // can correlate later.
        source: selected.column,
        // Req 3.4 — sort ascending by width.
        variants: [...uploadedVariants].sort((a, b) => a.width - b.width),
    };

    // ---- Stage 6: rehost flag ---------------------------------------------
    // Use the *uploaded* variants (not the full encoded set) so the rehost
    // target always points at a URL that actually exists. If the largest
    // variant's upload failed, we fall back to the next-largest successfully
    // uploaded one.
    const rehostFlag = maybeRehostFlag(selected, uploadedVariants);

    // Req 5.3 — partial when at least one variant succeeded and at least
    // one failed. Otherwise full success.
    const status: RunForRowResult['status'] =
        uploadedVariants.length === generated.encoded.length ? 'ok' : 'partial';

    return {
        status,
        manifest,
        source: generated.source,
        selected,
        ...rehostFlag,
        errors,
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default fetcher. Used in production. AbortController-driven timeout so
 * the function doesn't hold a Vercel slot longer than `FETCH_TIMEOUT_MS`.
 */
async function defaultFetchSource(
    url: string,
): Promise<{ bytes: Buffer; status: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'user-agent': FETCH_USER_AGENT,
                accept: 'image/*,*/*;q=0.8',
            },
        });

        // Even on non-2xx we read the body so the connection releases.
        const arrayBuffer = await response.arrayBuffer();
        return {
            bytes: Buffer.from(arrayBuffer),
            status: response.status,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Detects whether the source URL host is foreign (i.e. not our Supabase
 * project host). Used to decide whether to set `rehostedTo` so the caller
 * rewrites the source column.
 *
 * Req 5.6 / 15.2 — the rehost target is the largest variant URL produced.
 * If the URL parse fails we conservatively decide *not* to rehost — better
 * to leave a malformed URL alone than to silently overwrite it.
 */
function isForeignHost(url: string): boolean {
    try {
        return new URL(url).hostname !== PROJECT_SUPABASE_HOST;
    } catch {
        return false;
    }
}

/**
 * Returns `{ rehostedTo }` when the row should be rehosted, otherwise an
 * empty object so the caller's spread doesn't introduce an undefined key.
 *
 * Targets the largest *successfully uploaded* variant URL — sorting by
 * `width` ascending and taking the last entry. Using uploaded variants
 * (rather than the full encoded set) guarantees the rehost target points
 * at a URL that actually exists in the bucket. Req 5.6, 15.2.
 */
function maybeRehostFlag(
    selected: SelectedSource,
    uploadedVariants: Variant[],
): { rehostedTo?: string } {
    if (!isForeignHost(selected.url)) return {};
    if (uploadedVariants.length === 0) return {};

    const sorted = [...uploadedVariants].sort((a, b) => a.width - b.width);
    return { rehostedTo: sorted[sorted.length - 1].url };
}

/**
 * Build a synthetic manifest for the dry-run path. Uses
 * `publicVariantUrl` so the URLs match what production would write.
 */
function buildManifest(
    pHash: string,
    client: SupabaseClient,
    encoded: Array<{ width: number; buffer: Buffer; bytes: number }>,
    selected: SelectedSource,
): VariantManifest {
    return {
        format: 'webp',
        source: selected.column,
        variants: [...encoded]
            .sort((a, b) => a.width - b.width)
            .map((e) => ({
                width: e.width,
                url: publicVariantUrl(client, pHash, e.width),
                bytes: e.bytes,
            })),
    };
}

/** Hostname extraction that doesn't throw on malformed URLs. */
function safeHost(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return '<malformed-url>';
    }
}
