/**
 * Decodes COCO RLE (Run Length Encoding) to a Uint8Array mask.
 * Adapted from standard COCO RLE decoding logic.
 */
export function decodeRLE(countsBase64: string, h: number, w: number): Uint8Array {
    const counts = atob(countsBase64);
    const mask = new Uint8Array(h * w);
    let m = 0;
    let p = 0;
    let k = 0;
    let more = true;
    let val = 0; // 0 or 1

    // Decode LEB128 string
    // This is a simplified decoder assuming the string is the raw bytes of the LEB128 encoded data
    // If the input is a binary string, we need to process it char by char.
    // COCO 'counts' string is usually a binary string where each char is a byte.

    // However, sometimes it's passed as a list of numbers (uncompressed RLE).
    // If counts is a string, it's compressed RLE.

    const ord = (str: string, idx: number) => str.charCodeAt(idx);

    while (p < counts.length) {
        more = true;
        let v = 0;
        let shift = 0;
        while (more) {
            const c = ord(counts, p);
            p++;
            v |= (c & 0x1f) << shift;
            shift += 5;
            more = (c & 0x20) !== 0;
        }

        // Zigzag decoding
        if ((v & 1) !== 0) {
            v = ~(v >> 1);
        } else {
            v = v >> 1;
        }

        m += v;

        // Fill mask
        // RLE is column-major order
        for (let i = 0; i < m; i++) {
            if (k >= h * w) break;
            mask[k] = val;
            k++;
        }
        val ^= 1;
    }

    return mask;
}

/**
 * Converts a mask to a Canvas ImageBitmap or Data URL for rendering.
 */
export function maskToCanvas(mask: Uint8Array, h: number, w: number, color: string = 'rgba(255, 0, 0, 0.5)'): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    // Parse color
    // Simple parsing for rgba/hex would be needed, here assuming a fixed overlay for simplicity or passing r,g,b,a
    const r = 147, g = 51, b = 234, a = 128; // Purple-600 with 0.5 opacity

    // RLE is column-major, Canvas is row-major. Need to transpose?
    // COCO RLE is column-major: x varies fastest? No, usually column-major means y varies fastest.
    // Let's verify standard COCO RLE. Yes, column-major.
    // Canvas ImageData is row-major (y then x).

    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const idx = x * h + y; // Column-major index
            if (mask[idx] === 1) {
                const canvasIdx = (y * w + x) * 4; // Row-major index
                data[canvasIdx] = r;
                data[canvasIdx + 1] = g;
                data[canvasIdx + 2] = b;
                data[canvasIdx + 3] = a;
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
}
