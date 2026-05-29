/**
 * TypeScript types for the cake image variant pipeline.
 *
 * Single source of truth for the JSON manifest shape that the worker writes
 * into `cakegenie_analysis_cache.image_variants` and that the renderer reads
 * back out. Every other module in `src/lib/imageVariants/*` imports from here.
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
 *
 * Wire format (the JSON object stored in the jsonb column):
 *
 *   {
 *     "format": "webp",
 *     "source": "studio_edited_image_url" | "original_image_url",
 *     "variants": [
 *       { "width": 400,  "url": "https://.../variants/<phash>/400.webp",  "bytes": 12345 },
 *       { "width": 800,  "url": "https://.../variants/<phash>/800.webp",  "bytes": 23456 },
 *       { "width": 1200, "url": "https://.../variants/<phash>/1200.webp", "bytes": 34567 }
 *     ]
 *   }
 *
 * Field semantics:
 *
 * - `format` — the encoded image format. v1 only emits WebP (Req 10.1).
 * - `source` — which Cake_Row column the worker used as input. Per Req 14.3,
 *   the field stores the literal column name (`"studio_edited_image_url"` /
 *   `"original_image_url"`). Older manifests written before Req 14 may omit
 *   this field; the parser treats a missing `source` as `"original_image_url"`
 *   (Req 14.4).
 * - `variants` — sorted ascending by `width` (Req 3.4). May contain fewer
 *   than 3 entries when the source image was smaller than a target width
 *   (Req 1.3) or when individual variant uploads failed (Req 5.3 partial
 *   success).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

/**
 * Encoded image formats produced by the pipeline. v1 ships WebP only
 * (Req 10.1 — no JPEG / PNG / AVIF). Kept as a union so future formats can
 * be added without breaking parser exhaustiveness.
 */
export type VariantFormat = 'webp';

/**
 * One pre-resized rendition of the Source_Image at a target width.
 *
 * `url` is a deterministic Supabase storage URL — no query string, no
 * cache-busting token (Req 9.4, 12.1, 12.2). The same `(p_hash, width)` pair
 * always produces the same URL.
 */
export interface Variant {
    /** Encoded width in pixels. Integer, ascending in the manifest. */
    width: number;
    /** Public Supabase storage URL. */
    url: string;
    /** Encoded byte size of the WebP payload. */
    bytes: number;
}

/**
 * Which `cakegenie_analysis_cache` column the worker chose as the
 * Source_Image for this manifest. Per Req 14.1 the worker always tries
 * `studio_edited_image_url` first (when non-empty after trimming whitespace),
 * falling back to `original_image_url`. The literal string written matches
 * the column name so the rendering side can correlate without a separate
 * mapping table.
 */
export type SourceColumn = 'studio_edited_image_url' | 'original_image_url';

/**
 * The JSON manifest stored on `cakegenie_analysis_cache.image_variants`.
 * Sorted-by-width invariant on `variants` is enforced by the
 * serialize/parse helpers (Req 3.4, 11.4).
 */
export interface VariantManifest {
    format: VariantFormat;
    /**
     * Which Cache_Row column was used as the Source_Image. Req 14.3.
     * Older manifests may not include this field; `parseManifest` defaults
     * a missing value to `'original_image_url'` (Req 14.4).
     */
    source: SourceColumn;
    /** Sorted ascending by `width` (Req 3.4). */
    variants: Variant[];
}

// ---------------------------------------------------------------------------
// Pipeline I/O contracts
// ---------------------------------------------------------------------------

/**
 * Returned by `generateVariants(buffer)` — the pure (no I/O) sharp pipeline.
 * Encoded buffers are kept alongside the manifest so the caller can upload
 * them directly without re-encoding.
 */
export interface GenerateResult {
    /** The completed manifest, ready to be written to the cache row. */
    manifest: VariantManifest;
    /**
     * Decoded dimensions of the source image (post-EXIF rotation). Used to
     * populate `cakegenie_analysis_cache.image_width` / `image_height`
     * (Req 3.5, 16.1, 16.4).
     */
    source: { width: number; height: number };
    /**
     * Per-width buffers ready for upload, in the same order as
     * `manifest.variants`. The caller pairs these with `manifest.variants[i]`
     * to upload to the URL recorded in `manifest.variants[i].url`.
     */
    encoded: Array<{ width: number; buffer: Buffer; bytes: number }>;
    /**
     * Soft warnings the pipeline accumulated (e.g. variant set exceeded
     * 250 KB total, Req 8.2). These do not constitute a failure — the
     * caller still writes the manifest — but they should be logged.
     */
    warnings: string[];
}

