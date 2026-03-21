# Mobile Canvas Rendering Fix - Large Image Processing

## Problem Summary

When customers upload cake images from mobile phones, the canvas fails to render the image, resulting in:

- Hash = `0000000000000000` (blank canvas)
- Cache lookup fails
- Image processing continues but without cache optimization

### Root Causes

1. **Image not fully decoded before `drawImage` is called**
   - On mobile browsers, `img.onload` can fire before the image is fully decoded
   - Especially problematic with large images (high-resolution phone cameras)

2. **Mobile browser memory limits**
   - Mobile browsers have stricter memory limits for canvas operations
   - Large images can exceed available memory for offscreen canvas
   - iOS Safari and Chrome Mobile have particularly strict limits

3. **Current code flow**

   ```typescript
   // In generatePerceptualHash (src/contexts/ImageContext.tsx:34-125)
   const img = new Image();
   img.onload = () => {
       const canvas = document.createElement('canvas');
       canvas.width = 8;
       canvas.height = 8;
       const ctx = canvas.getContext('2d');
       ctx.drawImage(img, 0, 0, size, size); // ❌ Image may not be decoded yet
       const imageData = ctx.getImageData(0, 0, size, size);
       // ... hash computation
   };
   img.src = imageSrc;
   ```

---

## Solution Strategy

### Phase 1: Client-Side Fixes (Primary)

- Use `img.decode()` to wait for full decode
- Resize to 1024px max before processing
- Use `createImageBitmap` for efficient memory handling

### Phase 2: Client-Side Progressive Retry (Fallback)

- If Phase 1 fails, retry with half resolution
- Continue halving until success or minimum size reached
- No server cost, no external dependencies

---

## Common Solutions (Industry Best Practices)

### 1. **Use `img.decode()` Method** ✅ RECOMMENDED

The `HTMLImageElement.decode()` method returns a promise that resolves when the image is fully decoded.

```typescript
const img = new Image();
img.src = imageSrc;
await img.decode(); // ✅ Wait for full decode
ctx.drawImage(img, 0, 0, size, size);
```

**Pros:**

- Native browser API, no dependencies
- Explicitly waits for decode completion
- Supported in all modern browsers (Chrome 63+, Safari 12+, Firefox 68+)

**Cons:**

- Not supported in very old browsers (IE11)
- Can still fail on extremely large images due to memory limits

---

### 2. **Resize Before Processing** ✅ RECOMMENDED

Resize the image to a smaller dimension before drawing to canvas to reduce memory usage.

```typescript
const MAX_DIMENSION = 1024; // Limit max dimension
let width = img.naturalWidth;
let height = img.naturalHeight;

if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
        height = (height / width) * MAX_DIMENSION;
        width = MAX_DIMENSION;
    } else {
        width = (width / height) * MAX_DIMENSION;
        height = MAX_DIMENSION;
    }
}

canvas.width = width;
canvas.height = height;
ctx.drawImage(img, 0, 0, width, height);
```

**Pros:**

- Reduces memory usage significantly
- Faster processing
- Works on all browsers

**Cons:**

- Slightly reduces hash accuracy (but 8x8 is already very small)

---

### 3. **Use `createImageBitmap` API** ✅ RECOMMENDED

The `createImageBitmap` API is more efficient for handling large images and has better memory management.

```typescript
const bitmap = await createImageBitmap(img);
ctx.drawImage(bitmap, 0, 0, size, size);
bitmap.close(); // Release memory
```

**Pros:**

- More efficient memory usage
- Better performance on large images
- Supported in all modern browsers

**Cons:**

- Not supported in IE11
- Slightly more complex API

---

### 4. **Progressive Retry with Halving Resolution** ✅ FALLBACK

If the first attempt fails, retry with progressively smaller resolutions until success.

```typescript
async function generatePerceptualHashWithRetry(imageSrc: string): Promise<string | null> {
    // Try with original resolution first
    let hash = await generatePerceptualHash(imageSrc);
    if (hash !== null) return hash;

    // If failed, try with half resolution
    console.log('🔄 pHash: First attempt failed, retrying with half resolution...');
    hash = await generatePerceptualHashWithScale(imageSrc, 0.5);
    if (hash !== null) return hash;

    // If still failed, try with quarter resolution
    console.log('🔄 pHash: Second attempt failed, retrying with quarter resolution...');
    hash = await generatePerceptualHashWithScale(imageSrc, 0.25);
    if (hash !== null) return hash;

    // All attempts failed
    console.warn('⚠️ pHash: All retry attempts failed');
    return null;
}
```

