# Shopify Integration - Hash Routing Implementation

## Overview
This implementation is specifically designed for your hash-based routing system (`/#/customizing`).

---

## File 1: Update Shopify Page Script

**Location:** Shopify Liquid template for `/pages/cake-price-calculator`

**Find this section (around line 380):**
```javascript
const { data: urlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(upData.path);
lastPublicUrl = urlData.publicUrl;
status.innerHTML = `✅ Uploaded!<br><img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;" alt="Uploaded cake design" />`;
```

**Replace with:**
```javascript
const { data: urlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(upData.path);
lastPublicUrl = urlData.publicUrl;

// Show upload success with customization button
status.innerHTML = `
  ✅ Image uploaded successfully!<br>
  <img src="${lastPublicUrl}" style="max-width:60%;margin-top:1rem;border-radius:8px;" alt="Uploaded cake design" />
  <div style="margin-top:1.5rem;display:flex;flex-direction:column;gap:0.75rem;">
    <button id="customize-cake-btn" class="btn" style="width:100%;font-size:1rem;padding:0.75rem;">
      🎨 Customize Your Cake Design with AI
    </button>
    <p style="font-size:0.85rem;color:#666;margin:0;">
      Get full AI analysis, edit colors, toppers, and messages!
    </p>
  </div>
`;

// Add event listener to the customize button
const customizeBtn = document.getElementById('customize-cake-btn');
if (customizeBtn) {
  customizeBtn.addEventListener('click', () => {
    // Encode the image URL and rowId for safe transmission
    const encodedUrl = encodeURIComponent(lastPublicUrl);
    const encodedRowId = encodeURIComponent(currentRowId || '');

    // Build the redirect URL to your GeniePH app with hash routing
    // IMPORTANT: Replace 'https://yourgeniephapp.com' with your actual GeniePH domain
    const geniephUrl = `https://yourgeniephapp.com/?image=${encodedUrl}&source=shopify&shopify_rowid=${encodedRowId}`;

    // Redirect to GeniePH app
    window.location.href = geniephUrl;

    // Alternative: Open in new tab (uncomment if preferred)
    // window.open(geniephUrl, '_blank');
  });
}
```

**⚠️ Important:**
- Replace `https://yourgeniephapp.com` with your actual domain (e.g., `https://genieph.vercel.app`)
- The URL format is: `https://yourdomain.com/?image={URL}&source=shopify`
- NO hash in the initial redirect - your app will handle the hash routing internally

---

## File 2: Update `src/App.tsx`

**File:** `/Users/apcaballes/genieph/src/App.tsx`

**Add this useEffect hook inside the App component, after line 167 (after the useDesignSharing hook declaration):**

```typescript
// ========================================
// SHOPIFY INTEGRATION: Detect redirect with image parameter
// ========================================
useEffect(() => {
  // Check for Shopify redirect parameters in the URL (before hash)
  const urlParams = new URLSearchParams(window.location.search);
  const imageUrl = urlParams.get('image');
  const source = urlParams.get('source');
  const shopifyRowId = urlParams.get('shopify_rowid');

  if (imageUrl && source === 'shopify') {
    console.log('🛍️ Shopify redirect detected');
    console.log('Image URL:', imageUrl);
    console.log('Shopify Row ID:', shopifyRowId);

    // Store data in sessionStorage for the customization page to use
    sessionStorage.setItem('shopify_image_url', decodeURIComponent(imageUrl));
    if (shopifyRowId) {
      sessionStorage.setItem('shopify_rowid', decodeURIComponent(shopifyRowId));
    }

    // Navigate to customization page using hash routing
    window.location.hash = '#/customizing';

    // Clean up URL parameters (remove them from address bar)
    // Use replaceState to remove query params while keeping the hash
    const cleanUrl = `${window.location.origin}${window.location.pathname}#/customizing`;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}, []); // Run once on mount

// ========================================
// END SHOPIFY INTEGRATION
// ========================================
```

**Where to add it:**
1. Find the line with `const { shareDesign, deleteSharedDesign, isSharing, shareError } = useDesignSharing();`
2. Add the Shopify integration useEffect **after** that line
3. Make sure it's **before** any return statements or page rendering logic

---

## File 3: Update `src/app/customizing/page.tsx`

**File:** `/Users/apcaballes/genieph/src/app/customizing/page.tsx`

**Add this useEffect hook near the top of the component (after the useEffect for scroll restoration, around line 80-90):**

```typescript
// ========================================
// SHOPIFY INTEGRATION: Auto-load image from Shopify redirect
// ========================================
useEffect(() => {
  const shopifyImageUrl = sessionStorage.getItem('shopify_image_url');
  const shopifyRowId = sessionStorage.getItem('shopify_rowid');

  // Only auto-load if we have a Shopify image URL and haven't analyzed yet
  if (shopifyImageUrl && !analysisResult && !isAnalyzing) {
    console.log('🎨 Auto-loading Shopify image for customization');

    // Show loading toast
    toast.loading('Loading your Shopify design...', { id: 'shopify-load' });

    // Fetch the image and convert to File object
    fetch(shopifyImageUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        return response.blob();
      })
      .then(blob => {
        // Create a File object from the blob
        const file = new File([blob], 'shopify-cake-design.jpg', { type: blob.type });

        // Trigger the image upload analysis using the existing hook
        handleImageUpload(
          file,
          (result) => {
            // Success callback
            console.log('✅ Shopify image analyzed successfully');
            toast.success('Design loaded and analyzed!', { id: 'shopify-load' });

            // Store Shopify reference for analytics or tracking
            if (shopifyRowId) {
              console.log('Shopify Row ID for tracking:', shopifyRowId);
              // You can track this in analytics or save it for later use
            }
          },
          (error) => {
            // Error callback
            console.error('❌ Failed to analyze Shopify image:', error);
            toast.error('Failed to analyze design. Please try uploading again.', { id: 'shopify-load' });
          },
          {
            imageUrl: shopifyImageUrl, // Pass the URL for caching
          }
        );

        // Clear sessionStorage after loading (prevent re-loading on page refresh)
        sessionStorage.removeItem('shopify_image_url');
        sessionStorage.removeItem('shopify_rowid');
      })
      .catch(error => {
        console.error('❌ Failed to fetch Shopify image:', error);
        toast.error('Failed to load image from Shopify. Please try uploading again.', { id: 'shopify-load' });

        // Clear storage on error
        sessionStorage.removeItem('shopify_image_url');
        sessionStorage.removeItem('shopify_rowid');
      });
  }
}, [analysisResult, isAnalyzing, handleImageUpload]); // Dependencies to prevent re-runs

