# INP & CLS Performance Improvement Plan

## Executive Summary

After analyzing the landing page ([`LandingClient.tsx`](src/app/LandingClient.tsx)) and customizing page ([`CustomizingClient.tsx`](src/app/customizing/CustomizingClient.tsx)), I've identified key issues affecting **INP (Interaction to Next Paint)** and **CLS (Cumulative Layout Shift)** scores.

---

## INP (Interaction to Next Paint) Issues

### Identified Problems

| # | Issue | Location | Impact |
| --- | ------- | ---------- | -------- |
| 1 | **Heavy client-side context initialization** | [`LandingClient.tsx:81`](src/app/LandingClient.tsx:81), [`CustomizingClient.tsx:272`](src/app/customizing/CustomizingClient.tsx:272) | Multiple contexts (Auth, Cart, SavedItems, Customization, Image) load simultaneously |
| 2 | **Synchronous data fetching on user focus** | [`SearchAutocomplete.tsx:194-216`](src/components/SearchAutocomplete.tsx:194) | Fetches keywords when search input is focused |
| 3 | **Multiple setInterval animations** | [`LandingClient.tsx:105-125`](src/app/LandingClient.tsx:105) | Hero image rotation + quick links carousel run on main thread |
| 4 | **Interactive ProductCard loads contexts on click** | [`ProductCard.tsx:196-256`](src/components/ProductCard.tsx:196) | Triggers image fetch + context initialization on click |
| 5 | **Image compression in main thread** | [`ImageUploader.tsx:30-37`](src/components/ImageUploader.tsx:30) | Image processing blocks UI |
| 6 | **No explicit event handler optimization** | Multiple components | Missing `passive` listeners, no debouncing on scroll handlers |

### INP Improvement Recommendations

#### 1. Defer Non-Critical Context Initialization

```typescript
// Current: All contexts load immediately
const { user, isAuthenticated } = useAuth();
const { itemCount } = useCart();
const { toggleSaveDesign } = useSavedItemsActions();

// Recommended: Lazy load contexts that aren't needed immediately
// Use React.lazy for context providers or split initialization
```

#### 2. Optimize SearchAutocomplete

- **Move data fetching to idle time** using `requestIdleCallback` or `IntersectionObserver`
- **Preload suggestions on page load** instead of on focus
- **Debounce the focus handler** to prevent rapid-fire requests

#### 3. Use CSS for Animations Instead of JavaScript

```typescript
// Current: JavaScript intervals for hero rotation
const heroInterval = setInterval(() => { ... }, 1000);

// Recommended: Use CSS animations with will-change
// In CSS: animation: hero-fade 1s infinite;
// Add: transform: translateZ(0); will-change: opacity;
```

#### 4. Optimize ProductCard Click Handler

- **Preload image data** when card enters viewport using `IntersectionObserver`
- **Defer context initialization** until actual click with `setTimeout(..., 0)`

#### 5. Move Image Compression to Web Worker

