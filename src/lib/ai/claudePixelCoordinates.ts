import sharp from 'sharp';

/**
 * Claude reports image positions in raw pixels of the image it sees, while the
 * analysis contract (and the storefront overlay) use a 0–1000 normalized,
 * top-left coordinate space. Asking Claude to normalize is unreliable: on a
 * 768×1024 upload it sometimes returns x in 0–768, which the overlay then
 * squeezes toward the left edge. Instead the app tells Claude the exact pixel
 * size, lets it answer in pixels, and converts here.
 */

// Anthropic downscales anything larger than this before the model sees it, and
// Claude then answers in the downscaled pixel space. Resizing up front keeps
// the dimensions we convert against identical to what Claude actually saw.
const CLAUDE_MAX_LONG_EDGE = 1568;
const CLAUDE_MAX_PIXELS = 1_150_000;
// Tolerance for a box that touches or slightly overshoots the image edge.
const EDGE_OVERSHOOT_RATIO = 1.02;

export type ClaudePreparedImage = {
    data: string;
    mimeType: string;
    width: number;
    height: number;
};

/**
 * Returns the image Claude will receive plus its exact pixel size, or null when
 * the size cannot be determined (callers then keep the legacy behavior).
 */
export async function prepareClaudeImage(
    imageData: string,
    mimeType: string,
): Promise<ClaudePreparedImage | null> {
    try {
        const input = Buffer.from(imageData, 'base64');
        const metadata = await sharp(input).metadata();
        if (!metadata.width || !metadata.height) return null;

        // EXIF orientations 5–8 swap the displayed axes.
        const hasOrientation = (metadata.orientation ?? 1) > 1;
        const swapAxes = (metadata.orientation ?? 1) >= 5;
        const sourceWidth = swapAxes ? metadata.height : metadata.width;
        const sourceHeight = swapAxes ? metadata.width : metadata.height;

        const scale = Math.min(
            1,
            CLAUDE_MAX_LONG_EDGE / Math.max(sourceWidth, sourceHeight),
            Math.sqrt(CLAUDE_MAX_PIXELS / (sourceWidth * sourceHeight)),
        );
        if (scale >= 1 && !hasOrientation) {
            return { data: imageData, mimeType, width: sourceWidth, height: sourceHeight };
        }

        const width = Math.max(1, Math.floor(sourceWidth * scale));
        const height = Math.max(1, Math.floor(sourceHeight * scale));
        let pipeline = sharp(input).rotate().resize(width, height, { fit: 'fill' });
        let outputMimeType = mimeType;
        if (mimeType === 'image/jpeg') pipeline = pipeline.jpeg({ quality: 90 });
        else if (mimeType === 'image/webp') pipeline = pipeline.webp({ quality: 90 });
        else {
            pipeline = pipeline.png();
            outputMimeType = 'image/png';
        }
        const output = await pipeline.toBuffer();
        return { data: output.toString('base64'), mimeType: outputMimeType, width, height };
    } catch (error) {
        console.warn('[Claude] Could not read image dimensions; keeping normalized-coordinate prompt.', error);
        return null;
    }
}

export function buildPixelCoordinateInstruction(width: number, height: number): string {
    return [
        `COORDINATE SYSTEM OVERRIDE (takes precedence over any 0–1000 or "normalized" coordinate instruction above):`,
        `this image is exactly ${width} pixels wide and ${height} pixels tall.`,
        `Report every coordinate (all box_2d values and all geometry line points) in raw pixels of this image,`,
        `keeping the same ordering ([ymin, xmin, ymax, xmax] for boxes, [y, x] for points).`,
        `y runs 0–${height} and x runs 0–${width}. Do not normalize to 0–1000; the application converts pixels itself.`,
    ].join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown, length: number): value is number[] {
    return Array.isArray(value)
        && value.length === length
        && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

const LINE_KEYS = new Set(['cake_diameter_line', 'cake_height_line']);

/**
 * Walks a parsed model response and collects every [ymin, xmin, ymax, xmax]
 * box (`box_2d`, single or collection) and every [y, x] geometry-line point.
 */
function collectCoordinateArrays(node: unknown, boxes: number[][], points: number[][]): void {
    if (Array.isArray(node)) {
        node.forEach((child) => collectCoordinateArrays(child, boxes, points));
        return;
    }
    if (!isRecord(node)) return;

    for (const [key, value] of Object.entries(node)) {
        if (key === 'box_2d') {
            if (isNumberArray(value, 4)) boxes.push(value);
            else if (Array.isArray(value)) value.forEach((unit) => { if (isNumberArray(unit, 4)) boxes.push(unit); });
        } else if (LINE_KEYS.has(key) && isRecord(value)) {
            for (const endpoint of [value.start, value.end]) {
                if (isNumberArray(endpoint, 2)) points.push(endpoint);
            }
        } else {
            collectCoordinateArrays(value, boxes, points);
        }
    }
}

export type PixelConversionResult = {
    value: unknown;
    converted: boolean;
    /** Set when the response was left untouched because it already looks normalized. */
    skippedReason?: string;
};

/**
 * Converts a pixel-space response into the 0–1000 normalized contract. Works on
 * a copy. If any coordinate exceeds the image bounds the model clearly did not
 * answer in pixels (e.g. it normalized anyway), so the response is returned
 * unchanged rather than being shrunk twice.
 */
export function convertPixelCoordinatesToNormalized(
    parsed: unknown,
    width: number,
    height: number,
): PixelConversionResult {
    const value = structuredClone(parsed);
    const boxes: number[][] = [];
    const points: number[][] = [];
    collectCoordinateArrays(value, boxes, points);

    if (boxes.length + points.length === 0) return { value, converted: false };

    const maxX = width * EDGE_OVERSHOOT_RATIO;
    const maxY = height * EDGE_OVERSHOOT_RATIO;
    const outOfBounds = boxes.some(([ymin, xmin, ymax, xmax]) => ymin > maxY || ymax > maxY || xmin > maxX || xmax > maxX)
        || points.some(([y, x]) => y > maxY || x > maxX);
    if (outOfBounds) {
        return { value, converted: false, skippedReason: 'coordinates exceed image pixel bounds' };
    }

    const normalize = (coordinate: number, extent: number) => (
        Math.min(1000, Math.max(0, Math.round((coordinate / extent) * 1000)))
    );
    for (const box of boxes) {
        box[0] = normalize(box[0], height);
        box[1] = normalize(box[1], width);
        box[2] = normalize(box[2], height);
        box[3] = normalize(box[3], width);
    }
    for (const pointValue of points) {
        pointValue[0] = normalize(pointValue[0], height);
        pointValue[1] = normalize(pointValue[1], width);
    }
    return { value, converted: true };
}