// ========================================
// END SHOPIFY INTEGRATION
// ========================================
```

**Where to add it:**
1. Look for existing `useEffect` hooks near the top of the component
2. Add this **after** the scroll restoration useEffect (if there is one)
3. Make sure it's **before** the main return/JSX rendering

---

## File 4: Enhanced Loading State (Optional but Recommended)

**File:** `/Users/apcaballes/genieph/src/app/customizing/page.tsx`

**Add this state variable near the top of the component:**

```typescript
// Shopify integration loading state
const [isLoadingShopifyImage, setIsLoadingShopifyImage] = useState(false);
```

**Then update the Shopify useEffect to use this state:**

```typescript
useEffect(() => {
  const shopifyImageUrl = sessionStorage.getItem('shopify_image_url');
  const shopifyRowId = sessionStorage.getItem('shopify_rowid');

  if (shopifyImageUrl && !analysisResult && !isAnalyzing && !isLoadingShopifyImage) {
    console.log('🎨 Auto-loading Shopify image for customization');

    // Set loading state
    setIsLoadingShopifyImage(true);
    toast.loading('Loading your Shopify design...', { id: 'shopify-load' });

    fetch(shopifyImageUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        const file = new File([blob], 'shopify-cake-design.jpg', { type: blob.type });

        handleImageUpload(
          file,
          (result) => {
            console.log('✅ Shopify image analyzed successfully');
            toast.success('Design loaded! Start customizing below.', { id: 'shopify-load' });
            setIsLoadingShopifyImage(false);
          },
          (error) => {
            console.error('❌ Failed to analyze Shopify image:', error);
            toast.error('Failed to analyze design. Please try uploading again.', { id: 'shopify-load' });
            setIsLoadingShopifyImage(false);
          },
          { imageUrl: shopifyImageUrl }
        );

        sessionStorage.removeItem('shopify_image_url');
        sessionStorage.removeItem('shopify_rowid');
      })
      .catch(error => {
        console.error('❌ Failed to fetch Shopify image:', error);
        toast.error('Failed to load image from Shopify', { id: 'shopify-load' });
        setIsLoadingShopifyImage(false);

        sessionStorage.removeItem('shopify_image_url');
        sessionStorage.removeItem('shopify_rowid');
      });
  }
}, [analysisResult, isAnalyzing, isLoadingShopifyImage, handleImageUpload]);
```

**Add this JSX near the top of the component return (before the main content):**

```tsx
{/* Shopify image loading overlay */}
{isLoadingShopifyImage && (
  <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center">
    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md text-center animate-fade-in">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-pink-200"></div>
        <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin"></div>
      </div>
      <h3 className="text-xl font-semibold mb-2 text-gray-800">Loading from Shopify</h3>
      <p className="text-gray-600 mb-4">Analyzing your cake design with AI...</p>
      <div className="flex items-center justify-center gap-2 text-sm text-pink-600">
        <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span>This will only take a moment</span>
      </div>
    </div>
  </div>
)}
```

---

## File 5: Optional - Add "Back to Shopify Store" Link

**File:** `/Users/apcaballes/genieph/src/app/customizing/page.tsx`

**Add this constant near the top:**

```typescript
const SHOPIFY_STORE_URL = 'https://www.cakesandmemories.com/pages/cake-price-calculator';
```

**Add this JSX in your header/navigation area:**

```tsx
{/* Show "Back to Store" link if user came from Shopify */}
{sessionStorage.getItem('came_from_shopify') && (
  <div className="mb-4 p-3 bg-pink-50 border border-pink-200 rounded-lg flex items-center justify-between">
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
      <span>From: <strong>Cakes & Memories</strong></span>
    </div>
    <a
      href={SHOPIFY_STORE_URL}
      className="flex items-center gap-1 text-pink-600 hover:text-pink-700 font-medium text-sm transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      Back to Store
    </a>
  </div>
)}
```

**Update the Shopify loading useEffect to set the flag:**

```typescript
if (shopifyImageUrl && !analysisResult && !isAnalyzing) {
  // Set flag that user came from Shopify
  sessionStorage.setItem('came_from_shopify', 'true');

  // ... rest of the code
}
```

---

## File 6: Database Tracking (Optional)

**Create Supabase Migration:**

```sql
-- Migration: Add Shopify tracking to cart_items table
ALTER TABLE cart_items
ADD COLUMN IF NOT EXISTS shopify_rowid UUID,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'genieph';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cart_items_shopify_rowid ON cart_items(shopify_rowid);
CREATE INDEX IF NOT EXISTS idx_cart_items_source ON cart_items(source);

