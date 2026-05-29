/**
 * Variant manifest parser, serializer, srcset/picker helpers, and the
 * source-image selection rule.
 *
 * All functions here are pure — no I/O, no Supabase client, no `sharp`.
 * That makes them safe to import into the SSR/RSC render path (where the
 * PDP reads the manifest off the cache row and builds the `<picture>`
 * element) without dragging Node-only dependencies into the React tree.
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
 */

import type {
    SelectedSource,
    SourceColumn,
    Variant,
    VariantFormat,
    VariantManifest,
} from './types';

// ---------------------------------------------------------------------------
// Parser / serializer
// ---------------------------------------------------------------------------

const VARIANT_FORMATS = new Set<VariantFormat>(['webp']);
const SOURCE_COLUMNS = new Set<SourceColumn>([
    'studio_edited_image_url',
    'original_image_url',
]);

function isFiniteNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

function parseVariant(value: unknown): Variant | null {
    if (typeof value !== 'object' || value === null) return null;
    const obj = value as Record<string, unknown>;

    if (!isFiniteNonNegativeInteger(obj.width) || obj.width <= 0) return null;
    if (!isNonEmptyString(obj.url)) return null;
    if (!isFiniteNonNegativeInteger(obj.bytes)) return null;

    return {
        width: obj.width,
        url: obj.url,
        bytes: obj.bytes,
    };
}

/**
 * Reads a JSONB value off `cakegenie_analysis_cache.image_variants` and
 * returns a typed `VariantManifest`, or `null` when the input is malformed.
 *
 * Per Req 3.6, an empty `variants` array is treated the same as a NULL
 * manifest by the renderer — but we still return the parsed shape so
 * callers can distinguish "no manifest at all" from "manifest exists but
 * has nothing to render". When the renderer wants the second case to fall
 * back, it can check `manifest.variants.length === 0`.
 *
 * Per Req 14.4, manifests written before Req 14 (no `source` field) are
 * accepted and given a default of `'original_image_url'` so PDP rendering
 * keeps working without a backfill rerun.
 *
 * Always returns the variants sorted ascending by `width` so callers can
 * rely on order without an extra sort step (Req 3.4, 11.4). Variants with
 * duplicate widths are kept in the order they appeared — duplicates are a
 * pipeline bug, not something the parser should silently drop.
 */
export function parseManifest(value: unknown): VariantManifest | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object') return null;

    const obj = value as Record<string, unknown>;

    // format: required, must be a known VariantFormat literal.
    if (!isNonEmptyString(obj.format)) return null;
    if (!VARIANT_FORMATS.has(obj.format as VariantFormat)) return null;
    const format = obj.format as VariantFormat;

    // source: optional for backward compatibility (Req 14.4).
    let source: SourceColumn = 'original_image_url';
    if (obj.source !== undefined && obj.source !== null) {
        if (!isNonEmptyString(obj.source)) return null;
        if (!SOURCE_COLUMNS.has(obj.source as SourceColumn)) return null;
        source = obj.source as SourceColumn;
    }

    // variants: required, must be an array.
    if (!Array.isArray(obj.variants)) return null;
    const parsedVariants: Variant[] = [];
    for (const raw of obj.variants) {
        const variant = parseVariant(raw);
        if (variant === null) return null;
        parsedVariants.push(variant);
    }

    // Sort ascending by width (Req 3.4). Stable sort preserves duplicate-
    // width inputs in original order so a buggy pipeline emitting duplicates
    // is visible at the renderer rather than silently masked.
    parsedVariants.sort((a, b) => a.width - b.width);

    return { format, source, variants: parsedVariants };
}

/**
 * Returns the plain object shape that goes into `image_variants` jsonb.
 * Sorts `variants` ascending by `width` on the way out so we never store
 * an unsorted manifest, regardless of the order the caller built it in
 * (Req 3.4).
 */
