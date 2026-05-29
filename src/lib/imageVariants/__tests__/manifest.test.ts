import { describe, it, expect } from 'vitest';
import {
    parseManifest,
    serializeManifest,
    buildSrcSet,
    pickFallbackSrc,
    selectEffectiveSource,
} from '../manifest';
import type { VariantManifest } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const url400 = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/variants/abc/400.webp';
const url800 = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/variants/abc/800.webp';
const url1200 = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/variants/abc/1200.webp';

const validManifest: VariantManifest = {
    format: 'webp',
    source: 'studio_edited_image_url',
    variants: [
        { width: 400, url: url400, bytes: 12000 },
        { width: 800, url: url800, bytes: 24000 },
        { width: 1200, url: url1200, bytes: 36000 },
    ],
};

describe('parseManifest', () => {
    it('returns null for null/undefined (Req 3.6)', () => {
        expect(parseManifest(null)).toBeNull();
        expect(parseManifest(undefined)).toBeNull();
    });

    it('returns null for non-object inputs', () => {
        expect(parseManifest('string')).toBeNull();
        expect(parseManifest(42)).toBeNull();
        expect(parseManifest(true)).toBeNull();
    });

    it('returns null for an empty object (no format, no variants)', () => {
        expect(parseManifest({})).toBeNull();
    });

    it('returns null for unknown format values', () => {
        expect(parseManifest({ format: 'jpeg', variants: [] })).toBeNull();
        expect(parseManifest({ format: 'avif', variants: [] })).toBeNull();
    });

    it('returns null when variants is not an array', () => {
        expect(parseManifest({ format: 'webp', variants: 'not-an-array' })).toBeNull();
        expect(parseManifest({ format: 'webp', variants: {} })).toBeNull();
    });

    it('returns null when any variant is malformed', () => {
        expect(
            parseManifest({
                format: 'webp',
                variants: [{ width: 400, url: url400, bytes: 1000 }, { width: 'not-a-number', url: url800, bytes: 2000 }],
            }),
        ).toBeNull();
        expect(
            parseManifest({
                format: 'webp',
                variants: [{ width: 400, url: '', bytes: 1000 }],
            }),
        ).toBeNull();
        expect(
            parseManifest({
                format: 'webp',
                variants: [{ width: 0, url: url400, bytes: 1000 }],
            }),
        ).toBeNull();
        expect(
            parseManifest({
                format: 'webp',
                variants: [{ width: 400, url: url400, bytes: -1 }],
            }),
        ).toBeNull();
    });

    it('accepts a manifest with no source field and defaults to original_image_url (Req 14.4)', () => {
        const parsed = parseManifest({
            format: 'webp',
            variants: [{ width: 800, url: url800, bytes: 24000 }],
        });
        expect(parsed).not.toBeNull();
        expect(parsed!.source).toBe('original_image_url');
    });

    it('rejects a manifest with an unknown source value', () => {
        expect(
            parseManifest({
                format: 'webp',
                source: 'something_else',
                variants: [{ width: 800, url: url800, bytes: 24000 }],
            }),
        ).toBeNull();
    });

    it('parses a valid manifest with studio_edited_image_url source', () => {
        const parsed = parseManifest({
            format: 'webp',
            source: 'studio_edited_image_url',
            variants: [{ width: 800, url: url800, bytes: 24000 }],
        });
        expect(parsed).toEqual({
            format: 'webp',
            source: 'studio_edited_image_url',
            variants: [{ width: 800, url: url800, bytes: 24000 }],
        });
    });

    it('sorts variants ascending by width regardless of input order (Req 3.4)', () => {
        const parsed = parseManifest({
            format: 'webp',
            source: 'original_image_url',
            variants: [
                { width: 1200, url: url1200, bytes: 36000 },
                { width: 400, url: url400, bytes: 12000 },
                { width: 800, url: url800, bytes: 24000 },
            ],
        });
        expect(parsed!.variants.map((v) => v.width)).toEqual([400, 800, 1200]);
    });

    it('accepts an empty variants array but keeps it empty (Req 3.6)', () => {
        const parsed = parseManifest({
            format: 'webp',
            source: 'original_image_url',
            variants: [],
        });
        expect(parsed).not.toBeNull();
        expect(parsed!.variants).toEqual([]);
    });
});

describe('serializeManifest', () => {
    it('returns the canonical object shape', () => {
        const out = serializeManifest(validManifest);
        expect(out).toEqual({
            format: 'webp',
            source: 'studio_edited_image_url',
            variants: [
                { width: 400, url: url400, bytes: 12000 },
                { width: 800, url: url800, bytes: 24000 },
                { width: 1200, url: url1200, bytes: 36000 },
            ],
        });
    });

    it('always sorts variants ascending by width even if input is unsorted (Req 3.4)', () => {
        const unsorted: VariantManifest = {
            format: 'webp',
            source: 'studio_edited_image_url',
            variants: [
                { width: 1200, url: url1200, bytes: 36000 },
                { width: 400, url: url400, bytes: 12000 },
                { width: 800, url: url800, bytes: 24000 },
            ],
        };
        const out = serializeManifest(unsorted);
        expect(out.variants.map((v) => v.width)).toEqual([400, 800, 1200]);
    });

    it('round-trips through parseManifest (Req 11.3)', () => {
        const out = serializeManifest(validManifest);
        const parsed = parseManifest(out);
        expect(parsed).toEqual(validManifest);
    });

    it('does not mutate the input manifest', () => {
        const input: VariantManifest = {
            format: 'webp',
            source: 'studio_edited_image_url',
            variants: [
                { width: 1200, url: url1200, bytes: 36000 },
                { width: 400, url: url400, bytes: 12000 },
            ],
        };
        const beforeOrder = input.variants.map((v) => v.width);
        serializeManifest(input);
        expect(input.variants.map((v) => v.width)).toEqual(beforeOrder);
    });
});