**Pros:**

- Pure client-side solution
- No server cost
- No external dependencies
- Works on all browsers

**Cons:**

- Multiple attempts add latency
- Lower resolution reduces hash accuracy

---

## Recommended Implementation Strategy

### Primary Solution: `img.decode()` + Resize + `createImageBitmap`

Combine multiple strategies for maximum reliability:

```typescript
async function generatePerceptualHash(imageSrc: string): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = async () => {
            try {
                // Strategy 1: Wait for decode
                if (img.decode) {
                    try {
                        await img.decode();
                    } catch (decodeErr) {
                        console.warn('⚠️ pHash: decode() failed, proceeding anyway:', decodeErr);
                    }
                }

                // Strategy 2: Resize before processing
                const MAX_DIMENSION = 1024;
                let width = img.naturalWidth;
                let height = img.naturalHeight;
                
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    if (width > height) {
                        height = (height / width) * MAX_DIMENSION;
                        width = MAX_DIMENSION;
                    } else {
                        width = (width / height) * MAX_DIMENSION;
                        height = MAX_DIMENSION;
                    }
                }

                // Strategy 3: Use createImageBitmap if available
                let source: HTMLImageElement | ImageBitmap = img;
                if (typeof createImageBitmap !== 'undefined') {
                    try {
                        source = await createImageBitmap(img, {
                            resizeWidth: 8,
                            resizeHeight: 8,
                            resizeQuality: 'low'
                        });
                    } catch (bitmapErr) {
                        console.warn('⚠️ pHash: createImageBitmap failed, using img:', bitmapErr);
                    }
                }

                const canvas = document.createElement('canvas');
                const size = 8;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.warn('⚠️ pHash: Could not get canvas context');
                    return resolve(PHASH_FAILED);
                }

                ctx.drawImage(source, 0, 0, size, size);
                
                // Clean up bitmap if used
                if (source instanceof ImageBitmap) {
                    source.close();
                }

                const imageData = ctx.getImageData(0, 0, size, size);
                const pixels = imageData.data;
                const numPixels = size * size;
                const grayscale = new Array(numPixels);
                let totalLuminance = 0;
                let allZero = true;

                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];
                    const a = pixels[i + 3];

                    if (r !== 0 || g !== 0 || b !== 0 || a !== 0) {
                        allZero = false;
                    }

                    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                    grayscale[i / 4] = luminance;
                    totalLuminance += luminance;
                }

                // GUARD: Blank canvas — image failed to render
                if (allZero) {
                    console.warn('⚠️ pHash: Canvas rendered blank — image likely failed to decode. Skipping cache.');
                    return resolve(PHASH_FAILED);
                }

                const avgLuminance = totalLuminance / numPixels;

                // GUARD: All pixels identical luminance — solid color
                let minLum = Infinity;
                let maxLum = -Infinity;
                for (let i = 0; i < numPixels; i++) {
                    if (grayscale[i] < minLum) minLum = grayscale[i];
                    if (grayscale[i] > maxLum) maxLum = grayscale[i];
                }
                if (maxLum - minLum < 1) {
                    console.warn('⚠️ pHash: All pixels same luminance (solid color). Skipping cache.');
                    return resolve(PHASH_FAILED);
                }

                let hash = 0n;
                for (let i = 0; i < grayscale.length; i++) {
                    if (grayscale[i] > avgLuminance) {
                        hash |= 1n << BigInt(i);
                    }
                }

                const hashStr = hash.toString(16).padStart(16, '0');

                // GUARD: Final sanity check — reject all-zero hash
                if (hashStr === '0000000000000000') {
                    console.warn('⚠️ pHash: Computed all-zero hash. Skipping cache.');
                    return resolve(PHASH_FAILED);
                }

                resolve(hashStr);
            } catch (err) {
                console.warn('⚠️ pHash: Canvas operation failed:', err);
                resolve(PHASH_FAILED);
            }
        };

        img.onerror = () => {
            console.warn('⚠️ pHash: Image failed to load');
            resolve(PHASH_FAILED);
        };

        img.src = imageSrc;
    });
}
```

