# Shopify ↔ GeniePH Integration Guide

## Overview
This guide explains how to integrate your Shopify cake price calculator page with the GeniePH customization app.

## Integration Architecture

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│ Shopify Page (cakesandmemories.com/pages/cake-price-calculator)│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1. User uploads cake image
                              ↓
                    ┌──────────────────────┐
                    │ Image Optimization   │
                    │ - Compress to 1.2MB  │
                    │ - Downscale to 1800px│
                    └──────────────────────┘
                              │
                              │ 2. Upload to Supabase
                              ↓
                    ┌──────────────────────┐
                    │ Supabase Storage     │
                    │ Bucket: uploadopenai │
                    │ Get public URL       │
                    └──────────────────────┘
                              │
                              │ 3. Redirect with URL param
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ GeniePH App (yourdomain.com/?image={URL}&source=shopify)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 4. Auto-load image from URL
                              ↓
                    ┌──────────────────────┐
                    │ Gemini AI Analysis   │
                    │ - Phase 1: Features  │
                    │ - Phase 2: Coords    │
                    └──────────────────────┘
                              │
                              │ 5. Show customization UI
                              ↓
                    ┌──────────────────────┐
                    │ User Customizes      │
                    │ - Edit toppers       │
                    │ - Change colors      │
                    │ - Add messages       │
                    └──────────────────────┘
                              │
                              │ 6. Add to cart
                              ↓
                    ┌──────────────────────┐
                    │ Checkout & Payment   │
                    │ (Existing flow)      │
                    └──────────────────────┘