-- Create linking table for bi-directional sync (optional)
CREATE TABLE IF NOT EXISTS shopify_genieph_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_rowid UUID,
  genieph_cart_item_id UUID REFERENCES cart_items(id) ON DELETE CASCADE,
  shopify_image_url TEXT,
  genieph_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shopify_links_shopify_rowid ON shopify_genieph_links(shopify_rowid);
CREATE INDEX IF NOT EXISTS idx_shopify_links_cart_item ON shopify_genieph_links(genieph_cart_item_id);

-- Add comment for documentation
COMMENT ON TABLE shopify_genieph_links IS 'Links Shopify price calculator uploads to GeniePH customizations';
```

**Update your cart add function to include Shopify tracking:**

Find where you add items to cart (likely in `CartContext.tsx` or where `addToCartOptimistic` is called):

```typescript
// Get Shopify reference from sessionStorage
const shopifyRowId = sessionStorage.getItem('shopify_rowid');

const cartItem = {
  // ... existing fields
  shopify_rowid: shopifyRowId || null,
  source: shopifyRowId ? 'shopify' : 'genieph',
  // ... rest of fields
};

// Clear the Shopify reference after adding to cart
if (shopifyRowId) {
  sessionStorage.removeItem('shopify_rowid');
  sessionStorage.removeItem('came_from_shopify');
}
```

---

## Testing with Hash Routing

### Local Testing URLs

1. **Shopify redirect simulation:**
   ```
   http://localhost:5173/?image=https://example.com/cake.jpg&source=shopify
   ```

2. **Expected behavior:**
   - URL changes to: `http://localhost:5173/#/customizing`
   - sessionStorage contains `shopify_image_url`
   - Image auto-loads on customization page
   - AI analysis starts automatically

### Production URLs

1. **Shopify redirect:**
   ```
   https://genieph.vercel.app/?image={ENCODED_URL}&source=shopify&shopify_rowid={ID}
   ```

2. **After processing:**
   ```
   https://genieph.vercel.app/#/customizing
   ```

---

## Hash Routing Flow Diagram