- Use `compressorjs` with `useWebWorker: true` (already enabled, but ensure it's working)
- Show loading state immediately while processing happens in background

---

## CLS (Cumulative Layout Shift) Issues

### CLS Identified Problems

| # | Issue | Location | Impact |
| --- | ------- | ---------- | -------- |
| 1 | **Missing explicit image dimensions** | [`ProductCard.tsx:92-96`](src/components/ProductCard.tsx:92), [`LazyImage.tsx`](src/components/LazyImage.tsx) | Uses fallback `aspect-4/5` even when `image_width`/`image_height` are available |
| 2 | **Masonry layout causes shifts** | [`PopularDesigns.tsx:73-90`](src/components/landing/PopularDesigns.tsx:73) | Grid reflows as images load |
| 3 | **Search dropdown appears dynamically** | [`SearchAutocomplete.tsx:257-425`](src/components/SearchAutocomplete.tsx:257) | Causes content push |
| 4 | **Sticky header transition** | [`LandingClient.tsx:226`](src/app/LandingClient.tsx:226) | Background change can cause visual shift |
| 5 | **Hero image container has no fixed aspect** | [`LandingClient.tsx:398`](src/app/LandingClient.tsx:398) | Uses `aspect-3/2` but images may differ |
| 6 | **Font loading causes FOUT** | [`globals.css`](src/app/globals.css) | No font-display: swap or preloading |

### CLS Improvement Recommendations

#### 1. Use Exact Image Dimensions from Database

```typescript
// Current: Always uses fallback aspect ratio
<div style={image_width && image_height ? { aspectRatio: `${image_width} / ${image_height}` } : undefined}>

// Problem: image_width and image_height are passed but not always used
// Fix: Ensure dimensions are always passed and used
<LazyImage
  src={original_image_url}
  width={image_width || 400}  // Always provide width
  height={image_height || 500} // Always provide height
  fill={false} // Use fixed dimensions instead of fill
/>
```

#### 2. Reserve Space for Search Dropdown

```typescript
// Add min-height to prevent layout shift
<div className="absolute z-50 w-full mt-2 bg-white..." 
     style={{ minHeight: '200px' }}>  // Reserve space
```

#### 3. Add Aspect Ratio Containers for Hero

```typescript
// Use fixed aspect ratio for hero container
<div className="relative w-full rounded-2xl aspect-3/2 bg-white">
  {/* Hero images here */}
</div>
```

#### 4. Preload Fonts

```css
/* In globals.css or layout.tsx */
<link 
  rel="preload" 
  href="/fonts/your-font.woff2" 
  as="font" 
  type="font/woff2" 
  crossOrigin="anonymous"
/>

/* Add to font-family declaration */
font-display: swap; /* or optional: block, fallback, optional */
```

#### 5. Use CSS contain Property for Masonry

```css
/* Reduce layout recalculations */
.masonry-grid {
  contain: layout style;
}
```

---

## Page-Specific Recommendations

### Landing Page ([`LandingClient.tsx`](src/app/LandingClient.tsx))

| Priority | Action | Expected Impact |
| ---------- | -------- | ----------------- |
| High | Add `priority={true}` to first hero image | Improve LCP, reduce CLS |
| High | Preload critical fonts | Reduce FOUT |
| Medium | Convert hero rotation to CSS animations | Reduce JS main thread blocking |
| Medium | Add skeleton loading for PopularDesigns | Prevent content jump |
| Low | Lazy load below-fold sections | Faster initial paint |

### Customizing Page ([`CustomizingClient.tsx`](src/app/customizing/CustomizingClient.tsx))

| Priority | Action | Expected Impact |
| ---------- | -------- | ----------------- |
| High | Defer CustomizationContext initialization | Faster TTI |
| High | Reserve space for sidebar panels | Reduce CLS |
| Medium | Lazy load AI chat panel | Faster initial load |
| Medium | Preload hero image with fetchpriority="high" | Improve LCP |
| Low | Use CSS for panel transitions | Reduce JS overhead |

---

## Implementation Priority Matrix

```text
                    | Low CLS Impact | High CLS Impact |
--------------------|----------------|-----------------|
Low INP Impact      | Nice-to-have   | Medium Priority |
High INP Impact     | Medium Priority| HIGH PRIORITY   |
```

### Top 5 Quick Wins (High INP + High CLS Impact)

1. **Fix image dimension propagation** in ProductCard - Use available `image_width`/`image_height`
2. **Reserve space for search dropdown** - Add min-height
3. **Defer SearchAutocomplete fetch** - Use requestIdleCallback
4. **Add priority to LCP images** - First hero image, first product grid row
5. **Convert JS animations to CSS** - Hero rotation, quick links carousel

---

## Monitoring & Testing

- Use **Chrome DevTools > Performance** tab to record INP/CLS
- Test on **mobile throttling** (Slow 4G) to simulate real user conditions
- Use **web-vitals** library to track Core Web Vitals in production:

```typescript
import { onCLS, onINP, onLCP } from 'web-vitals';
onCLS(console.log);
onINP(console.log);
onLCP(console.log);
```