/**
 * The result of resolving the effective source URL for a row using the
 * Source_Image selection rule (Req 14.1).
 *
 * `column` is which `cakegenie_analysis_cache` column held the chosen URL.
 * The worker stores this on the manifest (`source` field, Req 14.3) and
 * uses it later when applying the foreign-host rehost rule (Req 5.6, 15.2)
 * to know which column to rewrite.
 */
export interface SelectedSource {
    url: string;
    column: SourceColumn;
}

/**
 * Input to `runVariantPipelineForRow`, the glue layer used by both the
 * webhook worker and the backfill CLI.
 *
 * The two source URLs are passed in directly (rather than re-read from the
 * row) because the webhook payload already carries them — saving a round
 * trip. The backfill CLI populates them from its batch SELECT.
 */
export interface RunForRowInput {
    pHash: string;
    /**
     * Studio-edited URL from the cache row, if any. Whitespace-only values
     * are treated as empty per Req 14.1.
     */
    studioEditedImageUrl?: string | null;
    /** Original URL from the cache row, if any. */
    originalImageUrl?: string | null;
    /**
     * Supabase client used for both storage uploads and the final DB UPDATE.
     * The worker passes a service-role client; the backfill CLI also uses
     * service-role. Browser-scoped clients won't have storage write
     * permissions and would fail at upload time.
     */
    client: SupabaseClient;
    /**
     * When true, the pipeline runs fetch + sharp but skips storage uploads
     * and the DB UPDATE. Used by `scripts/backfill-image-variants.ts
     * --dry-run` (Req 7.10).
     */
    dryRun?: boolean;
}

/**
 * Status reported by `runVariantPipelineForRow` after processing one row.
 *
 * - `ok` — all target widths uploaded and a complete manifest was written.
 * - `partial` — at least one variant succeeded and at least one failed
 *   (Req 5.3). A reduced manifest is still written.
 * - `skipped` — the row had no usable source URL (Req 5.4).
 * - `failed` — the worker could not produce any usable variants (decode
 *   error, every upload failed, etc.). `image_variants` stays NULL
 *   (Req 5.1, 5.5).
 */
export type RunForRowStatus = 'ok' | 'partial' | 'skipped' | 'failed';

/**
 * Result returned by `runVariantPipelineForRow`. The caller (webhook route
 * or backfill CLI) reads `manifest` to UPDATE `image_variants`, reads
 * `selected.column` + `rehostedTo` to apply the optional rehost UPDATE
 * (Req 5.6, 15.2), and reads `errors` for logging.
 */
export interface RunForRowResult {
    status: RunForRowStatus;
    /**
     * The completed manifest when `status` is `'ok'` or `'partial'`.
     * `null` when the row was skipped or the pipeline failed end-to-end.
     */
    manifest: VariantManifest | null;
    /**
     * Decoded dimensions of the source image, when sharp could read them.
     * Used by the caller to populate `image_width` / `image_height`
     * (Req 3.5, 16.1).
     */
    source?: { width: number; height: number };
    /**
     * Which column on the cache row was used as the source. Set whenever
     * the worker had a non-null Source_Image — present even on `'failed'`
     * outcomes that progressed past selection (e.g. fetch failed but we
     * know which column we tried).
     */
    selected?: SelectedSource;
    /**
     * The largest-variant Supabase URL produced by this run, set only when
     * `selected.url` host is not the project Supabase host AND at least one
     * variant uploaded successfully. The caller writes this value back to
     * `selected.column` to complete the rehost (Req 5.6, 15.2).
     */
    rehostedTo?: string;
    /**
     * Per-stage errors accumulated during the run. Used for the
     * `image_variants_error` column and structured logging.
     *
     * Stages mirror the failure-handling matrix in design.md:
     *   `fetch_original` | `decode` | `encode_<width>` | `upload_<width>`
     *   | `db_update` | `rehost_source_url`
     */
    errors: Array<{ stage: string; message: string }>;
}
