import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
    generateVariants,
    DEFAULT_TARGET_WIDTHS,
    DEFAULT_QUALITY,
    DEFAULT_EFFORT,
} from '../generate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a synthetic JPEG of the given dimensions. JPEG (not WebP) so that
 * we exercise the cross-format decode path that the production worker
 * uses on Pinterest/Instagram URLs.
 */
async function makeJpeg(width: number, height: number = Math.round(width * 0.75)): Promise<Buffer> {
    return sharp({
        create: {
            width,
            height,
            channels: 3,
            background: { r: 200, g: 100, b: 50 },
        },
    })
        .jpeg({ quality: 90 })
        .toBuffer();
}

async function makePng(width: number, height: number = Math.round(width * 0.75)): Promise<Buffer> {
    return sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 200, g: 100, b: 50, alpha: 1 },
        },
    })
        .png()
        .toBuffer();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateVariants', () => {
    it('exports the documented defaults (Req 1.1, 1.2, 1.6)', () => {
        expect(DEFAULT_TARGET_WIDTHS).toEqual([400, 800, 1200]);
        expect(DEFAULT_QUALITY).toBe(80);
        expect(DEFAULT_EFFORT).toBe(4);
    });

    it('emits 3 variants at 400/800/1200 for a 3000 px source (Req 1.1)', async () => {
        const input = await makeJpeg(3000);
        const result = await generateVariants(input);

        expect(result.manifest.variants.map((v) => v.width)).toEqual([400, 800, 1200]);
        expect(result.encoded.map((e) => e.width)).toEqual([400, 800, 1200]);
    });

    it('emits ascending-by-width variants regardless of input target order (Req 3.4)', async () => {
        const input = await makeJpeg(2000);
        const result = await generateVariants(input, { targetWidths: [1200, 400, 800] });

        const widths = result.manifest.variants.map((v) => v.width);
        expect(widths).toEqual([...widths].sort((a, b) => a - b));
        expect(widths).toEqual([400, 800, 1200]);
    });

    it('skips widths greater than source width — no upscaling (Req 1.3)', async () => {
        const input = await makeJpeg(1000);
        const result = await generateVariants(input);

        // Targets [400, 800, 1200]; source is 1000 → keep [400, 800], drop 1200.
        expect(result.manifest.variants.map((v) => v.width)).toEqual([400, 800]);
        expect(result.manifest.variants.every((v) => v.width <= 1000)).toBe(true);
    });

    it('emits a single native-width variant when source is narrower than smallest target (Req 1.5)', async () => {
        const input = await makeJpeg(300);
        const result = await generateVariants(input);

        expect(result.manifest.variants).toHaveLength(1);
        expect(result.manifest.variants[0].width).toBe(300);
    });

    it('every variant is no bigger than the original bytes (Req 1.8)', async () => {
        const input = await makeJpeg(2400);
        const result = await generateVariants(input);

        expect(result.manifest.variants.length).toBeGreaterThan(0);
        for (const v of result.manifest.variants) {
            expect(v.bytes).toBeLessThanOrEqual(input.length);
        }
    });

    it('returns format=webp on the manifest (Req 10.1)', async () => {
        const input = await makeJpeg(1500);
        const result = await generateVariants(input);
        expect(result.manifest.format).toBe('webp');
    });

    it('every produced buffer is a valid WebP', async () => {
        const input = await makeJpeg(1500);
        const result = await generateVariants(input);

        for (const enc of result.encoded) {
            const meta = await sharp(enc.buffer).metadata();
            expect(meta.format).toBe('webp');
            expect(meta.width).toBe(enc.width);
        }
    });

    it('returns post-EXIF-rotation source dimensions (Req 16.4)', async () => {
        // Build an image whose EXIF claims orientation=6 (rotate 90° CW).
        // sharp's `withMetadata` applies the orientation when later .rotate()
        // is called.
        const portraitBeforeRotation = await sharp({
            create: {
                width: 800,
                height: 600,
                channels: 3,
                background: { r: 100, g: 100, b: 100 },
            },
        })
            .withMetadata({ orientation: 6 })
            .jpeg()
            .toBuffer();

        const result = await generateVariants(portraitBeforeRotation);
        // After honoring EXIF orientation 6, the visually-correct dimensions
        // are swapped: 600 wide × 800 tall.
        expect(result.source.width).toBe(600);
        expect(result.source.height).toBe(800);
    });

    it('source dimensions are integers and positive', async () => {
        const input = await makeJpeg(1234, 1234);
        const result = await generateVariants(input);
        expect(Number.isInteger(result.source.width)).toBe(true);
        expect(Number.isInteger(result.source.height)).toBe(true);
        expect(result.source.width).toBeGreaterThan(0);
        expect(result.source.height).toBeGreaterThan(0);
    });

    it('manifest.variants and encoded arrays are in 1:1 correspondence', async () => {
        const input = await makeJpeg(2000);
        const result = await generateVariants(input);

        expect(result.encoded.length).toBe(result.manifest.variants.length);
        for (let i = 0; i < result.encoded.length; i++) {
            expect(result.encoded[i].width).toBe(result.manifest.variants[i].width);
            expect(result.encoded[i].bytes).toBe(result.manifest.variants[i].bytes);
        }
    });

    it('handles PNG input', async () => {
        const input = await makePng(1500);
        const result = await generateVariants(input);
        // 1500 ≥ 1200, so all three target widths fit.
        expect(result.manifest.variants.map((v) => v.width)).toEqual([400, 800, 1200]);
    });

    it('returns empty result with warning for empty buffer', async () => {
        const result = await generateVariants(Buffer.alloc(0));
        expect(result.manifest.variants).toEqual([]);
        expect(result.encoded).toEqual([]);
        expect(result.warnings).toContain('empty_input_buffer');
        expect(result.source.width).toBe(0);
        expect(result.source.height).toBe(0);
    });

    it('returns empty result with warning for non-image bytes (Req 5.5)', async () => {
        const garbage = Buffer.from('this is not an image at all', 'utf-8');
        const result = await generateVariants(garbage);
        expect(result.manifest.variants).toEqual([]);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('honors custom targetWidths option', async () => {
        const input = await makeJpeg(2000);
        const result = await generateVariants(input, { targetWidths: [600] });
        expect(result.manifest.variants.map((v) => v.width)).toEqual([600]);
    });

    it('strips EXIF metadata from output (Req 1.4 / privacy)', async () => {
        // Source has GPS and copyright EXIF; output should not.
        const inputWithExif = await sharp({
            create: {
                width: 1500,
                height: 1000,
                channels: 3,
                background: { r: 100, g: 100, b: 100 },
            },
        })
            .withMetadata({ exif: { IFD0: { Copyright: 'TestCorp' } } })
            .jpeg()
            .toBuffer();

        const result = await generateVariants(inputWithExif);
        expect(result.encoded.length).toBeGreaterThan(0);

        for (const enc of result.encoded) {
            const meta = await sharp(enc.buffer).metadata();
            // sharp.metadata().exif is a Buffer when present, undefined when absent.
            // Without explicit `withMetadata()` in our pipeline, EXIF should be stripped.
            expect(meta.exif).toBeUndefined();
        }
    });

    it('source url field is empty in returned variants — caller fills it (Req: contract)', async () => {
        const input = await makeJpeg(1500);
        const result = await generateVariants(input);
        for (const v of result.manifest.variants) {
            expect(v.url).toBe('');
        }
    });
});
