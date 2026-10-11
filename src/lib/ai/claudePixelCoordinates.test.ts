import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
    buildPixelCoordinateInstruction,
    convertPixelCoordinatesToNormalized,
    prepareClaudeImage,
} from './claudePixelCoordinates';

const pixelResponse = {
    analysis: {
        main_toppers: [{ group_id: 'paddle', box_2d: [[620, 245, 880, 495]] }],
        support_elements: [{ group_id: 'balls', box_2d: [[770, 130, 880, 235], [775, 510, 880, 612]] }],
        cake_messages: [{ text: 'Happy Birthday', box_2d: [300, 190, 345, 545] }],
    },
    geometry: {
        geometry_version: 'integrated_bbox_v2',
        cake_diameter_line: { start: [530, 140], end: [530, 600] },
        cake_height_line: { start: [600, 370], end: [880, 370] },
    },
};

describe('convertPixelCoordinatesToNormalized', () => {
    it('scales x by width and y by height for a 768x1024 image', () => {
        const { value, converted } = convertPixelCoordinatesToNormalized(pixelResponse, 768, 1024);
        const result = value as typeof pixelResponse;

        expect(converted).toBe(true);
        // x: 245/768 → 319, 495/768 → 645. y: 620/1024 → 605, 880/1024 → 859.
        expect(result.analysis.main_toppers[0].box_2d).toEqual([[605, 319, 859, 645]]);
        expect(result.analysis.support_elements[0].box_2d).toEqual([[752, 169, 859, 306], [757, 664, 859, 797]]);
        expect(result.analysis.cake_messages[0].box_2d).toEqual([293, 247, 337, 710]);
        expect(result.geometry.cake_diameter_line).toEqual({ start: [518, 182], end: [518, 781] });
        expect(result.geometry.cake_height_line).toEqual({ start: [586, 482], end: [859, 482] });
        expect(result.geometry.geometry_version).toBe('integrated_bbox_v2');
    });

    it('does not mutate the input', () => {
        const snapshot = structuredClone(pixelResponse);
        convertPixelCoordinatesToNormalized(pixelResponse, 768, 1024);
        expect(pixelResponse).toEqual(snapshot);
    });

    it('converts bbox-only repair responses', () => {
        const { value } = convertPixelCoordinatesToNormalized(
            { repairs: [{ repair_key: 'row_0', box_2d: [[512, 384, 1024, 768]] }] },
            768,
            1024,
        );
        expect(value).toEqual({ repairs: [{ repair_key: 'row_0', box_2d: [[500, 500, 1000, 1000]] }] });
    });

    it('leaves a response alone when a coordinate exceeds the image, meaning it was already normalized', () => {
        const alreadyNormalized = {
            analysis: { main_toppers: [{ box_2d: [[100, 200, 400, 950]] }] },
            geometry: { cake_diameter_line: { start: [500, 100], end: [500, 900] } },
        };
        const result = convertPixelCoordinatesToNormalized(alreadyNormalized, 768, 1024);

        expect(result.converted).toBe(false);
        expect(result.skippedReason).toMatch(/exceed/);
        expect(result.value).toEqual(alreadyNormalized);
    });

    it('ignores non-numeric and malformed coordinates for the validator to reject', () => {
        const malformed = { analysis: { main_toppers: [{ box_2d: ['a', 1, 2, 3] }] } };
        const result = convertPixelCoordinatesToNormalized(malformed, 768, 1024);

        expect(result.converted).toBe(false);
        expect(result.value).toEqual(malformed);
    });
});

describe('prepareClaudeImage', () => {
    const makeImage = (width: number, height: number, format: 'png' | 'webp' | 'jpeg' = 'png') => sharp({
        create: { width, height, channels: 3, background: '#ff88aa' },
    }).toFormat(format).toBuffer().then((buffer) => buffer.toString('base64'));

    it('passes a small image through unchanged and reports its size', async () => {
        const data = await makeImage(768, 1024, 'webp');
        const prepared = await prepareClaudeImage(data, 'image/webp');

        expect(prepared).toEqual({ data, mimeType: 'image/webp', width: 768, height: 1024 });
    });

    it('downscales oversized images and reports the size Claude will see', async () => {
        const data = await makeImage(3000, 2000);
        const prepared = await prepareClaudeImage(data, 'image/png');

        expect(prepared).not.toBeNull();
        expect(prepared!.data).not.toBe(data);
        expect(prepared!.width * prepared!.height).toBeLessThanOrEqual(1_150_000);
        expect(Math.max(prepared!.width, prepared!.height)).toBeLessThanOrEqual(1568);
        expect(prepared!.width / prepared!.height).toBeCloseTo(1.5, 1);

        const metadata = await sharp(Buffer.from(prepared!.data, 'base64')).metadata();
        expect({ width: metadata.width, height: metadata.height })
            .toEqual({ width: prepared!.width, height: prepared!.height });
    });

    it('returns null when the image cannot be decoded', async () => {
        expect(await prepareClaudeImage(Buffer.from('not an image').toString('base64'), 'image/png')).toBeNull();
    });
});

describe('buildPixelCoordinateInstruction', () => {
    it('states the exact pixel size and overrides normalization', () => {
        const text = buildPixelCoordinateInstruction(768, 1024);
        expect(text).toContain('768 pixels wide and 1024 pixels tall');
        expect(text).toContain('Do not normalize');
    });
});