---

## Fallback Strategy: Progressive Retry with Halving Resolution

When the primary solution fails, retry with progressively smaller resolutions:

```typescript
/**
 * Generate perceptual hash with progressive retry.
 * If first attempt fails, retry with half resolution, then quarter resolution.
 */
async function generatePerceptualHashWithRetry(imageSrc: string): Promise<string | null> {
    // Attempt 1: Full resolution (with decode + resize + createImageBitmap)
    let hash = await generatePerceptualHash(imageSrc);
    if (hash !== null) {
        console.log('✅ pHash: Success on first attempt');
        return hash;
    }

    // Attempt 2: Half resolution
    console.log('🔄 pHash: First attempt failed, retrying with half resolution...');
    hash = await generatePerceptualHashWithScale(imageSrc, 0.5);
    if (hash !== null) {
        console.log('✅ pHash: Success on second attempt (half resolution)');
        return hash;
    }

    // Attempt 3: Quarter resolution
    console.log('🔄 pHash: Second attempt failed, retrying with quarter resolution...');
    hash = await generatePerceptualHashWithScale(imageSrc, 0.25);
    if (hash !== null) {
        console.log('✅ pHash: Success on third attempt (quarter resolution)');
        return hash;
    }

    // All attempts failed
    console.warn('⚠️ pHash: All retry attempts failed, skipping cache');
    return null;
}

/**
 * Generate perceptual hash with a specific scale factor.
 * Creates a scaled-down version of the image before processing.
 */
async function generatePerceptualHashWithScale(imageSrc: string, scale: number): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = async () => {
            try {
                // Wait for decode
                if (img.decode) {
                    try {
                        await img.decode();
                    } catch (decodeErr) {
                        console.warn('⚠️ pHash: decode() failed, proceeding anyway:', decodeErr);
                    }
                }

                // Calculate scaled dimensions
                const scaledWidth = Math.floor(img.naturalWidth * scale);
                const scaledHeight = Math.floor(img.naturalHeight * scale);

                // Create temporary canvas for scaling
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = scaledWidth;
                tempCanvas.height = scaledHeight;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) {
                    console.warn('⚠️ pHash: Could not get temp canvas context');
                    return resolve(PHASH_FAILED);
                }

                // Draw scaled image
                tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

                // Now create the 8x8 hash canvas from the scaled image
                const canvas = document.createElement('canvas');
                const size = 8;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.warn('⚠️ pHash: Could not get canvas context');
                    return resolve(PHASH_FAILED);
                }

                ctx.drawImage(tempCanvas, 0, 0, size, size);

                const imageData = ctx.getImageData(0, 0, size, size);
                const pixels = imageData.data;
                const numPixels = size * size;
                const grayscale = new Array(numPixels);
                let totalLuminance = 0;
                let allZero = true;

                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];
                    const a = pixels[i + 3];

                    if (r !== 0 || g !== 0 || b !== 0 || a !== 0) {
                        allZero = false;
                    }

                    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                    grayscale[i / 4] = luminance;
                    totalLuminance += luminance;
                }

                // GUARD: Blank canvas
                if (allZero) {
                    console.warn('⚠️ pHash: Canvas rendered blank at scale', scale);
                    return resolve(PHASH_FAILED);
                }

                const avgLuminance = totalLuminance / numPixels;

                // GUARD: All pixels identical luminance
                let minLum = Infinity;
                let maxLum = -Infinity;
                for (let i = 0; i < numPixels; i++) {
                    if (grayscale[i] < minLum) minLum = grayscale[i];
                    if (grayscale[i] > maxLum) maxLum = grayscale[i];
                }
                if (maxLum - minLum < 1) {
                    console.warn('⚠️ pHash: All pixels same luminance at scale', scale);
                    return resolve(PHASH_FAILED);
                }

                let hash = 0n;
                for (let i = 0; i < grayscale.length; i++) {
                    if (grayscale[i] > avgLuminance) {
                        hash |= 1n << BigInt(i);
                    }
                }

                const hashStr = hash.toString(16).padStart(16, '0');

                // GUARD: Final sanity check
                if (hashStr === '0000000000000000') {
                    console.warn('⚠️ pHash: Computed all-zero hash at scale', scale);
                    return resolve(PHASH_FAILED);
                }

                resolve(hashStr);
            } catch (err) {
                console.warn('⚠️ pHash: Canvas operation failed at scale', scale, err);
                resolve(PHASH_FAILED);
            }
        };

        img.onerror = () => {
            console.warn('⚠️ pHash: Image failed to load at scale', scale);
            resolve(PHASH_FAILED);
        };

        img.src = imageSrc;
    });
}
```

