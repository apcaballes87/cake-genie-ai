# Chrome Extension: "Get Price" Button for Pinterest & Google Images

## Goal
Build a Chrome extension that injects a "Get Price" button on cake images when users browse Pinterest or Google Images. Clicking the button forwards the image to `genie.ph/customizing` for AI cake analysis and instant pricing.

## How the existing flow works (genie.ph)

The customizing page (`/customizing`) already supports receiving an image URL via query params for external sources. Here's the existing Shopify CSE handoff pattern:

### Server-side (`src/app/customizing/page.tsx`, lines 45-90):
```typescript
const imageUrl = typeof searchParams.image_url === 'string' ? searchParams.image_url : null;
const source = typeof searchParams.source === 'string' ? searchParams.source : null;
const isShopifyCse = source === 'shopify_cse' && imageUrl;
const proxyImageUrl = isShopifyCse ? `/api/proxy-image?url=${encodeURIComponent(imageUrl)}` : null;
```

### Image proxy (`/api/proxy-image`):
- Proxies external images to bypass CORS
- Accepts `?url=<encoded_image_url>` query param

### Client-side (`src/app/customizing/CustomizingClient.tsx`):
- When `preloadImageUrl` is provided (from server), shows the image immediately in the hero panel
- Then the `ImageContext.handleImageUpload` function runs the analysis pipeline:
  1. Compresses image + generates perceptual hash (pHash)
  2. Validates it's a cake image (rejects non-cakes, cupcakes-only, wedding cakes, etc.)
  3. Checks pHash cache for previously analyzed identical designs
  4. If no cache: Phase 1 = fast AI feature extraction (instant), Phase 2 = Roboflow coordinate enrichment (background)
  5. Results populate the customization UI (toppers, icing, size, pricing)

### The existing "Get Price" button on CSE results (`src/hooks/useSearchEngine.ts`, lines 600-610):
```typescript
const button = document.createElement('button');
button.innerHTML = `${sparkleIconSVG}<span>Get Price</span>`;
button.className = 'absolute bottom-2 right-2 flex items-center bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all opacity-0 z-50';
```
The button uses a pink-to-purple gradient, rounded-full pill shape, with a sparkle SVG icon.

### URL pattern to forward to:
```
https://genie.ph/customizing?image_url={ENCODED_IMAGE_URL}&source=chrome_extension
```

The `source=chrome_extension` param will need to be handled in the Next.js app similar to `shopify_cse` — this is a small addition we'll make on the Next.js side too.

---

## Chrome Extension Requirements

### 1. Manifest (Manifest V3)
- Name: "Genie Cake Pricer" (or similar)
- Permissions: `activeTab`, `scripting`
- Content scripts injected on:
  - `*.pinterest.com/*`
  - `www.google.com/search*` (image search: `tbm=isch`)
  - `www.google.com/imghp*`
  - `images.google.com/*`
- Icon: Genie.ph brand icon (pink/purple gradient sparkle)

### 2. Content Script Behavior

**On Pinterest:**
- Pinterest uses a masonry grid of pins. Each pin has an image.
- On hover over a pin/image, show a floating "Get Price" button (bottom-right of the image).
- Pinterest is a SPA — use MutationObserver to detect new pins loaded via infinite scroll.
- Extract the highest resolution image URL available. Pinterest images follow patterns like:
  - `i.pinimg.com/originals/...` (full res)
  - `i.pinimg.com/736x/...` (medium)
  - `i.pinimg.com/564x/...` (small)
  - Try to upgrade to `/originals/` version when possible.

**On Google Images:**
- Google Images shows a grid of thumbnails. Clicking one opens a side panel with a larger image.
- Show "Get Price" button on hover over thumbnails in the grid.
- Also show "Get Price" button in the expanded side panel view.
- Google Images loads dynamically — use MutationObserver for new results.
- Extract the full-resolution image URL (the `data-src` or the actual `src` from the expanded view, not the base64 thumbnail).

### 3. Button Design
- Match the existing genie.ph "Get Price" button style:
  - Pink-to-purple gradient background (`from-pink-500 to-purple-600`)
  - White text, bold, small font
  - Rounded-full (pill shape)
  - Sparkle icon (use inline SVG)
  - Shadow, scale-up on hover
  - Fade in on image hover, fade out on mouse leave
- Position: absolute bottom-right of the image container
- z-index high enough to appear above Pinterest/Google overlays

### 4. Click Handler
When "Get Price" is clicked:
1. Extract the highest resolution image URL from the element
2. Open a new tab to: `https://genie.ph/customizing?image_url=${encodeURIComponent(imageUrl)}&source=chrome_extension`
3. Optionally: show a brief toast/notification "Opening Genie.ph..." before navigating

### 5. Popup (optional, nice-to-have)
- Simple popup when clicking the extension icon
- Shows: "Browse Pinterest or Google Images and click 'Get Price' on any cake image to get instant AI pricing from Genie.ph"
- Link to genie.ph

---

## Next.js Changes Needed (genie.ph side)

### 1. Update `src/app/customizing/page.tsx`
Extend the existing Shopify CSE handoff to also support `source=chrome_extension`:

```typescript
// Change from:
const isShopifyCse = source === 'shopify_cse' && imageUrl;
// To:
const isExternalSource = (source === 'shopify_cse' || source === 'chrome_extension') && imageUrl;
```

Use `isExternalSource` everywhere `isShopifyCse` was used.

### 2. Update `src/app/customizing/CustomizingClient.tsx`
When the page loads with `source=chrome_extension` and an `image_url`:
- Show the preloaded image immediately in the hero panel (already works via `preloadImageUrl`)
- Auto-trigger the image analysis pipeline (fetch the proxied image → run `handleImageUpload`)
- This should mostly work already if we follow the same pattern as Shopify CSE

### 3. Ensure `/api/proxy-image` handles Pinterest and Google image domains
- Pinterest: `i.pinimg.com`
- Google: `encrypted-tbn0.gstatic.com`, various CDN domains
- May need to add these to an allowlist if the proxy has domain restrictions

---

## File Structure for the Chrome Extension

```
genie-chrome-extension/
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── content/
│   ├── pinterest.js      # Content script for Pinterest
│   ├── google-images.js  # Content script for Google Images
│   ├── shared.js         # Shared utilities (button creation, URL handling)
│   └── styles.css        # Button styles
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── background.js          # Service worker (if needed)
```

---

## Testing Checklist
- [ ] Pinterest: hover over pins shows "Get Price" button
- [ ] Pinterest: infinite scroll loads new pins with buttons
- [ ] Pinterest: clicking "Get Price" opens genie.ph/customizing with the image
- [ ] Google Images: hover over thumbnails shows button
- [ ] Google Images: button also works in expanded side panel
- [ ] Google Images: scroll/load more results maintains buttons
- [ ] genie.ph receives the image URL and starts analysis automatically
- [ ] Image proxy successfully fetches Pinterest and Google image URLs
- [ ] Extension popup shows instructions
- [ ] No console errors on either platform
- [ ] Button doesn't interfere with normal Pinterest/Google interactions (clicking the image itself still works)
