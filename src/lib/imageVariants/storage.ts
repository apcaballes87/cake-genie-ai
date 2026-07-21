/**
 * Variant storage helpers — path builder, public URL builder, and the
 * Supabase upload wrapper.
 *
 * All paths are deterministic functions of `(p_hash, width)` only. No
 * timestamps, no random tokens, no run identifiers (Req 12.1, 12.2). This
 * lets the URLs be safely treated as immutable forever (Req 9.4) and lets
 * the backfill be idempotent — a re-run produces byte-identical paths and
 * upserts the storage objects in place (Req 9.2).
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_BASE_URL, STORAGE_BUCKETS } from '@/constants';
import { getSeoImageUploadHeaders } from '@/lib/seo/storageImageHeaders';

/** The bucket all variants live in (Req 2.1). */
const VARIANT_BUCKET = STORAGE_BUCKETS.cakegenie;

/** Storage path prefix for variant objects within the bucket. */
const VARIANT_PREFIX = 'variants';

/**
 * Project Supabase host. Used by the foreign-source rehost rule
 * (Req 5.6, 15.1) to detect URLs that don't already live in our bucket.
 *
 * Resolved at module-eval time from `STORAGE_BASE_URL`, which is itself
 * built from `process.env.NEXT_PUBLIC_SUPABASE_URL`. If that env var is
 * missing, `constants.ts` will already have thrown; we don't need a second
 * guard here.
 */
export const PROJECT_SUPABASE_HOST: string = (() => {
    try {
        return new URL(STORAGE_BASE_URL).hostname;
    } catch {
        return 'cqmhanqnfybyxezhobkx.supabase.co';
    }
})();

/**
 * Cache-Control max-age value applied to every uploaded variant. Variants
 * are content-addressed by `(p_hash, width)`, so we mark them immutable
 * for one year — browsers and edge caches can hold onto them without
 * revalidation (Req 2.2, 9.3).
 *
 * IMPORTANT: Supabase's `cacheControl` upload option only accepts the
 * **numeric max-age value** as a string; Supabase auto-prepends
 * `max-age=` itself when serving the object. Passing the full directive
 * (e.g. `'public, max-age=31536000, immutable'`) results in the broken
 * header `max-age=public, max-age=...` which CDNs reject and fall back
 * to `no-cache`. We pass `'31536000'` here and rely on Supabase's
 * default emission of `max-age=31536000`. The full `public, immutable`
 * directives are configured at the bucket level in the Supabase
 * dashboard if needed.
 *
 * When the underlying source changes, the worker overwrites the same
 * path via `upsert: true` (Req 9.2) and the cache key (URL) stays the
 * same; freshness is propagated via a fresh `last-modified` header.
 */
const VARIANT_CACHE_CONTROL_MAX_AGE_SECONDS = '31536000';

/** WebP MIME type used on every upload (Req 2.3, 10.1). */
const VARIANT_CONTENT_TYPE = 'image/webp';

/**
 * Returns the storage object key for a variant within the cakegenie bucket.
 * Per Req 2.1 (revised): `variants/{key}/{width}.webp`.
 *
 * `key` is the descriptive design slug (e.g. `kuromi-light-purple-1-tier-cake-e3c3`)
 * so the rendered image URL carries keyword signal for Google Images. Callers
 * fall back to `p_hash` only when a row has no slug. The key is used verbatim
 * (no slugification) because design slugs are already URL-safe; `p_hash`
 * fallbacks are alphanumeric.
 *
 * Width is coerced through `Math.trunc` so a malformed (non-integer) input
 * produces a deterministic, predictable key rather than a NaN that would
 * silently corrupt later lookups. Callers should always pass an integer
 * width from the manifest.
 */
export function variantPath(key: string, width: number): string {
    const intWidth = Math.trunc(width);
    return `${VARIANT_PREFIX}/${key}/${intWidth}.webp`;
}

/**
 * Returns the public Supabase URL for a variant. Deterministic — built
 * entirely from `(key, width)` and the static storage host. The
 * SupabaseClient parameter is accepted (rather than required) so the helper
 * can be called without any network or DB context.
 *
 * Note: we deliberately don't call `client.storage.from(...).getPublicUrl()`
 * because that hits internal helpers that occasionally append cache-busting
 * query strings. Building the URL by string concatenation guarantees the
 * "no query string" rule from Req 9.4.
 */
export function publicVariantUrl(_client: SupabaseClient, key: string, width: number): string {
    return `${STORAGE_BASE_URL}/${VARIANT_BUCKET}/${variantPath(key, width)}`;
}

/**
 * Uploads a single encoded variant to Supabase storage with the standard
 * cache and content-type headers. Always upserts (Req 2.4, 9.2) so a re-run
 * overwrites the same path in place.
 *
 * Returns the deterministic public URL on success — same value as
 * `publicVariantUrl(client, key, width)`. We re-derive it locally rather
 * than trusting whatever the storage SDK returns, so callers can't end up
 * with run-scoped or signed URLs by accident (Req 12.2).
 *
 * Throws on failure (HTTP error, network error, payload-too-large, etc.).
 * Callers in `runVariantPipelineForRow` catch this and record the
 * `upload_<width>` stage in the per-row error log (Req 5.3).
 */
export async function uploadVariant(
    client: SupabaseClient,
    key: string,
    width: number,
    buf: Buffer
): Promise<{ url: string }> {
    const path = variantPath(key, width);

    const { error } = await client.storage
        .from(VARIANT_BUCKET)
        .upload(path, buf, {
            contentType: VARIANT_CONTENT_TYPE,
            cacheControl: VARIANT_CACHE_CONTROL_MAX_AGE_SECONDS,
            upsert: true,
            headers: getSeoImageUploadHeaders(),
        });

    if (error) {
        // Wrap with stage info so the caller's structured logging picks it
        // up cleanly. The error.message from supabase-js is already
        // human-readable; we just prefix the operation.
        throw new Error(`uploadVariant(${key}, ${width}): ${error.message}`);
    }

    return { url: publicVariantUrl(client, key, width) };
}