export function serializeManifest(manifest: VariantManifest): {
    format: VariantFormat;
    source: SourceColumn;
    variants: Variant[];
} {
    const sortedVariants = [...manifest.variants].sort((a, b) => a.width - b.width);
    return {
        format: manifest.format,
        source: manifest.source,
        variants: sortedVariants,
    };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

/**
 * Builds the `srcset` attribute string from a manifest. Variants are
 * emitted in strictly ascending width order so the browser's source-set
 * resolution is well-defined (Req 6.2, 11.4).
 *
 * Returns an empty string when the manifest has no variants. The caller
 * (renderer) treats an empty srcset as "no `<picture>` wrapper" and falls
 * back to a single-URL `<img>` (Req 5.2).
 */
export function buildSrcSet(manifest: VariantManifest): string {
    if (manifest.variants.length === 0) return '';
    const sorted = [...manifest.variants].sort((a, b) => a.width - b.width);
    return sorted.map((v) => `${v.url} ${v.width}w`).join(', ');
}

/**
 * Picks the variant URL to use as the `src` fallback on the `<img>` (the
 * value the browser uses when the `srcset` selection logic doesn't apply,
 * e.g. for older crawlers or `<noscript>`).
 *
 * Strategy (Req 6.5): prefer the largest variant whose `width <= maxWidth`.
 * If every variant is larger than `maxWidth`, fall back to the smallest
 * variant — better to serve something the device might over-display than
 * nothing at all.
 *
 * Returns `null` only when the manifest has no variants.
 *
 * Default `maxWidth` is 1200 because the largest variant we produce is
 * 1200 px (Req 1.1) — so on the typical desktop case `pickFallbackSrc(m)`
 * returns the 1200 variant directly.
 */
export function pickFallbackSrc(
    manifest: VariantManifest | null | undefined,
    maxWidth: number = 1200,
): string | null {
    if (!manifest || manifest.variants.length === 0) return null;

    const sorted = [...manifest.variants].sort((a, b) => a.width - b.width);

    let best: Variant | null = null;
    for (const v of sorted) {
        if (v.width <= maxWidth) best = v;
    }
    if (best !== null) return best.url;

    // Every variant is larger than the requested max — fall back to the
    // smallest available so the renderer always has something to show.
    return sorted[0].url;
}

// ---------------------------------------------------------------------------
// Source-image selection (Req 14.1)
// ---------------------------------------------------------------------------

/**
 * Trim ASCII whitespace from both ends of a candidate URL string.
 *
 * Some legacy rows in `cakegenie_analysis_cache` have leading/trailing
 * whitespace in the URL columns (carried over from a CSV import). Per
 * Req 14.1, whitespace-only studio URLs are treated as empty so the
 * pipeline falls through to the original URL. Non-empty URLs with
 * surrounding whitespace are returned trimmed so downstream `new URL(...)`
 * doesn't throw on the leading space.
 */
function normalizeCandidateUrl(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves the effective Source_Image for a Cache_Row using the precedence
 * defined in Req 14.1: studio-edited URL wins when present and non-empty
 * (after trimming whitespace), otherwise the original URL.
 *
 * Returns `null` when both columns are empty — the caller treats this as
 * "skip this row" and writes `image_variants_status='skipped'` (Req 5.4).
 *
 * Both the webhook worker and the backfill CLI go through this single
 * function so the studio-vs-original behavior never drifts between the
 * two code paths.
 */
export function selectEffectiveSource(row: {
    studio_edited_image_url: string | null | undefined;
    original_image_url: string | null | undefined;
}): SelectedSource | null {
    const studio = normalizeCandidateUrl(row.studio_edited_image_url);
    if (studio !== null) {
        return { url: studio, column: 'studio_edited_image_url' };
    }

    const original = normalizeCandidateUrl(row.original_image_url);
    if (original !== null) {
        return { url: original, column: 'original_image_url' };
    }

    return null;
}