---

## Implementation Checklist

### Phase 1: Client-Side Fixes (Immediate)

- [ ] Update `generatePerceptualHash` in `src/contexts/ImageContext.tsx`
  - [ ] Add `img.decode()` call before `drawImage`
  - [ ] Add resize logic to limit max dimension to 1024px
  - [ ] Add `createImageBitmap` support with fallback
  - [ ] Add better error logging

- [ ] Update `generatePerceptualHash` in `src/hooks/useImageManagement.ts`
  - [ ] Apply same fixes as above

- [ ] Test on mobile devices (iOS Safari, Chrome Mobile)

### Phase 2: Client-Side Progressive Retry (Fallback)

- [ ] Create `generatePerceptualHashWithScale` helper function
  - [ ] Accept scale parameter (0.5, 0.25, etc.)
  - [ ] Create temporary canvas for scaling
  - [ ] Generate hash from scaled image

- [ ] Create `generatePerceptualHashWithRetry` wrapper function
  - [ ] Attempt 1: Full resolution
  - [ ] Attempt 2: Half resolution (0.5)
  - [ ] Attempt 3: Quarter resolution (0.25)
  - [ ] Return null if all attempts fail

- [ ] Update callers to use `generatePerceptualHashWithRetry`
  - [ ] Update `src/contexts/ImageContext.tsx`
  - [ ] Update `src/hooks/useImageManagement.ts`

- [ ] Test progressive retry on mobile devices

### Phase 3: Monitoring & Optimization

- [ ] Add analytics to track hash generation failures
- [ ] Monitor retry success rates
- [ ] Optimize based on real-world data

---

## Testing Strategy

### Manual Testing

1. **Test on mobile devices:**
   - iOS Safari (iPhone 12+)
   - Chrome Mobile (Android)
   - Samsung Internet

2. **Test with large images:**
   - 4K images (3840x2160)
   - 8K images (7680x4320)
   - Images > 10MB

3. **Test edge cases:**
   - Very small images (< 100x100)
   - Solid color images
   - Transparent images
   - Corrupted images

### Automated Testing

```typescript
describe('generatePerceptualHash', () => {
    it('should handle large images on mobile', async () => {
        // Test with 4K image
        const largeImage = await generateLargeTestImage(3840, 2160);
        const hash = await generatePerceptualHash(largeImage);
        expect(hash).not.toBe('0000000000000000');
        expect(hash).not.toBeNull();
    });

    it('should retry with half resolution on failure', async () => {
        // Mock first attempt failure
        const hash = await generatePerceptualHashWithRetry(corruptedImage);
        // Should succeed on retry with smaller resolution
        expect(hash).not.toBeNull();
    });
});
```

---

## Expected Outcomes

### Before Fix

- ❌ Mobile uploads fail with hash = `0000000000000000`
- ❌ Cache lookup fails
- ❌ No fallback mechanism
- ❌ Poor user experience on mobile

### After Fix

- ✅ Mobile uploads succeed with valid hash
- ✅ Cache lookup works
- ✅ Progressive retry provides fallback
- ✅ Better user experience on mobile
- ✅ Reduced server load (more cache hits)
- ✅ Zero additional cost (pure client-side solution)

---

## References

- [MDN: HTMLImageElement.decode()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode)
- [MDN: createImageBitmap()](https://developer.mozilla.org/en-US/docs/Web/API/createImageBitmap)
- [Canvas API Memory Limits](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression)