describe('buildSrcSet', () => {
    it('emits widths in strictly ascending order (Req 6.2, 11.4)', () => {
        const srcset = buildSrcSet(validManifest);
        expect(srcset).toBe(`${url400} 400w, ${url800} 800w, ${url1200} 1200w`);
    });

    it('handles unsorted input by sorting first', () => {
        const unsorted: VariantManifest = {
            format: 'webp',
            source: 'original_image_url',
            variants: [
                { width: 1200, url: url1200, bytes: 36000 },
                { width: 400, url: url400, bytes: 12000 },
                { width: 800, url: url800, bytes: 24000 },
            ],
        };
        const srcset = buildSrcSet(unsorted);
        // Widths should appear 400 → 800 → 1200 even though input was reversed.
        const widthMatches = srcset.match(/\s(\d+)w/g);
        expect(widthMatches).toEqual([' 400w', ' 800w', ' 1200w']);
    });

    it('returns an empty string when no variants are present (Req 5.2)', () => {
        const empty: VariantManifest = {
            format: 'webp',
            source: 'original_image_url',
            variants: [],
        };
        expect(buildSrcSet(empty)).toBe('');
    });

    it('handles a single-variant manifest (Req 1.5)', () => {
        const single: VariantManifest = {
            format: 'webp',
            source: 'original_image_url',
            variants: [{ width: 300, url: 'https://x/300.webp', bytes: 5000 }],
        };
        expect(buildSrcSet(single)).toBe('https://x/300.webp 300w');
    });
});

describe('pickFallbackSrc', () => {
    it('returns the largest variant whose width <= maxWidth (Req 6.5)', () => {
        expect(pickFallbackSrc(validManifest, 1200)).toBe(url1200);
        expect(pickFallbackSrc(validManifest, 1000)).toBe(url800);
        expect(pickFallbackSrc(validManifest, 500)).toBe(url400);
    });

    it('falls back to the smallest variant when every variant is larger than maxWidth', () => {
        expect(pickFallbackSrc(validManifest, 100)).toBe(url400);
    });

    it('defaults to maxWidth=1200', () => {
        expect(pickFallbackSrc(validManifest)).toBe(url1200);
    });

    it('returns null when manifest is null or has no variants', () => {
        expect(pickFallbackSrc(null)).toBeNull();
        expect(pickFallbackSrc(undefined)).toBeNull();
        expect(
            pickFallbackSrc({
                format: 'webp',
                source: 'original_image_url',
                variants: [],
            }),
        ).toBeNull();
    });

    it('handles a single-variant manifest correctly', () => {
        const single: VariantManifest = {
            format: 'webp',
            source: 'original_image_url',
            variants: [{ width: 800, url: url800, bytes: 24000 }],
        };
        expect(pickFallbackSrc(single, 1200)).toBe(url800);
        expect(pickFallbackSrc(single, 400)).toBe(url800); // smaller-than-min fallback
    });
});

describe('selectEffectiveSource (Req 14.1)', () => {
    it('prefers studio_edited_image_url when non-empty', () => {
        expect(
            selectEffectiveSource({
                studio_edited_image_url: 'https://studio/x.jpg',
                original_image_url: 'https://orig/y.jpg',
            }),
        ).toEqual({ url: 'https://studio/x.jpg', column: 'studio_edited_image_url' });
    });

    it('falls back to original_image_url when studio is null', () => {
        expect(
            selectEffectiveSource({
                studio_edited_image_url: null,
                original_image_url: 'https://orig/y.jpg',
            }),
        ).toEqual({ url: 'https://orig/y.jpg', column: 'original_image_url' });
    });

    it('falls back to original_image_url when studio is undefined', () => {
        expect(
            selectEffectiveSource({
                studio_edited_image_url: undefined,
                original_image_url: 'https://orig/y.jpg',
            }),
        ).toEqual({ url: 'https://orig/y.jpg', column: 'original_image_url' });
    });

    it('treats whitespace-only studio URL as empty (Req 14.1)', () => {
        expect(
            selectEffectiveSource({
                studio_edited_image_url: '   ',
                original_image_url: 'https://orig/y.jpg',
            }),
        ).toEqual({ url: 'https://orig/y.jpg', column: 'original_image_url' });
    });

    it('treats empty-string studio URL as empty', () => {
        expect(
            selectEffectiveSource({
                studio_edited_image_url: '',
                original_image_url: 'https://orig/y.jpg',
            }),
        ).toEqual({ url: 'https://orig/y.jpg', column: 'original_image_url' });
    });

    it('returns null when both are null (Req 5.4)', () => {
        expect(
            selectEffectiveSource({
                studio_edited_image_url: null,
                original_image_url: null,
            }),
        ).toBeNull();
    });

    it('returns null when both are whitespace-only', () => {
        expect(
            selectEffectiveSource({
                studio_edited_image_url: '  ',
                original_image_url: '\t\n',
            }),
        ).toBeNull();
    });

    it('trims surrounding whitespace from the chosen URL', () => {
        expect(
            selectEffectiveSource({
                studio_edited_image_url: '  https://studio/x.jpg  ',
                original_image_url: null,
            }),
        ).toEqual({ url: 'https://studio/x.jpg', column: 'studio_edited_image_url' });
    });

    it('returns the trimmed original when studio is whitespace-only and original has surrounding spaces', () => {
        expect(
            selectEffectiveSource({
                studio_edited_image_url: '   ',
                original_image_url: ' https://orig/y.jpg\n',
            }),
        ).toEqual({ url: 'https://orig/y.jpg', column: 'original_image_url' });
    });
});