```
Shopify Page
     │
     │ 1. Upload image to Supabase
     ↓
Get public URL: https://supabase.co/.../image.webp
     │
     │ 2. Click "Customize with AI" button
     ↓
Redirect: https://genieph.app/?image={URL}&source=shopify
     │
     ↓
─────────────────────────────────────────────────────
GeniePH App - App.tsx useEffect (runs on mount)
─────────────────────────────────────────────────────
     │
     │ 3. Detect query params: ?image=...&source=shopify
     ↓
Store in sessionStorage:
  - shopify_image_url
  - shopify_rowid
     │
     │ 4. Change hash routing: window.location.hash = '#/customizing'
     ↓
URL becomes: https://genieph.app/#/customizing
     │
     ↓
─────────────────────────────────────────────────────
GeniePH App - Customizing Page useEffect
─────────────────────────────────────────────────────
     │
     │ 5. Detect sessionStorage.shopify_image_url
     ↓
Fetch image from URL
     │
     │ 6. Convert blob to File object
     ↓
Call handleImageUpload(file)
     │
     ↓
─────────────────────────────────────────────────────
Gemini AI Analysis (from useImageManagement hook)
─────────────────────────────────────────────────────
     │
     │ 7. Phase 1: Fast features analysis (7-10s)
     ↓
Display results to user
     │
     │ 8. Phase 2: Background coordinate enrichment
     ↓
Update UI with precise coordinates
     │
     ↓
User can now customize design
```

---

## Common Issues & Solutions

### Issue 1: Redirect doesn't work
**Symptoms:** Clicking Shopify button does nothing or goes to wrong page

**Debug:**
```javascript
// In browser console after clicking button
console.log(window.location.href);
// Should show: https://genieph.app/?image=...&source=shopify
```

**Fix:** Verify GeniePH URL in Shopify script is correct

---

### Issue 2: Image doesn't auto-load
**Symptoms:** User arrives at customization page but no image loads

**Debug:**
```javascript
// In browser console on customization page
console.log(sessionStorage.getItem('shopify_image_url'));
// Should show the image URL
```

**Fix:**
- Check App.tsx useEffect is running (add console.log)
- Verify sessionStorage is being set
- Check if hash routing is working: `window.location.hash === '#/customizing'`

---

### Issue 3: Hash routing conflict
**Symptoms:** URL shows `/#/?image=...` instead of `/#/customizing`

**Fix:** Ensure you're setting `window.location.hash` and NOT using `window.location.href` for internal navigation

---

### Issue 4: Double hash in URL
**Symptoms:** URL shows `##` or `#/#/customizing`

**Fix:** Make sure Shopify redirect URL doesn't include a hash:
```javascript
// ✅ Correct
const url = 'https://genieph.app/?image=...';

// ❌ Wrong
const url = 'https://genieph.app/#/?image=...';
```

---

### Issue 5: sessionStorage cleared too early
**Symptoms:** Page refresh loses Shopify data

**Fix:** Only clear sessionStorage AFTER successful image load:
```typescript
// ✅ Correct - clear after loading
handleImageUpload(file, (result) => {
  sessionStorage.removeItem('shopify_image_url'); // Clear here
});

// ❌ Wrong - don't clear before loading
sessionStorage.removeItem('shopify_image_url');
handleImageUpload(file, ...);
```

---

## Deployment Checklist

- [ ] Update Shopify page with production GeniePH URL
- [ ] Test redirect flow on staging environment
- [ ] Verify hash routing works: `/#/customizing`
- [ ] Test on mobile devices
- [ ] Verify sessionStorage persists during navigation
- [ ] Test with different image formats (JPG, PNG, WEBP)
- [ ] Check browser console for errors
- [ ] Verify Gemini API analysis works
- [ ] Test cart add with Shopify tracking
- [ ] Monitor error logs after deployment

---

## Analytics Tracking (Optional)

Add tracking to measure success:

```typescript
// In App.tsx after detecting Shopify redirect
if (imageUrl && source === 'shopify') {
  // Track redirect event
  gtag?.('event', 'shopify_redirect', {
    event_category: 'integration',
    event_label: 'shopify_to_genieph',
    value: 1
  });
}

// In customizing page after successful analysis
handleImageUpload(file, (result) => {
  gtag?.('event', 'shopify_image_analyzed', {
    event_category: 'integration',
    event_label: 'analysis_success',
    cake_type: result.cakeType
  });
});

// When adding to cart
gtag?.('event', 'shopify_add_to_cart', {
  event_category: 'integration',
  event_label: 'conversion',
  value: finalPrice
});
```

---

## Summary

This implementation ensures:
✅ Seamless redirect from Shopify to GeniePH
✅ Hash routing compatibility (`/#/customizing`)
✅ Automatic image loading and AI analysis
✅ Clean URL management
✅ Error handling and fallbacks
✅ Optional database tracking
✅ Mobile-friendly

**Total Implementation Time:** 20-30 minutes
**Difficulty:** Easy
**Risk:** Low (independent systems)