```

## Implementation

### Step 1: Modify Shopify Page Upload Handler

**Location:** Shopify page script section (after successful upload)

**Current code:**
```javascript
const { data: urlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(upData.path);
lastPublicUrl = urlData.publicUrl;
status.innerHTML = `✅ Uploaded!<br><img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;" alt="Uploaded cake design" />`;
```

**Updated code:**
```javascript
const { data: urlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(upData.path);
lastPublicUrl = urlData.publicUrl;

// Show upload success with redirect option
status.innerHTML = `
  ✅ Uploaded!<br>
  <img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;" alt="Uploaded cake design" /><br>
  <button id="customize-btn" class="btn" style="margin-top:1rem;">
    🎨 Customize Your Cake Design
  </button>
`;

// Add redirect button handler
document.getElementById('customize-btn').addEventListener('click', () => {
  // Encode the image URL
  const encodedUrl = encodeURIComponent(lastPublicUrl);

  // Redirect to GeniePH app with image parameter
  const geniephUrl = `https://yourdomain.com/?image=${encodedUrl}&source=shopify`;

  // Option 1: Same tab (replace current page)
  window.location.href = geniephUrl;

  // Option 2: New tab (keep Shopify page open)
  // window.open(geniephUrl, '_blank');
});
```

### Step 2: Update GeniePH App to Handle URL Parameters

**File:** `src/hooks/useImageManagement.ts`

**Add URL parameter detection:**

```typescript
// Add this near the top of the useImageManagement hook
useEffect(() => {
  // Check for image URL in query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const imageUrl = urlParams.get('image');
  const source = urlParams.get('source');

  if (imageUrl && source === 'shopify') {
    // Load image from Shopify
    loadImageFromUrl(imageUrl);

    // Clean up URL parameters
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);

async function loadImageFromUrl(imageUrl: string) {
  try {
    setIsProcessing(true);

    // Fetch the image
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    // Convert to File object
    const file = new File([blob], 'shopify-upload.jpg', { type: blob.type });

    // Process through existing image analysis flow
    await handleImageSelected(file);

  } catch (error) {
    console.error('Failed to load image from URL:', error);
    toast.error('Failed to load image. Please try uploading again.');
  } finally {
    setIsProcessing(false);
  }
}
```

### Step 3: Update ImageUploader Component

**File:** `src/components/ImageUploader.tsx`

**Add URL loading support:**

```typescript
// Add this as a prop to ImageUploader
interface ImageUploaderProps {
  onImageSelected?: (file: File | Blob, imageName?: string) => void;
  initialImageUrl?: string; // NEW PROP
  isProcessing?: boolean;
  disabled?: boolean;
}

// In the component, add useEffect to handle initialImageUrl
useEffect(() => {
  if (initialImageUrl && onImageSelected) {
    loadImageFromUrl(initialImageUrl);
  }
}, [initialImageUrl]);

async function loadImageFromUrl(url: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], 'shopify-image.jpg', { type: blob.type });
    onImageSelected?.(file, 'Shopify Upload');
  } catch (error) {
    console.error('Failed to load image:', error);
    toast.error('Failed to load your image. Please upload again.');
  }
}
```

### Step 4: Update App.tsx Landing Page Logic

**File:** `src/App.tsx`

**Add Shopify redirect handling:**

```typescript
// Add this in the App component's useEffect
useEffect(() => {
  // Check for Shopify redirect
  const urlParams = new URLSearchParams(window.location.search);
  const imageUrl = urlParams.get('image');
  const source = urlParams.get('source');

  if (imageUrl && source === 'shopify') {
    // Store image URL for the customization page
    sessionStorage.setItem('shopify_image_url', imageUrl);

    // Auto-navigate to customizing page
    setCurrentPage('customizing');

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);
```

### Step 5: Storage Bucket Considerations

**Option A: Keep Separate Buckets (Recommended)**
- Shopify uses: `uploadopenai` bucket
- GeniePH uses: `cakegenie` bucket
- **Pros:**
  - Clear separation of concerns
  - Easier to track source
  - Different retention policies
- **Cons:**
  - Duplicate storage if image is re-uploaded

**Option B: Unified Bucket**
- Both use: `cakegenie` bucket
- **Pros:**
  - No duplication
  - Single source of truth
- **Cons:**
  - Need to update Shopify page script
  - Migration required

**Recommendation:** Keep separate buckets initially. The image will exist in both:
1. `uploadopenai` - Original Shopify upload (for their pricing system)
2. `cakegenie` - Compressed version for AI analysis (your system)

This is acceptable because:
- Images are compressed differently for each use case
- Storage is cheap
- Keeps systems decoupled

### Step 6: Database Table Strategy

**Option A: Keep Separate Tables (Recommended)**
- Shopify: `uploadpricing2` table
- GeniePH: `cakegenie_analysis_cache` table
- Add a new linking table:

```sql
CREATE TABLE shopify_genieph_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_rowid UUID REFERENCES uploadpricing2(rowid),
  genieph_cache_id UUID REFERENCES cakegenie_analysis_cache(id),
  shopify_image_url TEXT,
  genieph_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

This allows:
- Track which Shopify uploads converted to full customizations
- Analytics on conversion rates
- Link back to original Shopify pricing

### Step 7: Enhanced Shopify Page (Optional Features)

**Feature 1: Direct Deep Link**
Instead of just redirecting, pass more context:

```javascript
const geniephUrl = `https://yourdomain.com/?image=${encodedUrl}&source=shopify&rowid=${currentRowId}&type=${selectedCakeType}&height=${selectedHeight}`;
```

**Feature 2: Pre-populate Customization**
GeniePH can read these params and pre-select options:

```typescript
const urlParams = new URLSearchParams(window.location.search);
const cakeType = urlParams.get('type') as CakeType;
const cakeHeight = urlParams.get('height') as CakeThickness;

// Pre-populate in customization page
if (cakeType) {
  setSelectedCakeType(cakeType);
}
```

### Step 8: Shopify Cart Integration (Advanced)

If you want users to checkout on Shopify instead of GeniePH:

```javascript
// After customization in GeniePH
function addToShopifyCart(customizationData) {
  const shopifyVariantId = VARIANT_MAP[String(totalPrice)];

  // Redirect back to Shopify with cart data
  const cartUrl = `https://www.cakesandmemories.com/cart/add?id=${shopifyVariantId}&quantity=1&properties[Custom Design]=${encodedImageUrl}&properties[Shipping Date]=${shippingDate}`;

  window.location.href = cartUrl;
}
```

## Testing Checklist

- [ ] Upload image on Shopify page
- [ ] Verify image appears in `uploadopenai` bucket
- [ ] Click "Customize" button redirects to GeniePH
- [ ] Image auto-loads in GeniePH
- [ ] Gemini AI analysis starts automatically
- [ ] Customization page shows analysis results
- [ ] User can edit design
- [ ] Add to cart works
- [ ] Checkout flow completes
- [ ] Order appears in database

## Rollback Plan

If integration causes issues:

1. Comment out redirect button in Shopify page
2. Users continue using systems separately
3. No data loss (both systems independent)

## Future Enhancements

1. **Bi-directional Sync**: Update Shopify when GeniePH customization completes
2. **SSO Integration**: Single login across both platforms
3. **Unified Cart**: Merge Shopify and GeniePH carts
4. **Analytics Dashboard**: Track conversion from Shopify → GeniePH
5. **Webhook Integration**: Real-time updates between systems

## Environment Variables

Make sure these are set in your GeniePH app:

```env
VITE_SUPABASE_URL=https://congofivupobtfudnhni.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GEMINI_API_KEY=your_gemini_api_key
```

## Support Contact

- Shopify store: cakesandmemories.com
- GeniePH app: yourdomain.com
- Supabase project: congofivupobtfudnhni

## Questions & Troubleshooting

**Q: Why redirect instead of embedding?**
A: Shopify has limitations on embedded apps. Redirect provides full functionality.

**Q: Will this work on mobile?**
A: Yes, the redirect flow works on all devices.

**Q: Can users go back to Shopify?**
A: Yes, they can use browser back button or provide a "Back to Store" link.

**Q: What about SEO?**
A: The Shopify page retains its SEO. GeniePH should have proper meta tags.
