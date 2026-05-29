/**
 * `generateVariants(buffer)` — the pure (no I/O) sharp pipeline.
 *
 * Decodes the source image once, reads its post-EXIF-rotation dimensions,
 * then re-encodes one WebP buffer per target width. Skips widths greater
 * than the source width (Req 1.3 — no upscaling). When the source is
 * narrower than the smallest target, emits a single native-width variant
 * (Req 1.5). Strips EXIF (sharp default with no `withMetadata`).
 *
 * Spec: .kiro/specs/cake-image-variant-pipeline/{requirements,design}.md
 *
 * Why isolate this from storage / DB:
 * - Pure functions are unit-testable without a Supabase client or network.
 * - The webhook worker and the backfill CLI both call this same function.
 * - Property tests (Req 11.1, 11.5) need to run thousands of iterations
 *   against synthetic inputs; isolating I/O keeps that fast.
 *
 * Required dependency: `sharp` (moved to `dependencies` in Phase 1.2).
 */

import sharp from 'sharp';

import type { GenerateResult, Variant, VariantManifest } from './types';

// ---------------------------------------------------------------------------
// Defaults (Req 1.1, 1.2, 1.6)
// ---------------------------------------------------------------------------

/**
 * The widths v1 ships. Determined by the dropped 1600/2400 tiers and the
 * 250 KB-per-cake budget at p95 (Req 8.2). Adding a width is purely
 * additive — older renderers see new srcset entries and ignore them.
 */
export const DEFAULT_TARGET_WIDTHS = [400, 800, 1200] as const;

/**
 * WebP quality knob. 80 hits the sweet spot of byte-size vs visual quality
 * for cake photos (smooth gradients, mid-frequency detail). Req 1.6.
 */
export const DEFAULT_QUALITY = 80;

/**
 * sharp `effort` (encoding compute time vs file size). 4 is the libwebp
 * default. Req 1.2 / 8.3 — bumping this trades CPU for smaller files;
 * we keep the default to stay inside the 30 s Vercel budget.
 */
export const DEFAULT_EFFORT = 4;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateOptions {
    /**
     * Target widths in pixels. Anything > source.width is dropped silently
     * (Req 1.3). Sorted ascending before processing so output order is
     * deterministic regardless of caller-supplied order.
     */
    targetWidths?: readonly number[];
    /** WebP quality 0-100. Default 80. */
    quality?: number;
    /** sharp `effort` 0-6. Default 4. */
    effort?: number;
}

/**
 * Run the full generate pipeline on a single source image.
 *
 * Throws only on programmer error (e.g. caller passed an empty buffer);
 * any image-data failure is reported through the return value with
 * `result.warnings` and an empty `result.encoded` array. The caller (the
 * webhook route or backfill CLI) maps that to the `'failed'` status
 * (Req 5.5).
 *
 * Why caller-visible error reporting instead of throwing:
 * - The webhook worker already has a try/catch but needs structured info
 *   to write to `image_variants_error`. Returning warnings keeps the
 *   error path uniform with the success path.
 * - Property tests (Req 11.5, 11.6) generate adversarial inputs; throwing
 *   on every malformed buffer would break the property runner.
 */
