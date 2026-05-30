// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recolorWithMask, PREVIEW_MAX_DIMENSION } from './icingMaskComposite';

/**
 * Unit tests for the client-side icing compositor (`recolorWithMask`).
 *
 * `recolorWithMask` is canvas/DOM code: it uses `document.createElement('canvas')`,
 * `getContext('2d')`, `drawImage`, `getImageData`, `putImageData`, and `toDataURL`.
 * jsdom does not implement a real 2D canvas, so we stub the canvas surface:
 *   - `HTMLCanvasElement.prototype.getContext` returns a fake 2D context that
 *     records `drawImage` / `getImageData` / `putImageData`.
 *   - `HTMLCanvasElement.prototype.toDataURL` returns a fixed fake data URL.
 *   - `document.createElement` is spied so we can capture each canvas and read
 *     the `width` / `height` set on it during the call (the working dimensions).
 *
 * Validates: Requirements 8.1, 8.2, 9.1.
 */

const FAKE_DATA_URL = 'data:image/webp;base64,FAKE';

// jsdom may not expose ImageData; recolorWithMask constructs `new ImageData(...)`
// internally, so provide a minimal polyfill when it is missing.
if (typeof (globalThis as Record<string, unknown>).ImageData === 'undefined') {
  class ImageDataPolyfill {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    readonly colorSpace = 'srgb' as const;

    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight: number,
      maybeHeight?: number
    ) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = maybeHeight ?? dataOrWidth.length / 4 / widthOrHeight;
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
      }
    }
  }

  (globalThis as Record<string, unknown>).ImageData =
    ImageDataPolyfill as unknown as typeof ImageData;
}

function makeImageData(width: number, height: number): ImageData {
  return new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
}

function makeBaseImage(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  return { naturalWidth, naturalHeight } as unknown as HTMLImageElement;
}

type FakeContext = {
  drawImage: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
};

let fakeContext: FakeContext;
let createdCanvases: HTMLCanvasElement[];

beforeEach(() => {
  createdCanvases = [];

  fakeContext = {
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) =>
      makeImageData(w, h)
    ),
    putImageData: vi.fn(),
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    fakeContext as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(FAKE_DATA_URL);

  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
    const element = realCreateElement(tagName, options);
    if (tagName === 'canvas') {
      createdCanvases.push(element as HTMLCanvasElement);
    }
    return element;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recolorWithMask', () => {
  it('rescales the mask when stored mask dimensions differ from the working dimensions (Req 8.2)', () => {
    const baseImage = makeBaseImage(40, 30); // under PREVIEW_MAX_DIMENSION -> working dims 40x30
    const maskImageData = makeImageData(20, 15); // mask stored at half size -> mismatch

    const result = recolorWithMask({
      baseImage,
      maskImageData,
      maskWidth: 20,
      maskHeight: 15,
      targetHex: '#FFC0CB',
    });

    // Canvas creation order: workCanvas, (rescale) sourceCanvas, scaledCanvas, layerCanvas.
    expect(createdCanvases).toHaveLength(4);

    const [workCanvas, sourceCanvas, scaledCanvas] = createdCanvases;

    // Source canvas holds the mask at its native dimensions.
    expect(sourceCanvas.width).toBe(20);
    expect(sourceCanvas.height).toBe(15);
    // Scaled canvas brings the mask up to the working dimensions.
    expect(scaledCanvas.width).toBe(40);
    expect(scaledCanvas.height).toBe(30);

    // The mask is painted, scaled, then read back at the working dimensions.
    expect(fakeContext.putImageData).toHaveBeenCalledWith(maskImageData, 0, 0);
    expect(fakeContext.drawImage).toHaveBeenCalledWith(sourceCanvas, 0, 0, 40, 30);
    expect(fakeContext.getImageData).toHaveBeenCalledWith(0, 0, 40, 30);

    // Working canvas (and therefore the output) stays at the working dimensions.
    expect(workCanvas.width).toBe(40);
    expect(workCanvas.height).toBe(30);
    expect(result).toBe(FAKE_DATA_URL);
  });

  it('does not rescale the mask when its dimensions already match the working dimensions', () => {
    const baseImage = makeBaseImage(40, 30);
    const maskImageData = makeImageData(40, 30);

    recolorWithMask({
      baseImage,
      maskImageData,
      maskWidth: 40,
      maskHeight: 30,
      targetHex: '#90EE90',
    });

    // No rescale -> only workCanvas and layerCanvas are created.
    expect(createdCanvases).toHaveLength(2);
    // The mask is used as-is; no read-back from a scaling canvas.
    expect(fakeContext.getImageData).not.toHaveBeenCalled();
  });

  it('outputs an image at the constrained working dimensions (Req 8.1, 8.3)', () => {
    // 2400x1200 is larger than PREVIEW_MAX_DIMENSION on its longest side, so it
    // is constrained to 1200x600 (scale 0.5) while preserving aspect ratio.
    const baseImage = makeBaseImage(2400, 1200);
    const workingWidth = 1200;
    const workingHeight = 600;
    const maskImageData = makeImageData(workingWidth, workingHeight);

    const result = recolorWithMask({
      baseImage,
      maskImageData,
      maskWidth: workingWidth,
      maskHeight: workingHeight,
      targetHex: '#FF0000',
    });

    expect(PREVIEW_MAX_DIMENSION).toBe(1200);

    const workCanvas = createdCanvases[0];
    expect(workCanvas.width).toBe(workingWidth);
    expect(workCanvas.height).toBe(workingHeight);

    // The base image is drawn at the constrained working dimensions.
    expect(fakeContext.drawImage).toHaveBeenCalledWith(baseImage, 0, 0, workingWidth, workingHeight);
    expect(result).toBe(FAKE_DATA_URL);
  });

  it('throws and produces no output when the base image has a non-positive dimension (Req 9.1 / 8.4)', () => {
    const baseImage = makeBaseImage(0, 1200); // non-positive width
    const maskImageData = makeImageData(10, 10);

    expect(() =>
      recolorWithMask({
        baseImage,
        maskImageData,
        maskWidth: 10,
        maskHeight: 10,
        targetHex: '#FFC0CB',
      })
    ).toThrow('Image dimensions must be positive');

    // It fails before touching any canvas, so the preview is left unchanged
    // (no canvas created, no data URL produced).
    expect(createdCanvases).toHaveLength(0);
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled();
  });
});