export async function generateVariants(
    input: Buffer,
    opts: GenerateOptions = {},
): Promise<GenerateResult> {
    const targetWidths = (opts.targetWidths ?? DEFAULT_TARGET_WIDTHS).slice().sort((a, b) => a - b);
    const quality = opts.quality ?? DEFAULT_QUALITY;
    const effort = opts.effort ?? DEFAULT_EFFORT;

    if (!Buffer.isBuffer(input) || input.length === 0) {
        // Caller-side mistake. Don't try to encode an empty buffer; let the
        // caller log the error. Empty buffers have no manifest to return.
        return {
            manifest: emptyManifest(),
            source: { width: 0, height: 0 },
            encoded: [],
            warnings: ['empty_input_buffer'],
        };
    }

    const originalBytes = input.length;

    // Decode metadata once. `failOn: 'none'` lets sharp surface partial
    // info on slightly malformed images instead of throwing — we'd rather
    // record a structured warning than abort the whole row.
    let metadata: sharp.Metadata;
    try {
        metadata = await sharp(input, { failOn: 'none' }).metadata();
    } catch (err) {
        return {
            manifest: emptyManifest(),
            source: { width: 0, height: 0 },
            encoded: [],
            warnings: [`metadata_decode_error: ${(err as Error).message}`],
        };
    }

    // sharp's `metadata()` reports the *stored* width/height — i.e. before
    // EXIF orientation is applied. For orientations 5/6/7/8 the visually-
    // correct dimensions are swapped. We derive the post-rotation
    // dimensions ourselves rather than re-decoding (which is what
    // `.rotate().toBuffer({ resolveWithObject: true })` would do at the
    // cost of a full decode pass). Req 16.4.
    const orientation = metadata.orientation ?? 1;
    const swapsAxes = orientation >= 5 && orientation <= 8;
    const rawWidth = metadata.width ?? 0;
    const rawHeight = metadata.height ?? 0;
    const sourceWidth = swapsAxes ? rawHeight : rawWidth;
    const sourceHeight = swapsAxes ? rawWidth : rawHeight;

    // Req 5.5, 16.3: when sharp can't read dimensions we treat the row as
    // failed. The caller maps the empty manifest + warning to status='failed'.
    if (
        !Number.isFinite(sourceWidth) ||
        !Number.isFinite(sourceHeight) ||
        sourceWidth <= 0 ||
        sourceHeight <= 0
    ) {
        return {
            manifest: emptyManifest(),
            source: { width: 0, height: 0 },
            encoded: [],
            warnings: [
                `invalid_source_dimensions: width=${rawWidth} height=${rawHeight} orientation=${orientation}`,
            ],
        };
    }

    // Filter target widths against source width (Req 1.3). When source is
    // narrower than the smallest target, fall back to a single native-width
    // variant (Req 1.5).
    const usableTargets = targetWidths.filter((w) => w <= sourceWidth);
    const effectiveWidths: number[] = usableTargets.length > 0 ? usableTargets : [sourceWidth];

    const variants: Variant[] = [];
    const encoded: GenerateResult['encoded'] = [];
    const warnings: string[] = [];

    let totalBytes = 0;

    for (const width of effectiveWidths) {
        try {
            // Each variant gets its own sharp pipeline. Sharing one pipeline
            // across `.resize()` calls would mutate state across iterations.
            const buffer = await sharp(input, { failOn: 'none' })
                .rotate() // Honor EXIF orientation before resizing (Req 16.4).
                .resize({ width, withoutEnlargement: true })
                .webp({ quality, effort })
                .toBuffer();

            // Req 1.8: every variant must be ≤ original bytes. WebP at q=80
            // beats almost every JPEG/PNG, but we record a warning if it
            // ever doesn't (which would point to a corrupt source).
            if (buffer.length > originalBytes) {
                warnings.push(
                    `variant_${width}_exceeded_original: variant=${buffer.length} original=${originalBytes}`,
                );
                continue;
            }

            // Req 1.7 / 9.1 — record the encoded byte size. URL is filled
            // in by the caller (storage.ts) so this module stays I/O-free.
            variants.push({
                width,
                url: '', // populated downstream
                bytes: buffer.length,
            });
            encoded.push({
                width,
                buffer,
                bytes: buffer.length,
            });
            totalBytes += buffer.length;
        } catch (err) {
            warnings.push(`encode_${width}_error: ${(err as Error).message}`);
        }
    }

    // Req 8.2 — soft cap of 250 KB total across the variant set. This is a
    // warning, not a failure: the renderer still benefits from any subset
    // we produced. Operators triage via the runbook when this fires.
    const SOFT_BYTE_BUDGET = 250 * 1024;
    if (totalBytes > SOFT_BYTE_BUDGET) {
        warnings.push(
            `variant_set_exceeded_budget: total_bytes=${totalBytes} budget=${SOFT_BYTE_BUDGET}`,
        );
    }

    return {
        manifest: {
            format: 'webp',
            // Source field gets overwritten by the caller (runForRow.ts) to
            // match the column it actually read. This default is just a
            // safe value while the manifest is en route to the caller.
            source: 'original_image_url',
            variants,
        },
        source: { width: sourceWidth, height: sourceHeight },
        encoded,
        warnings,
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyManifest(): VariantManifest {
    return {
        format: 'webp',
        source: 'original_image_url',
        variants: [],
    };
}
